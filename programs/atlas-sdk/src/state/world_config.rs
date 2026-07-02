use anchor_lang::prelude::*;

/// Tipo de mundo — define la narrativa y el SDK que lo consume.
/// El contrato no diferencia comportamiento por tipo —
/// eso lo hace el SDK en el cliente.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum WorldType {
    Gaming,      // v1.0 — GameFi, Web3 Gaming
    Defi,        // v2.0 — Liquidity Mining, Staking
    Dao,         // v2.0 — Governance, Voting
    Marketplace, // v3.0 — NFT, RWA listings
    Custom,      // Para developers con narrativas propias
}

/// Visibilidad del mundo
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum WorldVisibility {
    Public,  // Cualquier wallet puede participar — gratis
    Private, // Solo wallets en la whitelist — fee de creación
}

/// Tipo de recurso definido on-chain por el developer al crear el mundo.
/// Cada mundo puede tener hasta 8 tipos de recurso con sus propias reglas.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct ResourceType {
    /// ID del tipo (0-7) — lo que se pasa en collect_resource
    pub id: u8,
    /// Nombre del recurso (ej: "common", "rare", "vote", "listing")
    #[max_len(32)]
    pub name: String,
    /// Puntos que otorga recolectar este recurso
    pub points: u64,
    /// Cooldown específico para este tipo en segundos
    /// Si es 0, usa el cooldown global del mundo
    pub cooldown_seconds: i64,
}

/// Configuración inmutable del mundo.
/// Se crea una vez con create_world y no cambia entre epochs.
/// PDA: ["world_config", world_id.to_le_bytes()]
#[account]
#[derive(InitSpace)]
pub struct WorldConfig {
    /// ID único del mundo — asignado por el protocolo (auto-incremental)
    pub world_id: u64,
    /// Wallet que creó y administra el mundo
    pub authority: Pubkey,
    /// Nombre del mundo
    #[max_len(64)]
    pub name: String,
    /// Tipo de mundo — Gaming, Defi, Dao, Marketplace, Custom
    pub world_type: WorldType,
    /// Visibilidad — Public o Private
    pub visibility: WorldVisibility,
    /// Recursos totales disponibles por epoch
    pub total_resources: u64,
    /// Duración máxima de cada epoch en segundos
    /// El epoch termina cuando se agotan los recursos O cuando expira este tiempo
    pub epoch_duration: i64,
    /// Cooldown global entre recolectas (segundos)
    /// Puede ser sobreescrito por el cooldown específico de cada ResourceType
    pub global_cooldown: i64,
    /// Tipos de recurso del mundo (máximo 8)
    #[max_len(8)]
    pub resource_types: Vec<ResourceType>,
    /// Epoch actual del mundo
    pub current_epoch: u64,
    /// Máximo de recolectas por wallet por ventana de 24h.
    /// 0 significa sin límite (no recomendado para mundos públicos grandes).
    /// Protección anti-sybil / anti-farming a nivel de mundo.
    pub max_daily_collects: u32,
    pub bump: u8,
}

impl WorldConfig {
    /// Obtiene el ResourceType por ID.
    /// Retorna None si el ID no existe en este mundo.
    pub fn get_resource_type(&self, id: u8) -> Option<&ResourceType> {
        self.resource_types.iter().find(|r| r.id == id)
    }

    /// Obtiene el cooldown efectivo para un tipo de recurso.
    /// Si el tipo tiene cooldown propio (> 0), lo usa.
    /// Si no, usa el cooldown global del mundo.
    pub fn effective_cooldown(&self, resource_type_id: u8) -> i64 {
        if let Some(rt) = self.get_resource_type(resource_type_id) {
            if rt.cooldown_seconds > 0 {
                return rt.cooldown_seconds;
            }
        }
        self.global_cooldown
    }
}
