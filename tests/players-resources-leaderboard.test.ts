import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Atlas } from "../target/types/atlas";
import { expect } from "chai";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";

describe("atlas — players, resources & leaderboard", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Atlas as Program<Atlas>;

  const player = Keypair.generate();
  let worldId: number;
  let realTreasury: anchor.web3.PublicKey;

  const getGlobalConfigPDA = () =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("atlas_config")],
      program.programId
    )[0];

  const getWorldConfigPDA = (id: number) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("world_config"), new BN(id).toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];

  const getWorldStatePDA = (id: number, epoch: number) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("world_state"),
        new BN(id).toArrayLike(Buffer, "le", 8),
        new BN(epoch).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];

  const getPlayerPDA = (id: number, owner: anchor.web3.PublicKey) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("player"), new BN(id).toArrayLike(Buffer, "le", 8), owner.toBuffer()],
      program.programId
    )[0];

  const getLeaderboardPDA = (id: number, epoch: number) =>
    anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("leaderboard"),
        new BN(id).toArrayLike(Buffer, "le", 8),
        new BN(epoch).toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];

  before(async () => {
    // Transferencia directa en vez de airdrop — evita el rate limit del faucet
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: player.publicKey,
        lamports: Math.floor(0.2 * anchor.web3.LAMPORTS_PER_SOL),
      })
    );
    await provider.sendAndConfirm(tx);

    // El protocolo puede ya existir de una corrida anterior contra devnet
    // persistente — leemos el treasury real en ese caso.
    try {
      const existing = await program.account.globalConfig.fetch(getGlobalConfigPDA());
      realTreasury = existing.treasury;
    } catch {
      const treasury = Keypair.generate();
      await program.methods
        .initializeProtocol(treasury.publicKey)
        .accounts({
          globalConfig: getGlobalConfigPDA(),
          authority: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      realTreasury = treasury.publicKey;
    }

    const globalConfig = await program.account.globalConfig.fetch(getGlobalConfigPDA());
    worldId = Number(globalConfig.worldCount);

    await program.methods
      .createWorld(
        "Test World",
        { gaming: {} },
        { public: {} },
        new BN(10), // pocos recursos para poder agotar en test
        new BN(604800),
        new BN(2), // cooldown corto: 2 segundos
        0, // maxDailyCollects — antes faltaba este argumento
        [
          { id: 0, name: "common", points: new BN(1), cooldownSeconds: new BN(0) },
          { id: 1, name: "rare", points: new BN(3), cooldownSeconds: new BN(0) },
        ]
      )
      .accounts({
        globalConfig: getGlobalConfigPDA(),
        worldConfig: getWorldConfigPDA(worldId),
        worldState: getWorldStatePDA(worldId, 0),
        treasury: realTreasury,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .createLeaderboard()
      .accounts({
        worldConfig: getWorldConfigPDA(worldId),
        leaderboard: getLeaderboardPDA(worldId, 0),
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("mintea un player en el mundo público", async () => {
    await program.methods
      .mintPlayer("TestHero", "https://gateway.irys.xyz/test")
      .accounts({
        globalConfig: getGlobalConfigPDA(), // antes faltaba — requerido para el check de pauseProtocol
        worldConfig: getWorldConfigPDA(worldId),
        player: getPlayerPDA(worldId, player.publicKey),
        owner: player.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([player])
      .rpc();

    const p = await program.account.player.fetch(getPlayerPDA(worldId, player.publicKey));
    expect(p.name).to.equal("TestHero");
    expect(p.level.toNumber()).to.equal(1);
    expect(p.resourcesCollected.toNumber()).to.equal(0);
  });

  it("recolecta un recurso 'rare' y suma 3 puntos", async () => {
    await program.methods
      .collectResource(1) // rare
      .accounts({
        globalConfig: getGlobalConfigPDA(), // antes faltaba
        worldConfig: getWorldConfigPDA(worldId),
        worldState: getWorldStatePDA(worldId, 0),
        player: getPlayerPDA(worldId, player.publicKey),
        leaderboard: getLeaderboardPDA(worldId, 0),
        owner: player.publicKey,
      })
      .signers([player])
      .rpc();

    const p = await program.account.player.fetch(getPlayerPDA(worldId, player.publicKey));
    expect(p.resourcesCollected.toNumber()).to.equal(3);
  });

  it("aparece en el leaderboard del epoch 0", async () => {
    const lb = await program.account.leaderboard.fetch(getLeaderboardPDA(worldId, 0));
    const entry = lb.entries.find(
      (e) => e.owner.toBase58() === player.publicKey.toBase58()
    );
    expect(entry).to.not.be.undefined;
    expect(entry!.resourcesCollected.toNumber()).to.equal(3);
  });

  it("falla si el tipo de recurso no existe en el mundo", async () => {
    try {
      await program.methods
        .collectResource(7) // no existe en este mundo
        .accounts({
          globalConfig: getGlobalConfigPDA(),
          worldConfig: getWorldConfigPDA(worldId),
          worldState: getWorldStatePDA(worldId, 0),
          player: getPlayerPDA(worldId, player.publicKey),
          leaderboard: getLeaderboardPDA(worldId, 0),
          owner: player.publicKey,
        })
        .signers([player])
        .rpc();
      expect.fail("Debería haber fallado con InvalidResourceType");
    } catch (err: any) {
      expect(err.error?.errorCode?.code).to.equal("InvalidResourceType");
    }
  });
});
