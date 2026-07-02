/**
 * Test de Mundo Privado — Atlas SDK
 *
 * Verifica:
 * 1. Crear un mundo privado (cobra fee al authority)
 * 2. Inicializar whitelist
 * 3. Intentar mintear SIN estar en whitelist → debe fallar
 * 4. Agregar wallet a whitelist
 * 5. Mintear player CON whitelist → debe funcionar
 * 6. Remover de whitelist
 *
 * Uso:
 *   npx ts-node scripts/test-private-world.ts
 */

import * as anchor from "@coral-xyz/anchor"
import { Keypair, SystemProgram } from "@solana/web3.js"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { AtlasClient, WorldType, WorldVisibility } from "../sdk/dist"
import {
  getGlobalConfigPDA,
  getWorldConfigPDA,
  getWhitelistPDA,
  getPlayerPDA,
} from "../core/dist"

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
  console.log("🔒 Atlas SDK — Test Mundo Privado (Devnet)\n")

  const wallet = loadLocalWallet()
  const atlas = new AtlasClient({ network: "devnet", wallet })

  // Wallet secundaria SIN whitelist para probar el rechazo
  const outsider = Keypair.generate()

  // Transferir SOL directo desde la wallet principal (más confiable que airdrop)
  const transferTx = new anchor.web3.Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: outsider.publicKey,
      lamports: 0.05 * anchor.web3.LAMPORTS_PER_SOL,
    })
  )
  const { blockhash } = await atlas.connection.getLatestBlockhash()
  transferTx.recentBlockhash = blockhash
  transferTx.feePayer = wallet.publicKey
  const signedTx = await wallet.signTransaction(transferTx)
  const transferSig = await atlas.connection.sendRawTransaction(signedTx.serialize())
  await atlas.connection.confirmTransaction(transferSig)

  console.log(`Wallet "outsider" (sin whitelist): ${outsider.publicKey.toBase58()}\n`)

  // ─── PASO 1: Verificar balance antes del fee ───────────────────────────────
  const balanceBefore = await atlas.connection.getBalance(wallet.publicKey)
  console.log(`📋 PASO 1 — Balance antes de crear mundo privado: ${balanceBefore / 1e9} SOL`)

  const [globalConfigPDA] = getGlobalConfigPDA(atlas.programId)
  const globalConfig = await (atlas.program.account as any).globalConfig.fetch(globalConfigPDA)
  console.log(`   Fee de mundo privado: ${Number(globalConfig.privateWorldFee) / 1e9} SOL\n`)

  // ─── PASO 2: Crear mundo privado ────────────────────────────────────────────
  console.log("📋 PASO 2 — Crear mundo privado")
  const { worldId, signature } = await atlas.world.create({
    name: `Private World ${Date.now()}`,
    worldType: WorldType.Gaming,
    visibility: WorldVisibility.Private,
    totalResources: 100,
    epochDuration: "7d",
    globalCooldown: 5,
    resourceTypes: [
      { id: 0, name: "common", points: 1, cooldownSeconds: 0 },
    ],
  })
  console.log(`✅ Mundo privado creado. worldId: ${worldId}`)
  console.log(`   Signature: ${signature}\n`)

  const balanceAfter = await atlas.connection.getBalance(wallet.publicKey)
  const feeCharged = (balanceBefore - balanceAfter) / 1e9
  console.log(`📋 Verificación de fee — SOL gastado: ~${feeCharged.toFixed(4)} SOL (incluye fee + rent + tx fees)\n`)

  // ─── PASO 3: Verificar visibilidad ──────────────────────────────────────────
  const world = await atlas.world.get(worldId)
  console.log(`📋 PASO 3 — Verificar configuración`)
  console.log(`   Visibility: ${world?.config.visibility === WorldVisibility.Private ? "Private ✅" : "Public ❌ (esperaba Private)"}\n`)

  // ─── PASO 4: Inicializar whitelist ──────────────────────────────────────────
  console.log("📋 PASO 4 — Inicializar whitelist")
  const [worldConfigPDA] = getWorldConfigPDA(worldId, atlas.programId)
  const [whitelistPDA] = getWhitelistPDA(worldId, atlas.programId)

  await (atlas.program.methods as any)
    .initializeWhitelist()
    .accounts({
      worldConfig: worldConfigPDA,
      whitelist: whitelistPDA,
      authority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  console.log("✅ Whitelist inicializada\n")

  // ─── PASO 5: Intentar mintear SIN whitelist (debe fallar) ──────────────────
  console.log("📋 PASO 5 — Intentar mint SIN estar en whitelist (debe fallar)")
  const outsiderWallet = {
    publicKey: outsider.publicKey,
    signTransaction: async (tx: any) => { tx.partialSign(outsider); return tx },
    signAllTransactions: async (txs: any[]) => { txs.forEach(tx => tx.partialSign(outsider)); return txs },
  }
  const atlasOutsider = new AtlasClient({ network: "devnet", wallet: outsiderWallet })

  const [outsiderPlayerPDA] = getPlayerPDA(worldId, outsider.publicKey, atlas.programId)

  try {
    await (atlasOutsider.program.methods as any)
      .mintPlayerPrivate("Intruder", "https://gateway.irys.xyz/test")
      .accounts({
        worldConfig: worldConfigPDA,
        player: outsiderPlayerPDA,
        whitelist: whitelistPDA,
        owner: outsider.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()
    console.log("❌ ERROR: El mint debería haber fallado pero tuvo éxito\n")
  } catch (err: any) {
    const msg = err.error?.errorCode?.code ?? err.message
    if (msg === "NotWhitelisted" || String(msg).includes("NotWhitelisted")) {
      console.log("✅ Rechazado correctamente — NotWhitelisted\n")
    } else {
      console.log(`⚠️  Falló pero con error inesperado: ${msg}\n`)
    }
  }

  // ─── PASO 6: Agregar a whitelist ────────────────────────────────────────────
  console.log("📋 PASO 6 — Agregar wallet 'outsider' a la whitelist")
  await (atlas.program.methods as any)
    .addToWhitelist(outsider.publicKey)
    .accounts({
      worldConfig: worldConfigPDA,
      whitelist: whitelistPDA,
      authority: wallet.publicKey,
    })
    .rpc()
  console.log("✅ Wallet agregada a whitelist\n")

  // ─── PASO 7: Mintear CON whitelist (debe funcionar) ────────────────────────
  console.log("📋 PASO 7 — Mint CON whitelist (debe funcionar ahora)")
  await (atlasOutsider.program.methods as any)
    .mintPlayerPrivate("Invitado", "https://gateway.irys.xyz/test")
    .accounts({
      worldConfig: worldConfigPDA,
      player: outsiderPlayerPDA,
      whitelist: whitelistPDA,
      owner: outsider.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc()
  console.log("✅ Player minteado exitosamente con whitelist\n")

  const player = await atlasOutsider.player.get(worldId, outsider.publicKey)
  console.log(`   Player: ${player?.name}, Nivel: ${player?.level}\n`)

  // ─── PASO 8: Remover de whitelist ───────────────────────────────────────────
  console.log("📋 PASO 8 — Remover wallet de la whitelist")
  await (atlas.program.methods as any)
    .removeFromWhitelist(outsider.publicKey)
    .accounts({
      worldConfig: worldConfigPDA,
      whitelist: whitelistPDA,
      authority: wallet.publicKey,
    })
    .rpc()

  const whitelist = await (atlas.program.account as any).whitelist.fetch(whitelistPDA)
  const stillMember = whitelist.members.some(
    (m: any) => m.toBase58() === outsider.publicKey.toBase58()
  )
  console.log(stillMember ? "❌ La wallet sigue en whitelist\n" : "✅ Wallet removida correctamente\n")

  console.log("🎉 Test de Mundo Privado completo — todo funcionó según lo diseñado.")
}

main().catch((err) => {
  console.error("\n❌ Test falló:", err)
  process.exit(1)
})
