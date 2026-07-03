/**
 * @atlas-world/react — Design tokens compartidos
 *
 * Estilos inline (sin dependencia de CSS externo) para que los componentes
 * funcionen en cualquier proyecto sin configuración adicional.
 * Todo es personalizable vía props `theme` en cada componente.
 */

export interface AtlasTheme {
  accent: string
  background: string
  surface: string
  border: string
  text: string
  textMuted: string
  gold: string
  danger: string
  fontFamily: string
  borderRadius: string
}

export const defaultTheme: AtlasTheme = {
  accent: "#00C2A8",
  background: "#0A0E14",
  surface: "#111722",
  border: "#1F2937",
  text: "#E8E8E0",
  textMuted: "#9CA3AF",
  gold: "#F59E0B",
  danger: "#EF4444",
  fontFamily:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  borderRadius: "10px",
}

export function mergeTheme(overrides?: Partial<AtlasTheme>): AtlasTheme {
  return { ...defaultTheme, ...overrides }
}
