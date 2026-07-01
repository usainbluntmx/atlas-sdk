use anchor_lang::prelude::*;

/// Emitido cuando se crea un nuevo mundo
#[event]
pub struct WorldCreated {
    pub world_id: u64,
    pub authority: Pubkey,
    pub name: String,
    pub world_type: u8,
    pub visibility: u8,
    pub total_resources: u64,
    pub epoch_duration: i64,
}

/// Emitido cuando se inicializa el leaderboard de un epoch
#[event]
pub struct LeaderboardInitialized {
    pub world_id: u64,
    pub epoch: u64,
}

/// Emitido cuando un jugador mintea su personaje
#[event]
pub struct PlayerMinted {
    pub world_id: u64,
    pub owner: Pubkey,
    pub name: String,
    pub metadata_uri: String,
}

/// Emitido en cada recolecta exitosa
/// El frontend lo usa para actualizar el HUD en tiempo real sin polling
#[event]
pub struct ResourceCollected {
    pub world_id: u64,
    pub epoch: u64,
    pub wallet: Pubkey,
    pub resource_type: u8,
    pub points: u64,
    pub world_progress: u64,
    pub total_resources: u64,
}

/// Emitido cuando el mundo se agota o expira
/// El authority debe escuchar este evento y crear el leaderboard del nuevo epoch
#[event]
pub struct WorldReset {
    pub world_id: u64,
    pub completed_epoch: u64,
    pub new_epoch: u64,
    pub winner: Pubkey,
    pub total_collected: u64,
}

/// Emitido cuando se agrega una wallet a la whitelist (Private Worlds)
#[event]
pub struct PlayerWhitelisted {
    pub world_id: u64,
    pub member: Pubkey,
}

/// Emitido cuando se remueve una wallet de la whitelist (Private Worlds)
#[event]
pub struct PlayerRemovedFromWhitelist {
    pub world_id: u64,
    pub member: Pubkey,
}
