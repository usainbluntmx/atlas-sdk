use anchor_lang::prelude::*;

/// Entrada del leaderboard
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct LeaderboardEntry {
    pub owner: Pubkey,
    #[max_len(32)]
    pub name: String,
    pub resources_collected: u64,
    pub level: u64,
}

/// Leaderboard de un mundo para un epoch específico.
/// El historial persiste — cada epoch tiene su propio leaderboard.
/// PDA: ["leaderboard", world_id.to_le_bytes(), epoch.to_le_bytes()]
#[account]
#[derive(InitSpace)]
pub struct Leaderboard {
    pub world_id: u64,
    pub epoch: u64,
    /// Top 25 players del epoch — ordenado por recursos recolectados (desc)
    #[max_len(25)]
    pub entries: Vec<LeaderboardEntry>,
    pub bump: u8,
}
