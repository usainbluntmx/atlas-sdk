/**
 * @atlas-world/react — useCollect
 *
 * Hook para recolectar recursos con estado de carga, cooldown y errores.
 *
 * @example
 * const { collect, collecting, cooldown, error } = useCollect(worldId)
 *
 * return (
 *   <button
 *     onClick={() => collect(0)}
 *     disabled={collecting || cooldown > 0}
 *   >
 *     {cooldown > 0 ? `Espera ${cooldown}s` : 'Recolectar'}
 *   </button>
 * )
 */

import { useState, useEffect, useCallback } from 'react'
import type { CollectResult } from '@atlas-world/core'
import { useAtlasContext } from './AtlasProvider'

interface UseCollectResult {
  collect: (resourceTypeId: number) => Promise<CollectResult | null>
  collecting: boolean
  cooldown: number
  lastResult: CollectResult | null
  error: string | null
}

export function useCollect(worldId: number | null): UseCollectResult {
  const { client } = useAtlasContext()
  const [collecting, setCollecting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [lastResult, setLastResult] = useState<CollectResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Countdown del cooldown
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => {
      setCooldown(prev => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  const collect = useCallback(
    async (resourceTypeId: number): Promise<CollectResult | null> => {
      if (!client || worldId === null || collecting || cooldown > 0) return null

      setCollecting(true)
      setError(null)

      try {
        const result = await client.resource.collect({ worldId, resourceTypeId })
        setLastResult(result)

        // Obtener el cooldown del tipo de recurso
        const remaining = await client.resource.cooldownRemaining(
          worldId,
          resourceTypeId
        )
        setCooldown(remaining)

        return result
      } catch (err: any) {
        const msg = err.message ?? 'Error al recolectar'
        setError(msg)
        return null
      } finally {
        setCollecting(false)
      }
    },
    [client, worldId, collecting, cooldown]
  )

  return { collect, collecting, cooldown, lastResult, error }
}
