/**
 * @atlas-world/core — Types
 *
 * Todos los tipos del protocolo Atlas v3.
 * Derivados del contrato on-chain — no modificar manualmente.
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

/**
 * Tipo de mundo. Define la narrativa y cómo el SDK interpreta los datos.
 * El contrato no diferencia comportamiento por tipo — lo hace el SDK.
 */
export enum WorldType {
  Gaming = 0,      // v1.0 — GameFi, Web3 Gaming
  Defi = 1,        // v2.0 — Liquidity Mining, Staking
  Dao = 2,         // v2.0 — Governance, Voting
  Marketplace = 3, // v3.0 — NFT, RWA listings
  Custom = 4,      // Para developers con narrativas propias
}

/**
 * Visibilidad del mundo.
 * Public: cualquier wallet puede participar.
 * Private: solo wallets en la whitelist — requiere fee de creación.
 */
export enum WorldVisibility {
  Public = 0,
  Private = 1,
}

// ─── Resource Types ───────────────────────────────────────────────────────────

/**
 * Tipo de recurso definido on-chain al crear el mundo.
 * Cada mundo puede tener hasta 8 tipos con sus propias reglas.
 *
 * @example GameFi
 * { id: 0, name: 'common', points: 1, cooldownSeconds: 5 }
 * { id: 1, name: 'rare',   points: 3, cooldownSeconds: 10 }
 * { id: 2, name: 'epic',   points: 5, cooldownSeconds: 30 }
 *
 * @example DAO
 * { id: 0, name: 'vote',     points: 1,  cooldownSeconds: 86400 }
 * { id: 1, name: 'proposal', points: 10, cooldownSeconds: 604800 }
 */
export interface ResourceType {
  id: number
  name: string
  points: number
  cooldownSeconds: number
}

// ─── On-chain accounts ────────────────────────────────────────────────────────

/** Configuración global del protocolo. Solo existe una instancia. */
export interface GlobalConfig {
  protocolAuthority: string
  worldCount: number
  privateWorldFee: number
  treasury: string
  bump: number
}

/**
 * Configuración inmutable del mundo.
 * Se crea una vez y persiste entre epochs.
 */
export interface WorldConfig {
  worldId: number
  authority: string
  name: string
  worldType: WorldType
  visibility: WorldVisibility
  totalResources: number
  epochDuration: number
  globalCooldown: number
  resourceTypes: ResourceType[]
  currentEpoch: number
  bump: number
}

/**
 * Estado mutable del mundo — se resetea con cada epoch.
 * La configuración vive en WorldConfig.
 */
export interface WorldState {
  worldId: number
  epoch: number
  resourcesCollected: number
  startedAt: number
  bump: number
}

/** Vista combinada del mundo — WorldConfig + WorldState */
export interface World {
  config: WorldConfig
  state: WorldState
  /** Porcentaje de recursos recolectados en el epoch actual (0-100) */
  progress: number
  /** true si el mundo está agotado */
  exhausted: boolean
  /** Segundos restantes del epoch (-1 si no hay límite de tiempo activo) */
  secondsRemaining: number
}

/** Player en un mundo específico */
export interface Player {
  worldId: number
  owner: string
  name: string
  metadataUri: string
  level: number
  resourcesCollected: number
  lastCollectTime: number
  currentEpoch: number
  bump: number
}

/** Entrada del leaderboard */
export interface LeaderboardEntry {
  owner: string
  name: string
  resourcesCollected: number
  level: number
}

/** Leaderboard de un mundo para un epoch específico */
export interface Leaderboard {
  worldId: number
  epoch: number
  entries: LeaderboardEntry[]
  bump: number
}

/** Whitelist de un mundo privado */
export interface Whitelist {
  worldId: number
  members: string[]
  bump: number
}

// ─── SDK Input types ──────────────────────────────────────────────────────────

/** Parámetros para crear un mundo */
export interface CreateWorldParams {
  name: string
  worldType: WorldType
  visibility: WorldVisibility
  totalResources: number
  /** Duración del epoch — puede ser número de segundos o string como '7d', '24h', '30m' */
  epochDuration: number | string
  /** Cooldown global entre recolectas en segundos (default: 5) */
  globalCooldown?: number
  resourceTypes: ResourceType[]
}

/** Parámetros para mintear un player */
export interface MintPlayerParams {
  worldId: number
  name: string
  /** URI a metadata en Arweave. Si no se provee, el SDK genera una por defecto. */
  metadataUri?: string
}

/** Resultado de una recolecta */
export interface CollectResult {
  signature: string
  resourceType: ResourceType
  points: number
  newLevel: number
  worldProgress: number
  epochEnded: boolean
}

// ─── Event types ──────────────────────────────────────────────────────────────

export interface WorldCreatedEvent {
  worldId: number
  authority: string
  name: string
  worldType: number
  visibility: number
  totalResources: number
  epochDuration: number
}

export interface ResourceCollectedEvent {
  worldId: number
  epoch: number
  wallet: string
  resourceType: number
  points: number
  worldProgress: number
  totalResources: number
}

export interface WorldResetEvent {
  worldId: number
  completedEpoch: number
  newEpoch: number
  winner: string
  totalCollected: number
}

export interface PlayerMintedEvent {
  worldId: number
  owner: string
  name: string
  metadataUri: string
}

// ─── Error types ──────────────────────────────────────────────────────────────

export interface AtlasError {
  code: number
  message: string
  raw?: unknown
}

// ─── Network ──────────────────────────────────────────────────────────────────

export type AtlasNetwork = 'devnet' | 'mainnet-beta' | 'localnet'
