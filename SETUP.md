# Setup — Atlas SDK Project

## 1. Reemplazar Program ID

Este proyecto usa un placeholder `REPLACE_WITH_NEW_PROGRAM_ID` en tres archivos.
Genera un keypair nuevo para este programa:

```bash
solana-keygen new -o target/deploy/atlas-keypair.json --no-bip39-passphrase --force
solana-keygen pubkey target/deploy/atlas-keypair.json
```

Copia el Program ID que te da y reemplázalo en:
- `programs/atlas/src/lib.rs` → `declare_id!(...)`
- `Anchor.toml` → `[programs.devnet]` y `[programs.mainnet]`

Búscalo con:
```bash
grep -r "REPLACE_WITH_NEW_PROGRAM_ID" . --include="*.rs" --include="*.toml" -l
```

## 2. Instalar dependencias

```bash
# Dependencias de Anchor (root)
npm install

# Dependencias del SDK monorepo
pnpm install
```

## 3. Build del contrato

```bash
anchor build
```

## 4. Deploy a Devnet

```bash
solana config set --url devnet
solana airdrop 2  # si necesitas SOL
anchor deploy
anchor idl init --provider.cluster devnet --filepath target/idl/atlas.json <PROGRAM_ID>
```

## 5. Inicializar el protocolo (una sola vez)

Después de deployar, alguien debe llamar `initialize_protocol` para crear el `GlobalConfig`.
Esto se puede hacer desde un script o desde el SDK:

```typescript
import { AtlasClient } from '@atlas-world/sdk'
// ... llamar initializeProtocol con el treasury wallet
```

## 6. Correr tests

```bash
anchor test --skip-local-validator  # si usas devnet
# o
anchor test  # levanta validator local automáticamente
```

## 7. Build del SDK

```bash
pnpm build
```

Esto compila `core`, `sdk` y `react` en sus respectivas carpetas `dist/`.

## 8. Copiar el IDL al SDK

El `AtlasClient` necesita el IDL generado. Después de cada `anchor build`:

```bash
cp target/idl/atlas.json sdk/src/idl.json
```

(Y actualiza el import en `sdk/src/AtlasClient.ts` para usar este archivo en vez del path relativo a `programs/`.)
