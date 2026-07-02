import chalk from "chalk"
import ora from "ora"
import { getAtlasClient } from "../client"
import { loadConfig } from "../config"

interface WorldOptions {
  world?: string
}

export async function advanceEpochCommand(options: WorldOptions) {
  const config = loadConfig()
  const worldId = options.world ? parseInt(options.world, 10) : config.defaultWorldId

  if (worldId === undefined) {
    console.log(chalk.red("\n❌ No hay un mundo por defecto. Usa --world <id>.\n"))
    return
  }

  const spinner = ora("Avanzando epoch...").start()
  try {
    const atlas = getAtlasClient()
    await atlas.world.advanceEpoch(worldId)
    await atlas.world.createLeaderboard(worldId)
    spinner.succeed(chalk.green("Epoch avanzado y leaderboard creado"))
  } catch (err: any) {
    spinner.fail(chalk.red("Error al avanzar epoch"))
    console.error(chalk.red(err.message ?? err))
  }
}

export async function pauseCommand() {
  const spinner = ora("Pausando protocolo (emergency stop)...").start()
  try {
    const atlas = getAtlasClient()
    await atlas.pauseProtocol()
    spinner.succeed(chalk.yellow("⏸  Protocolo pausado — create_world, mint_player y collect_resource están bloqueados"))
  } catch (err: any) {
    spinner.fail(chalk.red("Error al pausar"))
    console.error(chalk.red(err.message ?? err))
  }
}

export async function unpauseCommand() {
  const spinner = ora("Reactivando protocolo...").start()
  try {
    const atlas = getAtlasClient()
    await atlas.unpauseProtocol()
    spinner.succeed(chalk.green("▶️  Protocolo reactivado"))
  } catch (err: any) {
    spinner.fail(chalk.red("Error al reactivar"))
    console.error(chalk.red(err.message ?? err))
  }
}
