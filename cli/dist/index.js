#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const init_1 = require("./commands/init");
const createWorld_1 = require("./commands/createWorld");
const mintPlayer_1 = require("./commands/mintPlayer");
const collect_1 = require("./commands/collect");
const status_1 = require("./commands/status");
const leaderboard_1 = require("./commands/leaderboard");
const admin_1 = require("./commands/admin");
const watch_1 = require("./commands/watch");
const closeWorld_1 = require("./commands/closeWorld");
const quickstart_1 = require("./commands/quickstart");
// Manejador global — sin esto, un error de config/wallet faltante se
// escapa como stack trace crudo de Anchor en vez de un mensaje claro.
process.on("unhandledRejection", (err) => {
    const msg = err?.message ?? String(err);
    console.error(chalk_1.default.red(`\n❌ ${msg}\n`));
    process.exit(1);
});
const program = new commander_1.Command();
program
    .name("atlas-cli")
    .description(chalk_1.default.cyan("Atlas World Protocol") + " — crea y administra mundos persistentes en Solana")
    .version("1.2.0");
program
    .command("init")
    .description("Configura tu wallet y red por primera vez")
    .action(init_1.initCommand);
program
    .command("quickstart")
    .description("Demo en un comando: crea mundo + mintea player + keeper corriendo")
    .action(quickstart_1.quickstartCommand);
program
    .command("create-world")
    .description("Crea un nuevo mundo (interactivo, con templates de GameFi/DAO/Marketplace)")
    .action(createWorld_1.createWorldCommand);
program
    .command("close-world")
    .description("[authority] Cierra un mundo y devuelve el rent")
    .option("-w, --world <id>", "worldId (usa el default si se omite)")
    .action(closeWorld_1.closeWorldCommand);
program
    .command("mint-player")
    .description("Mintea tu player en un mundo")
    .option("-n, --name <name>", "Nombre del player")
    .option("-w, --world <id>", "worldId (usa el default si se omite)")
    .action(mintPlayer_1.mintPlayerCommand);
program
    .command("collect")
    .description("Recolecta un recurso del mundo")
    .option("-t, --type <id>", "ID del tipo de recurso (default: 0)")
    .option("-w, --world <id>", "worldId (usa el default si se omite)")
    .action(collect_1.collectCommand);
program
    .command("status")
    .description("Muestra el estado del mundo y tu progreso")
    .option("-w, --world <id>", "worldId (usa el default si se omite)")
    .action(status_1.statusCommand);
program
    .command("leaderboard")
    .description("Muestra el leaderboard del mundo")
    .option("-w, --world <id>", "worldId (usa el default si se omite)")
    .option("-e, --epoch <n>", "Epoch específico (default: epoch actual)")
    .action(leaderboard_1.leaderboardCommand);
program
    .command("advance-epoch")
    .description("[authority] Avanza el epoch después de un WorldReset")
    .option("-w, --world <id>", "worldId (usa el default si se omite)")
    .action(admin_1.advanceEpochCommand);
program
    .command("watch")
    .description("[authority] Keeper de desarrollo — avanza epochs automáticamente cuando el mundo se agota")
    .option("-w, --world <id>", "worldId (usa el default si se omite)")
    .action(watch_1.watchCommand);
program
    .command("pause")
    .description("[protocol authority] Emergency stop — pausa todo el protocolo")
    .action(admin_1.pauseCommand);
program
    .command("unpause")
    .description("[protocol authority] Reactiva el protocolo")
    .action(admin_1.unpauseCommand);
program.parseAsync().catch((err) => {
    console.error(chalk_1.default.red(`\n❌ ${err.message ?? err}\n`));
    process.exit(1);
});
//# sourceMappingURL=index.js.map