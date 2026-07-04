"use client"
/**
 * @atlas-world/react — useLeaderboard
 *
 * Hook para leer el leaderboard de un mundo. Incluye polling de
 * respaldo cada 8s además de eventos en tiempo real, para garantizar
 * consistencia eventual aunque el WebSocket del RPC público de Devnet
 * no entregue el evento a tiempo.
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

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Leaderboard } from '@atlas-world/core'
import { useAtlasContext } from './AtlasProvider'

const POLL_INTERVAL_MS = 8000

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
  const fetchingRef = useRef(false)

  const fetchLeaderboard = useCallback(async () => {
    if (!client || worldId === null || fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const data = await client.leaderboard.get(worldId, { epoch })
      setLeaderboard(data)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [client, worldId, epoch])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  // Polling de respaldo (solo para el leaderboard del epoch actual)
  useEffect(() => {
    if (!client || worldId === null || epoch !== undefined) return
    const interval = setInterval(fetchLeaderboard, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [client, worldId, epoch, fetchLeaderboard])

  // Re-fetch cuando alguien recolecta (mejor esfuerzo)
  useEffect(() => {
    if (!client || worldId === null || epoch !== undefined) return

    const unsub = client.resource.subscribe(worldId, () => {
      fetchLeaderboard()
    })

    return unsub
  }, [client, worldId, epoch, fetchLeaderboard])

  return { leaderboard, loading, refetch: fetchLeaderboard }
}
