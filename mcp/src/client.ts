import { AtlasClient } from "@atlas-world/sdk"
import { loadConfig, loadWallet } from "./config"

let cachedClient: AtlasClient | null = null

/**
 * Obtiene (y cachea) el AtlasClient para esta sesión del servidor MCP.
 * Un solo cliente se reutiliza entre llamadas de herramientas.
 */
export function getAtlasClient(): AtlasClient {
  if (cachedClient) return cachedClient

  const config = loadConfig()
  const wallet = loadWallet(config.walletPath)

  cachedClient = new AtlasClient({
    network: config.network,
    wallet,
    programId: config.programId,
  })

  return cachedClient
}

export function getDefaultWorldId(): number | undefined {
  return loadConfig().defaultWorldId
}
