# Atlas World Protocol SDK

> Construye mundos persistentes en Solana en minutos.

[![npm](https://img.shields.io/npm/v/@atlas-world/sdk)](https://www.npmjs.com/package/@atlas-world/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## ¿Qué es Atlas?

Atlas World Protocol es una primitiva de estado compartido persistente en Solana.
Un **World** en Atlas es cualquier espacio de estado donde múltiples actores interactúan
con reglas verificables on-chain.

- Un **juego** es un World
- Una **DAO** es un World
- Un **marketplace** es un World
- Un protocolo **DeFi** es un World

**Program ID (Devnet):** `6byM2kmNLLGcrjRcq7ETVvGpxKgoEQuAof44SXe1vEee`

---

## ⚠️ Limitaciones conocidas (léelas antes de diseñar tu mundo)

- **Leaderboard top 25** — el leaderboard on-chain guarda únicamente las 25 mejores puntuaciones por epoch. No hay paginación ni ranking ilimitado. Para GameFi pequeño/mediano es suficiente; para producción con miles de jugadores activos simultáneos, necesitarás un indexer externo que escuche los eventos `ResourceCollected` y mantenga su propio ranking completo.
- **Los epochs no avanzan solos** — cuando un mundo se agota (o expira por tiempo), el protocolo emite el evento `WorldReset`, pero **alguien tiene que llamar `advanceEpoch()` y `createLeaderboard()` manualmente** para que el mundo vuelva a aceptar recolectas. Ver la sección "Ciclo de vida de un Epoch" más abajo — este es el punto que más confunde a developers nuevos.
- **Los mundos no se pueden cerrar todavía** — no existe una instrucción `close_world`. Una vez creado, el mundo (y su rent asociado) permanece indefinidamente. Está en el roadmap.

---

## Instalación

```bash
npm install @atlas-world/sdk
# o
pnpm add @atlas-world/sdk
```

Para React (incluye hooks y componentes UI):
```bash
npm install @atlas-world/react
```

Para usar el CLI sin instalar nada:
```bash
npx @atlas-world/cli init
```

---

## Quickstart

### 1. Inicializar el cliente

El `wallet` que le pasas a `AtlasClient` cambia según dónde corras tu código:

**En React** (frontend con wallet-adapter):
```typescript
import { AtlasClient, WorldType, WorldVisibility } from '@atlas-world/sdk'
import { useWallet } from '@solana/wallet-adapter-react'

const wallet = useWallet() // WalletContextState

const atlas = new AtlasClient({
  network: 'devnet',
  wallet, // se pasa tal cual, el SDK sabe manejarlo
})
```

**En Node.js / scripts / backend** (sin wallet-adapter, usando un keypair de archivo):
```typescript
import { AtlasClient } from '@atlas-world/sdk'
import { Keypair } from '@solana/web3.js'
import * as fs from 'fs'

const secretKey = JSON.parse(fs.readFileSync('~/.config/solana/id.json', 'utf-8'))
const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey))

// Envuelve el keypair en una interfaz compatible — el SDK solo necesita
// publicKey, signTransaction y signAllTransactions
const wallet = {
  publicKey: keypair.publicKey,
  signTransaction: async (tx: any) => { tx.partialSign(keypair); return tx },
  signAllTransactions: async (txs: any[]) => { txs.forEach(tx => tx.partialSign(keypair)); return txs },
}

const atlas = new AtlasClient({ network: 'devnet', wallet })
```

Esto es exactamente lo que hace `@atlas-world/cli` internamente — si quieres ver un ejemplo completo funcionando, revisa `cli/src/config.ts` en el repo.

### 2. Crear un mundo

```typescript
const { worldId } = await atlas.world.create({
  name: 'Mi Juego',
  worldType: WorldType.Gaming,
  visibility: WorldVisibility.Public,
  totalResources: 500,
  epochDuration: '7d',        // '7d', '24h', '30m' o segundos
  globalCooldown: 5,          // segundos entre recolectas
  maxDailyCollects: 0,        // 0 = sin límite; usa un número para anti-farming
  resourceTypes: [
    { id: 0, name: 'common', points: 1,  cooldownSeconds: 5  },
    { id: 1, name: 'rare',   points: 3,  cooldownSeconds: 10 },
    { id: 2, name: 'epic',   points: 5,  cooldownSeconds: 30 },
  ]
})

// El leaderboard del epoch 0 se crea aparte (una sola vez por epoch)
await atlas.world.createLeaderboard(worldId)
```

### 3. Mintear un player

```typescript
await atlas.player.mint({
  worldId,
  name: 'Hero',
  metadataUri: 'https://gateway.irys.xyz/...' // opcional
})
```

### 4. Recolectar recursos

```typescript
const result = await atlas.resource.collect({
  worldId,
  resourceTypeId: 1, // 'rare' en este mundo
})

console.log(`+${result.points} puntos — Nivel ${result.newLevel}`)
```

### 5. Leer el leaderboard

```typescript
const lb = await atlas.leaderboard.get(worldId)
lb.entries.forEach((entry, i) => {
  console.log(`#${i+1} ${entry.name} — ${entry.resourcesCollected} pts`)
})
```

---

## Ciclo de vida de un Epoch

Esto es lo más importante de entender antes de llevar un mundo a producción.

Un mundo tiene recursos limitados (`totalResources`). Cuando se agotan — o cuando pasa el tiempo configurado en `epochDuration`, lo que ocurra primero — el epoch **termina**. El contrato:

1. Incrementa `currentEpoch` en `WorldConfig`
2. Emite el evento `WorldReset`

Pero **no crea automáticamente** el `WorldState` del nuevo epoch, porque eso requeriría que el contrato pagara rent sin que nadie lo autorice. Por diseño, el `authority` del mundo decide cuándo continuar. Si no llamas `advanceEpoch()`, la siguiente recolecta falla con el error `EpochMismatch` — esto es normal, no es un bug.

**El patrón correcto** es suscribirte al evento y reaccionar:

```typescript
const unsubscribe = atlas.world.subscribe(worldId, {
  onWorldReset: async (event) => {
    console.log(`Epoch ${event.completedEpoch} terminó. Ganador: ${event.winner}`)

    // Avanza el epoch — crea el WorldState nuevo
    await atlas.world.advanceEpoch(worldId)

    // Crea el leaderboard del nuevo epoch
    await atlas.world.createLeaderboard(worldId)

    console.log(`Epoch ${event.newEpoch} listo para recibir recolectas`)
  }
})
```

Si usas el CLI en vez del SDK directo, el equivalente manual es:
```bash
atlas-cli advance-epoch
```

El leaderboard del epoch anterior **nunca se borra** — queda accesible para siempre como historial:
```typescript
const historico = await atlas.leaderboard.get(worldId, { epoch: 0 })
```

---

## Eventos del Protocolo

Todos los eventos son emitidos on-chain vía Anchor Events. Suscríbete con `atlas.world.subscribe()` o `atlas.resource.subscribe()` para reaccionar en tiempo real sin polling.

| Evento | Cuándo se emite | Campos |
|---|---|---|
| `WorldCreated` | Al crear un mundo | `worldId`, `authority`, `name`, `worldType`, `visibility`, `totalResources`, `epochDuration` |
| `LeaderboardInitialized` | Al crear el leaderboard de un epoch | `worldId`, `epoch` |
| `PlayerMinted` | Al mintear un player | `worldId`, `owner`, `name`, `metadataUri` |
| `ResourceCollected` | En cada recolecta exitosa | `worldId`, `epoch`, `wallet`, `resourceType`, `points`, `worldProgress`, `totalResources` |
| `WorldReset` | Cuando un epoch termina (agotamiento o tiempo) | `worldId`, `completedEpoch`, `newEpoch`, `winner`, `totalCollected` |
| `PlayerWhitelisted` | Al agregar una wallet a la whitelist (mundos privados) | `worldId`, `member` |
| `PlayerRemovedFromWhitelist` | Al remover una wallet de la whitelist | `worldId`, `member` |
| `ProtocolPaused` | Cuando el protocol authority activa el emergency stop | `by` |
| `ProtocolUnpaused` | Cuando se reactiva el protocolo | `by` |

Si estás construyendo un indexer o backend propio, estos son los eventos que necesitas escuchar. La definición exacta de cada uno vive en `programs/atlas-sdk/src/events.rs` en el repo del contrato.

---

## React Hooks y Componentes

```tsx
import {
  AtlasProvider, useWorld, usePlayer, useLeaderboard, useCollect,
  AtlasWorldProgress, AtlasLeaderboard, AtlasPlayerCard, AtlasCollectButton,
} from '@atlas-world/react'

