"use client"
/**
 * @atlas-world/react — AtlasWorldProgress
 *
 * Barra de progreso del mundo, lista para usar. Se actualiza en tiempo
 * real vía eventos on-chain (sin polling), gracias a useWorld().
 *
 * @example
 * <AtlasWorldProgress worldId={0} />
 * <AtlasWorldProgress worldId={0} theme={{ accent: '#818CF8' }} showCountdown />
 */

import React from "react"
import { useWorld } from "../useWorld"
import { AtlasTheme, mergeTheme } from "../theme"

export interface AtlasWorldProgressProps {
  worldId: number
  theme?: Partial<AtlasTheme>
  /** Muestra el tiempo restante del epoch además del progreso de recursos */
  showCountdown?: boolean
  className?: string
}

function formatSeconds(s: number): string {
  if (s < 0) return "sin límite"
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function AtlasWorldProgress({
  worldId,
  theme: themeOverride,
  showCountdown = false,
  className,
}: AtlasWorldProgressProps) {
  const { world, loading } = useWorld(worldId)
  const theme = mergeTheme(themeOverride)

  if (loading && !world) {
    return (
      <div
        className={className}
        style={{
          padding: 16,
          borderRadius: theme.borderRadius,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          color: theme.textMuted,
          fontFamily: theme.fontFamily,
          fontSize: 13,
        }}
      >
        Cargando mundo...
      </div>
    )
  }

  if (!world) {
    return (
      <div
        className={className}
        style={{
          padding: 16,
          borderRadius: theme.borderRadius,
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          color: theme.danger,
          fontFamily: theme.fontFamily,
          fontSize: 13,
        }}
      >
        Mundo no encontrado
      </div>
    )
  }

  const barColor = world.progress > 80 ? theme.gold : theme.accent

  return (
    <div
      className={className}
      style={{
        padding: 16,
        borderRadius: theme.borderRadius,
        background: theme.surface,
        border: `1px solid ${theme.border}`,
        fontFamily: theme.fontFamily,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 8,
        }}
      >
        <span style={{ color: theme.text, fontSize: 14, fontWeight: 600 }}>
          {world.config.name}
        </span>
        <span style={{ color: theme.textMuted, fontSize: 11 }}>
          Epoch {world.config.currentEpoch}
        </span>
      </div>

      <div
        style={{
          width: "100%",
          height: 8,
          borderRadius: 4,
          background: theme.border,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${world.progress}%`,
            height: "100%",
            background: barColor,
            transition: "width 0.4s ease",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 8,
          fontSize: 12,
          color: theme.textMuted,
        }}
      >
        <span>
          {world.state.resourcesCollected} / {world.config.totalResources}
        </span>
        {showCountdown && (
          <span>
            {world.secondsRemaining < 0
              ? "sin límite de tiempo"
              : `${formatSeconds(world.secondsRemaining)} restantes`}
          </span>
        )}
      </div>

      {world.exhausted && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: theme.gold,
          }}
        >
          ⚡ Mundo agotado — esperando reset
        </div>
      )}
    </div>
  )
}
