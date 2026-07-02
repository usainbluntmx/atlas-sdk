"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusCommand = statusCommand;
const chalk_1 = __importDefault(require("chalk"));
const client_1 = require("../client");
const config_1 = require("../config");
function bar(pct, width = 24) {
    const filled = Math.round((pct / 100) * width);
    return "█".repeat(filled) + "░".repeat(width - filled);
}
async function statusCommand(options) {
    const config = (0, config_1.loadConfig)();
    const worldId = options.world ? parseInt(options.world, 10) : config.defaultWorldId;
    if (worldId === undefined) {
        console.log(chalk_1.default.red("\n❌ No hay un mundo por defecto. Usa --world <id>.\n"));
        return;
    }
    const atlas = (0, client_1.getAtlasClient)();
    const world = await atlas.world.get(worldId);
    if (!world) {
        console.log(chalk_1.default.red(`\n❌ No se encontró el mundo ${worldId}\n`));
        return;
    }
    const visibilityLabel = world.config.visibility === 0 ? "Público" : "Privado";
    console.log(chalk_1.default.bold.cyan(`\n🌍 ${world.config.name}`) + chalk_1.default.gray(`  (worldId: ${worldId})\n`));
    console.log(`  Visibilidad:  ${visibilityLabel}`);
    console.log(`  Epoch actual: ${world.config.currentEpoch}`);
    console.log(`  Cooldown:     ${world.config.globalCooldown}s`);
    if (world.pendingAdvance) {
        console.log(chalk_1.default.yellow(`\n  ⚠️  El epoch avanzó pero falta correr advance-epoch\n`));
    }
    else {
        console.log(`\n  Progreso: ${chalk_1.default.cyan(bar(world.progress))} ${world.progress}%  (${world.state.resourcesCollected}/${world.config.totalResources})`);
        if (world.exhausted) {
            console.log(chalk_1.default.yellow(`  ⚡ Mundo agotado — esperando reset`));
        }
    }
    console.log(chalk_1.default.bold(`\n  Tipos de recurso:`));
    world.config.resourceTypes.forEach((rt) => {
        console.log(`    • ${rt.name} — ${rt.points} pts, cooldown ${rt.cooldownSeconds}s`);
    });
    const player = await atlas.player.get(worldId);
    if (player) {
        console.log(chalk_1.default.bold(`\n  Tu player:`));
        console.log(`    Nombre: ${player.name}`);
        console.log(`    Nivel:  ${player.level}`);
        console.log(`    Puntos: ${player.resourcesCollected}`);
    }
    else {
        console.log(chalk_1.default.gray(`\n  No tienes un player en este mundo. Corre: atlas-cli mint-player`));
    }
    console.log();
}
//# sourceMappingURL=status.js.map