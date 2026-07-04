"use client"

/**
 * @atlas-world/react — AtlasProvider
 *
 * Context provider que inicializa el AtlasClient y lo pone disponible
 * para todos los hooks. Debe envolver la aplicación.
 *
 * IMPORTANTE: AtlasProvider NO llama useWallet() internamente. Recibe
 * el objeto `wallet` como prop, obtenido por TU propio useWallet() de
 * @solana/wallet-adapter-react. Esto evita bugs de "Context duplicado"
 * que ocurren cuando dos copias del mismo paquete de wallet-adapter
 * conviven en node_modules (una en tu app, otra dentro de esta librería).
 *
 * @example
 * "use client"
 * import { useWallet } from '@solana/wallet-adapter-react'
 * import { AtlasProvider } from '@atlas-world/react'
 *
 * function Providers({ children }) {
 *   const wallet = useWallet()
 *   return (
 *     <AtlasProvider network="devnet" wallet={wallet}>
 *       {children}
 *     </AtlasProvider>
 *   )
 * }
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react'
import { AtlasClient } from '@atlas-world/sdk'
import type { AtlasNetwork } from '@atlas-world/core'

interface AtlasContextValue {
  client: AtlasClient | null
  connected: boolean
  /** Wallet address en base58, o null si no hay wallet conectada */
  publicKey: string | null
}

const AtlasContext = createContext<AtlasContextValue>({
  client: null,
  connected: false,
  publicKey: null,
})

interface AtlasProviderProps {
  network: AtlasNetwork
  /**
   * Objeto wallet obtenido de useWallet() de @solana/wallet-adapter-react
   * (o cualquier objeto compatible con publicKey/signTransaction).
   */
  wallet: any
  programId?: string
  children: ReactNode
}

export function AtlasProvider({ network, wallet, programId, children }: AtlasProviderProps) {
  const client = useMemo(() => {
    if (!wallet?.connected || !wallet?.publicKey) return null
    return new AtlasClient({ network, wallet, programId })
  }, [wallet?.connected, wallet?.publicKey, network, programId])

  const value = useMemo<AtlasContextValue>(
    () => ({
      client,
      connected: Boolean(wallet?.connected),
      publicKey: wallet?.publicKey ? wallet.publicKey.toBase58() : null,
    }),
    [client, wallet?.connected, wallet?.publicKey]
  )

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>
}

/** Hook interno para acceder al contexto de Atlas */
export function useAtlasContext() {
  return useContext(AtlasContext)
}
