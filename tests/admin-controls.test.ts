import * as anchor from "@coral-xyz/anchor"
import { Program, BN } from "@coral-xyz/anchor"
import { Atlas } from "../target/types/atlas"
import { expect } from "chai"
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js"

/**
 * Cubre los huecos de cobertura señalados por feedback externo:
 * pauseProtocol/unpauseProtocol, closeWorld con recuperación de rent,
 * transferWorldAuthority, y max_daily_collects (rate limiting diario).
 */
describe("admin controls — pause, close, transfer authority, rate limiting", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.Atlas as Program<Atlas>

  const throwaway = Keypair.generate()
  let realTreasury: anchor.web3.PublicKey

  const getGlobalConfigPDA = () =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("atlas_config")],
      program.programId
    )[0]

  /** Transferencia directa en vez de airdrop — evita el rate limit del faucet público */
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

  before(async () => {
    await fundWallet(throwaway.publicKey, 0.1)

    // El protocolo puede ya existir (inicializado por otro archivo de test
    // o corrida anterior contra devnet persistente) — leemos el treasury
    // REAL en vez de asumir uno. El contrato exige que la cuenta `treasury`
    // pasada a createWorld coincida exactamente con global_config.treasury,
    // sin importar si el mundo es público o privado.
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
  })

  after(async () => {
    // Asegurar que el protocolo queda despausado para no afectar otros tests
    try {
      const config = await program.account.globalConfig.fetch(getGlobalConfigPDA())
      if (config.paused) {
        await program.methods
          .unpauseProtocol()
          .accounts({ globalConfig: getGlobalConfigPDA(), authority: provider.wallet.publicKey })
          .rpc()
      }
    } catch {
      // no-op
    }
  })

  describe("pauseProtocol / unpauseProtocol", () => {
    it("pausa el protocolo correctamente", async () => {
      await program.methods
        .pauseProtocol()
        .accounts({ globalConfig: getGlobalConfigPDA(), authority: provider.wallet.publicKey })
        .rpc()

      const config = await program.account.globalConfig.fetch(getGlobalConfigPDA())
      expect(config.paused).to.equal(true)
    })

    it("create_world falla mientras el protocolo está pausado", async () => {
      const globalConfig = await program.account.globalConfig.fetch(getGlobalConfigPDA())
      const worldId = Number(globalConfig.worldCount)

      const [worldConfigPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("world_config"), new BN(worldId).toArrayLike(Buffer, "le", 8)],
        program.programId
      )
      const [worldStatePDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("world_state"),
          new BN(worldId).toArrayLike(Buffer, "le", 8),
          new BN(0).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      )

      try {
        await program.methods
          .createWorld(
            "No debería crearse",
            { gaming: {} },
            { public: {} },
            new BN(10),
            new BN(86400),
            new BN(0),
            0,
            [{ id: 0, name: "x", points: new BN(1), cooldownSeconds: new BN(0) }]
          )
          .accounts({
            globalConfig: getGlobalConfigPDA(),
            worldConfig: worldConfigPDA,
            worldState: worldStatePDA,
            treasury: realTreasury,
            authority: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
        expect.fail("Debería haber fallado con ProtocolPaused")
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("ProtocolPaused")
      }
    })

    it("unpauseProtocol reactiva el protocolo", async () => {
      await program.methods
        .unpauseProtocol()
        .accounts({ globalConfig: getGlobalConfigPDA(), authority: provider.wallet.publicKey })
        .rpc()

      const config = await program.account.globalConfig.fetch(getGlobalConfigPDA())
      expect(config.paused).to.equal(false)
    })
  })

  describe("transferWorldAuthority y closeWorld", () => {
    let worldId: number

    before(async () => {
      const globalConfig = await program.account.globalConfig.fetch(getGlobalConfigPDA())
      worldId = Number(globalConfig.worldCount)

      const [worldConfigPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("world_config"), new BN(worldId).toArrayLike(Buffer, "le", 8)],
        program.programId
      )
      const [worldStatePDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("world_state"),
          new BN(worldId).toArrayLike(Buffer, "le", 8),
          new BN(0).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      )

      await program.methods
        .createWorld(
          "Throwaway Admin Test",
          { gaming: {} },
          { public: {} },
          new BN(10),
          new BN(86400),
          new BN(0),
          0,
          [{ id: 0, name: "x", points: new BN(1), cooldownSeconds: new BN(0) }]
        )
        .accounts({
          globalConfig: getGlobalConfigPDA(),
          worldConfig: worldConfigPDA,
          worldState: worldStatePDA,
          treasury: realTreasury,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    })

    it("transfiere la autoridad del mundo y la revierte", async () => {
      const [worldConfigPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("world_config"), new BN(worldId).toArrayLike(Buffer, "le", 8)],
        program.programId
      )

      await program.methods
        .transferWorldAuthority(throwaway.publicKey)
        .accounts({ worldConfig: worldConfigPDA, authority: provider.wallet.publicKey })
        .rpc()

      let config = await program.account.worldConfig.fetch(worldConfigPDA)
      expect(config.authority.toBase58()).to.equal(throwaway.publicKey.toBase58())

      await program.methods
        .transferWorldAuthority(provider.wallet.publicKey)
        .accounts({ worldConfig: worldConfigPDA, authority: throwaway.publicKey })
        .signers([throwaway])
        .rpc()

      config = await program.account.worldConfig.fetch(worldConfigPDA)
      expect(config.authority.toBase58()).to.equal(provider.wallet.publicKey.toBase58())
    })

    it("falla si alguien que no es el authority intenta cerrar el mundo", async () => {
      const [worldConfigPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("world_config"), new BN(worldId).toArrayLike(Buffer, "le", 8)],
        program.programId
      )

      try {
        await program.methods
          .closeWorld()
          .accounts({ worldConfig: worldConfigPDA, authority: throwaway.publicKey })
          .signers([throwaway])
          .rpc()
        expect.fail("Debería haber fallado — throwaway no es el authority")
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("Unauthorized")
      }
    })

    it("closeWorld cierra la cuenta y devuelve el rent al authority real", async () => {
      const [worldConfigPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("world_config"), new BN(worldId).toArrayLike(Buffer, "le", 8)],
        program.programId
      )

      const balanceBefore = await provider.connection.getBalance(provider.wallet.publicKey)

      await program.methods
        .closeWorld()
        .accounts({ worldConfig: worldConfigPDA, authority: provider.wallet.publicKey })
        .rpc()

      const balanceAfter = await provider.connection.getBalance(provider.wallet.publicKey)
      expect(balanceAfter).to.be.greaterThan(balanceBefore - 10000)

      try {
        await program.account.worldConfig.fetch(worldConfigPDA)
        expect.fail("La cuenta debería estar cerrada")
      } catch (err: any) {
        expect(err.message).to.match(/Account does not exist|could not find/i)
      }
    })
  })

  describe("max_daily_collects — rate limiting diario", () => {
    let worldId: number
    const player = Keypair.generate()

    const getPlayerPDA = (id: number) =>
      anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("player"), new BN(id).toArrayLike(Buffer, "le", 8), player.publicKey.toBuffer()],
        program.programId
      )[0]

    before(async () => {
      await fundWallet(player.publicKey, 0.05)

      const globalConfig = await program.account.globalConfig.fetch(getGlobalConfigPDA())
      worldId = Number(globalConfig.worldCount)

      const [worldConfigPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("world_config"), new BN(worldId).toArrayLike(Buffer, "le", 8)],
        program.programId
      )
      const [worldStatePDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("world_state"),
          new BN(worldId).toArrayLike(Buffer, "le", 8),
          new BN(0).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      )
      const [leaderboardPDA] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("leaderboard"),
          new BN(worldId).toArrayLike(Buffer, "le", 8),
          new BN(0).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      )

      await program.methods
        .createWorld(
          "Rate Limit Test",
          { gaming: {} },
          { public: {} },
          new BN(100),
          new BN(86400),
          new BN(0),
          2, // max 2 al día
          [{ id: 0, name: "common", points: new BN(1), cooldownSeconds: new BN(0) }]
        )
        .accounts({
          globalConfig: getGlobalConfigPDA(),
          worldConfig: worldConfigPDA,
          worldState: worldStatePDA,
          treasury: realTreasury,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      await program.methods
        .createLeaderboard()
        .accounts({
          worldConfig: worldConfigPDA,
          leaderboard: leaderboardPDA,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc()

      await program.methods
        .mintPlayer("RateLimitTester", "https://gateway.irys.xyz/test")
        .accounts({
          globalConfig: getGlobalConfigPDA(),
          worldConfig: worldConfigPDA,
          player: getPlayerPDA(worldId),
          owner: player.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc()
    })

    const collectAccounts = (id: number) => ({
      globalConfig: getGlobalConfigPDA(),
      worldConfig: anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("world_config"), new BN(id).toArrayLike(Buffer, "le", 8)],
        program.programId
      )[0],
      worldState: anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("world_state"),
          new BN(id).toArrayLike(Buffer, "le", 8),
          new BN(0).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      )[0],
      player: getPlayerPDA(id),
      leaderboard: anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("leaderboard"),
          new BN(id).toArrayLike(Buffer, "le", 8),
          new BN(0).toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      )[0],
      owner: player.publicKey,
    })

    it("permite recolectar hasta el límite diario (2 veces)", async () => {
      await program.methods.collectResource(0).accounts(collectAccounts(worldId)).signers([player]).rpc()
      await program.methods.collectResource(0).accounts(collectAccounts(worldId)).signers([player]).rpc()

      const p = await program.account.player.fetch(getPlayerPDA(worldId))
      expect(p.dailyCollectCount).to.equal(2)
    })

    it("la tercera recolecta del día falla con DailyLimitReached", async () => {
      try {
        await program.methods.collectResource(0).accounts(collectAccounts(worldId)).signers([player]).rpc()
        expect.fail("Debería haber fallado con DailyLimitReached")
      } catch (err: any) {
        expect(err.error?.errorCode?.code).to.equal("DailyLimitReached")
      }
    })
  })
})
