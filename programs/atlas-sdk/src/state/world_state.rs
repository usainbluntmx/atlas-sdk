use anchor_lang::prelude::*;

/// Estado mutable del mundo — se resetea con cada epoch.
/// La configuración vive en WorldConfig (inmutable).
/// PDA: ["world_state", world_id.to_le_bytes(), epoch.to_le_bytes()]
#[account]
#[derive(InitSpace)]
pub struct WorldState {
    pub world_id: u64,
    pub epoch: u64,
    pub resources_collected: u64,
    pub started_at: i64,
    pub bump: u8,
}
