import { AtlasClient } from "@atlas-world/sdk"
import { loadConfig, loadWallet } from "./config"

export function getAtlasClient(): AtlasClient {
  const config = loadConfig()
  const wallet = loadWallet(config.walletPath)

  return new AtlasClient({
    network: config.network,
    wallet,
    programId: config.programId,
  })
}
