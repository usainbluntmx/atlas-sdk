"use client"

/**
 * @atlas-world/react — usePlayer
 *
 * Hook para leer el estado del player conectado en un mundo.
 * Incluye polling de respaldo cada 8s además de eventos en tiempo real,
 * para garantizar consistencia eventual aunque el WebSocket del RPC
 * público de Devnet no entregue el evento a tiempo.
 *
 * @example
 * const { player, loading, hasPlayer } = usePlayer(worldId)
 *
 * if (!hasPlayer) return <MintButton />
 * return <p>Nivel {player.level} — {player.resourcesCollected} pts</p>
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Player } from '@atlas-world/core'
import { useAtlasContext } from './AtlasProvider'

const POLL_INTERVAL_MS = 8000

interface UsePlayerResult {
  player: Player | null
  loading: boolean
  hasPlayer: boolean
  refetch: () => Promise<void>
}

export function usePlayer(worldId: number | null): UsePlayerResult {
  const { client, publicKey } = useAtlasContext()
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(false)
  const fetchingRef = useRef(false)

  const fetchPlayer = useCallback(async () => {
    if (!client || worldId === null || !publicKey || fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    try {
      const data = await client.player.get(worldId)
      setPlayer(data)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [client, worldId, publicKey])

  useEffect(() => {
    fetchPlayer()
  }, [fetchPlayer])

  // Polling de respaldo
  useEffect(() => {
    if (!client || worldId === null || !publicKey) return
    const interval = setInterval(fetchPlayer, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [client, worldId, publicKey, fetchPlayer])

  // Actualizar player cuando recolecta (mejor esfuerzo)
  useEffect(() => {
    if (!client || worldId === null || !publicKey) return

    const unsub = client.resource.subscribe(worldId, event => {
      if (event.wallet === publicKey) {
        fetchPlayer()
      }
    })

    return unsub
  }, [client, worldId, publicKey, fetchPlayer])

  return {
    player,
    loading,
    hasPlayer: player !== null,
    refetch: fetchPlayer,
  }
}
