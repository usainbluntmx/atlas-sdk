import chalk from "chalk"
import ora from "ora"
import { WorldType, WorldVisibility } from "@atlas-world/core"
import { getAtlasClient } from "../client"
import { saveConfig } from "../config"

const POLL_INTERVAL_MS = 2000

/**
 * Un solo comando para demostraciones: crea un mundo pequeño con
 * defaults sensatos, mintea tu player, y deja un keeper corriendo
 * para que los epochs avancen solos — todo en un proceso.
 *
 * Pensado para hackathons y demos rápidas, no para configurar un
 * mundo real (para eso, usa `create-world` interactivo).
 */
export async function quickstartCommand() {
  console.log(chalk.bold.cyan("\n🚀 Atlas Quickstart — demo en un comando\n"))

  const atlas = getAtlasClient()

  // ─── Crear mundo con defaults de demo ──────────────────────────────────────
  const spinner = ora("Creando mundo de demo...").start()
  const { worldId } = await atlas.world.create({
    name: `Quickstart Demo ${Date.now().toString().slice(-4)}`,
    worldType: WorldType.Gaming,
    visibility: WorldVisibility.Public,
    totalResources: 20,
    epochDuration: "1d",
    globalCooldown: 2,
    maxDailyCollects: 0,
    resourceTypes: [
      { id: 0, name: "common", points: 1, cooldownSeconds: 2 },
      { id: 1, name: "rare", points: 3, cooldownSeconds: 4 },
      { id: 2, name: "epic", points: 5, cooldownSeconds: 8 },
    ],
  })
  await atlas.world.createLeaderboard(worldId)
  saveConfig({ defaultWorldId: worldId })
  spinner.succeed(chalk.green(`Mundo creado — worldId: ${worldId} (20 recursos, cooldown corto para demo)`))

  // ─── Mintear player ─────────────────────────────────────────────────────────
  const spinner2 = ora("Minteando tu player...").start()
  const owner = (atlas.program.provider as any).wallet.publicKey
  const name = `Demo_${owner.toBase58().slice(0, 4)}`
  await atlas.player.mint({ worldId, name })
  spinner2.succeed(chalk.green(`Player "${name}" minteado`))

  console.log(chalk.bold("\n✅ Todo listo. Prueba esto en otra terminal:\n"))
  console.log(`  atlas-cli collect --type 0`)
  console.log(`  atlas-cli status`)
  console.log(`  atlas-cli leaderboard\n`)

  console.log(chalk.gray("Dejando un keeper corriendo aquí — los epochs avanzarán solos."))
  console.log(chalk.gray("Ctrl+C para detener.\n"))

  // ─── Keeper en el mismo proceso ─────────────────────────────────────────────
  let stopped = false
  let lastEpochSeen = 0

  process.on("SIGINT", () => {
    stopped = true
    console.log(chalk.gray("\n\nQuickstart detenido.\n"))
    process.exit(0)
  })

  while (!stopped) {
    try {
      const world = await atlas.world.get(worldId)
      if (world?.pendingAdvance) {
        console.log(chalk.yellow(`\n⚡ Epoch ${lastEpochSeen} terminó — avanzando...`))
        await atlas.world.advanceEpoch(worldId)
        await atlas.world.createLeaderboard(worldId)
        lastEpochSeen = world.config.currentEpoch
        console.log(chalk.green(`✅ Epoch ${lastEpochSeen} listo\n`))
      } else if (world) {
        lastEpochSeen = world.config.currentEpoch
      }
    } catch {
      // silencioso — reintenta en el siguiente ciclo
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}
