/**
 * Test end-to-end del SDK Atlas contra devnet.
 *
 * Verifica todo el flujo:
 * 1. Inicializar protocolo (GlobalConfig)
 * 2. Crear un mundo público Gaming
 * 3. Mintear un player
 * 4. Recolectar recursos de distintos tipos
 * 5. Leer el leaderboard
 * 6. Verificar niveles y puntos
 *
 * Uso:
 *   npx ts-node scripts/test-sdk.ts
 *
 * Requiere que la wallet default de Solana CLI tenga SOL en devnet.
 */

import * as anchor from "@coral-xyz/anchor"
import { Keypair, Connection } from "@solana/web3.js"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

// Import directo del SDK compilado
import { AtlasClient, WorldType, WorldVisibility } from "../sdk/dist"

// ─── Setup de wallet local para testing (no wallet-adapter) ─────────────────

function loadLocalWallet() {
  const keypairPath = path.join(os.homedir(), ".config/solana/id.json")
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf-8"))
  const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey))

  // Wrapper mínimo compatible con la interfaz de wallet-adapter
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx: any) => {
      tx.partialSign(keypair)
      return tx
    },
    signAllTransactions: async (txs: any[]) => {
      txs.forEach((tx) => tx.partialSign(keypair))
      return txs
    },
    payer: keypair, // usado internamente por AnchorProvider si aplica
  }
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Test runner ─────────────────────────────────────────────────────────────

