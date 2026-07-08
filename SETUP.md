# SETUP.md — Atlas World Protocol

> Esta guía asume que estás **forkeando o clonando este repo para desplegar
> tu propia instancia** del protocolo (tu propio Program ID, tu propio
> `GlobalConfig`). Si solo quieres **usar** Atlas como developer, no
> necesitas nada de esto — instala `@atlas-world/sdk` o `@atlas-world/cli`
> directo desde npm. Ver el [README](./README.md).

---

## 1. Estado actual de este repo (referencia)

Este repo ya tiene un deploy funcional en Devnet:

- **Program ID:** `6byM2kmNLLGcrjRcq7ETVvGpxKgoEQuAof44SXe1vEee`
- **Ruta del programa:** `programs/atlas-sdk/src/lib.rs` (no `programs/atlas/`)
- **Toolchain:** Rust `1.85.0` (ver `rust-toolchain.toml`), Anchor `0.32.1`

Si vas a contribuir a *este* repo, no necesitas generar un Program ID
nuevo — usa el que ya existe arriba. Las secciones de abajo son para
cuando quieras desplegar **tu propia** instancia independiente.

---

## 2. Desplegar tu propia instancia (Program ID nuevo)

### 2.1 Generar un keypair de programa nuevo

```bash
solana-keygen new -o target/deploy/atlas-keypair.json --no-bip39-passphrase --force
solana-keygen pubkey target/deploy/atlas-keypair.json
```

Copia el Program ID que te da y reemplázalo en **estos 2 lugares**:

- `programs/atlas-sdk/src/lib.rs` → línea `declare_id!("...")`
- `Anchor.toml` → `[programs.devnet]` (y `[programs.mainnet]` si aplica)

Verifica que no quede ningún rastro del ID viejo:
```bash
grep -r "6byM2kmNLLGcrjRcq7ETVvGpxKgoEQuAof44SXe1vEee" . --include="*.rs" --include="*.toml" -l
```

### 2.2 Instalar dependencias

```bash
npm install       # dependencias de Anchor (root)
pnpm install      # dependencias del SDK monorepo (core/sdk/react/cli/mcp)
```

### 2.3 Build del contrato

```bash
anchor build
```

**Si esto falla con un error de `edition2024` o de compatibilidad de Cargo:**
verifica que `rust-toolchain.toml` tenga `channel = "1.85.0"` — versiones
más viejas de Rust (1.79–1.81) no resuelven correctamente el árbol de
dependencias transitivas de Anchor 0.32.1 en el ecosistema actual de crates.

### 2.4 Deploy a Devnet

```bash
solana config set --url devnet

# Si necesitas SOL de devnet:
solana airdrop 2
# Si el faucet falla (pasa seguido, está rate-limited): https://faucet.solana.com

anchor deploy
```

Si el binario crece y el deploy falla con `ExtendProgram requires...`:
```bash
solana program extend <TU_PROGRAM_ID> 20000
anchor deploy
```

### 2.5 Subir el IDL

```bash
anchor idl init --provider.cluster devnet --filepath target/idl/atlas.json <TU_PROGRAM_ID>
```

Si ya existe un IDL previo y este comando falla, ciérralo primero:
```bash
anchor idl close --provider.cluster devnet <TU_PROGRAM_ID>
anchor idl init --provider.cluster devnet --filepath target/idl/atlas.json <TU_PROGRAM_ID>
```

### 2.6 Copiar el IDL a los paquetes del SDK

Los paquetes `sdk`, `cli` y `mcp` necesitan su propia copia del IDL para
tipar el `Program` de Anchor:
```bash
cp target/idl/atlas.json sdk/src/idl.json
pnpm build:sdk
```

---

## 3. Inicializar el protocolo (una sola vez)

Después del deploy, `GlobalConfig` no existe todavía — nadie puede crear
un mundo hasta que se inicialice. Esto requiere una wallet de `treasury`
(puede ser la misma que despliega, o una separada para recibir fees de
mundos privados):

```typescript
import { AtlasClient } from '@atlas-world/sdk'
import { SystemProgram } from '@solana/web3.js'
import { getGlobalConfigPDA } from '@atlas-world/core'

const atlas = AtlasClient.fromKeypair({
  network: 'devnet',
  keypairPath: '~/.config/solana/id.json',
})

const [globalConfigPDA] = getGlobalConfigPDA(atlas.programId)
const treasuryPublicKey = atlas.program.provider.publicKey! // o una wallet separada

await (atlas.program.methods as any)
  .initializeProtocol(treasuryPublicKey)
  .accounts({
    globalConfig: globalConfigPDA,
    authority: atlas.program.provider.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc()

console.log('Protocolo inicializado — GlobalConfig listo en:', globalConfigPDA.toBase58())
```

Después de esto, `atlas.world.create(...)` ya funciona normalmente.

---

## 4. Correr los tests

```bash
anchor test
```

Si ves un error de que `target/types/atlas.ts` no existe, corre `anchor build`
primero — ese archivo se genera ahí, y los tests lo importan directamente.

Para saltarte la recompilación si ya hiciste `anchor build` recientemente:
```bash
anchor test --skip-build
```

---

## 5. Correr el ejemplo end-to-end

```bash
npx ts-node examples/quickstart.ts
```

Cubre el ciclo completo: crear mundo → leaderboard → mint → recolectar →
agotar → avanzar epoch → verificar historial. Es la forma más rápida de
confirmar que tu deploy quedó funcional de punta a punta.
