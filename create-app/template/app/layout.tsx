import type { Metadata } from "next"
import "./globals.css"
import { WalletProvider } from "@/components/WalletProvider"
import { AtlasWalletBridge } from "@/components/AtlasWalletBridge"

export const metadata: Metadata = {
  title: "Mi Mundo Atlas",
  description: "Construido con Atlas World Protocol",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <WalletProvider>
          <AtlasWalletBridge>{children}</AtlasWalletBridge>
        </WalletProvider>
      </body>
    </html>
  )
}
