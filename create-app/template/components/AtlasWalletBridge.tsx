"use client"

/**
 * Este componente existe para que useWallet() se llame desde el código
 * de TU app (no desde dentro de @atlas-world/react), garantizando que
 * usa la misma instancia de @solana/wallet-adapter-react que el resto
 * de tu aplicación. AtlasProvider recibe el wallet ya resuelto como prop.
 */

import { ReactNode } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { AtlasProvider } from "@atlas-world/react"
import { NETWORK } from "@/lib/atlas-config"

export function AtlasWalletBridge({ children }: { children: ReactNode }) {
  const wallet = useWallet()
  return (
    <AtlasProvider network={NETWORK} wallet={wallet}>
      {children}
    </AtlasProvider>
  )
}
