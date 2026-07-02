import chalk from "chalk"
import { getAtlasClient } from "../client"
import { loadConfig } from "../config"

interface StatusOptions {
  world?: string
}

function bar(pct: number, width = 24): string {
  const filled = Math.round((pct / 100) * width)
  return "█".repeat(filled) + "░".repeat(width - filled)
}

export async function statusCommand(options: StatusOptions) {
  const config = loadConfig()
  const worldId = options.world ? parseInt(options.world, 10) : config.defaultWorldId

  if (worldId === undefined) {
    console.log(chalk.red("\n❌ No hay un mundo por defecto. Usa --world <id>.\n"))
    return
  }

  const atlas = getAtlasClient()
  const world = await atlas.world.get(worldId)

  if (!world) {
    console.log(chalk.red(`\n❌ No se encontró el mundo ${worldId}\n`))
    return
  }

  const visibilityLabel = world.config.visibility === 0 ? "Público" : "Privado"

  console.log(chalk.bold.cyan(`\n🌍 ${world.config.name}`) + chalk.gray(`  (worldId: ${worldId})\n`))
  console.log(`  Visibilidad:  ${visibilityLabel}`)
  console.log(`  Epoch actual: ${world.config.currentEpoch}`)
  console.log(`  Cooldown:     ${world.config.globalCooldown}s`)

  if (world.pendingAdvance) {
    console.log(chalk.yellow(`\n  ⚠️  El epoch avanzó pero falta correr advance-epoch\n`))
  } else {
    console.log(
      `\n  Progreso: ${chalk.cyan(bar(world.progress))} ${world.progress}%  (${world.state.resourcesCollected}/${world.config.totalResources})`
    )
    if (world.exhausted) {
      console.log(chalk.yellow(`  ⚡ Mundo agotado — esperando reset`))
    }
  }

  console.log(chalk.bold(`\n  Tipos de recurso:`))
  world.config.resourceTypes.forEach((rt) => {
    console.log(`    • ${rt.name} — ${rt.points} pts, cooldown ${rt.cooldownSeconds}s`)
  })

  const player = await atlas.player.get(worldId)
  if (player) {
    console.log(chalk.bold(`\n  Tu player:`))
    console.log(`    Nombre: ${player.name}`)
    console.log(`    Nivel:  ${player.level}`)
    console.log(`    Puntos: ${player.resourcesCollected}`)
  } else {
    console.log(chalk.gray(`\n  No tienes un player en este mundo. Corre: atlas-cli mint-player`))
  }

  console.log()
}
