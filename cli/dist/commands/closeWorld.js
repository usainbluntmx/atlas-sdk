"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeWorldCommand = closeWorldCommand;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const client_1 = require("../client");
const config_1 = require("../config");
async function closeWorldCommand(options) {
    const config = (0, config_1.loadConfig)();
    const worldId = options.world ? parseInt(options.world, 10) : config.defaultWorldId;
    if (worldId === undefined) {
        console.log(chalk_1.default.red("\n❌ No hay un mundo por defecto. Usa --world <id>.\n"));
        return;
    }
    console.log(chalk_1.default.bold.cyan(`\n🗑️  Cerrar mundo ${worldId}\n`));
    console.log(chalk_1.default.yellow("⚠️  Esto es permanente. El WorldConfig se cierra y no se puede recuperar.\n" +
        "   El historial de leaderboards de epochs pasados NO se borra — solo\n" +
        "   se cierra la configuración del mundo. El rent se devuelve a tu wallet.\n"));
    const { confirm } = await inquirer_1.default.prompt([
        {
            type: "confirm",
            name: "confirm",
            message: `¿Cerrar el mundo ${worldId} definitivamente?`,
            default: false,
        },
    ]);
    if (!confirm) {
        console.log(chalk_1.default.gray("Cancelado.\n"));
        return;
    }
    const spinner = (0, ora_1.default)("Cerrando mundo...").start();
    try {
        const atlas = (0, client_1.getAtlasClient)();
        const { signature, lamportsRecovered } = await atlas.world.closeWorld(worldId);
        const solRecovered = lamportsRecovered / 1e9;
        spinner.succeed(chalk_1.default.green(`Mundo ${worldId} cerrado`));
        console.log(chalk_1.default.gray(`\nRent recuperado: ~${solRecovered.toFixed(4)} SOL`));
        console.log(chalk_1.default.gray(`Signature: ${signature}\n`));
    }
    catch (err) {
        spinner.fail(chalk_1.default.red("Error al cerrar el mundo"));
        console.error(chalk_1.default.red(err.message ?? err));
    }
}
//# sourceMappingURL=closeWorld.js.map