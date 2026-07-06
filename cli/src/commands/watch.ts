import chalk from "chalk"
import { getAtlasClient } from "../client"
import { loadConfig } from "../config"

interface WatchOptions {
  world?: string
}

const POLL_INTERVAL_MS = 4000

/**
 * Keeper de desarrollo. Revisa el mundo cada 4 segundos (polling) y,
 * cuando detecta que se agotó, avanza el epoch y crea el leaderboard
 * automáticamente — para que puedas seguir probando sin interrupciones.
 *
 * Usamos polling como mecanismo PRINCIPAL, no un evento WorldReset,
 * porque el WebSocket del RPC público de Devnet puede no entregar
 * eventos de forma confiable. El polling garantiza que esto funcione
 * siempre, aunque tarde unos segundos más que un evento instantáneo.
 *
 * Esto NO es para producción — es una conveniencia de desarrollo local.
 * En producción, corre esta misma lógica como tu propio backend/keeper,
 * idealmente con un RPC dedicado (Helius, QuickNode).
 */
export async function watchCommand(options: WatchOptions) {
  const config = loadConfig()
  const worldId = options.world ? parseInt(options.world, 10) : config.defaultWorldId

  if (worldId === undefined) {
    console.log(chalk.red("\n❌ No hay un mundo por defecto. Usa --world <id>.\n"))
    return
  }

  const atlas = getAtlasClient()

  console.log(chalk.bold.cyan(`\n👁  Watching mundo ${worldId} — Ctrl+C para detener\n`))
  console.log(chalk.gray(`Revisando cada ${POLL_INTERVAL_MS / 1000}s. Cuando el mundo se agote, avanzo el epoch solo.\n`))

  let stopped = false
  let lastEpochSeen: number | null = null

  process.on("SIGINT", () => {
    stopped = true
    console.log(chalk.gray("\n\nWatch detenido.\n"))
    process.exit(0)
  })

  while (!stopped) {
    try {
      const world = await atlas.world.get(worldId)

      if (!world) {
        console.log(chalk.red(`❌ Mundo ${worldId} no encontrado. Deteniendo.\n`))
        break
      }

      if (lastEpochSeen === null) {
        lastEpochSeen = world.config.currentEpoch
        console.log(chalk.gray(`   Epoch actual: ${world.config.currentEpoch} · progreso: ${world.progress}%`))
      }

      // El epoch ya avanzó (currentEpoch subió) pero el WorldState del
      // nuevo epoch no existe todavía — hay que crearlo.
      if (world.pendingAdvance) {
        console.log(
          chalk.yellow(`\n⚡ Epoch ${lastEpochSeen} terminó — avanzando a epoch ${world.config.currentEpoch}...`)
        )
        await atlas.world.advanceEpoch(worldId)
        await atlas.world.createLeaderboard(worldId)
        lastEpochSeen = world.config.currentEpoch
        console.log(chalk.green(`✅ Epoch ${lastEpochSeen} listo — el mundo sigue aceptando recolectas\n`))
      } else if (world.config.currentEpoch !== lastEpochSeen) {
        // Actualizar referencia si avanzó por otra vía (otro authority, etc.)
        lastEpochSeen = world.config.currentEpoch
      }
    } catch (err: any) {
      console.log(chalk.red(`⚠️  Error revisando el mundo: ${err.message ?? err}`))
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
  }
}