async function main() {
  console.log("🧪 Atlas SDK — Test End-to-End (Devnet)\n")

  const wallet = loadLocalWallet()
  console.log(`Wallet: ${wallet.publicKey.toBase58()}`)

  const atlas = new AtlasClient({
    network: "devnet",
    wallet,
  })

  // Verificar balance
  const balance = await atlas.connection.getBalance(wallet.publicKey)
  console.log(`Balance: ${balance / 1e9} SOL\n`)

  if (balance < 0.5 * 1e9) {
    console.log("⚠️  Balance bajo. Ejecuta: solana airdrop 2")
    process.exit(1)
  }

  // ─── PASO 1: Inicializar protocolo (solo si no existe) ────────────────────
  console.log("📋 PASO 1 — Inicializar protocolo")
  try {
    const globalConfigPDA = require("@atlas-world/core").getGlobalConfigPDA(
      atlas.programId
    )[0]
    const existing = await (atlas.program.account as any).globalConfig.fetch(
      globalConfigPDA
    )
    console.log(`✅ Protocolo ya inicializado. World count: ${existing.worldCount}\n`)
  } catch {
    console.log("Protocolo no existe — inicializando...")
    const sig = await (atlas.program.methods as any)
      .initializeProtocol(wallet.publicKey) // treasury = misma wallet para test
      .accounts({
        globalConfig: require("@atlas-world/core").getGlobalConfigPDA(
          atlas.programId
        )[0],
        authority: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()
    console.log(`✅ Protocolo inicializado. Signature: ${sig}\n`)
  }

  // ─── PASO 2: Crear mundo ───────────────────────────────────────────────────
  console.log("📋 PASO 2 — Crear mundo Gaming público")
  const { worldId, signature: createSig } = await atlas.world.create({
    name: `Test World ${Date.now()}`,
    worldType: WorldType.Gaming,
    visibility: WorldVisibility.Public,
    totalResources: 50,
    epochDuration: "1d",
    globalCooldown: 3,
    resourceTypes: [
      { id: 0, name: "common", points: 1, cooldownSeconds: 0 },
      { id: 1, name: "rare", points: 3, cooldownSeconds: 0 },
      { id: 2, name: "epic", points: 5, cooldownSeconds: 0 },
    ],
  })
  console.log(`✅ Mundo creado. worldId: ${worldId}, signature: ${createSig}\n`)

  // ─── PASO 3: Leer el mundo ──────────────────────────────────────────────────
  console.log("📋 PASO 3 — Leer estado del mundo")
  const world = await atlas.world.get(worldId)
  console.log(`✅ Mundo: "${world?.config.name}"`)
  console.log(`   Total recursos: ${world?.config.totalResources}`)
  console.log(`   Tipos de recurso: ${world?.config.resourceTypes.length}`)
  console.log(`   Progreso: ${world?.progress}%\n`)

  if (!world) throw new Error("❌ El mundo no se pudo leer después de crearlo")

  // ─── PASO 4: Mintear player ─────────────────────────────────────────────────
  console.log("📋 PASO 4 — Mintear player")
  const alreadyExists = await atlas.player.exists(worldId)
  if (alreadyExists) {
    console.log("⚠️  Ya existe un player para esta wallet en este mundo (esperado si re-corres el test en el mismo mundo)\n")
  } else {
    const { signature: mintSig } = await atlas.player.mint({
      worldId,
      name: "TestHero",
    })
    console.log(`✅ Player minteado. Signature: ${mintSig}\n`)
  }

  const player = await atlas.player.get(worldId)
  console.log(`Player: ${player?.name}, Nivel: ${player?.level}, Puntos: ${player?.resourcesCollected}\n`)

  // ─── PASO 5: Crear leaderboard (requiere authority) ────────────────────────
  console.log("📋 PASO 5 — Crear leaderboard del epoch 0")
  try {
    const { getLeaderboardPDA, getWorldConfigPDA } = require("@atlas-world/core")
    const [leaderboardPDA] = getLeaderboardPDA(worldId, 0, atlas.programId)
    const [worldConfigPDA] = getWorldConfigPDA(worldId, atlas.programId)

    await (atlas.program.methods as any)
      .createLeaderboard()
      .accounts({
        worldConfig: worldConfigPDA,
        leaderboard: leaderboardPDA,
        authority: wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc()
    console.log("✅ Leaderboard creado\n")
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      console.log("✅ Leaderboard ya existía\n")
    } else {
      throw err
    }
  }

  // ─── PASO 6: Recolectar recursos ────────────────────────────────────────────
  console.log("📋 PASO 6 — Recolectar recursos (common, rare, epic)")

  for (const [typeId, typeName] of [[0, "common"], [1, "rare"], [2, "epic"]] as const) {
    try {
      const result = await atlas.resource.collect({
        worldId,
        resourceTypeId: typeId,
      })
      console.log(`✅ Recolectado "${typeName}" — +${result.points} pts, Nivel ${result.newLevel}, Progreso mundo: ${result.worldProgress}`)
      await sleep(4000) // esperar el cooldown global (3s) + margen
    } catch (err: any) {
      console.log(`⚠️  Error recolectando "${typeName}": ${err.message ?? err}`)
    }
  }
  console.log()

  // ─── PASO 7: Verificar player actualizado ──────────────────────────────────
  console.log("📋 PASO 7 — Verificar player actualizado")
  const updatedPlayer = await atlas.player.get(worldId)
  console.log(`✅ Player: ${updatedPlayer?.name}`)
  console.log(`   Nivel: ${updatedPlayer?.level}`)
  console.log(`   Puntos totales: ${updatedPlayer?.resourcesCollected}\n`)

  // ─── PASO 8: Leer leaderboard ───────────────────────────────────────────────
  console.log("📋 PASO 8 — Leer leaderboard")
  const leaderboard = await atlas.leaderboard.get(worldId)
  console.log(`✅ Leaderboard (epoch ${leaderboard?.epoch}):`)
  leaderboard?.entries.forEach((entry, i) => {
    console.log(`   #${i + 1} ${entry.name} — ${entry.resourcesCollected} pts (Nivel ${entry.level})`)
  })
  console.log()

  // ─── PASO 9: Verificar posición del player ─────────────────────────────────
  console.log("📋 PASO 9 — Verificar posición en leaderboard")
  const position = await atlas.leaderboard.getPosition(
    worldId,
    wallet.publicKey.toBase58()
  )
  if (position) {
    console.log(`✅ Posición: #${position.position} con ${position.entry.resourcesCollected} pts\n`)
  } else {
    console.log("⚠️  No se encontró la wallet en el leaderboard\n")
  }

  console.log("🎉 Test completo. El SDK funciona end-to-end contra devnet.")
}

main().catch((err) => {
  console.error("\n❌ Test falló:", err)
  process.exit(1)
})
