/**
 * Test de Mainnet Readiness — Atlas SDK
 *
 * Verifica:
 * 1. admin_set_world_count ahora falla (dev-only gate)
 * 2. close_protocol ahora falla (dev-only gate)
 * 3. transfer_protocol_authority funciona (transfiere y revierte)
 * 4. transfer_world_authority funciona (transfiere y revierte)
 * 5. close_world funciona (crea un mundo descartable y lo cierra)
 *
 * Uso:
 *   npx ts-node scripts/test-mainnet-readiness.ts
 */

import * as anchor from "@coral-xyz/anchor"
import { Keypair, SystemProgram } from "@solana/web3.js"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import { AtlasClient, WorldType, WorldVisibility } from "../sdk/dist"
import { getGlobalConfigPDA, getWorldConfigPDA } from "../core/dist"

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

function walletFromKeypair(kp: Keypair) {
  return {
    publicKey: kp.publicKey,
    signTransaction: async (tx: any) => { tx.partialSign(kp); return tx },
    signAllTransactions: async (txs: any[]) => { txs.forEach(tx => tx.partialSign(kp)); return txs },
  }
}

async function main() {
  console.log("🔒 Atlas SDK — Test Mainnet Readiness (Devnet)\n")

  const mainKeypairRaw = JSON.parse(
    fs.readFileSync(path.join(os.homedir(), ".config/solana/id.json"), "utf-8")
  )
  const mainKeypair = Keypair.fromSecretKey(new Uint8Array(mainKeypairRaw))
  const wallet = loadLocalWallet()
  const atlas = new AtlasClient({ network: "devnet", wallet })

  // ─── PASO 1: admin_set_world_count debe fallar ─────────────────────────────
  console.log("📋 PASO 1 — admin_set_world_count debe fallar (dev-only gate)")
  try {
    const [globalConfigPDA] = getGlobalConfigPDA(atlas.programId)
    await (atlas.program.methods as any)
      .adminSetWorldCount(new anchor.BN(999))
      .accounts({ globalConfig: globalConfigPDA, authority: wallet.publicKey })
      .rpc()
    console.log("❌ ERROR: admin_set_world_count NO debería haber funcionado\n")
  } catch (err: any) {
    const msg = err.error?.errorCode?.code ?? err.message
    console.log(`✅ Bloqueado correctamente: ${msg}\n`)
  }

  // ─── PASO 2: close_protocol debe fallar ────────────────────────────────────
  console.log("📋 PASO 2 — close_protocol debe fallar (dev-only gate)")
  try {
    const [globalConfigPDA] = getGlobalConfigPDA(atlas.programId)
    await (atlas.program.methods as any)
      .closeProtocol()
      .accounts({ globalConfig: globalConfigPDA, authority: wallet.publicKey })
      .rpc()
    console.log("❌ ERROR: close_protocol NO debería haber funcionado\n")
  } catch (err: any) {
    const msg = err.error?.errorCode?.code ?? err.message
    console.log(`✅ Bloqueado correctamente: ${msg}\n`)
  }

  // ─── PASO 3: transfer_protocol_authority (transferir y revertir) ──────────
  console.log("📋 PASO 3 — transfer_protocol_authority (transferir y revertir)")
  const throwaway = Keypair.generate()
  const throwawayWallet = walletFromKeypair(throwaway)

  // Fondear la wallet throwaway con transferencia directa (más confiable que airdrop)
  const transferTx = new anchor.web3.Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: throwaway.publicKey,
      lamports: 0.05 * anchor.web3.LAMPORTS_PER_SOL,
    })
  )
  const { blockhash } = await atlas.connection.getLatestBlockhash()
  transferTx.recentBlockhash = blockhash
  transferTx.feePayer = wallet.publicKey
  const signedTransferTx = await wallet.signTransaction(transferTx)
  const transferSig = await atlas.connection.sendRawTransaction(signedTransferTx.serialize())
  await atlas.connection.confirmTransaction(transferSig)

  const [globalConfigPDA] = getGlobalConfigPDA(atlas.programId)

  await (atlas.program.methods as any)
    .transferProtocolAuthority(throwaway.publicKey)
    .accounts({ globalConfig: globalConfigPDA, authority: wallet.publicKey })
    .rpc()

  let config = await (atlas.program.account as any).globalConfig.fetch(globalConfigPDA)
  const transferred = config.protocolAuthority.toBase58() === throwaway.publicKey.toBase58()
  console.log(`   Autoridad transferida a throwaway: ${transferred}`)

  // Revertir — ahora firma la wallet throwaway
  const atlasThrowaway = new AtlasClient({ network: "devnet", wallet: throwawayWallet })
  await (atlasThrowaway.program.methods as any)
    .transferProtocolAuthority(wallet.publicKey)
    .accounts({ globalConfig: globalConfigPDA, authority: throwaway.publicKey })
    .rpc()

  config = await (atlas.program.account as any).globalConfig.fetch(globalConfigPDA)
  const reverted = config.protocolAuthority.toBase58() === wallet.publicKey.toBase58()
  console.log(`   Autoridad revertida a wallet original: ${reverted}`)
  console.log(transferred && reverted ? "✅ transfer_protocol_authority funciona correctamente\n" : "❌ Algo falló\n")

  // ─── PASO 4 y 5: crear mundo descartable, transferir autoridad, cerrarlo ──
  console.log("📋 PASO 4 — Crear mundo descartable para probar transfer_world_authority y close_world")
  const { worldId } = await atlas.world.create({
    name: "Throwaway Test World",
    worldType: WorldType.Gaming,
    visibility: WorldVisibility.Public,
    totalResources: 10,
    epochDuration: "1d",
    resourceTypes: [{ id: 0, name: "test", points: 1, cooldownSeconds: 0 }],
  })
  console.log(`✅ Mundo descartable creado. worldId: ${worldId}\n`)

  console.log("📋 PASO 5 — transfer_world_authority (transferir y revertir)")
  const [worldConfigPDA] = getWorldConfigPDA(worldId, atlas.programId)

  await (atlas.program.methods as any)
    .transferWorldAuthority(throwaway.publicKey)
    .accounts({ worldConfig: worldConfigPDA, authority: wallet.publicKey })
    .rpc()

  let worldConfig = await (atlas.program.account as any).worldConfig.fetch(worldConfigPDA)
  const worldTransferred = worldConfig.authority.toBase58() === throwaway.publicKey.toBase58()
  console.log(`   Autoridad del mundo transferida: ${worldTransferred}`)

  await (atlasThrowaway.program.methods as any)
    .transferWorldAuthority(wallet.publicKey)
    .accounts({ worldConfig: worldConfigPDA, authority: throwaway.publicKey })
    .rpc()

  worldConfig = await (atlas.program.account as any).worldConfig.fetch(worldConfigPDA)
  const worldReverted = worldConfig.authority.toBase58() === wallet.publicKey.toBase58()
  console.log(`   Autoridad del mundo revertida: ${worldReverted}`)
  console.log(
    worldTransferred && worldReverted
      ? "✅ transfer_world_authority funciona correctamente\n"
      : "❌ Algo falló\n"
  )

  console.log("📋 PASO 6 — close_world (cerrar el mundo descartable)")
  const balanceBefore = await atlas.connection.getBalance(wallet.publicKey)

  await (atlas.program.methods as any)
    .closeWorld()
    .accounts({ worldConfig: worldConfigPDA, authority: wallet.publicKey })
    .rpc()

  const balanceAfter = await atlas.connection.getBalance(wallet.publicKey)
  const rentRecovered = balanceAfter > balanceBefore

  try {
    await (atlas.program.account as any).worldConfig.fetch(worldConfigPDA)
    console.log("❌ ERROR: la cuenta debería haber sido cerrada\n")
  } catch {
    console.log(`✅ Cuenta cerrada correctamente. Rent recuperado: ${rentRecovered}\n`)
  }

  console.log("🎉 Test de Mainnet Readiness completo.")
}

main().catch((err) => {
  console.error("\n❌ Test falló:", err)
  process.exit(1)
})
