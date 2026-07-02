"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectCommand = collectCommand;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const client_1 = require("../client");
const config_1 = require("../config");
async function collectCommand(options) {
    const config = (0, config_1.loadConfig)();
    const worldId = options.world ? parseInt(options.world, 10) : config.defaultWorldId;
    if (worldId === undefined) {
        console.log(chalk_1.default.red("\n❌ No hay un mundo por defecto. Usa --world <id>.\n"));
        return;
    }
    const resourceTypeId = options.type ? parseInt(options.type, 10) : 0;
    console.log(chalk_1.default.bold.cyan(`\n⛏️  Recolectar recurso (mundo ${worldId})\n`));
    const spinner = (0, ora_1.default)("Recolectando...").start();
    try {
        const atlas = (0, client_1.getAtlasClient)();
        const result = await atlas.resource.collect({ worldId, resourceTypeId });
        spinner.succeed(chalk_1.default.green(`+${result.points} pts (${result.resourceType.name}) — Nivel ${result.newLevel}`));
        console.log(chalk_1.default.gray(`\nProgreso del mundo: ${result.worldProgress}`));
        if (result.epochEnded) {
            console.log(chalk_1.default.yellow("\n⚡ ¡El mundo se agotó! El epoch avanzará."));
            console.log(chalk_1.default.gray("El authority debe correr advance-epoch y create-leaderboard."));
        }
        console.log(chalk_1.default.gray(`\nSignature: ${result.signature}\n`));
    }
    catch (err) {
        spinner.fail(chalk_1.default.red("Error al recolectar"));
        console.error(chalk_1.default.red(err.message ?? err));
    }
}
//# sourceMappingURL=collect.js.map