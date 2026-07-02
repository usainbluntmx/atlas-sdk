import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { Keypair } from "@solana/web3.js"

const CONFIG_DIR = path.join(os.homedir(), ".atlas")
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json")

export interface AtlasCliConfig {
  network: "devnet" | "mainnet-beta"
  walletPath: string
  defaultWorldId?: number
  programId?: string
}

const DEFAULT_CONFIG: AtlasCliConfig = {
  network: "devnet",
  walletPath: path.join(os.homedir(), ".config/solana/id.json"),
}

export function configExists(): boolean {
  return fs.existsSync(CONFIG_PATH)
}

export function loadConfig(): AtlasCliConfig {
  if (!configExists()) {
    throw new Error(
      "No hay configuración de Atlas CLI. Corre `atlas-cli init` primero."
    )
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8")
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
}

export function saveConfig(config: Partial<AtlasCliConfig>): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
  const current = configExists() ? loadConfig() : DEFAULT_CONFIG
  const merged = { ...current, ...config }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2))
}

/**
 * Carga el keypair local y lo envuelve en una interfaz compatible
 * con wallet-adapter para usar con AtlasClient.
 */
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
