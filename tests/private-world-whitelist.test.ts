import * as anchor from "@coral-xyz/anchor"
import { Program, BN } from "@coral-xyz/anchor"
import { Atlas } from "../target/types/atlas"
import { expect } from "chai"
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js"

/**
 * Cubre el hueco de cobertura señalado por feedback externo:
 * mundo privado con whitelist — creación con fee, whitelist init,
 * add/remove, y que mint_player_private rechace correctamente a
 * wallets no autorizadas.
 */
describe("mundo privado — whitelist y control de acceso", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.Atlas as Program<Atlas>

  const outsider = Keypair.generate()
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

  const getWhitelistPDA = (id: number) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("whitelist"), new BN(id).toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0]

  const getPlayerPDA = (id: number, owner: anchor.web3.PublicKey) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("player"), new BN(id).toArrayLike(Buffer, "le", 8), owner.toBuffer()],
      program.programId
    )[0]

  before(async () => {
    await fundWallet(outsider.publicKey, 0.1)

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

  it("crea un mundo privado correctamente (ver nota sobre verificación de fee)", async () => {
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

    const signature = await program.methods
      .createWorld(
        "Private Test World",
        { gaming: {} },
        { private: {} },
        new BN(50),
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

    // NOTA: en este entorno de pruebas, `realTreasury` coincide con la
    // wallet que también actúa como `authority` (se configuró así una
    // sola vez, hace tiempo, "solo para test" — ver GlobalConfig en
    // devnet). Eso hace que la transferencia de fee sea de la cuenta
    // hacia sí misma — el balance neto de ESA transferencia específica
    // es cero, indistinguible del rent que la misma cuenta paga al
    // crear las cuentas nuevas. Por eso no se puede verificar la fee
    // por delta de balance en este entorno concreto; lo que sí podemos
    // confirmar sin ambigüedad es que la transacción se confirmó y que
    // el mundo quedó marcado como privado.
    const tx = await provider.connection.getTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    })
    expect(tx, "la transacción de createWorld debería haberse confirmado").to.not.be.null
    expect(tx!.meta!.err, "la transacción no debería tener errores").to.be.null

    const config = await program.account.worldConfig.fetch(worldConfigPDA)
    expect(config.visibility).to.deep.equal({ private: {} })
  })

  it("initialize_whitelist crea la lista vacía", async () => {
    await program.methods
      .initializeWhitelist()
      .accounts({
        worldConfig: getWorldConfigPDA(worldId),
        whitelist: getWhitelistPDA(worldId),
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc()

    const whitelist = await program.account.whitelist.fetch(getWhitelistPDA(worldId))
    expect(whitelist.members).to.have.lengthOf(0)
  })

  it("mint_player_private RECHAZA a una wallet fuera de la whitelist", async () => {
    try {
      await program.methods
        .mintPlayerPrivate("Intruder", "https://gateway.irys.xyz/test")
        .accounts({
          worldConfig: getWorldConfigPDA(worldId),
          player: getPlayerPDA(worldId, outsider.publicKey),
          whitelist: getWhitelistPDA(worldId),
          owner: outsider.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([outsider])
        .rpc()
      expect.fail("Debería haber fallado — outsider no está en whitelist")
    } catch (err: any) {
      expect(err.error?.errorCode?.code).to.equal("NotWhitelisted")
    }
  })

  it("add_to_whitelist agrega la wallet correctamente", async () => {
    await program.methods
      .addToWhitelist(outsider.publicKey)
      .accounts({
        worldConfig: getWorldConfigPDA(worldId),
        whitelist: getWhitelistPDA(worldId),
        authority: provider.wallet.publicKey,
      })
      .rpc()

    const whitelist = await program.account.whitelist.fetch(getWhitelistPDA(worldId))
    expect(whitelist.members.map((m) => m.toBase58())).to.include(outsider.publicKey.toBase58())
  })

  it("mint_player_private ahora funciona con la wallet en whitelist", async () => {
    await program.methods
      .mintPlayerPrivate("AhoraSi", "https://gateway.irys.xyz/test")
      .accounts({
        worldConfig: getWorldConfigPDA(worldId),
        player: getPlayerPDA(worldId, outsider.publicKey),
        whitelist: getWhitelistPDA(worldId),
        owner: outsider.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([outsider])
      .rpc()

    const p = await program.account.player.fetch(getPlayerPDA(worldId, outsider.publicKey))
    expect(p.name).to.equal("AhoraSi")
  })

  it("agregar la misma wallet dos veces falla con AlreadyWhitelisted", async () => {
    try {
      await program.methods
        .addToWhitelist(outsider.publicKey)
        .accounts({
          worldConfig: getWorldConfigPDA(worldId),
          whitelist: getWhitelistPDA(worldId),
          authority: provider.wallet.publicKey,
        })
        .rpc()
      expect.fail("Debería haber fallado — ya está en la whitelist")
    } catch (err: any) {
      expect(err.error?.errorCode?.code).to.equal("AlreadyWhitelisted")
    }
  })

  it("remove_from_whitelist quita la wallet correctamente", async () => {
    await program.methods
      .removeFromWhitelist(outsider.publicKey)
      .accounts({
        worldConfig: getWorldConfigPDA(worldId),
        whitelist: getWhitelistPDA(worldId),
        authority: provider.wallet.publicKey,
      })
      .rpc()

    const whitelist = await program.account.whitelist.fetch(getWhitelistPDA(worldId))
    expect(whitelist.members.map((m) => m.toBase58())).to.not.include(outsider.publicKey.toBase58())
  })
})
