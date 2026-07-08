import inquirer from "inquirer"
import chalk from "chalk"
import ora from "ora"
import { WorldVisibility, WORLD_TEMPLATES, WorldTemplateName } from "@atlas-world/core"
import { getAtlasClient } from "../client"
import { saveConfig } from "../config"

const TEMPLATE_LABELS: Record<WorldTemplateName, string> = {
  gaming: "🎮 GameFi / Web3 Gaming",
  dao: "🏛️  DAO / Governance",
  marketplace: "🛍️  Marketplace / Listings",
  defi: "💧 DeFi / Liquidity Mining",
  rwa: "🏢 RWA / Real World Assets",
  nft_collection: "🖼️  NFT Collection / Holder tracking",
}

/**
 * Estima el tamaño en bytes de las cuentas que se crean con un mundo,
 * para dar al usuario un costo aproximado en SOL antes de confirmar.
 */
function estimateWorldAccountBytes(resourceTypeCount: number): number {
  const discriminator = 8
  const worldConfig =
    discriminator +
    8 + 32 + 4 + 64 + 1 + 1 + 8 + 8 + 8 +
    4 + resourceTypeCount * (1 + 4 + 32 + 8 + 8) +
    8 + 4 + 1

  const worldState = discriminator + 8 + 8 + 8 + 8 + 1
  const leaderboardEmpty = discriminator + 8 + 8 + 4 + 1

  return worldConfig + worldState + leaderboardEmpty
}

export async function createWorldCommand() {
  console.log(chalk.bold.cyan("\n🌍 Crear un nuevo mundo en Atlas\n"))

  const templateChoices = (Object.keys(WORLD_TEMPLATES) as WorldTemplateName[]).map((key) => ({
    name: `${TEMPLATE_LABELS[key]} — ${WORLD_TEMPLATES[key].description}`,
    value: key,
  }))
  templateChoices.push({
    name: "⚙️  Custom (defines tus propios recursos)",
    value: "custom" as any,
  })

  const basics = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Nombre del mundo:",
      validate: (v: string) => (v.length > 0 && v.length <= 64) || "Debe tener entre 1 y 64 caracteres",
    },
    {
      type: "list",
      name: "templateKey",
      message: "¿Qué tipo de mundo quieres crear?",
      choices: templateChoices,
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
  ])

  const isCustom = basics.templateKey === "custom"
  let resourceTypes = isCustom ? [] : WORLD_TEMPLATES[basics.templateKey as WorldTemplateName].resourceTypes
  const template = isCustom ? null : WORLD_TEMPLATES[basics.templateKey as WorldTemplateName]

  if (isCustom) {
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
    console.log(chalk.gray(`\nUsando template "${basics.templateKey}":`))
    resourceTypes.forEach((rt) =>
      console.log(chalk.gray(`  • ${rt.name} — ${rt.points} pts, cooldown ${rt.cooldownSeconds}s`))
    )
    console.log()
  }

  const { maxDailyCollects } = await inquirer.prompt([
    {
      type: "number",
      name: "maxDailyCollects",
      message: "Límite de recolectas por wallet al día (0 = sin límite):",
      default: template?.maxDailyCollects ?? 0,
    },
  ])

  // ─── Estimado de costo antes de confirmar ─────────────────────────────────
  const atlas = getAtlasClient()
  const estimatedBytes = estimateWorldAccountBytes(resourceTypes.length)
  const rentLamports = await atlas.connection.getMinimumBalanceForRentExemption(estimatedBytes)
  const rentSol = rentLamports / 1e9
  const privateFee = basics.visibility === "private" ? 0.1 : 0
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
    { type: "confirm", name: "confirm", message: `¿Crear el mundo "${basics.name}"?`, default: true },
  ])
  if (!confirm) {
    console.log(chalk.gray("Cancelado."))
    return
  }

  const spinner = ora("Creando mundo en Solana...").start()

  try {
    const worldType = isCustom
      ? WORLD_TEMPLATES.gaming.worldType // custom usa el enum genérico Gaming/Custom por default
      : template!.worldType

    const { worldId, signature } = await atlas.world.create({
      name: basics.name,
      worldType,
      visibility: basics.visibility === "private" ? WorldVisibility.Private : WorldVisibility.Public,
      totalResources: basics.totalResources,
      epochDuration: template?.epochDuration ?? "7d",
      globalCooldown: template?.globalCooldown ?? 5,
      maxDailyCollects,
      resourceTypes,
    })

    await atlas.world.createLeaderboard(worldId)

    spinner.succeed(chalk.green(`Mundo creado — worldId: ${worldId}`))
    console.log(chalk.gray(`\nSignature: ${signature}`))
    console.log(chalk.gray(`Explorer: https://solscan.io/tx/${signature}?cluster=${atlas.network}\n`))

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
