import { WorldType } from './types'
import type { ResourceType } from './types'

/**
 * Templates de configuración por narrativa. Cada uno define resourceTypes,
 * duración de epoch y cooldown global sensatos para ese caso de uso.
 *
 * Usados por @atlas-world/cli (menú interactivo), @atlas-world/mcp
 * (referencia para agentes AI), y cualquier developer que use el SDK
 * directo y quiera un punto de partida en vez de diseñar desde cero.
 *
 * @example
 * import { WORLD_TEMPLATES } from '@atlas-world/sdk'
 *
 * const template = WORLD_TEMPLATES.dao
 * await atlas.world.create({
 *   name: 'Mi DAO',
 *   worldType: WorldType.Dao,
 *   visibility: WorldVisibility.Public,
 *   totalResources: 100,
 *   ...template, // epochDuration, globalCooldown, resourceTypes
 * })
 */
export interface WorldTemplate {
  worldType: WorldType
  description: string
  epochDuration: string
  globalCooldown: number
  maxDailyCollects: number
  resourceTypes: ResourceType[]
}

export const WORLD_TEMPLATES: Record<string, WorldTemplate> = {
  gaming: {
    worldType: WorldType.Gaming,
    description: 'Recolecta de recursos con niveles y leaderboard — el caso base de GameFi.',
    epochDuration: '7d',
    globalCooldown: 5,
    maxDailyCollects: 0,
    resourceTypes: [
      { id: 0, name: 'common', points: 1, cooldownSeconds: 5 },
      { id: 1, name: 'rare', points: 3, cooldownSeconds: 10 },
      { id: 2, name: 'epic', points: 5, cooldownSeconds: 30 },
    ],
  },

  dao: {
    worldType: WorldType.Dao,
    description: 'Votos y propuestas como recursos con cooldown — epochs alineados a ciclos de gobernanza.',
    epochDuration: '30d',
    globalCooldown: 3600,
    maxDailyCollects: 5,
    resourceTypes: [
      { id: 0, name: 'vote', points: 1, cooldownSeconds: 86400 },
      { id: 1, name: 'proposal', points: 10, cooldownSeconds: 604800 },
      { id: 2, name: 'veto', points: 5, cooldownSeconds: 172800 },
    ],
  },

  marketplace: {
    worldType: WorldType.Marketplace,
    description: 'Listings y features destacados con ranking diario — sin base de datos central.',
    epochDuration: '1d',
    globalCooldown: 60,
    maxDailyCollects: 20,
    resourceTypes: [
      { id: 0, name: 'listing', points: 1, cooldownSeconds: 3600 },
      { id: 1, name: 'featured', points: 5, cooldownSeconds: 86400 },
    ],
  },

  defi: {
    worldType: WorldType.Defi,
    description: 'Depósitos y staking modelados como recolectas — rate limiting anti-sybil nativo para liquidity mining.',
    epochDuration: '14d',
    globalCooldown: 3600,
    maxDailyCollects: 4,
    resourceTypes: [
      { id: 0, name: 'lp_deposit', points: 1, cooldownSeconds: 3600 },
      { id: 1, name: 'stake', points: 3, cooldownSeconds: 43200 },
      { id: 2, name: 'long_term_lock', points: 10, cooldownSeconds: 604800 },
    ],
  },

  rwa: {
    worldType: WorldType.Custom,
    description: 'Tokenización de activos reales — cada "recolecta" representa un evento verificable (certificación, custodia, transferencia).',
    epochDuration: '30d',
    globalCooldown: 86400,
    maxDailyCollects: 1,
    resourceTypes: [
      { id: 0, name: 'certification', points: 5, cooldownSeconds: 2592000 },
      { id: 1, name: 'custody_transfer', points: 3, cooldownSeconds: 86400 },
      { id: 2, name: 'audit_confirmed', points: 10, cooldownSeconds: 7776000 },
    ],
  },

  nft_collection: {
    worldType: WorldType.Marketplace,
    description: 'Mint tracking y ranking de holders para una colección NFT — actividad post-mint verificable on-chain.',
    epochDuration: '7d',
    globalCooldown: 300,
    maxDailyCollects: 10,
    resourceTypes: [
      { id: 0, name: 'mint', points: 1, cooldownSeconds: 0 },
      { id: 1, name: 'trade', points: 2, cooldownSeconds: 300 },
      { id: 2, name: 'hold_milestone', points: 5, cooldownSeconds: 604800 },
    ],
  },
}

export type WorldTemplateName = keyof typeof WORLD_TEMPLATES
