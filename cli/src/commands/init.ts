import inquirer from "inquirer"
import chalk from "chalk"
import * as fs from "fs"
import * as os from "os"
import { saveConfig, configExists, loadConfig } from "../config"

export async function initCommand() {
  console.log(chalk.bold.cyan("\n🌍 Atlas World Protocol — Setup\n"))

  if (configExists()) {
    const current = loadConfig()
    console.log(chalk.yellow("Ya existe una configuración:"))
    console.log(`  Red: ${current.network}`)
    console.log(`  Wallet: ${current.walletPath}\n`)

    const { overwrite } = await inquirer.prompt([
      {
        type: "confirm",
        name: "overwrite",
        message: "¿Quieres sobreescribirla?",
        default: false,
      },
    ])
    if (!overwrite) {
      console.log(chalk.gray("Setup cancelado."))
      return
    }
  }

  const defaultWalletPath = `${os.homedir()}/.config/solana/id.json`
  const walletExists = fs.existsSync(defaultWalletPath)

  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "network",
      message: "¿En qué red vas a trabajar?",
      choices: [
        { name: "Devnet (recomendado para desarrollo)", value: "devnet" },
        { name: "Mainnet-Beta", value: "mainnet-beta" },
      ],
      default: "devnet",
    },
    {
      type: "input",
      name: "walletPath",
      message: "Ruta a tu keypair de Solana:",
      default: defaultWalletPath,
      validate: (input: string) => {
        const resolved = input.replace(/^~/, os.homedir())
        return fs.existsSync(resolved)
          ? true
          : `No se encontró un keypair en ${resolved}. Genera uno con: solana-keygen new`
      },
    },
  ])

  saveConfig({
    network: answers.network,
    walletPath: answers.walletPath,
  })

  console.log(chalk.green("\n✅ Configuración guardada en ~/.atlas/config.json"))
  console.log(chalk.gray(`\nSiguiente paso: atlas-cli create-world\n`))
}
