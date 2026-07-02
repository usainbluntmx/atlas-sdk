use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("6byM2kmNLLGcrjRcq7ETVvGpxKgoEQuAof44SXe1vEee");

pub mod errors;
pub mod events;
pub mod state;

use errors::AtlasError;
use state::{
    GlobalConfig, DEFAULT_PRIVATE_WORLD_FEE,
    WorldConfig, WorldType, WorldVisibility, ResourceType,
    WorldState, Player, Leaderboard, LeaderboardEntry, Whitelist,
};

const LEVEL_THRESHOLD: u64 = 10;
const DAILY_WINDOW_SECONDS: i64 = 24 * 60 * 60;

#[program]
pub mod atlas {
    use super::*;

    // ─── Protocolo ──────────────────────────────────────────────────────────

    pub fn initialize_protocol(
        ctx: Context<InitializeProtocol>,
        treasury: Pubkey,
    ) -> Result<()> {
        let config = &mut ctx.accounts.global_config;
        config.protocol_authority = ctx.accounts.authority.key();
        config.world_count = 0;
        config.private_world_fee = DEFAULT_PRIVATE_WORLD_FEE;
        config.treasury = treasury;
        config.paused = false;
        config.bump = ctx.bumps.global_config;
        Ok(())
    }

    /// Emergency stop — pausa create_world, mint_player y collect_resource
    /// en TODO el protocolo. Las lecturas siguen funcionando normalmente.
    /// Solo puede llamarla el protocol_authority.
    pub fn pause_protocol(ctx: Context<ProtocolAdmin>) -> Result<()> {
        ctx.accounts.global_config.paused = true;
        emit!(crate::events::ProtocolPaused {
            by: ctx.accounts.authority.key(),
        });
        Ok(())
    }

    /// Reactiva el protocolo después de una pausa de emergencia.
    /// Solo puede llamarla el protocol_authority.
    pub fn unpause_protocol(ctx: Context<ProtocolAdmin>) -> Result<()> {
        ctx.accounts.global_config.paused = false;
        emit!(crate::events::ProtocolUnpaused {
            by: ctx.accounts.authority.key(),
        });
        Ok(())
    }

    /// ⚠️ SOLO PARA DESARROLLO — cierra GlobalConfig y devuelve el rent.
    ///
    /// Uso: cuando el layout de GlobalConfig cambia (se agregan/quitan campos)
    /// durante desarrollo activo en devnet, las cuentas existentes quedan
    /// con un layout incompatible. Esta instrucción permite cerrarla y
    /// volver a llamar initialize_protocol con el layout nuevo.
    ///
    /// Cierra la cuenta MANUALMENTE sin deserializarla (por eso el contexto
    /// usa UncheckedAccount) — así funciona incluso si el layout on-chain
    /// ya no coincide con el struct GlobalConfig actual.
    ///
    /// NO debe existir en el contrato final de mainnet — antes del deploy
    /// a mainnet, reemplazar por una estrategia de migración de cuentas
    /// apropiada (versionado de accounts, o congelar el layout antes
    /// del primer deploy productivo).
    pub fn close_protocol(ctx: Context<CloseProtocol>) -> Result<()> {
        let global_config_info = ctx.accounts.global_config.to_account_info();
        let authority_info = ctx.accounts.authority.to_account_info();

        let dest_starting_lamports = authority_info.lamports();
        **authority_info.lamports.borrow_mut() = dest_starting_lamports
            .checked_add(global_config_info.lamports())
            .ok_or(AtlasError::InvalidTotalResources)?; // reuse error, monto overflow improbable
        **global_config_info.lamports.borrow_mut() = 0;

        let mut data = global_config_info.try_borrow_mut_data()?;
        for byte in data.iter_mut() {
            *byte = 0;
        }

        Ok(())
    }

    /// ⚠️ SOLO PARA DESARROLLO — ajusta world_count manualmente.
    ///
    /// Uso: después de close_protocol + initialize_protocol, world_count
    /// vuelve a 0, pero las cuentas WorldConfig de mundos creados antes
    /// de la migración siguen existiendo en sus PDAs originales. Esta
    /// instrucción evita colisiones al crear mundos nuevos, saltando
    /// el contador por encima del último world_id usado.
    ///
    /// NO debe existir en el contrato final de mainnet.
    pub fn admin_set_world_count(
        ctx: Context<ProtocolAdmin>,
        new_count: u64,
    ) -> Result<()> {
        ctx.accounts.global_config.world_count = new_count;
        Ok(())
    }

    // ─── Worlds ─────────────────────────────────────────────────────────────

