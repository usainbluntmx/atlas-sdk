use anchor_lang::prelude::*;

#[error_code]
pub enum AtlasError {
    #[msg("El nombre no puede superar 64 caracteres")]
    NameTooLong,                    // 6000

    #[msg("El URI no puede superar 200 caracteres")]
    UriTooLong,                     // 6001

    #[msg("No eres el dueño de este personaje")]
    NotOwner,                       // 6002

    #[msg("Debes esperar antes de recolectar de nuevo")]
    CollectCooldown,                // 6003

    #[msg("El mundo está agotado — espera el reset")]
    WorldExhausted,                 // 6004

    #[msg("Solo el authority puede ejecutar esta acción")]
    Unauthorized,                   // 6005

    #[msg("El epoch del leaderboard no coincide con el mundo actual")]
    EpochMismatch,                  // 6006

    #[msg("Tipo de recurso inválido para este mundo")]
    InvalidResourceType,            // 6007

    #[msg("Máximo 8 tipos de recurso por mundo")]
    TooManyResourceTypes,           // 6008

    #[msg("El nombre del mundo no puede superar 64 caracteres")]
    WorldNameTooLong,               // 6009

    #[msg("No tienes acceso a este mundo privado")]
    NotWhitelisted,                 // 6010

    #[msg("La wallet ya está en la whitelist")]
    AlreadyWhitelisted,             // 6011

    #[msg("total_resources debe ser mayor a 0")]
    InvalidTotalResources,          // 6012

    #[msg("epoch_duration debe ser mayor a 0")]
    InvalidEpochDuration,           // 6013
}
