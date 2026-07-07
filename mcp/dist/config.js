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
exports.loadConfig = loadConfig;
exports.loadWallet = loadWallet;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const web3_js_1 = require("@solana/web3.js");
const CONFIG_PATH = path.join(os.homedir(), ".atlas", "config.json");
/**
 * Carga la configuración desde ~/.atlas/config.json — el mismo archivo
 * que usa @atlas-world/cli. Si ya corriste `atlas-cli init`, el servidor
 * MCP queda configurado automáticamente, sin pasos adicionales.
 *
 * También acepta override por variables de entorno, útil quien corre
 * el servidor MCP en un contexto sin CLI previamente configurado:
 *   ATLAS_NETWORK, ATLAS_WALLET_PATH, ATLAS_WORLD_ID
 */
function loadConfig() {
    const envNetwork = process.env.ATLAS_NETWORK;
    const envWalletPath = process.env.ATLAS_WALLET_PATH;
    const envWorldId = process.env.ATLAS_WORLD_ID;
    if (fs.existsSync(CONFIG_PATH)) {
        const fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
        return {
            network: envNetwork ?? fileConfig.network ?? "devnet",
            walletPath: envWalletPath ?? fileConfig.walletPath,
            defaultWorldId: envWorldId ? parseInt(envWorldId, 10) : fileConfig.defaultWorldId,
            programId: fileConfig.programId,
        };
    }
    if (!envWalletPath) {
        throw new Error("No hay configuración de Atlas. Corre `atlas-cli init` primero, " +
            "o define ATLAS_WALLET_PATH y ATLAS_NETWORK como variables de entorno.");
    }
    return {
        network: envNetwork ?? "devnet",
        walletPath: envWalletPath,
        defaultWorldId: envWorldId ? parseInt(envWorldId, 10) : undefined,
    };
}
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