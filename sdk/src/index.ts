/**
 * @atlas-world/sdk
 *
 * SDK para construir mundos persistentes en Solana.
 * Especializado para GameFi y Web3 Gaming — v1.0
 *
 * @example
 * import { AtlasClient, WorldType, WorldVisibility } from '@atlas-world/sdk'
 *
 * const atlas = new AtlasClient({ network: 'devnet', wallet })
 *
 * // Crear un mundo
 * const { worldId } = await atlas.world.create({
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
 *
 * // Mintear un player
 * await atlas.player.mint({ worldId, name: 'Hero' })
 *
 * // Recolectar un recurso
 * const result = await atlas.resource.collect({ worldId, resourceTypeId: 0 })
 * console.log(`+${result.points} puntos`)
 */

export { AtlasClient } from './AtlasClient'
export type { AtlasClientConfig } from './AtlasClient'
export { WorldClient } from './WorldClient'
export { PlayerClient } from './PlayerClient'
export { ResourceClient } from './ResourceClient'
export type { CollectParams } from './ResourceClient'
export { LeaderboardClient } from './LeaderboardClient'
export type { LeaderboardGetParams } from './LeaderboardClient'
export { WORLD_TEMPLATES } from '@atlas-world/core'
export type { WorldTemplate, WorldTemplateName } from '@atlas-world/core'

// Re-exportar tipos del core para que los devs solo necesiten importar de @atlas-world/sdk
export {
  WorldType,
  WorldVisibility,
  parseError,
  parseDuration,
  worldProgress,
  epochSecondsRemaining,
  calculateLevel,
  abbreviateAddress,
  lamportsToSol,
} from '@atlas-world/core'

export type {
  ResourceType,
  WorldConfig,
  WorldState,
  World,
  Player,
  Leaderboard,
  LeaderboardEntry,
  CreateWorldParams,
  MintPlayerParams,
  CollectResult,
  AtlasError,
  AtlasNetwork,
  ResourceCollectedEvent,
  WorldResetEvent,
  PlayerMintedEvent,
} from '@atlas-world/core'
