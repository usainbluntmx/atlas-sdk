/**
 * @atlas-world/react — AtlasProvider
 *
 * Context provider que inicializa el AtlasClient y lo pone disponible
 * para todos los hooks. Debe envolver la aplicación.
 *
 * @example
 * <AtlasProvider network="devnet">
 *   <App />
 * </AtlasProvider>
 */

import React, { createContext, useContext, useMemo, ReactNode } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { AtlasClient } from '@atlas-world/sdk'
import type { AtlasNetwork } from '@atlas-world/core'

interface AtlasContextValue {
  client: AtlasClient | null
  connected: boolean
}

const AtlasContext = createContext<AtlasContextValue>({
  client: null,
  connected: false,
})

interface AtlasProviderProps {
  network: AtlasNetwork
  programId?: string
  children: ReactNode
}

export function AtlasProvider({ network, programId, children }: AtlasProviderProps) {
  const wallet = useWallet()

  const client = useMemo(() => {
    if (!wallet.connected || !wallet.publicKey) return null
    return new AtlasClient({ network, wallet: wallet as any, programId })
  }, [wallet.connected, wallet.publicKey, network, programId])

  return (
    <AtlasContext.Provider value={{ client, connected: wallet.connected }}>
      {children}
    </AtlasContext.Provider>
  )
}

/** Hook interno para acceder al contexto de Atlas */
export function useAtlasContext() {
  return useContext(AtlasContext)
}
