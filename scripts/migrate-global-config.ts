/**
 * Script de migración — SOLO PARA DESARROLLO
 *
 * Cierra el GlobalConfig viejo (layout incompatible tras agregar el
 * campo `paused`) y lo vuelve a inicializar con el layout nuevo.
 *
 * ⚠️ Esto resetea world_count a 0. En devnet durante desarrollo esto
 * es aceptable. NUNCA hacer esto en mainnet con datos reales — antes
 * del deploy a mainnet, el layout de GlobalConfig debe estar congelado
 * o debe existir una estrategia de migración de cuentas apropiada.
 *
 * Uso:
 *   npx ts-node scripts/migrate-global-config.ts
 */

import { Keypair, SystemProgram } from "@solana/web3.js"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { AtlasClient } from "../sdk/dist"
import { getGlobalConfigPDA } from "../core/dist"

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

async function main() {
  console.log("🔧 Migración de GlobalConfig — SOLO DESARROLLO\n")

  const wallet = loadLocalWallet()
  const atlas = new AtlasClient({ network: "devnet", wallet })
  const [globalConfigPDA] = getGlobalConfigPDA(atlas.programId)

  // ─── Verificar si existe y si tiene el layout viejo ────────────────────────
  let exists = false
  try {
    await (atlas.program.account as any).globalConfig.fetch(globalConfigPDA)
    exists = true
  } catch (err: any) {
    if (err.message?.includes("Invalid bool") || err.message?.includes("Account does not exist")) {
      exists = err.message?.includes("Invalid bool") // existe pero layout viejo
    }
  }

  if (exists) {
    console.log("📋 Cerrando GlobalConfig con layout viejo...")
    const sig = await (atlas.program.methods as any)
      .closeProtocol()
      .accounts({
        globalConfig: globalConfigPDA,
        authority: wallet.publicKey,
      })
      .rpc()
    console.log(`✅ Cerrado. Signature: ${sig}\n`)
  } else {
    console.log("ℹ️  GlobalConfig no existe todavía — se creará limpio.\n")
  }

  // ─── Reinicializar con el layout nuevo ─────────────────────────────────────
  console.log("📋 Inicializando GlobalConfig con el layout nuevo...")
  const sig = await (atlas.program.methods as any)
    .initializeProtocol(wallet.publicKey) // treasury = misma wallet, solo para test
    .accounts({
      globalConfig: globalConfigPDA,
      authority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  console.log(`✅ GlobalConfig inicializado. Signature: ${sig}\n`)

  const config = await (atlas.program.account as any).globalConfig.fetch(globalConfigPDA)
  console.log("📋 Estado final:")
  console.log(`   world_count: ${config.worldCount}`)
  console.log(`   paused: ${config.paused}`)
  console.log(`   private_world_fee: ${Number(config.privateWorldFee) / 1e9} SOL`)

  // ─── Saltar world_count por encima de mundos ya existentes ─────────────────
  // Las cuentas WorldConfig de mundos creados ANTES de esta migración
  // siguen existiendo en sus PDAs originales. Si world_count vuelve a 0,
  // el próximo create_world colisionaría con esas cuentas ("already in use").
  // Ajustamos a un valor seguro por encima del último world_id usado.
  const SAFE_WORLD_COUNT = 10 // ajusta si has creado más de 10 mundos en total
  console.log(`\n📋 Saltando world_count a ${SAFE_WORLD_COUNT} (evitar colisión con mundos previos)...`)
  const sigAdjust = await (atlas.program.methods as any)
    .adminSetWorldCount(new (require("@coral-xyz/anchor").BN)(SAFE_WORLD_COUNT))
    .accounts({
      globalConfig: globalConfigPDA,
      authority: wallet.publicKey,
    })
    .rpc()
  console.log(`✅ world_count ajustado. Signature: ${sigAdjust}`)

  const configFinal = await (atlas.program.account as any).globalConfig.fetch(globalConfigPDA)
  console.log(`   world_count final: ${configFinal.worldCount}`)

  console.log("\n🎉 Migración completa.")
}

main().catch((err) => {
  console.error("\n❌ Migración falló:", err)
  process.exit(1)
})
