/**
 * @atlas-world/sdk — WorldClient
 * Operaciones sobre mundos: crear, obtener, suscribirse a eventos.
 */

import { PublicKey, SystemProgram } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import {
  WorldConfig,
  WorldState,
  World,
  WorldType,
  WorldVisibility,
  CreateWorldParams,
  WorldCreatedEvent,
  WorldResetEvent,
  parseDuration,
  worldProgress,
  epochSecondsRemaining,
  getGlobalConfigPDA,
  getWorldConfigPDA,
  getWorldStatePDA,
  parseError,
} from '@atlas-world/core'
import type { AtlasClient } from './AtlasClient'

export class WorldClient {
  private client: AtlasClient

  constructor(client: AtlasClient) {
    this.client = client
  }

  /**
   * Crea un nuevo mundo en el protocolo Atlas.
   *
   * @example GameFi
   * await atlas.world.create({
   *   name: 'Mi Juego',
   *   worldType: WorldType.Gaming,
   *   visibility: WorldVisibility.Public,
   *   totalResources: 500,
   *   epochDuration: '7d',
   *   resourceTypes: [
   *     { id: 0, name: 'common', points: 1,  cooldownSeconds: 5  },
   *     { id: 1, name: 'rare',   points: 3,  cooldownSeconds: 10 },
   *     { id: 2, name: 'epic',   points: 5,  cooldownSeconds: 30 },
   *   ]
   * })
   */
  async create(params: CreateWorldParams): Promise<{
    worldId: number
    signature: string
    worldConfigPDA: PublicKey
  }> {
    const { program, programId, connection } = this.client

    const [globalConfigPDA] = getGlobalConfigPDA(programId)

    // Obtener el world_id que se asignará (= world_count actual)
    const globalConfig = await (program.account as any).globalConfig.fetch(
      globalConfigPDA
    )
    const worldId = Number(globalConfig.worldCount)

    const [worldConfigPDA] = getWorldConfigPDA(worldId, programId)
    const [worldStatePDA] = getWorldStatePDA(worldId, 0, programId)

    const epochDurationSeconds = parseDuration(params.epochDuration)

    try {
      const signature = await (program.methods as any)
        .createWorld(
          params.name,
          this._serializeWorldType(params.worldType),
          this._serializeVisibility(params.visibility),
          new BN(params.totalResources),
          new BN(epochDurationSeconds),
          new BN(params.globalCooldown ?? 5),
          params.resourceTypes.map(rt => ({
            id: rt.id,
            name: rt.name,
            points: new BN(rt.points),
            cooldownSeconds: new BN(rt.cooldownSeconds),
          }))
        )
        .accounts({
          globalConfig: globalConfigPDA,
          worldConfig: worldConfigPDA,
          worldState: worldStatePDA,
          treasury: new PublicKey(globalConfig.treasury),
          authority: (program.provider as any).wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      return { worldId, signature, worldConfigPDA }
    } catch (err) {
      throw parseError(err)
    }
  }

  /**
   * Obtiene el estado completo de un mundo (config + state combinados).
   */
  async get(worldId: number): Promise<World | null> {
    const { program, programId } = this.client

    try {
      const [worldConfigPDA] = getWorldConfigPDA(worldId, programId)
      const configRaw = await (program.account as any).worldConfig.fetch(worldConfigPDA)
      const config = this._parseConfig(configRaw)

      const [worldStatePDA] = getWorldStatePDA(worldId, config.currentEpoch, programId)
      const stateRaw = await (program.account as any).worldState.fetch(worldStatePDA)
      const state = this._parseState(stateRaw)

      const progress = worldProgress(state.resourcesCollected, config.totalResources)
      const exhausted = state.resourcesCollected >= config.totalResources
      const secondsRemaining = epochSecondsRemaining(state.startedAt, config.epochDuration)

      return { config, state, progress, exhausted, secondsRemaining }
    } catch {
      return null
    }
  }

  /**
   * Lista todos los mundos del protocolo.
   * Obtiene el total desde GlobalConfig y los fetcha en paralelo.
   */
  async list(): Promise<World[]> {
    const { program, programId } = this.client

    try {
      const [globalConfigPDA] = getGlobalConfigPDA(programId)
      const globalConfig = await (program.account as any).globalConfig.fetch(globalConfigPDA)
      const worldCount = Number(globalConfig.worldCount)

      const worlds = await Promise.all(
        Array.from({ length: worldCount }, (_, i) => this.get(i))
      )

      return worlds.filter((w): w is World => w !== null)
    } catch {
      return []
    }
  }

  /**
   * Se suscribe a eventos de un mundo en tiempo real.
   * Retorna una función para cancelar la suscripción.
   */
  subscribe(
    worldId: number,
    handlers: {
      onResourceCollected?: (event: WorldResetEvent) => void
      onWorldReset?: (event: WorldResetEvent) => void
    }
  ): () => void {
    const { program } = this.client
    const listeners: number[] = []

    if (handlers.onWorldReset) {
      const id = program.addEventListener('WorldReset', (event: any) => {
        if (Number(event.worldId) === worldId) {
          handlers.onWorldReset!({
            worldId: Number(event.worldId),
            completedEpoch: Number(event.completedEpoch),
            newEpoch: Number(event.newEpoch),
            winner: event.winner.toBase58(),
            totalCollected: Number(event.totalCollected),
          })
        }
      })
      listeners.push(id)
    }

    // Retorna función de cleanup
    return () => {
      listeners.forEach(id => program.removeEventListener(id))
    }
  }

  // ─── Helpers privados ───────────────────────────────────────────────────────

  private _parseConfig(raw: any): WorldConfig {
    return {
      worldId: Number(raw.worldId),
      authority: raw.authority.toBase58(),
      name: raw.name,
      worldType: Number(raw.worldType) as WorldType,
      visibility: Number(raw.visibility) as WorldVisibility,
      totalResources: Number(raw.totalResources),
      epochDuration: Number(raw.epochDuration),
      globalCooldown: Number(raw.globalCooldown),
      resourceTypes: raw.resourceTypes.map((rt: any) => ({
        id: rt.id,
        name: rt.name,
        points: Number(rt.points),
        cooldownSeconds: Number(rt.cooldownSeconds),
      })),
      currentEpoch: Number(raw.currentEpoch),
      bump: raw.bump,
    }
  }

  private _parseState(raw: any): WorldState {
    return {
      worldId: Number(raw.worldId),
      epoch: Number(raw.epoch),
      resourcesCollected: Number(raw.resourcesCollected),
      startedAt: Number(raw.startedAt),
      bump: raw.bump,
    }
  }

  private _serializeWorldType(type: WorldType): object {
    const map = {
      [WorldType.Gaming]: { gaming: {} },
      [WorldType.Defi]: { defi: {} },
      [WorldType.Dao]: { dao: {} },
      [WorldType.Marketplace]: { marketplace: {} },
      [WorldType.Custom]: { custom: {} },
    }
    return map[type]
  }

  private _serializeVisibility(visibility: WorldVisibility): object {
    return visibility === WorldVisibility.Public
      ? { public: {} }
      : { private: {} }
  }
}
