import inquirer from "inquirer"
import chalk from "chalk"
import ora from "ora"
import { getAtlasClient } from "../client"
import { loadConfig } from "../config"

interface CloseWorldOptions {
  world?: string
}

export async function closeWorldCommand(options: CloseWorldOptions) {
  const config = loadConfig()
  const worldId = options.world ? parseInt(options.world, 10) : config.defaultWorldId

  if (worldId === undefined) {
    console.log(chalk.red("\n❌ No hay un mundo por defecto. Usa --world <id>.\n"))
    return
  }

  console.log(chalk.bold.cyan(`\n🗑️  Cerrar mundo ${worldId}\n`))
  console.log(
    chalk.yellow(
      "⚠️  Esto es permanente. El WorldConfig se cierra y no se puede recuperar.\n" +
      "   El historial de leaderboards de epochs pasados NO se borra — solo\n" +
      "   se cierra la configuración del mundo. El rent se devuelve a tu wallet.\n"
    )
  )

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `¿Cerrar el mundo ${worldId} definitivamente?`,
      default: false,
    },
  ])

  if (!confirm) {
    console.log(chalk.gray("Cancelado.\n"))
    return
  }

  const spinner = ora("Cerrando mundo...").start()

  try {
    const atlas = getAtlasClient()
    const { signature, lamportsRecovered } = await atlas.world.closeWorld(worldId)
    const solRecovered = lamportsRecovered / 1e9

    spinner.succeed(chalk.green(`Mundo ${worldId} cerrado`))
    console.log(chalk.gray(`\nRent recuperado: ~${solRecovered.toFixed(4)} SOL`))
    console.log(chalk.gray(`Signature: ${signature}\n`))
  } catch (err: any) {
    spinner.fail(chalk.red("Error al cerrar el mundo"))
    console.error(chalk.red(err.message ?? err))
  }
}
