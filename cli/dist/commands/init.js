"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = initCommand;
const inquirer_1 = __importDefault(require("inquirer"));
const chalk_1 = __importDefault(require("chalk"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const config_1 = require("../config");
async function initCommand() {
    console.log(chalk_1.default.bold.cyan("\n🌍 Atlas World Protocol — Setup\n"));
    if ((0, config_1.configExists)()) {
        const current = (0, config_1.loadConfig)();
        console.log(chalk_1.default.yellow("Ya existe una configuración:"));
        console.log(`  Red: ${current.network}`);
        console.log(`  Wallet: ${current.walletPath}\n`);
        const { overwrite } = await inquirer_1.default.prompt([
            {
                type: "confirm",
                name: "overwrite",
                message: "¿Quieres sobreescribirla?",
                default: false,
            },
        ]);
        if (!overwrite) {
            console.log(chalk_1.default.gray("Setup cancelado."));
            return;
        }
    }
    const defaultWalletPath = `${os.homedir()}/.config/solana/id.json`;
    const walletExists = fs.existsSync(defaultWalletPath);
    const answers = await inquirer_1.default.prompt([
        {
            type: "list",
            name: "network",
            message: "¿En qué red vas a trabajar?",
            choices: [
                { name: "Devnet (recomendado para desarrollo)", value: "devnet" },
                { name: "Mainnet-Beta", value: "mainnet-beta" },
            ],
            default: "devnet",
        },
        {
            type: "input",
            name: "walletPath",
            message: "Ruta a tu keypair de Solana:",
            default: defaultWalletPath,
            validate: (input) => {
                const resolved = input.replace(/^~/, os.homedir());
                return fs.existsSync(resolved)
                    ? true
                    : `No se encontró un keypair en ${resolved}. Genera uno con: solana-keygen new`;
            },
        },
    ]);
    (0, config_1.saveConfig)({
        network: answers.network,
        walletPath: answers.walletPath,
    });
    console.log(chalk_1.default.green("\n✅ Configuración guardada en ~/.atlas/config.json"));
    console.log(chalk_1.default.gray(`\nSiguiente paso: atlas-cli create-world\n`));
}
//# sourceMappingURL=init.js.map