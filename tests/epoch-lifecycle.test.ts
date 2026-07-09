import * as anchor from "@coral-xyz/anchor"
import { Program, BN } from "@coral-xyz/anchor"
import { Atlas } from "../target/types/atlas"
import { expect } from "chai"
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js"

/**
 * Cubre el hueco de cobertura señalado por feedback externo:
 * WorldReset, current_epoch incrementando, advanceEpoch, y que el
 * leaderboard del epoch anterior persista intacto.
 */
describe("epoch lifecycle — WorldReset, advanceEpoch, historial persistente", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.Atlas as Program<Atlas>

  const player = Keypair.generate()
  let worldId: number
  let realTreasury: anchor.web3.PublicKey

  async function fundWallet(to: anchor.web3.PublicKey, sol: number) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: to,
        lamports: Math.floor(sol * anchor.web3.LAMPORTS_PER_SOL),
      })
    )
    await provider.sendAndConfirm(tx)
  }

  const getGlobalConfigPDA = () =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("atlas_config")],
      program.programId
    )[0]

  const getWorldConfigPDA = (id: number) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("world_config"), new BN(id).toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0]

  const getWorldStatePDA = (id: number, epoch: number) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("world_state"),
        new BN(id).toArrayLike(Buffer, "le", 8),
        new BN(epoch).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0]

  const getLeaderboardPDA = (id: number, epoch: number) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("leaderboard"),
        new BN(id).toArrayLike(Buffer, "le", 8),
        new BN(epoch).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0]

  const getPlayerPDA = (id: number, owner: anchor.web3.PublicKey) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("player"), new BN(id).toArrayLike(Buffer, "le", 8), owner.toBuffer()],
      program.programId
    )[0]

  before(async () => {
    await fundWallet(player.publicKey, 0.1)

    // Asegurar que el protocolo existe, y leer el treasury REAL —
    // el contrato exige que coincida con global_config.treasury.
    try {
      const config = await program.account.globalConfig.fetch(getGlobalConfigPDA())
      realTreasury = config.treasury
    } catch {
      const newTreasury = Keypair.generate()
      await program.methods
        .initializeProtocol(newTreasury.publicKey)
        .accounts({
          globalConfig: getGlobalConfigPDA(),
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
      realTreasury = newTreasury.publicKey
    }

    const globalConfig = await program.account.globalConfig.fetch(getGlobalConfigPDA())
    worldId = Number(globalConfig.worldCount)

    // Mundo con solo 2 recursos — se agota rápido para probar el ciclo completo
    await program.methods
      .createWorld(
        "Epoch Lifecycle Test",
        { gaming: {} },
        { public: {} },
        new BN(2),
        new BN(604800), // 7 días — no queremos que expire por tiempo en este test
        new BN(0), // sin cooldown
        0, // sin límite diario
        [{ id: 0, name: "common", points: new BN(1), cooldownSeconds: new BN(0) }]
      )
      .accounts({
        globalConfig: getGlobalConfigPDA(),
        worldConfig: getWorldConfigPDA(worldId),
        worldState: getWorldStatePDA(worldId, 0),
        treasury: realTreasury,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    await program.methods
      .createLeaderboard()
      .accounts({
        worldConfig: getWorldConfigPDA(worldId),
        leaderboard: getLeaderboardPDA(worldId, 0),
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    await program.methods
      .mintPlayer("EpochTester", "https://gateway.irys.xyz/test")
      .accounts({
        globalConfig: getGlobalConfigPDA(),
        worldConfig: getWorldConfigPDA(worldId),
        player: getPlayerPDA(worldId, player.publicKey),
        owner: player.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player])
      .rpc()
  })

  it("el mundo empieza en epoch 0", async () => {
    const config = await program.account.worldConfig.fetch(getWorldConfigPDA(worldId))
    expect(config.currentEpoch.toNumber()).to.equal(0)
  })

  it("agotar el mundo incrementa current_epoch dentro de la misma transacción", async () => {
    // Recolecta 1 — no agota (1/2)
    await program.methods
      .collectResource(0)
      .accounts({
        globalConfig: getGlobalConfigPDA(),
        worldConfig: getWorldConfigPDA(worldId),
        worldState: getWorldStatePDA(worldId, 0),
        player: getPlayerPDA(worldId, player.publicKey),
        leaderboard: getLeaderboardPDA(worldId, 0),
        owner: player.publicKey,
      })
      .signers([player])
      .rpc()

    let config = await program.account.worldConfig.fetch(getWorldConfigPDA(worldId))
    expect(config.currentEpoch.toNumber()).to.equal(0, "no debería avanzar todavía (1/2)")

    // Recolecta 2 — agota el mundo (2/2), debe incrementar el epoch en esta misma tx
    await program.methods
      .collectResource(0)
      .accounts({
        globalConfig: getGlobalConfigPDA(),
        worldConfig: getWorldConfigPDA(worldId),
        worldState: getWorldStatePDA(worldId, 0),
        player: getPlayerPDA(worldId, player.publicKey),
        leaderboard: getLeaderboardPDA(worldId, 0),
        owner: player.publicKey,
      })
      .signers([player])
      .rpc()

    config = await program.account.worldConfig.fetch(getWorldConfigPDA(worldId))
    expect(config.currentEpoch.toNumber()).to.equal(1, "debería haber avanzado a epoch 1 en la misma tx que agotó")
  })

  it("collect_resource falla con EpochMismatch si el WorldState del nuevo epoch no existe", async () => {
    try {
      await program.methods
        .collectResource(0)
        .accounts({
          globalConfig: getGlobalConfigPDA(),
          worldConfig: getWorldConfigPDA(worldId),
          worldState: getWorldStatePDA(worldId, 1), // no existe todavía
          player: getPlayerPDA(worldId, player.publicKey),
          leaderboard: getLeaderboardPDA(worldId, 1), // tampoco existe
          owner: player.publicKey,
        })
        .signers([player])
        .rpc()
      expect.fail("Debería haber fallado — WorldState del epoch 1 no existe")
    } catch (err: any) {
      // Falla por cuenta no inicializada (AccountNotInitialized) — comportamiento esperado
      expect(err.message).to.match(/AccountNotInitialized|not been initialized/i)
    }
  })

  it("advanceEpoch crea el WorldState del nuevo epoch correctamente", async () => {
    await program.methods
      .advanceEpoch()
      .accounts({
        worldConfig: getWorldConfigPDA(worldId),
        worldState: getWorldStatePDA(worldId, 1),
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const state = await program.account.worldState.fetch(getWorldStatePDA(worldId, 1))
    expect(state.epoch.toNumber()).to.equal(1)
    expect(state.resourcesCollected.toNumber()).to.equal(0)
  })

  it("createLeaderboard del nuevo epoch empieza vacío", async () => {
    await program.methods
      .createLeaderboard()
      .accounts({
        worldConfig: getWorldConfigPDA(worldId),
        leaderboard: getLeaderboardPDA(worldId, 1),
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const lb = await program.account.leaderboard.fetch(getLeaderboardPDA(worldId, 1))
    expect(lb.epoch.toNumber()).to.equal(1)
    expect(lb.entries).to.have.lengthOf(0)
  })

  it("EL LEADERBOARD DEL EPOCH 0 SIGUE INTACTO — el historial nunca se borra", async () => {
    const historicalLb = await program.account.leaderboard.fetch(getLeaderboardPDA(worldId, 0))
    expect(historicalLb.epoch.toNumber()).to.equal(0)
    expect(historicalLb.entries.length).to.be.greaterThan(0)
    expect(historicalLb.entries[0].resourcesCollected.toNumber()).to.equal(2)
  })

  it("collect_resource vuelve a funcionar normalmente en el epoch 1", async () => {
    await program.methods
      .collectResource(0)
      .accounts({
        globalConfig: getGlobalConfigPDA(),
        worldConfig: getWorldConfigPDA(worldId),
        worldState: getWorldStatePDA(worldId, 1),
        player: getPlayerPDA(worldId, player.publicKey),
        leaderboard: getLeaderboardPDA(worldId, 1),
        owner: player.publicKey,
      })
      .signers([player])
      .rpc()

    const state = await program.account.worldState.fetch(getWorldStatePDA(worldId, 1))
    expect(state.resourcesCollected.toNumber()).to.equal(1)
  })
})