    pub fn create_world(
        ctx: Context<CreateWorld>,
        name: String,
        world_type: WorldType,
        visibility: WorldVisibility,
        total_resources: u64,
        epoch_duration: i64,
        global_cooldown: i64,
        max_daily_collects: u32,
        resource_types: Vec<ResourceType>,
    ) -> Result<()> {
        require!(!ctx.accounts.global_config.paused, AtlasError::ProtocolPaused);
        require!(name.len() <= 64, AtlasError::WorldNameTooLong);
        require!(total_resources > 0, AtlasError::InvalidTotalResources);
        require!(epoch_duration > 0, AtlasError::InvalidEpochDuration);
        require!(resource_types.len() <= 8, AtlasError::TooManyResourceTypes);

        if visibility == WorldVisibility::Private {
            let fee = ctx.accounts.global_config.private_world_fee;
            if fee > 0 {
                let cpi_ctx = CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.authority.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                );
                system_program::transfer(cpi_ctx, fee)?;
            }
        }

        let world_id = ctx.accounts.global_config.world_count;
        ctx.accounts.global_config.world_count += 1;

        let world_type_u8 = match world_type {
            WorldType::Gaming => 0u8,
            WorldType::Defi => 1u8,
            WorldType::Dao => 2u8,
            WorldType::Marketplace => 3u8,
            WorldType::Custom => 4u8,
        };
        let visibility_u8 = match visibility {
            WorldVisibility::Public => 0u8,
            WorldVisibility::Private => 1u8,
        };

        let config = &mut ctx.accounts.world_config;
        config.world_id = world_id;
        config.authority = ctx.accounts.authority.key();
        config.name = name.clone();
        config.world_type = world_type;
        config.visibility = visibility;
        config.total_resources = total_resources;
        config.epoch_duration = epoch_duration;
        config.global_cooldown = global_cooldown;
        config.resource_types = resource_types;
        config.current_epoch = 0;
        config.max_daily_collects = max_daily_collects;
        config.bump = ctx.bumps.world_config;

        let clock = Clock::get()?;
        let state = &mut ctx.accounts.world_state;
        state.world_id = world_id;
        state.epoch = 0;
        state.resources_collected = 0;
        state.started_at = clock.unix_timestamp;
        state.bump = ctx.bumps.world_state;

        emit!(crate::events::WorldCreated {
            world_id,
            authority: ctx.accounts.authority.key(),
            name,
            world_type: world_type_u8,
            visibility: visibility_u8,
            total_resources,
            epoch_duration,
        });

