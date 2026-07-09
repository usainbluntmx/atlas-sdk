/**
 * @atlas-world/core — Constants
 * Constantes del protocolo Atlas.
 */

/** Program ID del contrato Atlas desplegado en devnet */
export const ATLAS_PROGRAM_ID_DEVNET = '6byM2kmNLLGcrjRcq7ETVvGpxKgoEQuAof44SXe1vEee'

/** Program ID del contrato Atlas en mainnet (cuando esté disponible) */
export const ATLAS_PROGRAM_ID_MAINNET = ''

/** RPC endpoints */
export const RPC_ENDPOINTS = {
  devnet: 'https://api.devnet.solana.com',
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  localnet: 'http://localhost:8899',
} as const

/** Fee para crear un Private World en lamports (0.1 SOL) */
export const PRIVATE_WORLD_FEE = 100_000_000

/** Máximo de tipos de recurso por mundo */
export const MAX_RESOURCE_TYPES = 8

/** Máximo de entries en el leaderboard */
export const MAX_LEADERBOARD_ENTRIES = 25

/** Máximo de miembros en una whitelist por account */
export const MAX_WHITELIST_MEMBERS = 100

/** Cooldown global default en segundos */
export const DEFAULT_GLOBAL_COOLDOWN = 5

/** Seeds de las PDAs del protocolo */
export const PDA_SEEDS = {
  ATLAS_CONFIG: 'atlas_config',
  WORLD_CONFIG: 'world_config',
  WORLD_STATE: 'world_state',
  PLAYER: 'player',
  LEADERBOARD: 'leaderboard',
  WHITELIST: 'whitelist',
} as const

/**
 * Conversión de strings de duración a segundos.
 *
 * FIX: se agregó '24h' — el README y varios JSDoc lo documentan como
 * formato válido ("'7d', '24h', '30m' o segundos"), pero faltaba en
 * este mapa. Detectado por tests automatizados.
 */
export const DURATION_MAP: Record<string, number> = {
  '1m': 60,
  '5m': 300,
  '30m': 1800,
  '1h': 3600,
  '6h': 21600,
  '12h': 43200,
  '24h': 86400,
  '1d': 86400,
  '3d': 259200,
  '7d': 604800,
  '14d': 1209600,
  '30d': 2592000,
}
