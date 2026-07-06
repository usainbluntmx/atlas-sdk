#!/usr/bin/env node

import { Command } from "commander"
import chalk from "chalk"
import { initCommand } from "./commands/init"
import { createWorldCommand } from "./commands/createWorld"
import { mintPlayerCommand } from "./commands/mintPlayer"
import { collectCommand } from "./commands/collect"
import { statusCommand } from "./commands/status"
import { leaderboardCommand } from "./commands/leaderboard"
import { advanceEpochCommand, pauseCommand, unpauseCommand } from "./commands/admin"
import { watchCommand } from "./commands/watch"

// Manejador global — sin esto, un error de config/wallet faltante se
// escapa como stack trace crudo de Anchor en vez de un mensaje claro.
process.on("unhandledRejection", (err: any) => {
  const msg = err?.message ?? String(err)
  console.error(chalk.red(`\n❌ ${msg}\n`))
  process.exit(1)
})

const program = new Command()

program
  .name("atlas-cli")
  .description(
    chalk.cyan("Atlas World Protocol") + " — crea y administra mundos persistentes en Solana"
  )
  .version("1.1.0")

program
  .command("init")
  .description("Configura tu wallet y red por primera vez")
  .action(initCommand)

program
  .command("create-world")
  .description("Crea un nuevo mundo (interactivo, con templates de GameFi/DAO/Marketplace)")
  .action(createWorldCommand)

program
  .command("mint-player")
  .description("Mintea tu player en un mundo")
  .option("-n, --name <name>", "Nombre del player")
  .option("-w, --world <id>", "worldId (usa el default si se omite)")
  .action(mintPlayerCommand)

program
  .command("collect")
  .description("Recolecta un recurso del mundo")
  .option("-t, --type <id>", "ID del tipo de recurso (default: 0)")
  .option("-w, --world <id>", "worldId (usa el default si se omite)")
  .action(collectCommand)

program
  .command("status")
  .description("Muestra el estado del mundo y tu progreso")
  .option("-w, --world <id>", "worldId (usa el default si se omite)")
  .action(statusCommand)

program
  .command("leaderboard")
  .description("Muestra el leaderboard del mundo")
  .option("-w, --world <id>", "worldId (usa el default si se omite)")
  .option("-e, --epoch <n>", "Epoch específico (default: epoch actual)")
  .action(leaderboardCommand)

program
  .command("advance-epoch")
  .description("[authority] Avanza el epoch después de un WorldReset")
  .option("-w, --world <id>", "worldId (usa el default si se omite)")
  .action(advanceEpochCommand)

program
  .command("watch")
  .description("[authority] Keeper de desarrollo — avanza epochs automáticamente cuando el mundo se agota")
  .option("-w, --world <id>", "worldId (usa el default si se omite)")
  .action(watchCommand)

program
  .command("pause")
  .description("[protocol authority] Emergency stop — pausa todo el protocolo")
  .action(pauseCommand)

program
  .command("unpause")
  .description("[protocol authority] Reactiva el protocolo")
  .action(unpauseCommand)

program.parseAsync().catch((err) => {
  console.error(chalk.red(`\n❌ ${err.message ?? err}\n`))
  process.exit(1)
})
