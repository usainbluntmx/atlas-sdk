import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { Keypair } from "@solana/web3.js"

const CONFIG_PATH = path.join(os.homedir(), ".atlas", "config.json")

export interface AtlasMcpConfig {
  network: "devnet" | "mainnet-beta"
  walletPath: string
  defaultWorldId?: number
  programId?: string
}

/**
 * Carga la configuración desde ~/.atlas/config.json — el mismo archivo
 * que usa @atlas-world/cli. Si ya corriste `atlas-cli init`, el servidor
 * MCP queda configurado automáticamente, sin pasos adicionales.
 *
 * También acepta override por variables de entorno, útil quien corre
 * el servidor MCP en un contexto sin CLI previamente configurado:
 *   ATLAS_NETWORK, ATLAS_WALLET_PATH, ATLAS_WORLD_ID
 */
export function loadConfig(): AtlasMcpConfig {
  const envNetwork = process.env.ATLAS_NETWORK as "devnet" | "mainnet-beta" | undefined
  const envWalletPath = process.env.ATLAS_WALLET_PATH
  const envWorldId = process.env.ATLAS_WORLD_ID

  if (fs.existsSync(CONFIG_PATH)) {
    const fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) as AtlasMcpConfig
    return {
      network: envNetwork ?? fileConfig.network ?? "devnet",
      walletPath: envWalletPath ?? fileConfig.walletPath,
      defaultWorldId: envWorldId ? parseInt(envWorldId, 10) : fileConfig.defaultWorldId,
      programId: fileConfig.programId,
    }
  }

  if (!envWalletPath) {
    throw new Error(
      "No hay configuración de Atlas. Corre `atlas-cli init` primero, " +
      "o define ATLAS_WALLET_PATH y ATLAS_NETWORK como variables de entorno."
    )
  }

  return {
    network: envNetwork ?? "devnet",
    walletPath: envWalletPath,
    defaultWorldId: envWorldId ? parseInt(envWorldId, 10) : undefined,
  }
}

export function loadWallet(walletPath: string) {
  const resolved = walletPath.replace(/^~/, os.homedir())
  if (!fs.existsSync(resolved)) {
    throw new Error(`No se encontró el keypair en: ${resolved}`)
  }
  const secretKey = JSON.parse(fs.readFileSync(resolved, "utf-8"))
  const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey))

  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx: any) => {
      tx.partialSign(keypair)
      return tx
    },
    signAllTransactions: async (txs: any[]) => {
      txs.forEach((tx) => tx.partialSign(keypair))
      return txs
    },
    payer: keypair,
  }
}
