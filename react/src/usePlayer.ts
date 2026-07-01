/**
 * @atlas-world/react — usePlayer
 *
 * Hook para leer el estado del player conectado en un mundo.
 *
 * @example
 * const { player, loading, hasPlayer } = usePlayer(worldId)
 *
 * if (!hasPlayer) return <MintButton />
 * return <p>Nivel {player.level} — {player.resourcesCollected} pts</p>
 */

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import type { Player } from '@atlas-world/core'
import { useAtlasContext } from './AtlasProvider'

interface UsePlayerResult {
  player: Player | null
  loading: boolean
  hasPlayer: boolean
  refetch: () => Promise<void>
}

export function usePlayer(worldId: number | null): UsePlayerResult {
  const { client } = useAtlasContext()
  const { publicKey } = useWallet()
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchPlayer = useCallback(async () => {
    if (!client || worldId === null || !publicKey) return
    setLoading(true)
    try {
      const data = await client.player.get(worldId)
      setPlayer(data)
    } finally {
      setLoading(false)
    }
  }, [client, worldId, publicKey])

  useEffect(() => {
    fetchPlayer()
  }, [fetchPlayer])

  // Actualizar player cuando recolecta
  useEffect(() => {
    if (!client || worldId === null || !publicKey) return

    const unsub = client.resource.subscribe(worldId, event => {
      if (event.wallet === publicKey.toBase58()) {
        // Re-fetch el player para obtener el estado actualizado
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
