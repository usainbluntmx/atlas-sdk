"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mintPlayerCommand = mintPlayerCommand;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const client_1 = require("../client");
const config_1 = require("../config");
async function mintPlayerCommand(options) {
    const config = (0, config_1.loadConfig)();
    const worldId = options.world ? parseInt(options.world, 10) : config.defaultWorldId;
    if (worldId === undefined) {
        console.log(chalk_1.default.red("\n❌ No hay un mundo por defecto. Usa --world <id> o corre `atlas-cli create-world` primero.\n"));
        return;
    }
    const name = options.name ?? `Explorer_${Date.now().toString().slice(-4)}`;
    console.log(chalk_1.default.bold.cyan(`\n👤 Mint Player en mundo ${worldId}\n`));
    const spinner = (0, ora_1.default)(`Minteando "${name}"...`).start();
    try {
        const atlas = (0, client_1.getAtlasClient)();
        const alreadyExists = await atlas.player.exists(worldId);
        if (alreadyExists) {
            spinner.info(chalk_1.default.yellow("Ya tienes un player en este mundo."));
            const player = await atlas.player.get(worldId);
            console.log(`\n  Nombre: ${player?.name}`);
            console.log(`  Nivel: ${player?.level}`);
            console.log(`  Puntos: ${player?.resourcesCollected}\n`);
            return;
        }
        const { signature } = await atlas.player.mint({ worldId, name });
        spinner.succeed(chalk_1.default.green(`Player "${name}" minteado`));
        console.log(chalk_1.default.gray(`\nSignature: ${signature}`));
        console.log(chalk_1.default.gray(`Explorer: https://solscan.io/tx/${signature}?cluster=${atlas.network}\n`));
        console.log(chalk_1.default.bold("Siguiente paso:"));
        console.log(`  atlas-cli collect --type 0\n`);
    }
    catch (err) {
        spinner.fail(chalk_1.default.red("Error al mintear player"));
        console.error(chalk_1.default.red(err.message ?? err));
    }
}
//# sourceMappingURL=mintPlayer.js.map