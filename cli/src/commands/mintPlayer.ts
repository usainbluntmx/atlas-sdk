import chalk from "chalk"
import ora from "ora"
import { getAtlasClient } from "../client"
import { loadConfig } from "../config"

interface MintPlayerOptions {
  name?: string
  world?: string
}

export async function mintPlayerCommand(options: MintPlayerOptions) {
  const config = loadConfig()
  const worldId = options.world ? parseInt(options.world, 10) : config.defaultWorldId

  if (worldId === undefined) {
    console.log(
      chalk.red("\n❌ No hay un mundo por defecto. Usa --world <id> o corre `atlas-cli create-world` primero.\n")
    )
    return
  }

  const name = options.name ?? `Explorer_${Date.now().toString().slice(-4)}`

  console.log(chalk.bold.cyan(`\n👤 Mint Player en mundo ${worldId}\n`))
  const spinner = ora(`Minteando "${name}"...`).start()

  try {
    const atlas = getAtlasClient()

    const alreadyExists = await atlas.player.exists(worldId)
    if (alreadyExists) {
      spinner.info(chalk.yellow("Ya tienes un player en este mundo."))
      const player = await atlas.player.get(worldId)
      console.log(`\n  Nombre: ${player?.name}`)
      console.log(`  Nivel: ${player?.level}`)
      console.log(`  Puntos: ${player?.resourcesCollected}\n`)
      return
    }

    const { signature } = await atlas.player.mint({ worldId, name })
    spinner.succeed(chalk.green(`Player "${name}" minteado`))
    console.log(chalk.gray(`\nSignature: ${signature}`))
    console.log(chalk.gray(`Explorer: https://solscan.io/tx/${signature}?cluster=${atlas.network}\n`))
    console.log(chalk.bold("Siguiente paso:"))
    console.log(`  atlas-cli collect --type 0\n`)
  } catch (err: any) {
    spinner.fail(chalk.red("Error al mintear player"))
    console.error(chalk.red(err.message ?? err))
  }
}
