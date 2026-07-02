use anchor_lang::prelude::*;

/// Jugador en un mundo específico.
/// Una wallet puede tener un Player por mundo.
/// PDA: ["player", world_id.to_le_bytes(), owner]
#[account]
#[derive(InitSpace)]
pub struct Player {
    /// ID del mundo al que pertenece este player
    pub world_id: u64,
    /// Wallet dueña del player
    pub owner: Pubkey,
    /// Nombre del personaje
    #[max_len(32)]
    pub name: String,
    /// URI a metadata en Arweave (subido con Irys antes de llamar mint_player)
    #[max_len(200)]
    pub metadata_uri: String,
    /// Nivel actual — calculado on-chain como 1 + (resources_collected / level_threshold)
    pub level: u64,
    /// Puntos acumulados en el epoch actual
    pub resources_collected: u64,
    /// Unix timestamp de la última recolecta — para verificar cooldown on-chain
    pub last_collect_time: i64,
    /// Epoch en el que se registran los recursos_collected actuales
    /// Al cambiar de epoch, el frontend puede re-fetchear y mostrar el historial
    pub current_epoch: u64,
    /// Recolectas realizadas en el día actual (rate limiting anti-sybil)
    pub daily_collect_count: u32,
    /// Unix timestamp del inicio del día actual de rate limiting.
    /// Se resetea daily_collect_count a 0 cuando pasan 24h desde este valor.
    pub daily_window_started_at: i64,
    pub bump: u8,
}
