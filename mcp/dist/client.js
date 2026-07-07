"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAtlasClient = getAtlasClient;
exports.getDefaultWorldId = getDefaultWorldId;
const sdk_1 = require("@atlas-world/sdk");
const config_1 = require("./config");
let cachedClient = null;
/**
 * Obtiene (y cachea) el AtlasClient para esta sesión del servidor MCP.
 * Un solo cliente se reutiliza entre llamadas de herramientas.
 */
function getAtlasClient() {
    if (cachedClient)
        return cachedClient;
    const config = (0, config_1.loadConfig)();
    const wallet = (0, config_1.loadWallet)(config.walletPath);
    cachedClient = new sdk_1.AtlasClient({
        network: config.network,
        wallet,
        programId: config.programId,
    });
    return cachedClient;
}
function getDefaultWorldId() {
    return (0, config_1.loadConfig)().defaultWorldId;
}
//# sourceMappingURL=client.js.map