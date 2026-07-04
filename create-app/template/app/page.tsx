"use client"

import { useWallet } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import {
  AtlasWorldProgress,
  AtlasLeaderboard,
  AtlasPlayerCard,
  AtlasCollectButton,
  useWorld,
} from "@atlas-world/react"
import { AtlasClient } from "@atlas-world/sdk"
import { WORLD_ID, NETWORK } from "@/lib/atlas-config"

export default function Home() {
  const wallet = useWallet()
  const { connected, publicKey } = wallet
  const { world } = useWorld(WORLD_ID)

  const handleMint = async () => {
    if (!connected) return
    const atlas = new AtlasClient({ network: NETWORK, wallet: wallet as any })
    const name = `Explorer_${publicKey?.toBase58().slice(0, 4)}`
    await atlas.player.mint({ worldId: WORLD_ID, name })
    // Recarga simple para reflejar el nuevo player — en producción,
    // usa el patrón de refetch de usePlayer() en tu propia UI.
    window.location.reload()
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "40px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <header style={{ textAlign: "center", marginBottom: 12 }}>
        <div
          style={{
            width: 32,
            height: 32,
            border: "2px solid #00C2A8",
            transform: "rotate(45deg)",
            margin: "0 auto 16px",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 4,
              background: "#00C2A8",
            }}
          />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>
          Mi Mundo Atlas
        </h1>
        <p style={{ color: "#9CA3AF", fontSize: 13 }}>
          Construido con{" "}
          <a
            href="https://github.com/usainbluntmx/atlas-sdk"
            style={{ color: "#00C2A8" }}
          >
            Atlas World Protocol
          </a>
        </p>
      </header>

      <div style={{ display: "flex", justifyContent: "center" }}>
        <WalletMultiButton />
      </div>

      {!connected && (
        <p style={{ textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
          Conecta tu wallet de Phantom en Devnet para empezar.
        </p>
      )}

      {connected && (
        <>
          <AtlasWorldProgress worldId={WORLD_ID} showCountdown />

          <AtlasPlayerCard worldId={WORLD_ID} onMint={handleMint} />

          {world && (
            <div
              style={{
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {world.config.resourceTypes.map((rt) => (
                <AtlasCollectButton
                  key={rt.id}
                  worldId={WORLD_ID}
                  resourceTypeId={rt.id}
                  label={`Recolectar ${rt.name}`}
                />
              ))}
            </div>
          )}

          <AtlasLeaderboard
            worldId={WORLD_ID}
            limit={10}
            highlightWallet={publicKey?.toBase58()}
          />
        </>
      )}

      <footer
        style={{
          textAlign: "center",
          marginTop: 24,
          fontSize: 11,
          color: "#4B5563",
        }}
      >
        worldId {WORLD_ID} · {NETWORK} · npm install @atlas-world/sdk
      </footer>
    </main>
  )
}
