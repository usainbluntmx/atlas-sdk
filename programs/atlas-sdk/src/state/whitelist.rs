use anchor_lang::prelude::*;

/// Whitelist de un mundo privado.
/// Solo wallets en esta lista pueden mintear un Player en el mundo.
/// PDA: ["whitelist", world_id.to_le_bytes()]
#[account]
#[derive(InitSpace)]
pub struct Whitelist {
    pub world_id: u64,
    /// Wallets autorizadas — máximo 100 por account
    /// Para mundos grandes se pueden crear múltiples Whitelist accounts (paginadas)
    #[max_len(100)]
    pub members: Vec<Pubkey>,
    pub bump: u8,
}

impl Whitelist {
    pub fn contains(&self, wallet: &Pubkey) -> bool {
        self.members.contains(wallet)
    }
}
