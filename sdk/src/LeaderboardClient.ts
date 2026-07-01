/**
 * @atlas-world/sdk — LeaderboardClient
 * Lectura del leaderboard — actual e histórico.
 */

import {
  Leaderboard,
  LeaderboardEntry,
  getWorldConfigPDA,
  getLeaderboardPDA,
  parseError,
} from '@atlas-world/core'
import type { AtlasClient } from './AtlasClient'

export interface LeaderboardGetParams {
  /** Si se omite, usa el epoch actual */
  epoch?: number
}

export class LeaderboardClient {
  private client: AtlasClient

  constructor(client: AtlasClient) {
    this.client = client
  }

  /**
   * Obtiene el leaderboard de un mundo.
   * Por defecto usa el epoch actual. Pasa epoch para ver historial.
   *
   * @example
   * // Leaderboard actual
   * const lb = await atlas.leaderboard.get(worldId)
   *
   * // Leaderboard histórico del epoch 3
   * const lb = await atlas.leaderboard.get(worldId, { epoch: 3 })
   */
  async get(
    worldId: number,
    params: LeaderboardGetParams = {}
  ): Promise<Leaderboard | null> {
    const { program, programId } = this.client

    try {
      let epoch = params.epoch

      // Si no se especifica epoch, obtener el actual del WorldConfig
      if (epoch === undefined) {
        const [worldConfigPDA] = getWorldConfigPDA(worldId, programId)
        const worldConfig = await (program.account as any).worldConfig.fetch(worldConfigPDA)
        epoch = Number(worldConfig.currentEpoch)
      }

      const [leaderboardPDA] = getLeaderboardPDA(worldId, epoch, programId)
      const raw = await (program.account as any).leaderboard.fetch(leaderboardPDA)

      return {
        worldId: Number(raw.worldId),
        epoch: Number(raw.epoch),
        entries: raw.entries.map((e: any): LeaderboardEntry => ({
          owner: e.owner.toBase58(),
          name: e.name,
          resourcesCollected: Number(e.resourcesCollected),
          level: Number(e.level),
        })),
        bump: raw.bump,
      }
    } catch {
      return null
    }
  }

  /**
   * Obtiene el historial de leaderboards de un mundo (todos los epochs).
   */
  async history(worldId: number): Promise<Leaderboard[]> {
    const { program, programId } = this.client

    try {
      const [worldConfigPDA] = getWorldConfigPDA(worldId, programId)
      const worldConfig = await (program.account as any).worldConfig.fetch(worldConfigPDA)
      const currentEpoch = Number(worldConfig.currentEpoch)

      const leaderboards = await Promise.all(
        Array.from({ length: currentEpoch + 1 }, (_, epoch) =>
          this.get(worldId, { epoch })
        )
      )

      return leaderboards.filter((lb): lb is Leaderboard => lb !== null)
    } catch {
      return []
    }
  }

  /**
   * Obtiene la posición de una wallet en el leaderboard actual.
   * Retorna null si no está en el top 25.
   */
  async getPosition(
    worldId: number,
    walletAddress: string
  ): Promise<{ position: number; entry: LeaderboardEntry } | null> {
    const lb = await this.get(worldId)
    if (!lb) return null

    const index = lb.entries.findIndex(e => e.owner === walletAddress)
    if (index === -1) return null

    return {
      position: index + 1,
      entry: lb.entries[index],
    }
  }
}
