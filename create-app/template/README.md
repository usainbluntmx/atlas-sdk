# Mi Mundo Atlas

Generado con `create-atlas-app`. Esta app ya está conectada a Atlas World Protocol.

## Correr localmente

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000), conecta tu wallet de Phantom en **Devnet**, y verás el mundo en tiempo real.

## Conectarte a tu propio mundo

Por default esta app apunta al Mundo Demo compartido de Atlas. Para usar el tuyo:

```bash
npx @atlas-world/cli create-world
```

Copia el `worldId` que te da y actualiza `lib/atlas-config.ts`:

```typescript
export const WORLD_ID = 0 // tu worldId aquí
```

## Aprende más

- [Documentación del SDK](https://github.com/usainbluntmx/atlas-sdk)
- [@atlas-world/react — componentes y hooks](https://www.npmjs.com/package/@atlas-world/react)
- [@atlas-world/cli — administra tu mundo desde terminal](https://www.npmjs.com/package/@atlas-world/cli)
