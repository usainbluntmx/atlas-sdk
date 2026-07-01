/**
 * @atlas-world/sdk — AtlasClient
 *
 * Clase principal del SDK. Punto de entrada para todos los developers.
 *
 * @example
 * const atlas = new AtlasClient({ network: 'devnet', wallet })
 * const world = await atlas.world.create({ ... })
 * const player = await atlas.player.mint({ worldId: 0, name: 'Hero' })
 * await atlas.resource.collect({ worldId: 0, resourceTypeId: 0 })
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider, setProvider } from '@coral-xyz/anchor'
import {
  AtlasNetwork,
  ATLAS_PROGRAM_ID_DEVNET,
  RPC_ENDPOINTS,
} from '@atlas-world/core'
import { WorldClient } from './WorldClient'
import { PlayerClient } from './PlayerClient'
import { ResourceClient } from './ResourceClient'
import { LeaderboardClient } from './LeaderboardClient'

export interface AtlasClientConfig {
  /** Red de Solana */
  network: AtlasNetwork
  /** Wallet adapter del usuario */
  wallet: any
  /** Program ID custom (útil para testing con deploy local) */
  programId?: string
}

export class AtlasClient {
  readonly connection: Connection
  readonly program: Program
  readonly programId: PublicKey
  readonly network: AtlasNetwork

  /** Cliente para operaciones de mundo */
  readonly world: WorldClient
  /** Cliente para operaciones de player */
  readonly player: PlayerClient
  /** Cliente para recolectar recursos */
  readonly resource: ResourceClient
  /** Cliente para leer el leaderboard */
  readonly leaderboard: LeaderboardClient

  constructor(config: AtlasClientConfig) {
    this.network = config.network
    this.programId = new PublicKey(
      config.programId ?? ATLAS_PROGRAM_ID_DEVNET
    )

    this.connection = new Connection(
      RPC_ENDPOINTS[config.network],
      'confirmed'
    )

    const provider = new AnchorProvider(
      this.connection,
      config.wallet,
      { commitment: 'confirmed' }
    )
    setProvider(provider)

    // IDL importado del contrato generado por anchor build.
    // Después de cada `anchor build`, copia el IDL con:
    //   cp target/idl/atlas.json sdk/src/idl.json
    const IDL = require('./idl.json')
    this.program = new Program(IDL, provider)

    // Inicializar sub-clientes
    this.world = new WorldClient(this)
    this.player = new PlayerClient(this)
    this.resource = new ResourceClient(this)
    this.leaderboard = new LeaderboardClient(this)
  }
}
