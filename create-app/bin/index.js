#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const inquirer = require("inquirer")
const chalk = require("chalk")

const TEMPLATE_DIR = path.join(__dirname, "..", "template")

// Mundo Demo público mantenido por el equipo de Atlas.
// Cualquiera que use create-atlas-app se conecta a este mundo compartido
// por default — es la forma más rápida de ver el protocolo en acción
// junto a otros developers que lo están probando en este momento.
const DEMO_WORLD_ID = 12
const DEMO_NETWORK = "devnet"

function copyRecursive(src, dest) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item))
    }
  } else {
    fs.copyFileSync(src, dest)
  }
}

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, "utf-8")
  for (const [search, value] of Object.entries(replacements)) {
    content = content.split(search).join(value)
  }
  fs.writeFileSync(filePath, content)
}

async function main() {
  console.log(chalk.bold.cyan("\n🌍 create-atlas-app\n"))
  console.log(
    chalk.gray(
      "Crea una app Next.js conectada a Atlas World Protocol en un comando.\n"
    )
  )

  const argName = process.argv[2]

  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "projectName",
      message: "Nombre del proyecto:",
      default: argName || "my-atlas-app",
      when: !argName,
    },
    {
      type: "list",
      name: "worldMode",
      message: "¿A qué mundo quieres conectarte?",
      choices: [
        {
          name: `🌐 Mundo Demo compartido (worldId ${DEMO_WORLD_ID}) — recomendado, ve el protocolo en acción al instante`,
          value: "demo",
        },
        {
          name: "🆕 Voy a crear mi propio mundo después",
          value: "own",
        },
      ],
    },
  ])

  const projectName = argName || answers.projectName
  const targetDir = path.join(process.cwd(), projectName)

  if (fs.existsSync(targetDir)) {
    console.log(chalk.red(`\n❌ La carpeta "${projectName}" ya existe.\n`))
    process.exit(1)
  }

  console.log(chalk.gray(`\nCreando proyecto en ./${projectName}...\n`))
  copyRecursive(TEMPLATE_DIR, targetDir)

  // Reemplazos en package.json
  replaceInFile(path.join(targetDir, "package.json"), {
    "__PROJECT_NAME__": projectName,
  })

  // Reemplazos en la config del mundo
  const worldId = answers.worldMode === "demo" ? DEMO_WORLD_ID : 0
  replaceInFile(path.join(targetDir, "lib", "atlas-config.ts"), {
    "__WORLD_ID__": String(worldId),
    "__NETWORK__": DEMO_NETWORK,
  })

  console.log(chalk.green("✅ Proyecto creado\n"))
  console.log(chalk.bold("Siguiente pasos:\n"))
  console.log(`  cd ${projectName}`)
  console.log(`  npm install`)
  console.log(`  npm run dev\n`)

  if (answers.worldMode === "demo") {
    console.log(
      chalk.cyan(
        `Vas a conectarte al Mundo Demo compartido (worldId ${DEMO_WORLD_ID}) en Devnet.`
      )
    )
    console.log(
      chalk.gray(
        "Conecta tu wallet de Phantom en Devnet y verás el leaderboard en tiempo real.\n"
      )
    )
  } else {
    console.log(
      chalk.yellow(
        `Recuerda crear tu propio mundo con: npx @atlas-world/cli create-world`
      )
    )
    console.log(
      chalk.gray(
        `Luego actualiza WORLD_ID en lib/atlas-config.ts con tu worldId.\n`
      )
    )
  }
}

main().catch((err) => {
  console.error(chalk.red("\n❌ Error:"), err)
  process.exit(1)
})
