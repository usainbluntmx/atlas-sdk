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
        console.log(chalk_1.default.gray(`Progreso del mundo: ${result.worldProgress}`));
        console.log(chalk_1.default.gray(`Signature: ${result.signature}`));
        if (result.epochEnded) {
            console.log(chalk_1.default.bold.yellow("\n⚡ ¡El mundo acaba de agotarse! Ya no acepta más recolectas hasta que avances el epoch."));
            console.log(chalk_1.default.yellow("   Corre esto para reactivarlo:\n"));
            console.log(chalk_1.default.bold("     atlas-cli advance-epoch\n"));
            console.log(chalk_1.default.gray("   Tip: deja `atlas-cli watch` corriendo en otra terminal y esto pasa automáticamente.\n"));
        }
    }
    catch (err) {
        const code = err.error?.errorCode?.code;
        if (code === "EpochMismatch") {
            spinner.fail(chalk_1.default.red("El mundo está agotado y esperando avanzar de epoch"));
            console.log(chalk_1.default.yellow("\n   Corre esto para reactivarlo:\n"));
            console.log(chalk_1.default.bold("     atlas-cli advance-epoch\n"));
        }
        else {
            spinner.fail(chalk_1.default.red("Error al recolectar"));
            console.error(chalk_1.default.red(err.message ?? err));
        }
    }
}
//# sourceMappingURL=collect.js.map