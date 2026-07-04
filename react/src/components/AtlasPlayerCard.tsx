"use client"
/**
 * @atlas-world/react — AtlasPlayerCard
 *
 * Tarjeta del player conectado, lista para usar en cualquier HUD.
 * Si el usuario no tiene player en el mundo, muestra un botón de mint.
 *
 * @example
 * <AtlasPlayerCard worldId={0} onMint={() => atlas.player.mint({...})} />
 */

import React from "react"
import { usePlayer } from "../usePlayer"
import { AtlasTheme, mergeTheme } from "../theme"

export interface AtlasPlayerCardProps {
  worldId: number
  /** Callback cuando el usuario hace click en "Crear personaje" */
  onMint?: () => void | Promise<void>
  mintLabel?: string
  theme?: Partial<AtlasTheme>
  className?: string
}

export function AtlasPlayerCard({
  worldId,
  onMint,
  mintLabel = "Crear personaje",
  theme: themeOverride,
  className,
}: AtlasPlayerCardProps) {
  const { player, loading, hasPlayer } = usePlayer(worldId)
  const theme = mergeTheme(themeOverride)
  const [minting, setMinting] = React.useState(false)

  const containerStyle: React.CSSProperties = {
    padding: 16,
    borderRadius: theme.borderRadius,
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    fontFamily: theme.fontFamily,
  }

  if (loading) {
    return (
      <div className={className} style={containerStyle}>
        <span style={{ color: theme.textMuted, fontSize: 13 }}>Cargando...</span>
      </div>
    )
  }

  if (!hasPlayer) {
    const handleMint = async () => {
      if (!onMint) return
      setMinting(true)
      try {
        await onMint()
      } finally {
        setMinting(false)
      }
    }

    return (
      <div className={className} style={{ ...containerStyle, textAlign: "center" }}>
        <p style={{ color: theme.textMuted, fontSize: 13, margin: "0 0 12px" }}>
          Todavía no tienes un personaje en este mundo.
        </p>
        <button
          onClick={handleMint}
          disabled={minting || !onMint}
          style={{
            padding: "8px 20px",
            fontSize: 13,
            fontWeight: 600,
            color: theme.background,
            background: theme.accent,
            border: "none",
            borderRadius: 6,
            cursor: minting ? "not-allowed" : "pointer",
            opacity: minting ? 0.6 : 1,
            fontFamily: theme.fontFamily,
          }}
        >
          {minting ? "Creando..." : mintLabel}
        </button>
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{ ...containerStyle, display: "flex", alignItems: "center", gap: 14 }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: `${theme.accent}22`,
          border: `1px solid ${theme.accent}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 15,
          fontWeight: 700,
          color: theme.accent,
          flexShrink: 0,
        }}
      >
        {player!.level}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: theme.text,
            fontSize: 14,
            fontWeight: 600,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {player!.name}
        </div>
        <div style={{ color: theme.textMuted, fontSize: 12 }}>
          {player!.resourcesCollected} pts · Nivel {player!.level}
        </div>
      </div>
    </div>
  )
}
