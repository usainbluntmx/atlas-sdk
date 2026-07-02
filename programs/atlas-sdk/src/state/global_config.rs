use anchor_lang::prelude::*;

/// Configuración global del protocolo Atlas.
/// PDA: ["atlas_config"]
/// Solo existe una instancia. La inicializa el deployer del protocolo.
#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    /// Wallet que administra el protocolo (puede actualizar fees, etc.)
    pub protocol_authority: Pubkey,
    /// Contador global de mundos — se incrementa con cada create_world
    /// También es el world_id del próximo mundo
    pub world_count: u64,
    /// Fee en lamports para crear un Private World (default: 0.1 SOL)
    pub private_world_fee: u64,
    /// Dirección del treasury donde van las fees
    pub treasury: Pubkey,
    /// Emergency stop — si es true, create_world, mint_player y
    /// collect_resource fallan en TODO el protocolo. No afecta lecturas.
    pub paused: bool,
    pub bump: u8,
}

/// Fee default para crear un Private World: 0.1 SOL
pub const DEFAULT_PRIVATE_WORLD_FEE: u64 = 100_000_000; // 0.1 SOL en lamports
