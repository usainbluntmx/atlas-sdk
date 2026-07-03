/**
 * @atlas-world/react
 *
 * React hooks para construir mundos persistentes en Solana.
 *
 * @example
 * import { AtlasProvider, useWorld, usePlayer, useLeaderboard, useCollect } from '@atlas-world/react'
 *
 * function App() {
 *   return (
 *     <AtlasProvider network="devnet">
 *       <Game worldId={0} />
 *     </AtlasProvider>
 *   )
 * }
 *
 * function Game({ worldId }) {
 *   const { world } = useWorld(worldId)
 *   const { player, hasPlayer } = usePlayer(worldId)
 *   const { leaderboard } = useLeaderboard(worldId)
 *   const { collect, cooldown } = useCollect(worldId)
 *
 *   // world, player y leaderboard se actualizan en tiempo real
 *   // via Anchor Events — sin polling
 * }
 */

export { AtlasProvider } from './AtlasProvider'
export { useWorld } from './useWorld'
export { usePlayer } from './usePlayer'
export { useLeaderboard } from './useLeaderboard'
export { useCollect } from './useCollect'

// Componentes visuales listos para usar — sin CSS externo requerido
export { AtlasWorldProgress } from './components/AtlasWorldProgress'
export type { AtlasWorldProgressProps } from './components/AtlasWorldProgress'
export { AtlasLeaderboard } from './components/AtlasLeaderboard'
export type { AtlasLeaderboardProps } from './components/AtlasLeaderboard'
export { AtlasPlayerCard } from './components/AtlasPlayerCard'
export type { AtlasPlayerCardProps } from './components/AtlasPlayerCard'
export { AtlasCollectButton } from './components/AtlasCollectButton'
export type { AtlasCollectButtonProps } from './components/AtlasCollectButton'

// Theming
export { defaultTheme, mergeTheme } from './theme'
export type { AtlasTheme } from './theme'
