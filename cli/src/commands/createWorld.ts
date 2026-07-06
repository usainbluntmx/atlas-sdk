import inquirer from "inquirer"
import chalk from "chalk"
import ora from "ora"
import { WorldType, WorldVisibility } from "@atlas-world/core"
import { getAtlasClient } from "../client"
import { saveConfig } from "../config"

interface ResourceTypeTemplate {
  id: number
  name: string
  points: number
  cooldownSeconds: number
}

const TEMPLATES: Record<string, { epochDuration: string; resourceTypes: ResourceTypeTemplate[] }> = {
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
}

/**
 * Estima el tamaño en bytes de las cuentas que se crean con un mundo,
 * para dar al usuario un costo aproximado en SOL antes de confirmar.
 * Los tamaños son aproximados (siguen el layout real de WorldConfig,
 * WorldState y Leaderboard vacío) — suficiente para dar una idea real
 * de costo, no para ser exactos al byte.
 */
function estimateWorldAccountBytes(resourceTypeCount: number): number {
  const discriminator = 8
  const worldConfig =
    discriminator +
    8 + // world_id
    32 + // authority
    4 + 64 + // name (String, max 64)
    1 + // world_type enum
    1 + // visibility enum
    8 + // total_resources
    8 + // epoch_duration
    8 + // global_cooldown
    4 + resourceTypeCount * (1 + 4 + 32 + 8 + 8) + // resource_types Vec
    8 + // current_epoch
    4 + // max_daily_collects
    1 // bump

  const worldState = discriminator + 8 + 8 + 8 + 8 + 1 // world_id, epoch, resources_collected, started_at, bump

  const leaderboardEmpty = discriminator + 8 + 8 + 4 + 1 // world_id, epoch, entries len (0), bump

  return worldConfig + worldState + leaderboardEmpty
}

export async function createWorldCommand() {
  console.log(chalk.bold.cyan("\n🌍 Crear un nuevo mundo en Atlas\n"))

  const basics = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Nombre del mundo:",
      validate: (v: string) => (v.length > 0 && v.length <= 64) || "Debe tener entre 1 y 64 caracteres",
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
      validate: (v: number) => v > 0 || "Debe ser mayor a 0",
    },
    {
      type: "number",
      name: "maxDailyCollects",
      message: "Límite de recolectas por wallet al día (0 = sin límite):",
      default: 0,
    },
  ])

  const template = TEMPLATES[basics.template]
  let resourceTypes = template.resourceTypes

  if (basics.template === "custom") {
    resourceTypes = []
    console.log(chalk.gray("\nDefine tus tipos de recurso (máximo 8). Deja el nombre vacío para terminar.\n"))
    let id = 0
    while (id < 8) {
      const { name } = await inquirer.prompt([
        { type: "input", name: "name", message: `Nombre del recurso #${id} (vacío para terminar):` },
      ])
      if (!name) break

      const { points, cooldownSeconds } = await inquirer.prompt([
        { type: "number", name: "points", message: "  Puntos que otorga:", default: 1 },
        { type: "number", name: "cooldownSeconds", message: "  Cooldown en segundos:", default: 5 },
      ])
      resourceTypes.push({ id, name, points, cooldownSeconds })
      id++
    }
    if (resourceTypes.length === 0) {
      console.log(chalk.red("\n❌ Necesitas al menos un tipo de recurso. Cancelado.\n"))
      return
    }
  } else {
    console.log(chalk.gray(`\nUsando template "${basics.template}":`))
    resourceTypes.forEach((rt) =>
      console.log(chalk.gray(`  • ${rt.name} — ${rt.points} pts, cooldown ${rt.cooldownSeconds}s`))
    )
    console.log()
  }

  // ─── Estimado de costo antes de confirmar ─────────────────────────────────
  const atlas = getAtlasClient()
  const estimatedBytes = estimateWorldAccountBytes(resourceTypes.length)
  const rentLamports = await atlas.connection.getMinimumBalanceForRentExemption(estimatedBytes)
  const rentSol = rentLamports / 1e9
  const privateFee = basics.visibility === "private" ? 0.1 : 0 // fee actual del protocolo
  const totalEstimate = rentSol + privateFee

  console.log(chalk.bold("💰 Costo estimado:"))
  console.log(`   Rent de cuentas (recuperable si cierras el mundo): ~${rentSol.toFixed(4)} SOL`)
  if (privateFee > 0) {
    console.log(`   Fee de mundo privado (no recuperable): ${privateFee} SOL`)
  }
  console.log(chalk.bold(`   Total aproximado: ~${totalEstimate.toFixed(4)} SOL\n`))
  console.log(
    chalk.gray("   (El rent se devuelve si cierras el mundo con `atlas-cli close-world` en el futuro)\n")
  )

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `¿Crear el mundo "${basics.name}"?`,
      default: true,
    },
  ])
  if (!confirm) {
    console.log(chalk.gray("Cancelado."))
    return
  }

  const spinner = ora("Creando mundo en Solana...").start()

  try {
    const worldTypeMap: Record<string, WorldType> = {
      gaming: WorldType.Gaming,
      dao: WorldType.Dao,
      marketplace: WorldType.Marketplace,
      custom: WorldType.Custom,
    }

    const { worldId, signature } = await atlas.world.create({
      name: basics.name,
      worldType: worldTypeMap[basics.template],
      visibility: basics.visibility === "private" ? WorldVisibility.Private : WorldVisibility.Public,
      totalResources: basics.totalResources,
      epochDuration: template.epochDuration,
      maxDailyCollects: basics.maxDailyCollects,
      resourceTypes,
    })

    // Crear leaderboard del epoch 0 automáticamente
    await atlas.world.createLeaderboard(worldId)

    spinner.succeed(chalk.green(`Mundo creado — worldId: ${worldId}`))
    console.log(chalk.gray(`\nSignature: ${signature}`))
    console.log(
      chalk.gray(`Explorer: https://solscan.io/tx/${signature}?cluster=${atlas.network}\n`)
    )

    saveConfig({ defaultWorldId: worldId })
    console.log(chalk.cyan(`Este mundo quedó guardado como default. Próximos comandos lo usarán automáticamente.\n`))
    console.log(chalk.bold("Siguiente paso:"))
    console.log(`  atlas-cli mint-player --name "TuNombre"`)
    console.log(
      chalk.gray(`\nTip: corre "atlas-cli watch" en otra terminal para que los epochs avancen solos mientras pruebas.\n`)
    )
  } catch (err: any) {
    spinner.fail(chalk.red("Error al crear el mundo"))
    console.error(chalk.red(err.message ?? err))
  }
}
