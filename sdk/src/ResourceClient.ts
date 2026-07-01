/**
 * @atlas-world/sdk — ResourceClient
 * Recolecta recursos del mundo compartido.
 */

import { PublicKey } from '@solana/web3.js'
import {
  CollectResult,
  ResourceCollectedEvent,
  getWorldConfigPDA,
  getWorldStatePDA,
  getPlayerPDA,
  getLeaderboardPDA,
  parseError,
  calculateLevel,
} from '@atlas-world/core'
import type { AtlasClient } from './AtlasClient'

export interface CollectParams {
  worldId: number
  /** ID del tipo de recurso (0-7) según la configuración del mundo */
  resourceTypeId: number
}

export class ResourceClient {
  private client: AtlasClient

  constructor(client: AtlasClient) {
    this.client = client
  }

  /**
   * Recolecta un recurso del mundo compartido.
   *
   * Verifica on-chain:
   * - Cooldown del tipo de recurso
   * - Mundo no agotado
   * - Tipo de recurso válido para este mundo
   *
   * @example
   * const result = await atlas.resource.collect({
   *   worldId: 0,
   *   resourceTypeId: 1, // 'rare' en este mundo
   * })
   * console.log(`+${result.points} puntos — Nivel ${result.newLevel}`)
   */
  async collect(params: CollectParams): Promise<CollectResult> {
    const { program, programId } = this.client
    const owner = (program.provider as any).wallet.publicKey

    // Obtener el estado actual del mundo para saber el epoch
    const [worldConfigPDA] = getWorldConfigPDA(params.worldId, programId)
    const worldConfig = await (program.account as any).worldConfig.fetch(worldConfigPDA)
    const currentEpoch = Number(worldConfig.currentEpoch)

    const [worldStatePDA] = getWorldStatePDA(params.worldId, currentEpoch, programId)
    const [playerPDA] = getPlayerPDA(params.worldId, owner, programId)
    const [leaderboardPDA] = getLeaderboardPDA(params.worldId, currentEpoch, programId)

    try {
      const signature = await (program.methods as any)
        .collectResource(params.resourceTypeId)
        .accounts({
          worldConfig: worldConfigPDA,
          worldState: worldStatePDA,
          player: playerPDA,
          leaderboard: leaderboardPDA,
          owner,
        })
        .rpc()

      // Fetch estado actualizado post-transacción
      const [updatedPlayer, updatedWorldState] = await Promise.all([
        (program.account as any).player.fetch(playerPDA),
        (program.account as any).worldState.fetch(worldStatePDA),
      ])

      // Obtener info del tipo de recurso
      const resourceType = worldConfig.resourceTypes.find(
        (rt: any) => rt.id === params.resourceTypeId
      )

      const points = Number(resourceType?.points ?? 1)
      const newResourcesCollected = Number(updatedPlayer.resourcesCollected)
      const worldProgress = Number(updatedWorldState.resourcesCollected)
      const totalResources = Number(worldConfig.totalResources)
      const epochEnded = worldProgress >= totalResources

      return {
        signature,
        resourceType: {
          id: params.resourceTypeId,
          name: resourceType?.name ?? 'unknown',
          points,
          cooldownSeconds: Number(resourceType?.cooldownSeconds ?? 5),
        },
        points,
        newLevel: calculateLevel(newResourcesCollected),
        worldProgress,
        epochEnded,
      }
    } catch (err) {
      throw parseError(err)
    }
  }

  /**
   * Se suscribe a eventos de recolecta en tiempo real para un mundo.
   * Útil para actualizar el HUD sin polling.
   * Retorna función de cleanup.
   */
  subscribe(
    worldId: number,
    onCollect: (event: ResourceCollectedEvent) => void
  ): () => void {
    const { program } = this.client

    const listenerId = program.addEventListener(
      'ResourceCollected',
      (event: any) => {
        if (Number(event.worldId) === worldId) {
          onCollect({
            worldId: Number(event.worldId),
            epoch: Number(event.epoch),
            wallet: event.wallet.toBase58(),
            resourceType: event.resourceType,
            points: Number(event.points),
            worldProgress: Number(event.worldProgress),
            totalResources: Number(event.totalResources),
          })
        }
      }
    )

    return () => program.removeEventListener(listenerId)
  }

  /**
   * Calcula el tiempo de espera restante antes de poder recolectar de nuevo.
   * Retorna 0 si ya puede recolectar.
   */
  async cooldownRemaining(
    worldId: number,
    resourceTypeId: number
  ): Promise<number> {
    const { program, programId } = this.client
    const owner = (program.provider as any).wallet.publicKey

    try {
      const [playerPDA] = getPlayerPDA(worldId, owner, programId)
      const [worldConfigPDA] = getWorldConfigPDA(worldId, programId)

      const [player, worldConfig] = await Promise.all([
        (program.account as any).player.fetch(playerPDA),
        (program.account as any).worldConfig.fetch(worldConfigPDA),
      ])

      const lastCollect = Number(player.lastCollectTime)
      const resourceType = worldConfig.resourceTypes.find(
        (rt: any) => rt.id === resourceTypeId
      )
      const cooldown = Number(
        resourceType?.cooldownSeconds > 0
          ? resourceType.cooldownSeconds
          : worldConfig.globalCooldown
      )

      const now = Math.floor(Date.now() / 1000)
      const nextCollect = lastCollect + cooldown
      return Math.max(0, nextCollect - now)
    } catch {
      return 0
    }
  }
}
