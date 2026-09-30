/**
 * Contrat de stockage.
 *
 * Toutes les méthodes sont asynchrones bien que l'implémentation
 * localStorage soit synchrone : c'est ce qui permettra de brancher
 * un backend distant (Cloudflare D1, Supabase…) sans toucher à l'interface.
 */

import type { Id, Player, Tournament } from '../domain/types'

export interface TournamentSummary {
  id: Id
  name: string
  date: string
  teamCount: number
  roundCount: number
  updatedAt: string
}

export interface TournamentStore {
  listTournaments(): Promise<TournamentSummary[]>
  getTournament(id: Id): Promise<Tournament | null>
  saveTournament(tournament: Tournament): Promise<void>
  deleteTournament(id: Id): Promise<void>

  listPlayers(): Promise<Player[]>
  savePlayer(player: Player): Promise<void>
  deletePlayer(id: Id): Promise<void>
}

/** Sauvegarde complète, pour l'export et l'import JSON. */
export interface Backup {
  version: 1
  exportedAt: string
  players: Player[]
  tournaments: Tournament[]
}
