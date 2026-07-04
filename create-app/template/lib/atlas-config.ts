import type { AtlasNetwork } from "@atlas-world/core"

/**
 * Configuración del mundo al que se conecta esta app.
 *
 * Si elegiste el Mundo Demo al crear el proyecto, WORLD_ID apunta al
 * mundo compartido que mantiene el equipo de Atlas — verás el progreso
 * y el leaderboard de otros developers probando el protocolo ahora mismo.
 *
 * Para conectarte a tu propio mundo:
 *   1. npx @atlas-world/cli create-world
 *   2. Copia el worldId que te da
 *   3. Reemplaza el valor de WORLD_ID abajo
 */
export const WORLD_ID = __WORLD_ID__
export const NETWORK: AtlasNetwork = "__NETWORK__"
