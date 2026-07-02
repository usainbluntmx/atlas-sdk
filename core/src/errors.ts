/**
 * @atlas-world/core — Errors
 * Parseo y traducción de errores del protocolo Atlas.
 */

import type { AtlasError } from './types'

/** Mapa de error codes del contrato a mensajes en español */
const ERROR_MESSAGES: Record<number, string> = {
  6000: 'El nombre no puede superar 32 caracteres',
  6001: 'El URI no puede superar 200 caracteres',
  6002: 'No eres el dueño de este personaje',
  6003: 'Debes esperar antes de recolectar de nuevo',
  6004: 'El mundo está agotado — espera el reset',
  6005: 'Solo el authority puede ejecutar esta acción',
  6006: 'El epoch del leaderboard no coincide con el mundo actual',
  6007: 'Tipo de recurso inválido para este mundo',
  6008: 'Máximo 8 tipos de recurso por mundo',
  6009: 'El nombre del mundo no puede superar 64 caracteres',
  6010: 'No tienes acceso a este mundo privado',
  6011: 'La wallet ya está en la whitelist',
  6012: 'total_resources debe ser mayor a 0',
  6013: 'epoch_duration debe ser mayor a 0',
  6014: 'El protocolo está pausado temporalmente por mantenimiento',
  6015: 'Alcanzaste el límite diario de recolectas para este mundo',
}

/**
 * Convierte cualquier error de Anchor/Solana en un AtlasError legible.
 * Nunca lanza — siempre retorna un objeto con código y mensaje.
 */
export function parseError(err: unknown): AtlasError {
  // Error de Anchor con código tipado
  if (isAnchorError(err)) {
    const code = err.error?.errorCode?.number
    if (code !== undefined && ERROR_MESSAGES[code]) {
      return { code, message: ERROR_MESSAGES[code], raw: err }
    }
    const msg = err.error?.errorMessage ?? err.message ?? 'Error del programa'
    return { code: -1, message: msg, raw: err }
  }

  // Errores comunes de Solana/wallet
  if (err instanceof Error) {
    if (err.message.includes('insufficient funds')) {
      return { code: -2, message: 'SOL insuficiente para pagar la transacción', raw: err }
    }
    if (err.message.includes('User rejected')) {
      return { code: -3, message: 'Transacción rechazada por el usuario', raw: err }
    }
    if (err.message.includes('blockhash')) {
      return { code: -4, message: 'Timeout de red — intenta de nuevo', raw: err }
    }
    if (err.message.includes('already in use')) {
      return { code: -5, message: 'Esta cuenta ya existe', raw: err }
    }
    return { code: -1, message: err.message, raw: err }
  }

  return { code: -1, message: 'Error desconocido', raw: err }
}

/** Type guard para errores de Anchor */
function isAnchorError(err: unknown): err is {
  error?: { errorCode?: { number?: number }; errorMessage?: string }
  message?: string
} {
  return typeof err === 'object' && err !== null && 'error' in err
}
