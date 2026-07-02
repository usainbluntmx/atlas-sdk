import chalk from "chalk"
import { getAtlasClient } from "../client"
import { loadConfig } from "../config"

interface LeaderboardOptions {
  world?: string
  epoch?: string
}

const MEDALS = ["🥇", "🥈", "🥉"]

export async function leaderboardCommand(options: LeaderboardOptions) {
  const config = loadConfig()
  const worldId = options.world ? parseInt(options.world, 10) : config.defaultWorldId

  if (worldId === undefined) {
    console.log(chalk.red("\n❌ No hay un mundo por defecto. Usa --world <id>.\n"))
    return
  }

  const epoch = options.epoch ? parseInt(options.epoch, 10) : undefined

  const atlas = getAtlasClient()
  const lb = await atlas.leaderboard.get(worldId, { epoch })

  if (!lb) {
    console.log(chalk.red(`\n❌ Leaderboard no encontrado (¿ya se creó para este epoch?)\n`))
    return
  }

  console.log(chalk.bold.cyan(`\n🏆 Leaderboard — mundo ${worldId}, epoch ${lb.epoch}\n`))

  if (lb.entries.length === 0) {
    console.log(chalk.gray("  Sin entradas todavía.\n"))
    return
  }

  lb.entries.forEach((entry, i) => {
    const medal = MEDALS[i] ?? `  ${i + 1}.`
    console.log(
      `  ${medal} ${entry.name.padEnd(20)} ${chalk.cyan(entry.resourcesCollected + " pts")}  (Nivel ${entry.level})`
    )
  })
  console.log()
}