function App() {
  return (
    <AtlasProvider network="devnet">
      <Game worldId={0} />
    </AtlasProvider>
  )
}

function Game({ worldId }: { worldId: number }) {
  const { world } = useWorld(worldId)
  const { player, hasPlayer } = usePlayer(worldId)

  return (
    <div>
      <AtlasWorldProgress worldId={worldId} showCountdown />
      <AtlasPlayerCard worldId={worldId} onMint={() => atlas.player.mint({ worldId, name: 'Hero' })} />
      <AtlasCollectButton worldId={worldId} resourceTypeId={0} label="Recolectar madera" />
      <AtlasLeaderboard worldId={worldId} limit={10} />
    </div>
  )
}
```

Todos los hooks y componentes se actualizan en tiempo real vía Anchor Events — sin polling.

---

## CLI

```bash
npx @atlas-world/cli init            # configura wallet y red
npx @atlas-world/cli create-world    # interactivo, con templates
npx @atlas-world/cli mint-player -n "Hero"
npx @atlas-world/cli collect -t 0
npx @atlas-world/cli status
npx @atlas-world/cli leaderboard
npx @atlas-world/cli advance-epoch   # [authority]
npx @atlas-world/cli pause           # [protocol authority] emergency stop
```

Ver `cli/README.md` para la referencia completa de comandos.

---

## Casos de uso

### GameFi
```typescript
resourceTypes: [
  { id: 0, name: 'wood',  points: 1, cooldownSeconds: 5  },
  { id: 1, name: 'stone', points: 3, cooldownSeconds: 10 },
  { id: 2, name: 'gold',  points: 5, cooldownSeconds: 30 },
]
```

### DAO
```typescript
resourceTypes: [
  { id: 0, name: 'vote',     points: 1,  cooldownSeconds: 86400  },
  { id: 1, name: 'proposal', points: 10, cooldownSeconds: 604800 },
]
epochDuration: '30d'
```

### NFT Marketplace
```typescript
resourceTypes: [
  { id: 0, name: 'listing',  points: 1, cooldownSeconds: 3600  },
  { id: 1, name: 'featured', points: 5, cooldownSeconds: 86400 },
]
epochDuration: '1d'
```

---

## Paquetes

| Paquete | Descripción |
|---------|-------------|
| `@atlas-world/core` | Tipos, PDAs, errores y utilidades base |
| `@atlas-world/sdk` | Cliente principal — `AtlasClient` |
| `@atlas-world/react` | Hooks + componentes UI listos para usar |
| `@atlas-world/cli` | CLI interactivo para crear y administrar mundos |

---

## Seguridad — qué saber antes de usar en mainnet

- El contrato incluye instrucciones `close_protocol` y `admin_set_world_count` marcadas explícitamente como solo para desarrollo — se usan para migrar `GlobalConfig` cuando su layout cambia durante desarrollo activo en devnet. **No deben existir en un deploy de mainnet.**
- El protocolo tiene emergency stop (`pauseProtocol()` / `unpauseProtocol()`) controlado por una sola wallet (`protocol_authority`). Antes de mainnet, esa autoridad debe migrarse a una wallet multi-sig.
- El contrato **no ha sido auditado externamente** todavía. Úsalo en devnet con confianza; trátalo como beta en mainnet.

---

## Contrato

Construido con Anchor 0.32.1 en Solana Devnet.

**Program ID (Devnet):** `6byM2kmNLLGcrjRcq7ETVvGpxKgoEQuAof44SXe1vEee`

---

## License

MIT — construido por [@usainbluntmx](https://github.com/usainbluntmx)
