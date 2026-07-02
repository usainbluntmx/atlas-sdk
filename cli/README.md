# @atlas-world/cli

CLI interactivo para crear y administrar mundos persistentes en Solana con Atlas World Protocol.

## Instalación

```bash
npm install -g @atlas-world/cli
```

O úsalo sin instalar:

```bash
npx atlas-cli <comando>
```

## Quickstart

```bash
# 1. Configura tu wallet y red (una sola vez)
atlas-cli init

# 2. Crea un mundo (interactivo — elige GameFi, DAO, Marketplace o Custom)
atlas-cli create-world

# 3. Mintea tu player
atlas-cli mint-player --name "Hero"

# 4. Recolecta recursos
atlas-cli collect --type 0

# 5. Revisa tu progreso
atlas-cli status

# 6. Mira el leaderboard
atlas-cli leaderboard
```

Eso es todo — un mundo persistente funcionando en Solana en menos de 2 minutos.

## Comandos

| Comando | Descripción |
|---|---|
| `atlas-cli init` | Configura wallet y red (devnet/mainnet) |
| `atlas-cli create-world` | Crea un mundo nuevo, interactivo con templates |
| `atlas-cli mint-player -n <nombre>` | Mintea tu player en el mundo actual |
| `atlas-cli collect -t <tipo>` | Recolecta un recurso |
| `atlas-cli status` | Muestra el estado del mundo y tu progreso |
| `atlas-cli leaderboard` | Muestra el ranking del epoch actual |
| `atlas-cli advance-epoch` | [authority] Avanza al siguiente epoch tras un reset |
| `atlas-cli pause` / `unpause` | [protocol authority] Emergency stop |

Todos los comandos aceptan `-w, --world <id>` para especificar un mundo distinto al default.

## Configuración

`atlas-cli init` guarda tu configuración en `~/.atlas/config.json`:

```json
{
  "network": "devnet",
  "walletPath": "~/.config/solana/id.json",
  "defaultWorldId": 0
}
```

El `defaultWorldId` se actualiza automáticamente cada vez que creas un mundo con `create-world`.

## License

MIT
