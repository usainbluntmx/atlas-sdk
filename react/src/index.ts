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
