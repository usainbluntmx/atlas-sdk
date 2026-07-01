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

## Instalación

```bash
npm install @atlas-world/sdk
# o
pnpm add @atlas-world/sdk
```

Para React:
```bash
npm install @atlas-world/react
```

---

## Quickstart

### 1. Inicializar el cliente

```typescript
import { AtlasClient, WorldType, WorldVisibility } from '@atlas-world/sdk'

const atlas = new AtlasClient({
  network: 'devnet',
  wallet, // WalletContextState de @solana/wallet-adapter-react
})
```

### 2. Crear un mundo

```typescript
const { worldId } = await atlas.world.create({
  name: 'Mi Juego',
  worldType: WorldType.Gaming,
  visibility: WorldVisibility.Public,
  totalResources: 500,
  epochDuration: '7d',        // '7d', '24h', '30m' o segundos
  globalCooldown: 5,          // segundos entre recolectas
  resourceTypes: [
    { id: 0, name: 'common', points: 1,  cooldownSeconds: 5  },
    { id: 1, name: 'rare',   points: 3,  cooldownSeconds: 10 },
    { id: 2, name: 'epic',   points: 5,  cooldownSeconds: 30 },
  ]
})
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

## React Hooks

```tsx
import { AtlasProvider, useWorld, usePlayer, useLeaderboard, useCollect } from '@atlas-world/react'

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
  const { leaderboard } = useLeaderboard(worldId)
  const { collect, cooldown, collecting } = useCollect(worldId)

  // world, player y leaderboard se actualizan en tiempo real
  // via Anchor Events — sin polling

  if (!hasPlayer) return <button onClick={() => atlas.player.mint(...)}>Mint Player</button>

  return (
    <div>
      <p>{world?.config.name} — {world?.progress}%</p>
      <p>Nivel {player?.level}</p>
      <button
        onClick={() => collect(0)}
        disabled={collecting || cooldown > 0}
      >
        {cooldown > 0 ? `Espera ${cooldown}s` : 'Recolectar'}
      </button>
    </div>
  )
}
```

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
| `@atlas-world/react` | Hooks de React — `useWorld`, `usePlayer`, etc. |

---

## Contrato

**Program ID (Devnet):** `Baq3gzFF1oyCHZCDZ6ic8E28KQAJwyob3hJQRskqK7RV`

Construido con Anchor 0.32.1 en Solana Devnet.

---

## License

MIT — construido por [@usainbluntmx](https://github.com/usainbluntmx)
