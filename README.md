# Atlas World Protocol SDK

> Construye mundos persistentes en Solana en minutos.

[![npm](https://img.shields.io/npm/v/@atlas-world/sdk)](https://www.npmjs.com/package/@atlas-world/sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**[atlas-world.dev →](https://usainbluntmx.github.io/atlas-sdk/)** — sitio interactivo con arquitectura, casos de uso y demo en vivo

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

## ¿Qué parte de Atlas necesitas?

Atlas no es una sola cosa — es un contrato Solana + SDK TypeScript + 4 interfaces distintas encima. Elige la tuya:

| Quiero... | Usa esto |
|---|---|
| 👑 **Ver algo funcionando ya, con UI** | `npx @atlas-world/create-app` — genera una app Next.js con demo viva |
| 🛠️ **Control total desde terminal** (sin escribir código) | `npx @atlas-world/cli` — crear mundos, mintear, recolectar, todo interactivo |
| 💻 **Integrar el protocolo en mi propio backend/frontend** | `npm install @atlas-world/sdk` — el cliente TypeScript, ver [Quickstart](#quickstart) abajo |
| 🤖 **Que un agente AI opere mundos por su cuenta** | `npm install -g @atlas-world/mcp` — servidor MCP, ver [sección de agentes](#para-agentes-ai) |

Todas comparten el mismo contrato y el mismo estado on-chain — son solo puertas de entrada distintas al mismo protocolo.

---

## Empieza en 2 minutos

La forma más rápida de ver el protocolo funcionando — sin escribir código:

```bash
npx @atlas-world/create-app mi-mundo
cd mi-mundo
npm install
npm run dev
```

Esto genera una app Next.js ya conectada al **Mundo Demo público** que mantiene el equipo de Atlas. Abre `localhost:3000`, conecta tu wallet de Phantom en Devnet, y en segundos vas a ver progreso real, un leaderboard compartido con otros developers probando el SDK ahora mismo, y botones de recolecta que funcionan de inmediato. Todo se actualiza en vivo, sin recargar la página.

Cuando quieras tu propio mundo en vez del demo: `npx @atlas-world/cli create-world`.

---

## Para agentes AI

Atlas también tiene una interfaz nativa para agentes AI vía **[Model Context Protocol](https://modelcontextprotocol.io)**. Un agente puede crear mundos, mintear su identidad, recolectar recursos, y leer el leaderboard directamente como tool calls — sin que un humano escriba código intermedio.

```bash
npm install -g @atlas-world/mcp
```

Configura en Claude Desktop (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "atlas-world": {
      "command": "npx",
      "args": ["-y", "@atlas-world/mcp"]
    }
  }
}
```

Reutiliza la misma configuración que el CLI (`~/.atlas/config.json`) — si ya corriste `atlas-cli init`, el agente queda listo sin pasos extra. Ver [`mcp/README.md`](./mcp/README.md) para la referencia completa de tools.

---

## ⚠️ Limitaciones conocidas (léelas antes de diseñar tu mundo)

- **Leaderboard top 25** — el leaderboard on-chain guarda únicamente las 25 mejores puntuaciones por epoch. No hay paginación ni ranking ilimitado. Para GameFi pequeño/mediano es suficiente; para producción con miles de jugadores activos simultáneos, necesitarás un indexer externo que escuche los eventos `ResourceCollected` y mantenga su propio ranking completo.
- **Los epochs no avanzan solos** — cuando un mundo se agota (o expira por tiempo), el protocolo emite el evento `WorldReset`, pero **alguien tiene que llamar `advanceEpoch()` y `createLeaderboard()` manualmente** para que el mundo vuelva a aceptar recolectas. Ver la sección "Ciclo de vida de un Epoch" más abajo — este es el punto que más confunde a developers nuevos.
- **Los eventos en tiempo real dependen del RPC** — `@atlas-world/react` combina Anchor Events con polling de respaldo cada 8s, así que la UI siempre acaba consistente incluso si el WebSocket del RPC público de Devnet falla (es común en endpoints gratuitos). Para producción con más tráfico, usa un RPC dedicado (Helius, QuickNode).

---

## Instalación

**Requiere Node.js 18 o superior.** Verifica con `node --version`.

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

Para generar una app completa conectada al Mundo Demo:
```bash
npx @atlas-world/create-app mi-mundo
```

> **Nota sobre imports:** todo lo que necesitas — `AtlasClient`, `WorldType`, `WorldVisibility`, tipos como `Player` o `World` — se re-exporta desde `@atlas-world/sdk`. **Nunca necesitas importar directamente de `@atlas-world/core`** — ese paquete es una dependencia interna, no una API pública que debas tocar.

---

## Quickstart

> ¿Prefieres ver el ciclo completo en un solo archivo, comentado línea por línea? Corre [`examples/quickstart.ts`](./examples/quickstart.ts) — crea un mundo, mintea, recolecta, agota el mundo, avanza el epoch, y verifica el historial, todo en una sola corrida.

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

**En Node.js / scripts / backend** — la forma más rápida:
```typescript
import { AtlasClient } from '@atlas-world/sdk'

const atlas = AtlasClient.fromKeypair({
  network: 'devnet',
  keypairPath: '~/.config/solana/id.json',
})
```

`fromKeypair()` es el atajo recomendado para todo lo que no sea un frontend
con wallet de navegador. Si necesitas armar el objeto `wallet` a mano (por
ejemplo, para un keypair que no viene de un archivo), la forma explícita
es:
```typescript
import { AtlasClient } from '@atlas-world/sdk'
import { Keypair } from '@solana/web3.js'
import * as fs from 'fs'

const secretKey = JSON.parse(fs.readFileSync('~/.config/solana/id.json', 'utf-8'))
const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey))

// El SDK solo necesita publicKey, signTransaction y signAllTransactions
const wallet = {
  publicKey: keypair.publicKey,
  signTransaction: async (tx: any) => { tx.partialSign(keypair); return tx },
  signAllTransactions: async (txs: any[]) => { txs.forEach(tx => tx.partialSign(keypair)); return txs },
}

const atlas = new AtlasClient({ network: 'devnet', wallet })
```

Esto es lo que hace `fromKeypair()` internamente, y también lo que usa
`@atlas-world/cli` — revisa `cli/src/config.ts` en el repo si quieres verlo.

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
npx @atlas-world/cli watch           # [authority] keeper de desarrollo — avanza epochs solo
npx @atlas-world/cli pause           # [protocol authority] emergency stop
```

> **`watch` es para desarrollo, no producción.** Corre en foreground y avanza el epoch automáticamente cada vez que el mundo se agota — útil mientras pruebas para no tener que llamar `advance-epoch` manualmente cada vez. En producción, implementa esta misma lógica como tu propio backend/keeper usando `atlas.world.subscribe()`.

Ver `cli/README.md` para la referencia completa de comandos.

---

## Casos de uso

Cada narrativa tiene un template listo en `WORLD_TEMPLATES` — resourceTypes, epochDuration y cooldowns ya calibrados, no genéricos. Úsalos directo o como punto de partida:

```typescript
import { WORLD_TEMPLATES } from '@atlas-world/sdk'

const template = WORLD_TEMPLATES.dao // 'gaming' | 'dao' | 'marketplace' | 'defi' | 'rwa' | 'nft_collection'

await atlas.world.create({
  name: 'Mi DAO',
  worldType: template.worldType,
  visibility: WorldVisibility.Public,
  totalResources: 100,
  epochDuration: template.epochDuration,
  globalCooldown: template.globalCooldown,
  maxDailyCollects: template.maxDailyCollects,
  resourceTypes: template.resourceTypes,
})
```

| Template | Narrativa | Resources de ejemplo |
|---|---|---|
| `gaming` | GameFi / Web3 Gaming | common, rare, epic |
| `dao` | DAO / Governance | vote, proposal, veto |
| `marketplace` | Marketplace / Listings | listing, featured |
| `defi` | DeFi / Liquidity Mining | lp_deposit, stake, long_term_lock |
| `rwa` | Real World Assets | certification, custody_transfer, audit_confirmed |
| `nft_collection` | NFT holder tracking | mint, trade, hold_milestone |

`atlas-cli create-world` te deja elegir cualquiera de estos interactivamente, con el desglose completo de resourceTypes antes de confirmar.

---

## Paquetes

| Paquete | Descripción |
|---------|-------------|
| `@atlas-world/core` | Tipos, PDAs, errores y utilidades base |
| `@atlas-world/sdk` | Cliente principal — `AtlasClient` |
| `@atlas-world/react` | Hooks + componentes UI listos para usar |
| `@atlas-world/cli` | CLI interactivo para crear y administrar mundos |
| `@atlas-world/create-app` | Genera una app Next.js conectada al Mundo Demo en un comando |
| `@atlas-world/mcp` | Servidor MCP — tools nativas para agentes AI (Claude y otros) |

---

## Tests

El contrato tiene tests de integración corriendo contra un validator local
de Anchor — no es solo código sin verificar:

```bash
anchor test
```

Cubren: inicialización del protocolo, creación de mundos (públicos y
privados), whitelist, mint de players, recolecta con validación de
resource types inválidos, y el leaderboard. Ver `tests/*.test.ts` en el repo.

Además, todo el ciclo completo (crear → mint → recolectar → agotar →
avanzar epoch → verificar historial) está probado manualmente contra
devnet real en [`examples/quickstart.ts`](./examples/quickstart.ts) — el
mismo script que puedes correr tú para verificarlo de nuevo en cualquier momento.

---

## De desarrollo a producción

¿Ya probaste Atlas y quieres llevar tu mundo a mainnet con infraestructura real? Lee **[PRODUCTION-GUIDE.md](./PRODUCTION-GUIDE.md)** — cubre RPC dedicado, reemplazar `atlas-cli watch` por un keeper real, indexer para leaderboards sin límite, migración a multi-sig, y un checklist final pre-mainnet.

---

## Seguridad — qué saber antes de usar en mainnet

- **Las instrucciones de solo-desarrollo están bloqueadas por default.** `close_protocol` y `admin_set_world_count` existen para migrar `GlobalConfig` durante desarrollo activo en devnet, pero fallan siempre con `Unauthorized` a menos que el contrato se compile explícitamente con `anchor build -- --features devnet-tools`. Es estructuralmente imposible que lleguen activas a un deploy de mainnet por descuido.
- **Migración de autoridad sin redeploy.** `transferProtocolAuthority()` y `transferWorldAuthority()` permiten mover el control del protocolo (o de un mundo específico) a una wallet multi-sig (recomendado: [Squads](https://squads.so)) sin necesidad de volver a desplegar el contrato.
- **Los mundos se pueden cerrar.** `closeWorld()` cierra la cuenta `WorldConfig` y devuelve el rent al authority cuando un mundo ya no se usa. El `WorldState` y `Leaderboard` de epochs pasados no se cierran — quedan como historial.
- **Emergency stop.** `pauseProtocol()` / `unpauseProtocol()` bloquean `createWorld`, `mintPlayer` y `collectResource` en todo el protocolo sin afectar lecturas. Controlado por `protocol_authority` — migra esa autoridad a un multi-sig antes de mainnet.
- **El contrato no ha sido auditado externamente todavía.** Úsalo en devnet con confianza; trátalo como beta en mainnet hasta que haya un reporte de auditoría público.

---

## Contrato

Construido con Anchor 0.32.1 en Solana Devnet.

**Program ID (Devnet):** `6byM2kmNLLGcrjRcq7ETVvGpxKgoEQuAof44SXe1vEee`

---

## License

MIT — construido por [@usainbluntmx](https://github.com/usainbluntmx)
