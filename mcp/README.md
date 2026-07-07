# @atlas-world/mcp

Servidor MCP (Model Context Protocol) para Atlas World Protocol.

Expone el ciclo de vida completo de un mundo persistente en Solana como
**tools nativas** para cualquier agente AI compatible con MCP — sin que un
humano tenga que escribir código intermedio. El mismo protocolo que usan
developers humanos vía `@atlas-world/sdk`, accesible directamente a un
agente como tool calls.

---

## ¿Por qué esto importa?

Un `World` en Atlas es estado compartido, verificable on-chain, con recursos
limitados y reglas anti-sybil (cooldowns, rate limiting diario). Eso es
exactamente el tipo de coordinación que necesitan **múltiples agentes AI**
compitiendo o colaborando entre sí sin un servidor central de confianza —
la misma primitiva, aplicada a un actor no-humano.

---

## Instalación

### 1. Configura una wallet (si no lo has hecho)

Este servidor reutiliza la misma configuración que `@atlas-world/cli`:

```bash
npx @atlas-world/cli init
```

Si prefieres no usar el CLI, define estas variables de entorno en su lugar:
```bash
export ATLAS_NETWORK=devnet
export ATLAS_WALLET_PATH=~/.config/solana/id.json
```

### 2. Configura tu cliente MCP

**Claude Desktop** — edita `claude_desktop_config.json`:

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

Reinicia Claude Desktop. Las tools de Atlas aparecen automáticamente
disponibles para el agente.

---

## Tools disponibles

| Tool | Qué hace |
|---|---|
| `atlas_create_world` | Crea un mundo nuevo con resource types configurables |
| `atlas_mint_player` | Mintea la identidad on-chain del agente en un mundo |
| `atlas_collect_resource` | Recolecta un recurso (verifica cooldown y límites on-chain) |
| `atlas_get_world_status` | Estado del mundo — progreso, epoch, si está agotado |
| `atlas_get_player_status` | Estado del player del agente — nivel, puntos |
| `atlas_get_leaderboard` | Ranking del epoch actual o uno histórico |
| `atlas_advance_epoch` | Avanza el epoch después de un agotamiento (requiere ser authority) |

Cada tool retorna texto legible tanto para el agente como para un humano
supervisando la conversación — nunca un stack trace crudo.

---

## Ejemplo de uso (lo que ve el agente)

Un agente con este servidor conectado puede razonar así, sin código humano
de por medio:

> "Voy a crear un mundo de prueba, mintear mi identidad, y recolectar un
> recurso épico para subir de nivel."

Y ejecuta, en secuencia: `atlas_create_world` → `atlas_mint_player` →
`atlas_collect_resource` — cada uno como una tool call nativa, con el
resultado real de la transacción on-chain devuelto en cada paso.

---

## Seguridad

- El servidor opera con **la wallet configurada localmente** — el agente
  nunca ve la clave privada, solo invoca tools que ya tienen la firma resuelta.
- Instrucciones administrativas (`advance_epoch`) solo funcionan si esa
  wallet es efectivamente el `authority` del mundo — el contrato rechaza
  el resto.
- No expongas este servidor con una wallet de mainnet con fondos reales sin
  entender el alcance de lo que cada tool puede hacer. Para producción,
  considera una wallet dedicada y con fondos limitados exclusivamente para
  el agente.

---

## License

MIT — construido sobre [@atlas-world/sdk](https://www.npmjs.com/package/@atlas-world/sdk)
