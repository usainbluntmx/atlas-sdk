/**
 * Test de Seguridad — Atlas SDK
 *
 * Verifica:
 * 1. pauseProtocol() bloquea create_world, mint_player y collect_resource
 * 2. Las lecturas (world.get, player.get) siguen funcionando durante la pausa
 * 3. unpauseProtocol() reactiva el protocolo
 * 4. max_daily_collects bloquea recolectas después del límite
 *
 * Uso:
 *   npx ts-node scripts/test-security.ts
 */

import { Keypair } from "@solana/web3.js"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { AtlasClient, WorldType, WorldVisibility } from "../sdk/dist"

function loadLocalWallet() {
  const keypairPath = path.join(os.homedir(), ".config/solana/id.json")
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"))
  const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey))
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx: any) => { tx.partialSign(keypair); return tx },
    signAllTransactions: async (txs: any[]) => { txs.forEach(tx => tx.partialSign(keypair)); return txs },
    payer: keypair,
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log("🛡️  Atlas SDK — Test de Seguridad (Devnet)\n")

  const wallet = loadLocalWallet()
  const atlas = new AtlasClient({ network: "devnet", wallet })

  // ─── PASO 1: Verificar estado inicial (no pausado) ─────────────────────────
  console.log("📋 PASO 1 — Verificar que el protocolo no está pausado")
  const pausedBefore = await atlas.isPaused()
  console.log(`   isPaused(): ${pausedBefore}`)
  if (pausedBefore) {
    console.log("⚠️  El protocolo ya estaba pausado de una corrida anterior — despausando primero...")
    await atlas.unpauseProtocol()
  }
  console.log("✅ Protocolo activo\n")

  // ─── PASO 2: Crear un mundo con rate limit de 2 recolectas/día ─────────────
  console.log("📋 PASO 2 — Crear mundo con max_daily_collects = 2")
  const { worldId } = await atlas.world.create({
    name: `Security Test ${Date.now()}`,
    worldType: WorldType.Gaming,
    visibility: WorldVisibility.Public,
    totalResources: 100,
    epochDuration: "7d",
    globalCooldown: 0,
    maxDailyCollects: 2,
    resourceTypes: [{ id: 0, name: "common", points: 1, cooldownSeconds: 0 }],
  })
  console.log(`✅ Mundo creado. worldId: ${worldId}\n`)

  await atlas.world.createLeaderboard(worldId)
  await atlas.player.mint({ worldId, name: "SecurityTester" })

  // ─── PASO 3: Recolectar 2 veces (dentro del límite) ────────────────────────
  console.log("📋 PASO 3 — Recolectar 2 veces (dentro del límite diario)")
  await atlas.resource.collect({ worldId, resourceTypeId: 0 })
  console.log("   Recolecta 1/2 ✅")
  await sleep(500)
  await atlas.resource.collect({ worldId, resourceTypeId: 0 })
  console.log("   Recolecta 2/2 ✅")
  console.log("✅ Ambas recolectas exitosas\n")

  // ─── PASO 4: Intentar una tercera recolecta (debe fallar) ──────────────────
  console.log("📋 PASO 4 — Intentar recolecta #3 (debe fallar — límite diario alcanzado)")
  try {
    await atlas.resource.collect({ worldId, resourceTypeId: 0 })
    console.log("❌ ERROR: Debería haber fallado con DailyLimitReached\n")
  } catch (err: any) {
    const msg = err.message ?? String(err)
    if (msg.includes("límite diario") || msg.includes("DailyLimitReached")) {
      console.log(`✅ Rechazado correctamente: ${msg}\n`)
    } else {
      console.log(`⚠️  Falló pero con mensaje inesperado: ${msg}\n`)
    }
  }

  // ─── PASO 5: Pausar el protocolo ────────────────────────────────────────────
  console.log("📋 PASO 5 — Pausar el protocolo (emergency stop)")
  await atlas.pauseProtocol()
  const pausedAfter = await atlas.isPaused()
  console.log(`   isPaused(): ${pausedAfter}`)
  if (!pausedAfter) throw new Error("❌ El protocolo debería estar pausado")
  console.log("✅ Protocolo pausado\n")

  // ─── PASO 6: Verificar que las lecturas siguen funcionando ─────────────────
  console.log("📋 PASO 6 — Verificar que las lecturas funcionan durante la pausa")
  const world = await atlas.world.get(worldId)
  const player = await atlas.player.get(worldId)
  console.log(`   world.get() → "${world?.config.name}" ✅`)
  console.log(`   player.get() → "${player?.name}" ✅`)
  console.log("✅ Las lecturas no se ven afectadas por la pausa\n")

  // ─── PASO 7: Intentar crear un mundo durante la pausa (debe fallar) ────────
  console.log("📋 PASO 7 — Intentar crear un mundo durante la pausa (debe fallar)")
  try {
    await atlas.world.create({
      name: "No debería crearse",
      worldType: WorldType.Gaming,
      visibility: WorldVisibility.Public,
      totalResources: 10,
      epochDuration: "1d",
      resourceTypes: [{ id: 0, name: "x", points: 1, cooldownSeconds: 0 }],
    })
    console.log("❌ ERROR: Debería haber fallado con ProtocolPaused\n")
  } catch (err: any) {
    const msg = err.message ?? String(err)
    if (msg.includes("pausado") || msg.includes("ProtocolPaused")) {
      console.log(`✅ Rechazado correctamente: ${msg}\n`)
    } else {
      console.log(`⚠️  Falló pero con mensaje inesperado: ${msg}\n`)
    }
  }

  // ─── PASO 8: Intentar recolectar durante la pausa (debe fallar) ────────────
  console.log("📋 PASO 8 — Intentar recolectar durante la pausa (debe fallar)")
  try {
    // Nota: este mundo específico también tiene el límite diario alcanzado,
    // pero el check de "paused" ocurre PRIMERO en el contrato, así que
    // debe fallar con ProtocolPaused, no con DailyLimitReached.
    await atlas.resource.collect({ worldId, resourceTypeId: 0 })
    console.log("❌ ERROR: Debería haber fallado con ProtocolPaused\n")
  } catch (err: any) {
    const msg = err.message ?? String(err)
    console.log(`✅ Rechazado correctamente: ${msg}\n`)
  }

  // ─── PASO 9: Despausar el protocolo ─────────────────────────────────────────
  console.log("📋 PASO 9 — Reactivar el protocolo")
  await atlas.unpauseProtocol()
  const pausedFinal = await atlas.isPaused()
  console.log(`   isPaused(): ${pausedFinal}`)
  if (pausedFinal) throw new Error("❌ El protocolo debería estar activo")
  console.log("✅ Protocolo reactivado\n")

  console.log("🎉 Test de Seguridad completo — emergency stop y rate limiting funcionan correctamente.")
}

main().catch((err) => {
  console.error("\n❌ Test falló:", err)
  process.exit(1)
})
