# De Desarrollo a Producción — Guía de Atlas World Protocol

> Todo lo que usaste en devnet para prototipar rápido (`watch`, RPC público,
> leaderboard on-chain) tiene un reemplazo pensado para producción real.
> Esta guía cubre esa transición, paso a paso.

---

## El resumen en una tabla

| En desarrollo usaste... | En producción necesitas... |
|---|---|
| `atlas-cli watch` (polling cada 2s en tu terminal) | Un keeper real corriendo 24/7 (cron job, worker, o servicio) |
| RPC público de Devnet | RPC dedicado (Helius, QuickNode, Triton) |
| Leaderboard on-chain (top 25) | Indexer propio que escuche eventos y guarde el historial completo |
| Tu wallet personal como `protocol_authority` | Multi-sig (Squads) |
| Nada de monitoreo | Alertas sobre pausas, fallos, y balance del treasury |

Ninguno de estos cambios requiere modificar el contrato — todo se construye
sobre lo que ya existe (eventos, instrucciones de transferencia de autoridad,
`closeWorld`, `pauseProtocol`).

---

## 1. RPC dedicado

El RPC público de Devnet (`api.devnet.solana.com`) es suficiente para
prototipar, pero no es confiable para producción — rate limits agresivos,
WebSockets que se cortan sin avisar (por eso `@atlas-world/react` y
`atlas-cli watch` usan polling de respaldo).

**Qué hacer:**

1. Crea una cuenta en [Helius](https://helius.dev) o [QuickNode](https://quicknode.com) (ambos tienen tier gratuito para empezar).
2. Obtén tu endpoint RPC dedicado.
3. Pásalo al `AtlasClient` con el parámetro de red custom:

```typescript
import { AtlasClient } from '@atlas-world/sdk'
import { Connection } from '@solana/web3.js'

// AtlasClient no acepta un endpoint custom directamente todavía (usa
// RPC_ENDPOINTS fijos por red) — mientras tanto, usa el SDK de bajo nivel:
const connection = new Connection('https://tu-endpoint-dedicado.helius-rpc.com', 'confirmed')
// Y construye tu propio provider de Anchor con esa connection si necesitas
// control total. Para la mayoría de los casos, un RPC dedicado con
// WebSockets confiables hace que los eventos de Atlas lleguen sin
// necesitar polling de respaldo.
```

Con un RPC confiable, los eventos (`ResourceCollected`, `WorldReset`) llegan
en tiempo real de verdad — el polling de respaldo en los hooks de React deja
de ser necesario para la experiencia, aunque no hace daño dejarlo.

---

## 2. Reemplazar `watch` por un keeper real

`atlas-cli watch` es intencionalmente una herramienta de desarrollo — corre
en tu terminal, se detiene si cierras la ventana. En producción necesitas un
proceso que corra siempre, en un servidor.

**La lógica es la misma que ya usa `watch` internamente** — solo cambia
dónde corre:

```typescript
// keeper.ts — corre esto como un servicio (PM2, systemd, o un worker de tu
// plataforma cloud), no en tu laptop.

import { AtlasClient } from '@atlas-world/sdk'
import { Keypair } from '@solana/web3.js'
import * as fs from 'fs'

const keypair = Keypair.fromSecretKey(
  new Uint8Array(JSON.parse(fs.readFileSync(process.env.KEEPER_KEYPAIR_PATH!, 'utf-8')))
)
const wallet = {
  publicKey: keypair.publicKey,
  signTransaction: async (tx: any) => { tx.partialSign(keypair); return tx },
  signAllTransactions: async (txs: any[]) => { txs.forEach(tx => tx.partialSign(keypair)); return txs },
}

const atlas = new AtlasClient({ network: 'mainnet-beta', wallet })
const WORLD_IDS = [0, 1, 2] // los mundos que administras

async function checkAndAdvance(worldId: number) {
  const world = await atlas.world.get(worldId)
  if (world?.pendingAdvance) {
    console.log(`[keeper] Epoch terminó en mundo ${worldId} — avanzando...`)
    await atlas.world.advanceEpoch(worldId)
    await atlas.world.createLeaderboard(worldId)
    console.log(`[keeper] Epoch ${world.config.currentEpoch} listo en mundo ${worldId}`)
  }
}

async function loop() {
  while (true) {
    for (const worldId of WORLD_IDS) {
      try {
        await checkAndAdvance(worldId)
      } catch (err) {
        console.error(`[keeper] Error en mundo ${worldId}:`, err)
        // Aquí es donde conectas tu alerta (Slack, Discord, PagerDuty)
      }
    }
    await new Promise((r) => setTimeout(r, 10_000)) // cada 10s es razonable en prod
  }
}

loop()
```

Despliega esto en cualquier lugar que mantenga procesos vivos: una VM
pequeña con `pm2`, un contenedor en Railway/Render/Fly.io, o una función
de larga duración en tu proveedor cloud. La wallet del keeper (`KEEPER_KEYPAIR_PATH`)
necesita ser el `authority` de cada mundo que administra — o, si migraste a
multi-sig, una wallet delegada específicamente para esta tarea operativa.

---

## 3. Indexer para leaderboards sin límite

El leaderboard on-chain (top 25) existe para que cualquier mundo funcione
sin infraestructura extra desde el día 1. Cuando tu juego crece más allá de
eso, necesitas guardar el historial completo tú mismo.

**El patrón:**

1. Un servicio escucha el evento `ResourceCollected` (y `PlayerMinted`, `WorldReset`) de tu mundo.
2. Cada evento se guarda en tu base de datos (Postgres, Supabase, lo que uses).
3. Tu frontend consulta tu propia API en vez del leaderboard on-chain directamente.

```typescript
// indexer.ts — servicio simple, corre junto al keeper o por separado

atlas.resource.subscribe(worldId, async (event) => {
  await db.query(
    `INSERT INTO collections (world_id, wallet, resource_type, points, tx_signature, collected_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [event.worldId, event.wallet, event.resourceType, event.points, event.signature]
  )
})
```

Con esto, tu leaderboard "de verdad" vive en tu base de datos y puede tener
tantas entradas como quieras, paginación, filtros por fecha, etc. El
leaderboard on-chain (top 25) sigue existiendo como fuente de verdad
verificable — tu indexer es una vista enriquecida sobre esos mismos eventos.

---

## 4. Migrar a multi-sig

Antes de manejar dinero real, la autoridad del protocolo y de cada mundo no
debería depender de una sola clave privada.

1. Crea un Vault en [Squads](https://squads.so) con las wallets de tu equipo.
2. Transfiere la autoridad usando las instrucciones que ya construimos:

```typescript
// Una sola vez, cuando estés listo para producción real
await atlas.program.methods
  .transferProtocolAuthority(squadsVaultPublicKey)
  .accounts({ globalConfig: globalConfigPDA, authority: tuWalletActual.publicKey })
  .rpc()

