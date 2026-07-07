#!/usr/bin/env node

/**
 * @atlas-world/mcp
 *
 * Servidor MCP (Model Context Protocol) para Atlas World Protocol.
 * Expone el ciclo de vida completo de un mundo persistente como tools
 * que cualquier agente AI compatible con MCP (Claude, y otros) puede
 * invocar directamente — sin que un humano escriba código intermedio.
 *
 * Un agente puede: crear un mundo, mintear su player, recolectar
 * recursos, leer el estado y el leaderboard, y avanzar epochs — la
 * misma primitiva de estado compartido que usan los developers humanos,
 * ahora accesible como tool calls nativas.
 *
 * Configuración: reutiliza ~/.atlas/config.json (el mismo archivo que
 * @atlas-world/cli). Si ya corriste `atlas-cli init`, este servidor
 * queda listo sin pasos adicionales.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { WorldType, WorldVisibility, parseError } from "@atlas-world/core"
import { getAtlasClient, getDefaultWorldId } from "./client"

const server = new McpServer({
  name: "atlas-world",
  version: "1.0.0",
})

// Helper: formatea cualquier error como respuesta MCP legible, sin
// que un stack trace crudo llegue al agente.
function errorResult(err: unknown) {
  const parsed = parseError(err)
  return {
    content: [{ type: "text" as const, text: `Error: ${parsed.message}` }],
    isError: true,
  }
}

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] }
}

// ─── atlas_create_world ───────────────────────────────────────────────────

server.tool(
  "atlas_create_world",
  "Crea un nuevo mundo persistente en Atlas World Protocol (Solana). " +
    "Un mundo es cualquier espacio de estado compartido con reglas verificables " +
    "on-chain — puede modelar un juego, una DAO, un marketplace, o cualquier " +
    "sistema donde múltiples actores (humanos o agentes) compitan o colaboren " +
    "por recursos limitados. Retorna el worldId, que se usa en el resto de tools.",
  {
    name: z.string().max(64).describe("Nombre del mundo"),
    worldType: z.enum(["gaming", "dao", "marketplace", "custom"]).describe(
      "Narrativa del mundo — no cambia el comportamiento del contrato, solo documenta el propósito"
    ),
    visibility: z.enum(["public", "private"]).default("public").describe(
      "public: cualquier wallet puede participar, gratis. private: requiere whitelist, cobra fee de creación"
    ),
    totalResources: z.number().int().positive().default(500).describe(
      "Recursos totales disponibles por epoch — cuando se agotan, el mundo entra en WorldReset"
    ),
    epochDuration: z.string().default("7d").describe(
      "Duración máxima del epoch: '7d', '24h', '30m', o segundos como número"
    ),
    globalCooldown: z.number().int().nonnegative().default(5).describe(
      "Segundos mínimos entre recolectas por wallet (anti-bot)"
    ),
    maxDailyCollects: z.number().int().nonnegative().default(0).describe(
      "Límite de recolectas por wallet cada 24h. 0 = sin límite"
    ),
    resourceTypes: z
      .array(
        z.object({
          id: z.number().int().min(0).max(7),
          name: z.string().max(32),
          points: z.number().int().positive(),
          cooldownSeconds: z.number().int().nonnegative(),
        })
      )
      .min(1)
      .max(8)
      .describe("Hasta 8 tipos de recurso configurables, cada uno con sus propios puntos y cooldown"),
  },
  async (args) => {
    try {
      const atlas = getAtlasClient()
      const worldTypeMap: Record<string, WorldType> = {
        gaming: WorldType.Gaming,
        dao: WorldType.Dao,
        marketplace: WorldType.Marketplace,
        custom: WorldType.Custom,
      }

      const { worldId, signature } = await atlas.world.create({
        name: args.name,
        worldType: worldTypeMap[args.worldType],
        visibility: args.visibility === "private" ? WorldVisibility.Private : WorldVisibility.Public,
        totalResources: args.totalResources,
        epochDuration: args.epochDuration,
        globalCooldown: args.globalCooldown,
        maxDailyCollects: args.maxDailyCollects,
        resourceTypes: args.resourceTypes,
      })

      await atlas.world.createLeaderboard(worldId)

      return textResult(
        `Mundo creado exitosamente.\nworldId: ${worldId}\nsignature: ${signature}\n\n` +
          `El leaderboard del epoch 0 ya está listo. Usa worldId=${worldId} en las demás tools.`
      )
    } catch (err) {
      return errorResult(err)
    }
  }
)

// ─── atlas_mint_player ─────────────────────────────────────────────────────

server.tool(
  "atlas_mint_player",
  "Mintea un Player (identidad on-chain) para la wallet configurada, en un " +
    "mundo específico. Una wallet solo puede tener un Player por mundo. " +
    "Necesario antes de poder recolectar recursos en ese mundo.",
  {
    worldId: z.number().int().nonnegative().describe("ID del mundo (usa el default si se omite)").optional(),
    name: z.string().max(32).describe("Nombre del player"),
  },
  async (args) => {
    try {
      const atlas = getAtlasClient()
      const worldId = args.worldId ?? getDefaultWorldId()
      if (worldId === undefined) {
        return errorResult(new Error("No se especificó worldId y no hay un mundo default configurado"))
      }

      const alreadyExists = await atlas.player.exists(worldId)
      if (alreadyExists) {
        const player = await atlas.player.get(worldId)
        return textResult(
          `Esta wallet ya tiene un player en el mundo ${worldId}: "${player?.name}", ` +
            `nivel ${player?.level}, ${player?.resourcesCollected} puntos.`
        )
      }

      const { signature } = await atlas.player.mint({ worldId, name: args.name })
      return textResult(`Player "${args.name}" minteado en el mundo ${worldId}.\nsignature: ${signature}`)
    } catch (err) {
      return errorResult(err)
    }
  }
)

// ─── atlas_collect_resource ─────────────────────────────────────────────────

server.tool(
  "atlas_collect_resource",
  "Recolecta un recurso del mundo compartido. Verifica on-chain el cooldown, " +
    "el límite diario, y que el mundo no esté agotado. Si esta llamada agota " +
    "el mundo, el resultado lo indica — en ese caso, usa atlas_advance_epoch " +
    "para reactivarlo antes de la siguiente recolecta.",
  {
    worldId: z.number().int().nonnegative().optional().describe("ID del mundo (usa el default si se omite)"),
    resourceTypeId: z.number().int().min(0).max(7).default(0).describe(
      "ID del tipo de recurso a recolectar, según los resourceTypes definidos al crear el mundo"
    ),
  },
  async (args) => {
    try {
      const atlas = getAtlasClient()
      const worldId = args.worldId ?? getDefaultWorldId()
      if (worldId === undefined) {
        return errorResult(new Error("No se especificó worldId y no hay un mundo default configurado"))
      }

      const result = await atlas.resource.collect({
        worldId,
        resourceTypeId: args.resourceTypeId,
      })

      let text =
        `Recolectado: +${result.points} puntos (${result.resourceType.name}). ` +
        `Nuevo nivel: ${result.newLevel}. Progreso del mundo: ${result.worldProgress}.\n` +
        `signature: ${result.signature}`

      if (result.epochEnded) {
        text +=
          "\n\n⚡ Esta recolecta agotó el mundo. Ya no acepta más recolectas hasta " +
          "que se llame a atlas_advance_epoch para avanzar al siguiente epoch."
      }

      return textResult(text)
    } catch (err) {
      return errorResult(err)
    }
  }
)

// ─── atlas_get_world_status ─────────────────────────────────────────────────

server.tool(
  "atlas_get_world_status",
  "Obtiene el estado completo de un mundo: nombre, visibilidad, epoch actual, " +
    "progreso de recursos, tipos de recurso configurados, y si está agotado " +
    "o pendiente de avanzar de epoch.",
  {
    worldId: z.number().int().nonnegative().optional().describe("ID del mundo (usa el default si se omite)"),
  },
  async (args) => {
    try {
      const atlas = getAtlasClient()
      const worldId = args.worldId ?? getDefaultWorldId()
      if (worldId === undefined) {
        return errorResult(new Error("No se especificó worldId y no hay un mundo default configurado"))
      }

      const world = await atlas.world.get(worldId)
      if (!world) {
        return errorResult(new Error(`No se encontró el mundo ${worldId}`))
      }

      const status = {
        worldId,
        name: world.config.name,
        visibility: world.config.visibility === 0 ? "public" : "private",
        currentEpoch: world.config.currentEpoch,
        progress: `${world.progress}% (${world.state.resourcesCollected}/${world.config.totalResources})`,
        exhausted: world.exhausted,
        pendingAdvance: world.pendingAdvance,
        resourceTypes: world.config.resourceTypes,
      }

      return textResult(JSON.stringify(status, null, 2))
    } catch (err) {
      return errorResult(err)
    }
  }
)

// ─── atlas_get_player_status ─────────────────────────────────────────────────

server.tool(
  "atlas_get_player_status",
  "Obtiene el estado del Player de la wallet configurada en un mundo: " +
    "nombre, nivel, puntos acumulados.",
  {
    worldId: z.number().int().nonnegative().optional().describe("ID del mundo (usa el default si se omite)"),
  },
  async (args) => {
    try {
      const atlas = getAtlasClient()
      const worldId = args.worldId ?? getDefaultWorldId()
      if (worldId === undefined) {
        return errorResult(new Error("No se especificó worldId y no hay un mundo default configurado"))
      }

      const player = await atlas.player.get(worldId)
      if (!player) {
        return textResult(`Esta wallet no tiene un player en el mundo ${worldId}. Usa atlas_mint_player primero.`)
      }

      return textResult(
        JSON.stringify(
          {
            name: player.name,
            level: player.level,
            resourcesCollected: player.resourcesCollected,
            lastCollectTime: player.lastCollectTime,
          },
          null,
          2
        )
      )
    } catch (err) {
      return errorResult(err)
    }
  }
)

// ─── atlas_get_leaderboard ───────────────────────────────────────────────────

server.tool(
  "atlas_get_leaderboard",
  "Obtiene el leaderboard (top 25) de un mundo, para el epoch actual o uno " +
    "específico. El leaderboard de epochs pasados persiste como historial.",
  {
    worldId: z.number().int().nonnegative().optional().describe("ID del mundo (usa el default si se omite)"),
    epoch: z.number().int().nonnegative().optional().describe("Epoch específico — si se omite, usa el actual"),
  },
  async (args) => {
    try {
      const atlas = getAtlasClient()
      const worldId = args.worldId ?? getDefaultWorldId()
      if (worldId === undefined) {
        return errorResult(new Error("No se especificó worldId y no hay un mundo default configurado"))
      }

      const lb = await atlas.leaderboard.get(worldId, { epoch: args.epoch })
      if (!lb) {
        return textResult(`No se encontró leaderboard para el mundo ${worldId} (¿ya se creó para este epoch?)`)
      }

      const ranking = lb.entries.map((e, i) => ({
        position: i + 1,
        name: e.name,
        resourcesCollected: e.resourcesCollected,
        level: e.level,
      }))

      return textResult(JSON.stringify({ epoch: lb.epoch, entries: ranking }, null, 2))
    } catch (err) {
      return errorResult(err)
    }
  }
)

// ─── atlas_advance_epoch ─────────────────────────────────────────────────────

server.tool(
  "atlas_advance_epoch",
  "Avanza un mundo al siguiente epoch después de que se agotó (WorldReset). " +
    "Solo funciona si la wallet configurada es el authority del mundo. " +
    "Crea el WorldState y el Leaderboard del nuevo epoch — sin esto, el " +
    "mundo no puede aceptar más recolectas.",
  {
    worldId: z.number().int().nonnegative().optional().describe("ID del mundo (usa el default si se omite)"),
  },
  async (args) => {
    try {
      const atlas = getAtlasClient()
      const worldId = args.worldId ?? getDefaultWorldId()
      if (worldId === undefined) {
        return errorResult(new Error("No se especificó worldId y no hay un mundo default configurado"))
      }

      await atlas.world.advanceEpoch(worldId)
      await atlas.world.createLeaderboard(worldId)

      return textResult(`Epoch avanzado en el mundo ${worldId}. El mundo vuelve a aceptar recolectas.`)
    } catch (err) {
      return errorResult(err)
    }
  }
)

// ─── Arrancar el servidor ────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error("Error fatal en el servidor MCP de Atlas:", err)
  process.exit(1)
})
