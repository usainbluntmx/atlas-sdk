"use client"
/**
 * @atlas-world/react — AtlasLeaderboard
 *
 * Leaderboard listo para usar, con actualización en tiempo real.
 *
 * @example
 * <AtlasLeaderboard worldId={0} limit={10} />
 * <AtlasLeaderboard worldId={0} highlightWallet={publicKey?.toBase58()} />
 */

import React from "react"
import { useLeaderboard } from "../useLeaderboard"
import { AtlasTheme, mergeTheme } from "../theme"
import { abbreviateAddress } from "@atlas-world/core"

export interface AtlasLeaderboardProps {
  worldId: number
  /** Epoch específico — si se omite, usa el epoch actual */
  epoch?: number
  /** Máximo de entradas a mostrar (default: todas, hasta 25) */
  limit?: number
  /** Wallet a resaltar visualmente (ej. el usuario conectado) */
  highlightWallet?: string
  theme?: Partial<AtlasTheme>
  className?: string
}

const MEDALS = ["🥇", "🥈", "🥉"]

export function AtlasLeaderboard({
  worldId,
  epoch,
  limit,
  highlightWallet,
  theme: themeOverride,
  className,
}: AtlasLeaderboardProps) {
  const { leaderboard, loading } = useLeaderboard(worldId, epoch)
  const theme = mergeTheme(themeOverride)

  const containerStyle: React.CSSProperties = {
    borderRadius: theme.borderRadius,
    background: theme.surface,
    border: `1px solid ${theme.border}`,
    fontFamily: theme.fontFamily,
    overflow: "hidden",
  }

  if (loading && !leaderboard) {
    return (
      <div className={className} style={{ ...containerStyle, padding: 16 }}>
        <span style={{ color: theme.textMuted, fontSize: 13 }}>
          Cargando leaderboard...
        </span>
      </div>
    )
  }

  const entries = (leaderboard?.entries ?? []).slice(0, limit)

  return (
    <div className={className} style={containerStyle}>
      <div
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${theme.border}`,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span style={{ color: theme.text, fontSize: 13, fontWeight: 600 }}>
          Leaderboard
        </span>
        <span style={{ color: theme.textMuted, fontSize: 11 }}>
          Epoch {leaderboard?.epoch ?? "—"}
        </span>
      </div>

      {entries.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center" }}>
          <span style={{ color: theme.textMuted, fontSize: 13 }}>
            Sin jugadores todavía
          </span>
        </div>
      ) : (
        <div>
          {entries.map((entry, i) => {
            const isHighlighted = highlightWallet === entry.owner
            return (
              <div
                key={entry.owner}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 16px",
                  background: isHighlighted ? `${theme.accent}14` : "transparent",
                  borderLeft: isHighlighted
                    ? `2px solid ${theme.accent}`
                    : "2px solid transparent",
                }}
              >
                <span
                  style={{
                    width: 24,
                    fontSize: 13,
                    fontWeight: 700,
                    color:
                      i === 0
                        ? theme.gold
                        : i < 3
                        ? theme.textMuted
                        : theme.border,
                    textAlign: "center",
                  }}
                >
                  {MEDALS[i] ?? i + 1}
                </span>
                <span
                  style={{
                    flex: 1,
                    color: theme.text,
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {entry.name || abbreviateAddress(entry.owner)}
                </span>
                <span style={{ color: theme.accent, fontSize: 13, fontWeight: 600 }}>
                  {entry.resourcesCollected}
                </span>
                <span style={{ color: theme.textMuted, fontSize: 11 }}>
                  Lv.{entry.level}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