        Ok(())
    }

    pub fn create_leaderboard(ctx: Context<CreateLeaderboard>) -> Result<()> {
        let world_config = &ctx.accounts.world_config;
        let leaderboard = &mut ctx.accounts.leaderboard;

        leaderboard.world_id = world_config.world_id;
        leaderboard.epoch = world_config.current_epoch;
        leaderboard.entries = Vec::new();
        leaderboard.bump = ctx.bumps.leaderboard;

        emit!(crate::events::LeaderboardInitialized {
            world_id: world_config.world_id,
            epoch: world_config.current_epoch,
        });

        Ok(())
    }

    /// Crea el WorldState para el epoch actual después de un WorldReset.
    /// Debe llamarse junto con create_leaderboard cuando el authority
    /// recibe el evento WorldReset. Sin esto, la siguiente recolecta
    /// del nuevo epoch fallaría porque el WorldState no existiría.
    pub fn advance_epoch(ctx: Context<AdvanceEpoch>) -> Result<()> {
        let world_config = &ctx.accounts.world_config;
        let world_state = &mut ctx.accounts.world_state;
        let clock = Clock::get()?;

        world_state.world_id = world_config.world_id;
        world_state.epoch = world_config.current_epoch;
        world_state.resources_collected = 0;
        world_state.started_at = clock.unix_timestamp;
        world_state.bump = ctx.bumps.world_state;

        Ok(())
    }

    // ─── Players ─────────────────────────────────────────────────────────────

    /// Mintea un Player en un mundo público.
    pub fn mint_player(
        ctx: Context<MintPlayer>,
        name: String,
        metadata_uri: String,
    ) -> Result<()> {
        require!(!ctx.accounts.global_config.paused, AtlasError::ProtocolPaused);
        require!(name.len() <= 32, AtlasError::NameTooLong);
        require!(metadata_uri.len() <= 200, AtlasError::UriTooLong);

        let world_config = &ctx.accounts.world_config;
        let player = &mut ctx.accounts.player;

        player.world_id = world_config.world_id;
        player.owner = ctx.accounts.owner.key();
        player.name = name.clone();
        player.metadata_uri = metadata_uri.clone();
        player.level = 1;
        player.resources_collected = 0;
        player.last_collect_time = 0;
        player.current_epoch = world_config.current_epoch;
        player.daily_collect_count = 0;
        player.daily_window_started_at = 0;
        player.bump = ctx.bumps.player;

        emit!(crate::events::PlayerMinted {
            world_id: world_config.world_id,
            owner: player.owner,
            name,
            metadata_uri,
        });

        Ok(())
    }

    /// Mintea un Player en un mundo privado — verifica whitelist.
    pub fn mint_player_private(
        ctx: Context<MintPlayerPrivate>,
        name: String,
        metadata_uri: String,
    ) -> Result<()> {
        require!(!ctx.accounts.global_config.paused, AtlasError::ProtocolPaused);
        require!(name.len() <= 32, AtlasError::NameTooLong);
        require!(metadata_uri.len() <= 200, AtlasError::UriTooLong);

        require!(
            ctx.accounts.whitelist.contains(&ctx.accounts.owner.key()),
            AtlasError::NotWhitelisted
        );

        let world_config = &ctx.accounts.world_config;
        let player = &mut ctx.accounts.player;

        player.world_id = world_config.world_id;
        player.owner = ctx.accounts.owner.key();
        player.name = name.clone();
        player.metadata_uri = metadata_uri.clone();
        player.level = 1;
        player.resources_collected = 0;
        player.last_collect_time = 0;
        player.current_epoch = world_config.current_epoch;
        player.daily_collect_count = 0;
        player.daily_window_started_at = 0;
        player.bump = ctx.bumps.player;

        emit!(crate::events::PlayerMinted {
            world_id: world_config.world_id,
            owner: player.owner,
            name,
            metadata_uri,
        });

        Ok(())
    }

    // ─── Resources ───────────────────────────────────────────────────────────

    pub fn collect_resource(
        ctx: Context<CollectResource>,
        resource_type_id: u8,
    ) -> Result<()> {
        require!(!ctx.accounts.global_config.paused, AtlasError::ProtocolPaused);

        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        let world_config = &ctx.accounts.world_config;

        let resource_type = world_config
            .get_resource_type(resource_type_id)
            .ok_or(AtlasError::InvalidResourceType)?;

        let points = resource_type.points;
        let cooldown = world_config.effective_cooldown(resource_type_id);
        let max_daily = world_config.max_daily_collects;

        require!(
            now >= ctx.accounts.player.last_collect_time + cooldown,
            AtlasError::CollectCooldown
        );

        require!(
            ctx.accounts.world_state.resources_collected < world_config.total_resources,
            AtlasError::WorldExhausted
        );

        require!(
            ctx.accounts.leaderboard.epoch == world_config.current_epoch,
            AtlasError::EpochMismatch
        );

        // ─── Rate limiting diario (anti-sybil / anti-farming) ──────────────
        // Si max_daily_collects es 0, no hay límite.
        if max_daily > 0 {
            let player = &mut ctx.accounts.player;
            let window_expired = now >= player.daily_window_started_at + DAILY_WINDOW_SECONDS;

            if window_expired {
                // Nueva ventana de 24h — resetear contador
                player.daily_window_started_at = now;
                player.daily_collect_count = 0;
            }

            require!(
                player.daily_collect_count < max_daily,
                AtlasError::DailyLimitReached
            );

            player.daily_collect_count += 1;
        }

        ctx.accounts.world_state.resources_collected += 1;
        let world_progress = ctx.accounts.world_state.resources_collected;
        let total_resources = world_config.total_resources;
        let epoch = world_config.current_epoch;

        let world_exhausted = world_progress >= total_resources;
        let time_expired = now >= ctx.accounts.world_state.started_at + world_config.epoch_duration;
        let epoch_ended = world_exhausted || time_expired;

        ctx.accounts.player.resources_collected += points;
        ctx.accounts.player.level =
            1 + (ctx.accounts.player.resources_collected / LEVEL_THRESHOLD);
        ctx.accounts.player.last_collect_time = now;
        ctx.accounts.player.current_epoch = epoch;

        let collected = ctx.accounts.player.resources_collected;
        let level = ctx.accounts.player.level;
        let owner = ctx.accounts.player.owner;
        let name = ctx.accounts.player.name.clone();
        let world_id = world_config.world_id;

        let leaderboard = &mut ctx.accounts.leaderboard;

        if let Some(entry) = leaderboard.entries.iter_mut().find(|e| e.owner == owner) {
            entry.resources_collected = collected;
            entry.level = level;
        } else {
            let new_entry = LeaderboardEntry {
                owner,
                name,
                resources_collected: collected,
                level,
            };

            if leaderboard.entries.len() < 25 {
                let pos = leaderboard
                    .entries
                    .iter()
                    .position(|e| e.resources_collected < collected)
                    .unwrap_or(leaderboard.entries.len());
                leaderboard.entries.insert(pos, new_entry);
            } else {
                let last_score = leaderboard.entries.last().unwrap().resources_collected;
                if collected > last_score {
                    *leaderboard.entries.last_mut().unwrap() = new_entry;
                    let len = leaderboard.entries.len();
                    for i in (1..len).rev() {
                        if leaderboard.entries[i].resources_collected
                            > leaderboard.entries[i - 1].resources_collected
                        {
                            leaderboard.entries.swap(i, i - 1);
                        } else {
                            break;
                        }
                    }
                }
            }
        }

        emit!(crate::events::ResourceCollected {
            world_id,
            epoch,
            wallet: owner,
            resource_type: resource_type_id,
            points,
            world_progress,
            total_resources,
        });

        if epoch_ended {
            let new_epoch = epoch + 1;
            ctx.accounts.world_config.current_epoch = new_epoch;

            emit!(crate::events::WorldReset {
                world_id,
                completed_epoch: epoch,
                new_epoch,
                winner: owner,
                total_collected: world_progress,
            });
        }

        Ok(())
    }

    // ─── Whitelist ───────────────────────────────────────────────────────────

    pub fn initialize_whitelist(ctx: Context<InitializeWhitelist>) -> Result<()> {
        let whitelist = &mut ctx.accounts.whitelist;
        whitelist.world_id = ctx.accounts.world_config.world_id;
        whitelist.members = Vec::new();
        whitelist.bump = ctx.bumps.whitelist;
        Ok(())
    }

    pub fn add_to_whitelist(
        ctx: Context<ModifyWhitelist>,
        member: Pubkey,
    ) -> Result<()> {
        require!(
            !ctx.accounts.whitelist.contains(&member),
            AtlasError::AlreadyWhitelisted
        );
        ctx.accounts.whitelist.members.push(member);
        emit!(crate::events::PlayerWhitelisted {
            world_id: ctx.accounts.world_config.world_id,
            member,
        });
        Ok(())
    }

    pub fn remove_from_whitelist(
        ctx: Context<ModifyWhitelist>,
        member: Pubkey,
    ) -> Result<()> {
        ctx.accounts.whitelist.members.retain(|m| m != &member);
        emit!(crate::events::PlayerRemovedFromWhitelist {
            world_id: ctx.accounts.world_config.world_id,
            member,
        });
        Ok(())
    }
}

