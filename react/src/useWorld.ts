"use client"
/**
 * @atlas-world/react — useWorld
 *
 * Hook para leer el estado de un mundo. Se actualiza vía Anchor Events
 * en tiempo real, con un polling de respaldo cada 8 segundos — esto
 * garantiza consistencia eventual incluso si el WebSocket del RPC
 * público falla o se corta silenciosamente (algo común en endpoints
 * gratuitos de Devnet). Para producción, usa un RPC dedicado
 * (Helius, QuickNode, etc.) para que los eventos en vivo sean confiables.
 *
 * @example
 * const { world, loading, error } = useWorld(worldId)
 *
 * if (loading) return <Spinner />
 * if (!world) return <p>Mundo no encontrado</p>
 *
 * return (
 *   <div>
 *     <p>{world.config.name}</p>
 *     <p>{world.progress}% completado</p>
 *     <p>{world.state.resourcesCollected} / {world.config.totalResources}</p>
 *   </div>
 * )
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { World, ResourceCollectedEvent, WorldResetEvent } from '@atlas-world/core'
import { useAtlasContext } from './AtlasProvider'

const POLL_INTERVAL_MS = 8000

interface UseWorldResult {
  world: World | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useWorld(worldId: number | null): UseWorldResult {
  const { client } = useAtlasContext()
  const [world, setWorld] = useState<World | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchingRef = useRef(false)

  const fetchWorld = useCallback(async () => {
    if (!client || worldId === null || fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    setError(null)
    try {
      const data = await client.world.get(worldId)
      setWorld(data)
    } catch (err) {
      setError('Error al cargar el mundo')
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [client, worldId])

  // Fetch inicial
  useEffect(() => {
    fetchWorld()
  }, [fetchWorld])

  // Polling de respaldo — garantiza consistencia eventual
  useEffect(() => {
    if (!client || worldId === null) return
    const interval = setInterval(fetchWorld, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [client, worldId, fetchWorld])

  // Suscripción a eventos en tiempo real (mejor esfuerzo)
  useEffect(() => {
    if (!client || worldId === null) return

    const unsubCollect = client.resource.subscribe(
      worldId,
      (event: ResourceCollectedEvent) => {
        setWorld(prev => {
          if (!prev) return prev
          const newCollected = event.worldProgress
          const progress = Math.round((newCollected / prev.config.totalResources) * 100)
          return {
            ...prev,
            state: { ...prev.state, resourcesCollected: newCollected },
            progress,
            exhausted: newCollected >= prev.config.totalResources,
          }
        })
      }
    )

    const unsubReset = client.world.subscribe(worldId, {
      onWorldReset: (_event: WorldResetEvent) => {
        fetchWorld()
      },
    })

    return () => {
      unsubCollect()
      unsubReset()
    }
  }, [client, worldId, fetchWorld])

  return { world, loading, error, refetch: fetchWorld }
}
