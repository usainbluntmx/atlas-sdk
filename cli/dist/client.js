"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAtlasClient = getAtlasClient;
const sdk_1 = require("@atlas-world/sdk");
const config_1 = require("./config");
function getAtlasClient() {
    const config = (0, config_1.loadConfig)();
    const wallet = (0, config_1.loadWallet)(config.walletPath);
    return new sdk_1.AtlasClient({
        network: config.network,
        wallet,
        programId: config.programId,
    });
}
//# sourceMappingURL=client.js.map