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
Object.defineProperty(exports, "__esModule", { value: true });
exports.configExists = configExists;
exports.loadConfig = loadConfig;
exports.saveConfig = saveConfig;
exports.loadWallet = loadWallet;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const web3_js_1 = require("@solana/web3.js");
const CONFIG_DIR = path.join(os.homedir(), ".atlas");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const DEFAULT_CONFIG = {
    network: "devnet",
    walletPath: path.join(os.homedir(), ".config/solana/id.json"),
};
function configExists() {
    return fs.existsSync(CONFIG_PATH);
}
function loadConfig() {
    if (!configExists()) {
        throw new Error("No hay configuración de Atlas CLI. Corre `atlas-cli init` primero.");
    }
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}
function saveConfig(config) {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    const current = configExists() ? loadConfig() : DEFAULT_CONFIG;
    const merged = { ...current, ...config };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
}
/**
 * Carga el keypair local y lo envuelve en una interfaz compatible
 * con wallet-adapter para usar con AtlasClient.
 */
function loadWallet(walletPath) {
    const resolved = walletPath.replace(/^~/, os.homedir());
    if (!fs.existsSync(resolved)) {
        throw new Error(`No se encontró el keypair en: ${resolved}`);
    }
    const secretKey = JSON.parse(fs.readFileSync(resolved, "utf-8"));
    const keypair = web3_js_1.Keypair.fromSecretKey(new Uint8Array(secretKey));
    return {
        publicKey: keypair.publicKey,
        signTransaction: async (tx) => {
            tx.partialSign(keypair);
            return tx;
        },
        signAllTransactions: async (txs) => {
            txs.forEach((tx) => tx.partialSign(keypair));
            return txs;
        },
        payer: keypair,
    };
}
//# sourceMappingURL=config.js.map