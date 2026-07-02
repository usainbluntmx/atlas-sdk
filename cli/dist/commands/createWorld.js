"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorldCommand = createWorldCommand;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const core_1 = require("@atlas-world/core");
const client_1 = require("../client");
const config_1 = require("../config");
const TEMPLATES = {
    gaming: {
        epochDuration: "7d",
        resourceTypes: [
            { id: 0, name: "common", points: 1, cooldownSeconds: 5 },
            { id: 1, name: "rare", points: 3, cooldownSeconds: 10 },
            { id: 2, name: "epic", points: 5, cooldownSeconds: 30 },
        ],
    },
    dao: {
        epochDuration: "30d",
        resourceTypes: [
            { id: 0, name: "vote", points: 1, cooldownSeconds: 86400 },
            { id: 1, name: "proposal", points: 10, cooldownSeconds: 604800 },
        ],
    },
    marketplace: {
        epochDuration: "1d",
        resourceTypes: [
            { id: 0, name: "listing", points: 1, cooldownSeconds: 3600 },
            { id: 1, name: "featured", points: 5, cooldownSeconds: 86400 },
        ],
    },
    custom: {
        epochDuration: "7d",
        resourceTypes: [],
    },
};
async function createWorldCommand() {
    console.log(chalk_1.default.bold.cyan("\n🌍 Crear un nuevo mundo en Atlas\n"));
    const basics = await inquirer_1.default.prompt([
        {
            type: "input",
            name: "name",
            message: "Nombre del mundo:",
            validate: (v) => (v.length > 0 && v.length <= 64) || "Debe tener entre 1 y 64 caracteres",
        },
        {
            type: "list",
            name: "template",
            message: "¿Qué tipo de mundo quieres crear?",
            choices: [
                { name: "🎮 GameFi / Web3 Gaming", value: "gaming" },
                { name: "🏛️  DAO / Governance", value: "dao" },
                { name: "🛍️  Marketplace / Listings", value: "marketplace" },
                { name: "⚙️  Custom (defines tus propios recursos)", value: "custom" },
            ],
        },
        {
            type: "list",
            name: "visibility",
            message: "Visibilidad:",
            choices: [
                { name: "Público — cualquier wallet puede participar, gratis", value: "public" },
                { name: "Privado — acceso por whitelist, cobra fee de creación", value: "private" },
            ],
            default: "public",
        },
        {
            type: "number",
            name: "totalResources",
            message: "Total de recursos por epoch:",
            default: 500,
            validate: (v) => v > 0 || "Debe ser mayor a 0",
        },
        {
            type: "number",
            name: "maxDailyCollects",
            message: "Límite de recolectas por wallet al día (0 = sin límite):",
            default: 0,
        },
    ]);
    const template = TEMPLATES[basics.template];
    let resourceTypes = template.resourceTypes;
    if (basics.template === "custom") {
        resourceTypes = [];
        console.log(chalk_1.default.gray("\nDefine tus tipos de recurso (máximo 8). Deja el nombre vacío para terminar.\n"));
        let id = 0;
        while (id < 8) {
            const { name } = await inquirer_1.default.prompt([
                { type: "input", name: "name", message: `Nombre del recurso #${id} (vacío para terminar):` },
            ]);
            if (!name)
                break;
            const { points, cooldownSeconds } = await inquirer_1.default.prompt([
                { type: "number", name: "points", message: "  Puntos que otorga:", default: 1 },
                { type: "number", name: "cooldownSeconds", message: "  Cooldown en segundos:", default: 5 },
            ]);
            resourceTypes.push({ id, name, points, cooldownSeconds });
            id++;
        }
        if (resourceTypes.length === 0) {
            console.log(chalk_1.default.red("\n❌ Necesitas al menos un tipo de recurso. Cancelado.\n"));
            return;
        }
    }
    else {
        console.log(chalk_1.default.gray(`\nUsando template "${basics.template}":`));
        resourceTypes.forEach((rt) => console.log(chalk_1.default.gray(`  • ${rt.name} — ${rt.points} pts, cooldown ${rt.cooldownSeconds}s`)));
        console.log();
    }
    const { confirm } = await inquirer_1.default.prompt([
        {
            type: "confirm",
            name: "confirm",
            message: `¿Crear el mundo "${basics.name}"?`,
            default: true,
        },
    ]);
    if (!confirm) {
        console.log(chalk_1.default.gray("Cancelado."));
        return;
    }
    const spinner = (0, ora_1.default)("Creando mundo en Solana...").start();
    try {
        const atlas = (0, client_1.getAtlasClient)();
        const worldTypeMap = {
            gaming: core_1.WorldType.Gaming,
            dao: core_1.WorldType.Dao,
            marketplace: core_1.WorldType.Marketplace,
            custom: core_1.WorldType.Custom,
        };
        const { worldId, signature } = await atlas.world.create({
            name: basics.name,
            worldType: worldTypeMap[basics.template],
            visibility: basics.visibility === "private" ? core_1.WorldVisibility.Private : core_1.WorldVisibility.Public,
            totalResources: basics.totalResources,
            epochDuration: template.epochDuration,
            maxDailyCollects: basics.maxDailyCollects,
            resourceTypes,
        });
        // Crear leaderboard del epoch 0 automáticamente
        await atlas.world.createLeaderboard(worldId);
        spinner.succeed(chalk_1.default.green(`Mundo creado — worldId: ${worldId}`));
        console.log(chalk_1.default.gray(`\nSignature: ${signature}`));
        console.log(chalk_1.default.gray(`Explorer: https://solscan.io/tx/${signature}?cluster=${atlas.network}\n`));
        (0, config_1.saveConfig)({ defaultWorldId: worldId });
        console.log(chalk_1.default.cyan(`Este mundo quedó guardado como default. Próximos comandos lo usarán automáticamente.\n`));
        console.log(chalk_1.default.bold("Siguiente paso:"));
        console.log(`  atlas-cli mint-player --name "TuNombre"\n`);
    }
    catch (err) {
        spinner.fail(chalk_1.default.red("Error al crear el mundo"));
        console.error(chalk_1.default.red(err.message ?? err));
    }
}
//# sourceMappingURL=createWorld.js.map