/**
 * examples/quickstart.ts
 *
 * El ciclo de vida completo de un mundo Atlas, en un solo archivo,
 * comentado línea por línea. Corre esto para entender exactamente
 * qué pasa en cada paso — desde crear un mundo hasta que se agota
 * y avanza de epoch.
 *
 * Uso:
 *   npx ts-node examples/quickstart.ts
 *
 * Requiere:
 *   - Un keypair de Solana en ~/.config/solana/id.json
 *   - SOL de devnet en esa wallet (solana airdrop 2)
 */

import { AtlasClient, WorldType, WorldVisibility } from '@atlas-world/sdk'

async function main() {
  console.log('🌍 Atlas Quickstart — el ciclo de vida completo\n')

  // ─── PASO 1: Inicializar el cliente ────────────────────────────────────────
  // fromKeypair() es el atajo para Node.js/scripts — lee tu keypair local
  // y arma el objeto "wallet" internamente. Si estuvieras en un frontend
  // React, usarías `new AtlasClient({ network, wallet: useWallet() })` en
  // su lugar — ver el README para ambos casos.
  const atlas = AtlasClient.fromKeypair({
    network: 'devnet',
    keypairPath: '~/.config/solana/id.json',
  })
  console.log(`Wallet: ${atlas.program.provider.publicKey?.toBase58()}\n`)

  // ─── PASO 2: Crear un mundo ─────────────────────────────────────────────────
  // totalResources y resourceTypes son obligatorios — el SDK valida esto
  // en TypeScript antes de mandar la transacción, así que si te falta algo
  // vas a ver un error claro aquí mismo, no un error críptico de Anchor.
  console.log('📋 Creando un mundo...')
  const { worldId } = await atlas.world.create({
    name: `Quickstart ${Date.now().toString().slice(-4)}`,
    worldType: WorldType.Gaming,
    visibility: WorldVisibility.Public,
    totalResources: 3, // pocos recursos a propósito — para ver el ciclo completo rápido
    epochDuration: '7d', // duración máxima del epoch por tiempo (no lo alcanzaremos aquí)
    globalCooldown: 0, // sin cooldown — solo para que este demo corra rápido
    resourceTypes: [
      { id: 0, name: 'common', points: 1, cooldownSeconds: 0 },
    ],
  })
  console.log(`✅ Mundo creado — worldId: ${worldId}\n`)

  // ─── PASO 3: Crear el leaderboard del epoch 0 ──────────────────────────────
  // Esto es un paso separado de create() a propósito — el contrato no lo
  // hace automáticamente porque alguien tiene que pagar el rent de esa
  // cuenta, y el diseño del protocolo deja esa decisión explícita al
  // developer, no implícita dentro de otra instrucción.
  console.log('📋 Creando el leaderboard del epoch 0...')
  await atlas.world.createLeaderboard(worldId)
  console.log('✅ Leaderboard listo\n')

  // ─── PASO 4: Mintear tu Player ──────────────────────────────────────────────
  // Un Player es tu identidad on-chain dentro de ESTE mundo específico.
  // La misma wallet puede tener un Player distinto en cada mundo que exista.
  console.log('📋 Minteando tu player...')
  await atlas.player.mint({ worldId, name: 'QuickstartHero' })
  console.log('✅ Player minteado\n')

  // ─── PASO 5: Recolectar hasta agotar el mundo ──────────────────────────────
  // Pusimos totalResources: 3 arriba justo para llegar a este punto rápido.
  // Cada recolecta verifica on-chain: cooldown, límite diario, y que el
  // mundo no esté ya agotado.
  console.log('📋 Recolectando recursos hasta agotar el mundo (3 disponibles)...')
  for (let i = 0; i < 3; i++) {
    const result = await atlas.resource.collect({ worldId, resourceTypeId: 0 })
    console.log(
      `   Recolecta ${i + 1}/3 — +${result.points}pts, progreso: ${result.worldProgress}/3` +
        (result.epochEnded ? ' ⚡ (esto agotó el mundo)' : '')
    )
  }
  console.log()

  // ─── PASO 6: El momento clave — el mundo está agotado ──────────────────────
  // A partir de aquí, cualquier intento de recolectar más falla con el
  // error EpochMismatch. Esto es intencional: el contrato no avanza el
  // epoch solo, porque eso requeriría pagar rent de una cuenta nueva sin
  // que nadie lo autorice explícitamente. Por eso este paso es manual.
  console.log('📋 El mundo está agotado. Verificando estado...')
  const worldBeforeAdvance = await atlas.world.get(worldId)
  console.log(`   pendingAdvance: ${worldBeforeAdvance?.pendingAdvance}`)
  console.log(`   (si intentáramos collect() ahora, fallaría con EpochMismatch)\n`)

  // ─── PASO 7: Avanzar el epoch ───────────────────────────────────────────────
  // Esto crea el WorldState del nuevo epoch. Sin esto, el mundo queda
  // "muerto" para siempre. En producción, esto lo hace un keeper corriendo
  // 24/7 (ver PRODUCTION-GUIDE.md) — o en desarrollo, `atlas-cli watch`.
  console.log('📋 Avanzando al epoch 1...')
  await atlas.world.advanceEpoch(worldId)
  await atlas.world.createLeaderboard(worldId)
  console.log('✅ Epoch 1 listo — el mundo vuelve a aceptar recolectas\n')

  // ─── PASO 8: Verificar que el historial del epoch 0 persiste ───────────────
  // Esta es la garantía central del protocolo: el leaderboard del epoch
  // anterior NUNCA se borra. Queda accesible para siempre como historial.
  console.log('📋 Verificando que el leaderboard del epoch 0 sigue existiendo...')
  const historicalLb = await atlas.leaderboard.get(worldId, { epoch: 0 })
  console.log(`   Epoch 0 — entries: ${historicalLb?.entries.length}, top: ${historicalLb?.entries[0]?.resourcesCollected}pts\n`)

  // ─── PASO 9 (opcional): Cerrar el mundo y recuperar el rent ────────────────
  // Si este mundo fue solo para probar, ciérralo — recuperas el SOL del rent.
  // Comentado por default para que puedas seguir jugando con worldId arriba.
  //
  // const { lamportsRecovered } = await atlas.world.closeWorld(worldId)
  // console.log(`Mundo cerrado. Rent recuperado: ${lamportsRecovered / 1e9} SOL`)

  console.log('🎉 Ciclo completo. worldId', worldId, 'quedó en epoch 1, listo para seguir usándose.')
}

main().catch((err) => {
  console.error('❌ Error:', err.message ?? err)
  process.exit(1)
})