// ─── Contexts ────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializeProtocol<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [b"atlas_config"],
        bump
    )]
    pub global_config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProtocolAdmin<'info> {
    #[account(
        mut,
        seeds = [b"atlas_config"],
        bump = global_config.bump,
        constraint = global_config.protocol_authority == authority.key() @ AtlasError::Unauthorized
    )]
    pub global_config: Account<'info, GlobalConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CloseProtocol<'info> {
    /// CHECK: cerrado manualmente sin deserializar en el handler —
    /// esto permite cerrar la cuenta aunque su layout ya no coincida
    /// con el struct GlobalConfig actual. Solo verificamos que la
    /// dirección derive correctamente desde las seeds del protocolo,
    /// lo cual ya garantiza que es la cuenta correcta (no se puede
    /// verificar protocol_authority sin deserializar, por eso esta
    /// instrucción es solo para desarrollo — ver doc del handler).
    #[account(
        mut,
        seeds = [b"atlas_config"],
        bump
    )]
    pub global_config: UncheckedAccount<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateWorld<'info> {
    #[account(
        mut,
        seeds = [b"atlas_config"],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + WorldConfig::INIT_SPACE,
        seeds = [b"world_config", global_config.world_count.to_le_bytes().as_ref()],
        bump
    )]
    pub world_config: Account<'info, WorldConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + WorldState::INIT_SPACE,
        seeds = [
            b"world_state",
            global_config.world_count.to_le_bytes().as_ref(),
            0u64.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub world_state: Account<'info, WorldState>,

    /// CHECK: Verificado contra global_config.treasury
    #[account(
        mut,
        constraint = treasury.key() == global_config.treasury
    )]
    pub treasury: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateLeaderboard<'info> {
    #[account(
        mut,
        seeds = [b"world_config", world_config.world_id.to_le_bytes().as_ref()],
        bump = world_config.bump,
        constraint = world_config.authority == authority.key() @ AtlasError::Unauthorized
    )]
    pub world_config: Account<'info, WorldConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + Leaderboard::INIT_SPACE,
        seeds = [
            b"leaderboard",
            world_config.world_id.to_le_bytes().as_ref(),
            world_config.current_epoch.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub leaderboard: Account<'info, Leaderboard>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdvanceEpoch<'info> {
    #[account(
        seeds = [b"world_config", world_config.world_id.to_le_bytes().as_ref()],
        bump = world_config.bump,
        constraint = world_config.authority == authority.key() @ AtlasError::Unauthorized
    )]
    pub world_config: Account<'info, WorldConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + WorldState::INIT_SPACE,
        seeds = [
            b"world_state",
            world_config.world_id.to_le_bytes().as_ref(),
            world_config.current_epoch.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub world_state: Account<'info, WorldState>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintPlayer<'info> {
    #[account(
        seeds = [b"atlas_config"],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        seeds = [b"world_config", world_config.world_id.to_le_bytes().as_ref()],
        bump = world_config.bump
    )]
    pub world_config: Account<'info, WorldConfig>,

    #[account(
        init,
        payer = owner,
        space = 8 + Player::INIT_SPACE,
        seeds = [
            b"player",
            world_config.world_id.to_le_bytes().as_ref(),
            owner.key().as_ref()
        ],
        bump
    )]
    pub player: Account<'info, Player>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintPlayerPrivate<'info> {
    #[account(
        seeds = [b"atlas_config"],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        seeds = [b"world_config", world_config.world_id.to_le_bytes().as_ref()],
        bump = world_config.bump
    )]
    pub world_config: Account<'info, WorldConfig>,

    #[account(
        init,
        payer = owner,
        space = 8 + Player::INIT_SPACE,
        seeds = [
            b"player",
            world_config.world_id.to_le_bytes().as_ref(),
            owner.key().as_ref()
        ],
        bump
    )]
    pub player: Account<'info, Player>,

    #[account(
        seeds = [b"whitelist", world_config.world_id.to_le_bytes().as_ref()],
        bump = whitelist.bump
    )]
    pub whitelist: Account<'info, Whitelist>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CollectResource<'info> {
    #[account(
        seeds = [b"atlas_config"],
        bump = global_config.bump
    )]
    pub global_config: Account<'info, GlobalConfig>,

    #[account(
        mut,
        seeds = [b"world_config", world_config.world_id.to_le_bytes().as_ref()],
        bump = world_config.bump
    )]
    pub world_config: Account<'info, WorldConfig>,

    #[account(
        mut,
        seeds = [
            b"world_state",
            world_config.world_id.to_le_bytes().as_ref(),
            world_config.current_epoch.to_le_bytes().as_ref()
        ],
        bump = world_state.bump
    )]
    pub world_state: Account<'info, WorldState>,

    #[account(
        mut,
        seeds = [
            b"player",
            world_config.world_id.to_le_bytes().as_ref(),
            owner.key().as_ref()
        ],
        bump = player.bump,
        constraint = player.owner == owner.key() @ AtlasError::NotOwner
    )]
    pub player: Account<'info, Player>,

    #[account(
        mut,
        seeds = [
            b"leaderboard",
            world_config.world_id.to_le_bytes().as_ref(),
            world_config.current_epoch.to_le_bytes().as_ref()
        ],
        bump = leaderboard.bump
    )]
    pub leaderboard: Account<'info, Leaderboard>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeWhitelist<'info> {
    #[account(
        seeds = [b"world_config", world_config.world_id.to_le_bytes().as_ref()],
        bump = world_config.bump,
        constraint = world_config.authority == authority.key() @ AtlasError::Unauthorized,
        constraint = world_config.visibility == WorldVisibility::Private @ AtlasError::Unauthorized
    )]
    pub world_config: Account<'info, WorldConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + Whitelist::INIT_SPACE,
        seeds = [b"whitelist", world_config.world_id.to_le_bytes().as_ref()],
        bump
    )]
    pub whitelist: Account<'info, Whitelist>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ModifyWhitelist<'info> {
    #[account(
        seeds = [b"world_config", world_config.world_id.to_le_bytes().as_ref()],
        bump = world_config.bump,
        constraint = world_config.authority == authority.key() @ AtlasError::Unauthorized
    )]
    pub world_config: Account<'info, WorldConfig>,

    #[account(
        mut,
        seeds = [b"whitelist", world_config.world_id.to_le_bytes().as_ref()],
        bump = whitelist.bump
    )]
    pub whitelist: Account<'info, Whitelist>,

    pub authority: Signer<'info>,
}
