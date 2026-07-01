/**
 * @atlas-world/react — useWorld
 *
 * Hook para leer el estado de un mundo en tiempo real.
 * Se actualiza automáticamente vía Anchor Events — sin polling.
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

import { useState, useEffect, useCallback } from 'react'
import type { World, ResourceCollectedEvent, WorldResetEvent } from '@atlas-world/core'
import { useAtlasContext } from './AtlasProvider'

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

  const fetchWorld = useCallback(async () => {
    if (!client || worldId === null) return
    setLoading(true)
    setError(null)
    try {
      const data = await client.world.get(worldId)
      setWorld(data)
    } catch (err) {
      setError('Error al cargar el mundo')
    } finally {
      setLoading(false)
    }
  }, [client, worldId])

  // Fetch inicial
  useEffect(() => {
    fetchWorld()
  }, [fetchWorld])

  // Suscripción a eventos en tiempo real
  useEffect(() => {
    if (!client || worldId === null) return

    // Actualizar progreso cuando alguien recolecta
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

    // Re-fetch completo cuando el epoch se resetea
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
