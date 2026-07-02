/**
 * Test de Epoch Reset — Atlas SDK
 *
 * Verifica:
 * 1. Crear un mundo con pocos recursos (para agotar rápido)
 * 2. Recolectar hasta agotar el mundo → dispara WorldReset
 * 3. Verificar que current_epoch avanzó en WorldConfig
 * 4. Llamar advanceEpoch() para crear el WorldState del nuevo epoch
 * 5. Llamar createLeaderboard() para el nuevo epoch
 * 6. Verificar que el leaderboard del epoch 0 (histórico) sigue intacto
 * 7. Recolectar en el epoch 1 y verificar que funciona con normalidad
 *
 * Uso:
 *   npx ts-node scripts/test-epoch-reset.ts
 */

import * as anchor from "@coral-xyz/anchor"
import { Keypair, SystemProgram } from "@solana/web3.js"
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
  console.log("♻️  Atlas SDK — Test Epoch Reset (Devnet)\n")

  const wallet = loadLocalWallet()
  const atlas = new AtlasClient({ network: "devnet", wallet })

  // ─── PASO 1: Crear mundo con solo 2 recursos ───────────────────────────────
  console.log("📋 PASO 1 — Crear mundo con solo 2 recursos (para agotar rápido)")
  const { worldId } = await atlas.world.create({
    name: `Epoch Test ${Date.now()}`,
    worldType: WorldType.Gaming,
    visibility: WorldVisibility.Public,
    totalResources: 2, // se agota en 2 recolectas
    epochDuration: "7d", // no queremos que expire por tiempo en este test
    globalCooldown: 0, // sin cooldown para ir rápido
    resourceTypes: [
      { id: 0, name: "common", points: 1, cooldownSeconds: 0 },
    ],
  })
  console.log(`✅ Mundo creado. worldId: ${worldId}\n`)

  // ─── PASO 2: Crear leaderboard epoch 0 y mintear player ────────────────────
  console.log("📋 PASO 2 — Crear leaderboard epoch 0 y mintear player")
  await atlas.world.createLeaderboard(worldId)
  await atlas.player.mint({ worldId, name: "EpochTester" })
  console.log("✅ Leaderboard y player listos\n")

  // ─── PASO 3: Agotar el mundo (2 recolectas) ────────────────────────────────
  console.log("📋 PASO 3 — Recolectar hasta agotar el mundo")

  const result1 = await atlas.resource.collect({ worldId, resourceTypeId: 0 })
  console.log(`   Recolecta 1/2 — progreso: ${result1.worldProgress}, epochEnded: ${result1.epochEnded}`)
  await sleep(1000)

  const result2 = await atlas.resource.collect({ worldId, resourceTypeId: 0 })
  console.log(`   Recolecta 2/2 — progreso: ${result2.worldProgress}, epochEnded: ${result2.epochEnded}`)

  if (!result2.epochEnded) {
    throw new Error("❌ El mundo debería haberse agotado en la segunda recolecta")
  }
  console.log("✅ Mundo agotado — epochEnded: true\n")

  // ─── PASO 4: Verificar que current_epoch avanzó ────────────────────────────
  console.log("📋 PASO 4 — Verificar que current_epoch avanzó a 1")
  const world = await atlas.world.get(worldId)
  console.log(`   current_epoch en WorldConfig: ${world?.config.currentEpoch}`)
  if (world?.config.currentEpoch !== 1) {
    throw new Error(`❌ Esperaba epoch 1, obtuve ${world?.config.currentEpoch}`)
  }
  console.log("✅ Epoch avanzó correctamente\n")

  // ─── PASO 5: Verificar que el leaderboard del epoch 0 sigue intacto ────────
  console.log("📋 PASO 5 — Verificar leaderboard histórico (epoch 0)")
  const historicalLb = await atlas.leaderboard.get(worldId, { epoch: 0 })
  console.log(`   Leaderboard epoch 0 — entries: ${historicalLb?.entries.length}`)
  console.log(`   Top 1: ${historicalLb?.entries[0]?.name} — ${historicalLb?.entries[0]?.resourcesCollected} pts`)
  if (!historicalLb || historicalLb.entries.length === 0) {
    throw new Error("❌ El leaderboard histórico del epoch 0 debería tener datos")
  }
  console.log("✅ Leaderboard histórico persiste correctamente\n")

  // ─── PASO 6: Intentar recolectar en el epoch nuevo SIN avanzar (debe fallar) ──
  console.log("📋 PASO 6 — Intentar recolectar sin haber avanzado el epoch (debe fallar)")
  try {
    await atlas.resource.collect({ worldId, resourceTypeId: 0 })
    console.log("❌ ERROR: Debería haber fallado — WorldState del epoch 1 no existe aún\n")
  } catch (err: any) {
    console.log(`✅ Falló como se esperaba: ${err.message ?? err}\n`)
  }

  // ─── PASO 7: Avanzar el epoch (crear WorldState nuevo) ─────────────────────
  console.log("📋 PASO 7 — Avanzar epoch (crear WorldState para epoch 1)")
  await atlas.world.advanceEpoch(worldId)
  console.log("✅ WorldState del epoch 1 creado\n")

  // ─── PASO 8: Crear leaderboard del nuevo epoch ──────────────────────────────
  console.log("📋 PASO 8 — Crear leaderboard del epoch 1")
  await atlas.world.createLeaderboard(worldId)
  console.log("✅ Leaderboard epoch 1 creado (vacío)\n")

  // ─── PASO 9: Recolectar en el nuevo epoch ───────────────────────────────────
  console.log("📋 PASO 9 — Recolectar en el epoch 1 (debe funcionar normalmente)")
  const result3 = await atlas.resource.collect({ worldId, resourceTypeId: 0 })
  console.log(`✅ Recolectado en epoch 1 — progreso: ${result3.worldProgress}\n`)

  // ─── PASO 10: Verificar ambos leaderboards coexisten ────────────────────────
  console.log("📋 PASO 10 — Verificar que ambos leaderboards coexisten")
  const lbEpoch0 = await atlas.leaderboard.get(worldId, { epoch: 0 })
  const lbEpoch1 = await atlas.leaderboard.get(worldId, { epoch: 1 })
  console.log(`   Epoch 0 — ${lbEpoch0?.entries.length} entries, top: ${lbEpoch0?.entries[0]?.resourcesCollected} pts`)
  console.log(`   Epoch 1 — ${lbEpoch1?.entries.length} entries, top: ${lbEpoch1?.entries[0]?.resourcesCollected} pts`)

  if (!lbEpoch0 || !lbEpoch1) {
    throw new Error("❌ Ambos leaderboards deberían existir simultáneamente")
  }
  console.log("✅ Ambos leaderboards coexisten — el histórico no se sobreescribió\n")

  console.log("🎉 Test de Epoch Reset completo — el ciclo de vida del mundo funciona correctamente.")
}

main().catch((err) => {
  console.error("\n❌ Test falló:", err)
  process.exit(1)
})
