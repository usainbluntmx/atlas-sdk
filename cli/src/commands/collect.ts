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
    console.log(chalk.gray(`Progreso del mundo: ${result.worldProgress}`))
    console.log(chalk.gray(`Signature: ${result.signature}`))

    if (result.epochEnded) {
      console.log(
        chalk.bold.yellow(
          "\n⚡ ¡El mundo acaba de agotarse! Ya no acepta más recolectas hasta que avances el epoch."
        )
      )
      console.log(chalk.yellow("   Corre esto para reactivarlo:\n"))
      console.log(chalk.bold("     atlas-cli advance-epoch\n"))
      console.log(
        chalk.gray(
          "   Tip: deja `atlas-cli watch` corriendo en otra terminal y esto pasa automáticamente.\n"
        )
      )
    }
  } catch (err: any) {
    const code = err.error?.errorCode?.code
    if (code === "EpochMismatch") {
      spinner.fail(chalk.red("El mundo está agotado y esperando avanzar de epoch"))
      console.log(chalk.yellow("\n   Corre esto para reactivarlo:\n"))
      console.log(chalk.bold("     atlas-cli advance-epoch\n"))
    } else {
      spinner.fail(chalk.red("Error al recolectar"))
      console.error(chalk.red(err.message ?? err))
    }
  }
}
