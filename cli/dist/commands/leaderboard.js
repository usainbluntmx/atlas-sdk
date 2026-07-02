"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.leaderboardCommand = leaderboardCommand;
const chalk_1 = __importDefault(require("chalk"));
const client_1 = require("../client");
const config_1 = require("../config");
const MEDALS = ["🥇", "🥈", "🥉"];
async function leaderboardCommand(options) {
    const config = (0, config_1.loadConfig)();
    const worldId = options.world ? parseInt(options.world, 10) : config.defaultWorldId;
    if (worldId === undefined) {
        console.log(chalk_1.default.red("\n❌ No hay un mundo por defecto. Usa --world <id>.\n"));
        return;
    }
    const epoch = options.epoch ? parseInt(options.epoch, 10) : undefined;
    const atlas = (0, client_1.getAtlasClient)();
    const lb = await atlas.leaderboard.get(worldId, { epoch });
    if (!lb) {
        console.log(chalk_1.default.red(`\n❌ Leaderboard no encontrado (¿ya se creó para este epoch?)\n`));
        return;
    }
    console.log(chalk_1.default.bold.cyan(`\n🏆 Leaderboard — mundo ${worldId}, epoch ${lb.epoch}\n`));
    if (lb.entries.length === 0) {
        console.log(chalk_1.default.gray("  Sin entradas todavía.\n"));
        return;
    }
    lb.entries.forEach((entry, i) => {
        const medal = MEDALS[i] ?? `  ${i + 1}.`;
        console.log(`  ${medal} ${entry.name.padEnd(20)} ${chalk_1.default.cyan(entry.resourcesCollected + " pts")}  (Nivel ${entry.level})`);
    });
    console.log();
}
//# sourceMappingURL=leaderboard.js.map