// Por cada mundo que administres
await atlas.program.methods
  .transferWorldAuthority(squadsVaultPublicKey)
  .accounts({ worldConfig: worldConfigPDA, authority: tuWalletActual.publicKey })
  .rpc()
```

Después de esto, cualquier acción administrativa (`pauseProtocol`, `advanceEpoch`,
`closeWorld`) requiere la aprobación del multi-sig, no de una sola persona.

---

## 5. Monitoreo básico

Lo mínimo antes de manejar tráfico real:

- **Alerta si `ProtocolPaused` se emite** — significa que alguien activó el emergency stop, intencionalmente o no.
- **Alerta si el keeper falla repetidamente** — un mundo atascado en `pendingAdvance` por horas es un problema visible para tus jugadores.
- **Dashboard simple del treasury** — balance de SOL recibido por fees de mundos privados.
- **Logs de cada `collectResource` fallido** — un pico repentino de errores puede indicar un bug de tu frontend o un intento de abuso.

No necesitas herramientas sofisticadas para empezar — un webhook a Discord/Slack
desde tu keeper (`catch` block del loop de arriba) cubre el 80% del valor.

---

## 6. Checklist final antes de mainnet

- [ ] RPC dedicado configurado (Helius/QuickNode)
- [ ] Keeper corriendo como servicio, no en tu laptop
- [ ] Indexer si esperas más de ~25 jugadores activos simultáneos por mundo
- [ ] `protocol_authority` migrado a multi-sig (Squads)
- [ ] `world.authority` de cada mundo importante migrado a multi-sig
- [ ] Alertas básicas conectadas (Discord/Slack webhook mínimo)
- [ ] **Auditoría externa del contrato** — no negociable si vas a manejar fondos reales
- [ ] Confirmado que el build de mainnet NO incluye `--features devnet-tools`

---

## Eso es todo

Todo lo demás — crear mundos, mintear players, recolectar recursos, leer el
leaderboard — funciona exactamente igual en mainnet que en devnet. Solo
cambias `network: 'devnet'` por `network: 'mainnet-beta'` en el `AtlasClient`,
y le agregas la infraestructura de arriba alrededor.

¿Dudas o encontraste un gap en esta guía? Abre un issue en el repo.
