import chalk from "chalk"
import ora from "ora"
import { getAtlasClient } from "../client"
import { loadConfig } from "../config"

interface CollectOptions {
  type?: string
  world?: string
}

export async function collectCommand(options: CollectOptions) {
  const config = loadConfig()
  const worldId = options.world ? parseInt(options.world, 10) : config.defaultWorldId

  if (worldId === undefined) {
    console.log(chalk.red("\n❌ No hay un mundo por defecto. Usa --world <id>.\n"))
    return
  }

  const resourceTypeId = options.type ? parseInt(options.type, 10) : 0

  console.log(chalk.bold.cyan(`\n⛏️  Recolectar recurso (mundo ${worldId})\n`))
  const spinner = ora("Recolectando...").start()

  try {
    const atlas = getAtlasClient()
    const result = await atlas.resource.collect({ worldId, resourceTypeId })

    spinner.succeed(
      chalk.green(`+${result.points} pts (${result.resourceType.name}) — Nivel ${result.newLevel}`)
    )
    console.log(chalk.gray(`\nProgreso del mundo: ${result.worldProgress}`))
    if (result.epochEnded) {
      console.log(chalk.yellow("\n⚡ ¡El mundo se agotó! El epoch avanzará."))
      console.log(chalk.gray("El authority debe correr advance-epoch y create-leaderboard."))
    }
    console.log(chalk.gray(`\nSignature: ${result.signature}\n`))
  } catch (err: any) {
    spinner.fail(chalk.red("Error al recolectar"))
    console.error(chalk.red(err.message ?? err))
  }
}
