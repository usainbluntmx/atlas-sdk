/**
 * @atlas-world/react — useLeaderboard
 *
 * Hook para leer el leaderboard de un mundo en tiempo real.
 *
 * @example
 * const { leaderboard, loading } = useLeaderboard(worldId)
 *
 * return (
 *   <ul>
 *     {leaderboard?.entries.map((entry, i) => (
 *       <li key={entry.owner}>#{i+1} {entry.name} — {entry.resourcesCollected} pts</li>
 *     ))}
 *   </ul>
 * )
 */

import { useState, useEffect, useCallback } from 'react'
import type { Leaderboard } from '@atlas-world/core'
import { useAtlasContext } from './AtlasProvider'

interface UseLeaderboardResult {
  leaderboard: Leaderboard | null
  loading: boolean
  refetch: () => Promise<void>
}

export function useLeaderboard(
  worldId: number | null,
  epoch?: number
): UseLeaderboardResult {
  const { client } = useAtlasContext()
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchLeaderboard = useCallback(async () => {
    if (!client || worldId === null) return
    setLoading(true)
    try {
      const data = await client.leaderboard.get(worldId, { epoch })
      setLeaderboard(data)
    } finally {
      setLoading(false)
    }
  }, [client, worldId, epoch])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  // Re-fetch cuando alguien recolecta (el leaderboard puede cambiar)
  useEffect(() => {
    if (!client || worldId === null || epoch !== undefined) return

    const unsub = client.resource.subscribe(worldId, () => {
      fetchLeaderboard()
    })

    return unsub
  }, [client, worldId, epoch, fetchLeaderboard])

  return { leaderboard, loading, refetch: fetchLeaderboard }
}
