/**
 * @atlas-world/sdk — PlayerClient
 * Operaciones sobre players: mintear y obtener.
 */

import { PublicKey, SystemProgram } from '@solana/web3.js'
import {
  Player,
  MintPlayerParams,
  getWorldConfigPDA,
  getPlayerPDA,
  parseError,
} from '@atlas-world/core'
import type { AtlasClient } from './AtlasClient'

export class PlayerClient {
  private client: AtlasClient

  constructor(client: AtlasClient) {
    this.client = client
  }

  /**
   * Mintea un Player en un mundo público.
   * Una wallet puede tener un Player por mundo.
   *
   * @example
   * const result = await atlas.player.mint({
   *   worldId: 0,
   *   name: 'Hero',
   *   metadataUri: 'https://gateway.irys.xyz/...'
   * })
   */
  async mint(params: MintPlayerParams): Promise<{
    signature: string
    playerPDA: PublicKey
  }> {
    const { program, programId } = this.client
    const owner = (program.provider as any).wallet.publicKey

    const [worldConfigPDA] = getWorldConfigPDA(params.worldId, programId)
    const [playerPDA] = getPlayerPDA(params.worldId, owner, programId)

    const metadataUri = params.metadataUri ?? this._defaultMetadataUri(params.name)

    try {
      const signature = await (program.methods as any)
        .mintPlayer(params.name, metadataUri)
        .accounts({
          worldConfig: worldConfigPDA,
          player: playerPDA,
          owner,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      return { signature, playerPDA }
    } catch (err) {
      throw parseError(err)
    }
  }

  /**
   * Mintea un Player en un mundo privado (verifica whitelist).
   */
  async mintPrivate(params: MintPlayerParams): Promise<{
    signature: string
    playerPDA: PublicKey
  }> {
    const { program, programId } = this.client
    const owner = (program.provider as any).wallet.publicKey

    const [worldConfigPDA] = getWorldConfigPDA(params.worldId, programId)
    const [playerPDA] = getPlayerPDA(params.worldId, owner, programId)

    // Derivar whitelist PDA
    const worldIdBuf = Buffer.alloc(8)
    worldIdBuf.writeBigUInt64LE(BigInt(params.worldId))
    const [whitelistPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('whitelist'), worldIdBuf],
      programId
    )

    const metadataUri = params.metadataUri ?? this._defaultMetadataUri(params.name)

    try {
      const signature = await (program.methods as any)
        .mintPlayerPrivate(params.name, metadataUri)
        .accounts({
          worldConfig: worldConfigPDA,
          player: playerPDA,
          whitelist: whitelistPDA,
          owner,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      return { signature, playerPDA }
    } catch (err) {
      throw parseError(err)
    }
  }

  /**
   * Obtiene el Player de la wallet conectada en un mundo específico.
   */
  async get(worldId: number, owner?: PublicKey): Promise<Player | null> {
    const { program, programId } = this.client
    const ownerKey = owner ?? (program.provider as any).wallet.publicKey

    try {
      const [playerPDA] = getPlayerPDA(worldId, ownerKey, programId)
      const raw = await (program.account as any).player.fetch(playerPDA)
      return this._parse(raw)
    } catch {
      return null
    }
  }

  /**
   * Verifica si una wallet tiene un Player en un mundo.
   */
  async exists(worldId: number, owner?: PublicKey): Promise<boolean> {
    const player = await this.get(worldId, owner)
    return player !== null
  }

  private _parse(raw: any): Player {
    return {
      worldId: Number(raw.worldId),
      owner: raw.owner.toBase58(),
      name: raw.name,
      metadataUri: raw.metadataUri,
      level: Number(raw.level),
      resourcesCollected: Number(raw.resourcesCollected),
      lastCollectTime: Number(raw.lastCollectTime),
      currentEpoch: Number(raw.currentEpoch),
      dailyCollectCount: Number(raw.dailyCollectCount),
      dailyWindowStartedAt: Number(raw.dailyWindowStartedAt),
      bump: raw.bump,
    }
  }

  private _defaultMetadataUri(name: string): string {
    return `https://gateway.irys.xyz/atlas-player-${name.toLowerCase()}`
  }
}
