"use client"
/**
 * @atlas-world/react — AtlasCollectButton
 *
 * Botón de recolecta listo para usar, con cooldown visual integrado.
 * Se deshabilita automáticamente durante la transacción y el cooldown.
 *
 * @example
 * <AtlasCollectButton worldId={0} resourceTypeId={0} label="Recolectar madera" />
 */

import React from "react"
import { useCollect } from "../useCollect"
import { AtlasTheme, mergeTheme } from "../theme"

export interface AtlasCollectButtonProps {
  worldId: number
  resourceTypeId: number
  label?: string
  onSuccess?: (points: number, newLevel: number) => void
  onError?: (message: string) => void
  theme?: Partial<AtlasTheme>
  className?: string
}

export function AtlasCollectButton({
  worldId,
  resourceTypeId,
  label = "Recolectar",
  onSuccess,
  onError,
  theme: themeOverride,
  className,
}: AtlasCollectButtonProps) {
  const { collect, collecting, cooldown, error } = useCollect(worldId)
  const theme = mergeTheme(themeOverride)

  React.useEffect(() => {
    if (error && onError) onError(error)
  }, [error, onError])

  const handleClick = async () => {
    const result = await collect(resourceTypeId)
    if (result && onSuccess) onSuccess(result.points, result.newLevel)
  }

  const disabled = collecting || cooldown > 0
  const buttonLabel = collecting
    ? "Recolectando..."
    : cooldown > 0
    ? `Espera ${cooldown}s`
    : label

  return (
    <button
      className={className}
      onClick={handleClick}
      disabled={disabled}
      style={{
        padding: "10px 24px",
        fontSize: 13,
        fontWeight: 600,
        color: disabled ? theme.textMuted : theme.background,
        background: disabled ? theme.border : theme.accent,
        border: "none",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: theme.fontFamily,
        transition: "all 0.15s ease",
      }}
    >
      {buttonLabel}
    </button>
  )
}
