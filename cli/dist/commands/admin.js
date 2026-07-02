"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.advanceEpochCommand = advanceEpochCommand;
exports.pauseCommand = pauseCommand;
exports.unpauseCommand = unpauseCommand;
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const client_1 = require("../client");
const config_1 = require("../config");
async function advanceEpochCommand(options) {
    const config = (0, config_1.loadConfig)();
    const worldId = options.world ? parseInt(options.world, 10) : config.defaultWorldId;
    if (worldId === undefined) {
        console.log(chalk_1.default.red("\n❌ No hay un mundo por defecto. Usa --world <id>.\n"));
        return;
    }
    const spinner = (0, ora_1.default)("Avanzando epoch...").start();
    try {
        const atlas = (0, client_1.getAtlasClient)();
        await atlas.world.advanceEpoch(worldId);
        await atlas.world.createLeaderboard(worldId);
        spinner.succeed(chalk_1.default.green("Epoch avanzado y leaderboard creado"));
    }
    catch (err) {
        spinner.fail(chalk_1.default.red("Error al avanzar epoch"));
        console.error(chalk_1.default.red(err.message ?? err));
    }
}
async function pauseCommand() {
    const spinner = (0, ora_1.default)("Pausando protocolo (emergency stop)...").start();
    try {
        const atlas = (0, client_1.getAtlasClient)();
        await atlas.pauseProtocol();
        spinner.succeed(chalk_1.default.yellow("⏸  Protocolo pausado — create_world, mint_player y collect_resource están bloqueados"));
    }
    catch (err) {
        spinner.fail(chalk_1.default.red("Error al pausar"));
        console.error(chalk_1.default.red(err.message ?? err));
    }
}
async function unpauseCommand() {
    const spinner = (0, ora_1.default)("Reactivando protocolo...").start();
    try {
        const atlas = (0, client_1.getAtlasClient)();
        await atlas.unpauseProtocol();
        spinner.succeed(chalk_1.default.green("▶️  Protocolo reactivado"));
    }
    catch (err) {
        spinner.fail(chalk_1.default.red("Error al reactivar"));
        console.error(chalk_1.default.red(err.message ?? err));
    }
}
//# sourceMappingURL=admin.js.map