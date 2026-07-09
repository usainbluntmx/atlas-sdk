import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Atlas } from "../target/types/atlas";
import { expect } from "chai";
import { Keypair, SystemProgram } from "@solana/web3.js";

describe("atlas — protocol & world creation", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Atlas as Program<Atlas>;

  let realTreasury: anchor.web3.PublicKey;

  const getGlobalConfigPDA = () =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("atlas_config")],
      program.programId
    )[0];

  const getWorldConfigPDA = (worldId: number) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("world_config"), new BN(worldId).toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];

  const getWorldStatePDA = (worldId: number, epoch: number) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("world_state"),
        new BN(worldId).toArrayLike(Buffer, "le", 8),
        new BN(epoch).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];

  it("inicializa el protocolo (o reutiliza el existente en devnet persistente)", async () => {
    const globalConfigPDA = getGlobalConfigPDA();

    try {
      // El protocolo puede ya existir de una corrida anterior contra
      // devnet (a diferencia de un validator local, el estado persiste).
      const existing = await program.account.globalConfig.fetch(globalConfigPDA);
      realTreasury = existing.treasury;
    } catch {
      const treasury = Keypair.generate();
      await program.methods
        .initializeProtocol(treasury.publicKey)
        .accounts({
          globalConfig: globalConfigPDA,
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      realTreasury = treasury.publicKey;
    }

    const config = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(config.treasury.toBase58()).to.equal(realTreasury.toBase58());
  });

  it("crea un mundo público de tipo Gaming", async () => {
    const globalConfigPDA = getGlobalConfigPDA();
    const globalConfigBefore = await program.account.globalConfig.fetch(globalConfigPDA);
    const worldId = Number(globalConfigBefore.worldCount);

    const worldConfigPDA = getWorldConfigPDA(worldId);
    const worldStatePDA = getWorldStatePDA(worldId, 0);

    await program.methods
      .createWorld(
        "Mi Juego Test",
        { gaming: {} },
        { public: {} },
        new BN(500),
        new BN(604800), // 7 días
        new BN(5),
        0, // maxDailyCollects — antes faltaba este argumento
        [
          { id: 0, name: "common", points: new BN(1), cooldownSeconds: new BN(5) },
          { id: 1, name: "rare", points: new BN(3), cooldownSeconds: new BN(10) },
          { id: 2, name: "epic", points: new BN(5), cooldownSeconds: new BN(30) },
        ]
      )
      .accounts({
        globalConfig: globalConfigPDA,
        worldConfig: worldConfigPDA,
        worldState: worldStatePDA,
        treasury: realTreasury,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.worldConfig.fetch(worldConfigPDA);
    expect(config.worldId.toNumber()).to.equal(worldId);
    expect(config.name).to.equal("Mi Juego Test");
    expect(config.totalResources.toNumber()).to.equal(500);
    expect(config.resourceTypes).to.have.lengthOf(3);

    const state = await program.account.worldState.fetch(worldStatePDA);
    expect(state.epoch.toNumber()).to.equal(0);
    expect(state.resourcesCollected.toNumber()).to.equal(0);

    const globalConfigAfter = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfigAfter.worldCount.toNumber()).to.equal(worldId + 1);
  });

  it("el siguiente mundo obtiene el world_id consecutivo correcto", async () => {
    const globalConfigPDA = getGlobalConfigPDA();
    const globalConfigBefore = await program.account.globalConfig.fetch(globalConfigPDA);
    const worldId = Number(globalConfigBefore.worldCount);

    const worldConfigPDA = getWorldConfigPDA(worldId);
    const worldStatePDA = getWorldStatePDA(worldId, 0);

    await program.methods
      .createWorld(
        "Segundo Mundo",
        { dao: {} },
        { public: {} },
        new BN(100),
        new BN(2592000), // 30 días
        new BN(86400),
        0, // maxDailyCollects
        [{ id: 0, name: "vote", points: new BN(1), cooldownSeconds: new BN(86400) }]
      )
      .accounts({
        globalConfig: globalConfigPDA,
        worldConfig: worldConfigPDA,
        worldState: worldStatePDA,
        treasury: realTreasury,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.worldConfig.fetch(worldConfigPDA);
    expect(config.worldId.toNumber()).to.equal(worldId);

    const globalConfigAfter = await program.account.globalConfig.fetch(globalConfigPDA);
    expect(globalConfigAfter.worldCount.toNumber()).to.equal(worldId + 1);
  });
});
