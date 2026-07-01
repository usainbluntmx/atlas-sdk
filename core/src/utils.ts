/**
 * @atlas-world/core — Utils
 * Utilidades compartidas del protocolo Atlas.
 */

import { DURATION_MAP } from './constants'

/**
 * Convierte una duración a segundos.
 * Acepta número (ya en segundos) o string como '7d', '24h', '30m'.
 *
 * @example
 * parseDuration(604800) // 604800
 * parseDuration('7d')   // 604800
 * parseDuration('24h')  // 86400
 */
export function parseDuration(duration: number | string): number {
  if (typeof duration === 'number') return duration
  const seconds = DURATION_MAP[duration]
  if (!seconds) {
    throw new Error(
      `Duración inválida: "${duration}". Usa un número en segundos o uno de: ${Object.keys(DURATION_MAP).join(', ')}`
    )
  }
  return seconds
}

/**
 * Calcula el progreso del mundo como porcentaje (0-100).
 */
export function worldProgress(
  resourcesCollected: number,
  totalResources: number
): number {
  if (totalResources === 0) return 0
  return Math.min(100, Math.round((resourcesCollected / totalResources) * 100))
}

/**
 * Calcula los segundos restantes del epoch actual.
 * Retorna -1 si el epoch no tiene límite de tiempo.
 */
export function epochSecondsRemaining(
  startedAt: number,
  epochDuration: number
): number {
  if (epochDuration <= 0) return -1
  const now = Math.floor(Date.now() / 1000)
  const elapsed = now - startedAt
  return Math.max(0, epochDuration - elapsed)
}

/**
 * Calcula el nivel de un player basado en recursos recolectados.
 * level = 1 + floor(resourcesCollected / LEVEL_THRESHOLD)
 */
export function calculateLevel(
  resourcesCollected: number,
  levelThreshold = 10
): number {
  return 1 + Math.floor(resourcesCollected / levelThreshold)
}

/**
 * Formatea un número de lamports a SOL con precisión configurable.
 */
export function lamportsToSol(lamports: number, decimals = 4): string {
  return (lamports / 1_000_000_000).toFixed(decimals)
}

/**
 * Abrevia una dirección de wallet para mostrar en UI.
 * @example abbreviateAddress('Baq3gz...K7RV') // 'Baq3gz...K7RV'
 */
export function abbreviateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}
