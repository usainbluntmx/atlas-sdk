/**
 * @atlas-world/core — PDAs
 * Helpers para derivar todas las PDAs del protocolo Atlas.
 */

import { PublicKey } from '@solana/web3.js'
import { PDA_SEEDS } from './constants'

function u64ToLeBytes(value: number): Buffer {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64LE(BigInt(value))
  return buf
}

/** PDA de la configuración global del protocolo */
export function getGlobalConfigPDA(programId: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.ATLAS_CONFIG)],
    programId
  )
}

/** PDA de la configuración inmutable de un mundo */
export function getWorldConfigPDA(
  worldId: number,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.WORLD_CONFIG), u64ToLeBytes(worldId)],
    programId
  )
}

/** PDA del estado mutable de un mundo para un epoch específico */
export function getWorldStatePDA(
  worldId: number,
  epoch: number,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(PDA_SEEDS.WORLD_STATE),
      u64ToLeBytes(worldId),
      u64ToLeBytes(epoch),
    ],
    programId
  )
}

/** PDA de un player en un mundo específico */
export function getPlayerPDA(
  worldId: number,
  owner: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(PDA_SEEDS.PLAYER),
      u64ToLeBytes(worldId),
      owner.toBuffer(),
    ],
    programId
  )
}

/** PDA del leaderboard de un mundo para un epoch específico */
export function getLeaderboardPDA(
  worldId: number,
  epoch: number,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(PDA_SEEDS.LEADERBOARD),
      u64ToLeBytes(worldId),
      u64ToLeBytes(epoch),
    ],
    programId
  )
}

/** PDA de la whitelist de un mundo privado */
export function getWhitelistPDA(
  worldId: number,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PDA_SEEDS.WHITELIST), u64ToLeBytes(worldId)],
    programId
  )
}
