/**
 * Stockage local (localStorage).
 *
 * Suffisant pour un arbitre unique : les données restent sur la machine
 * qui saisit. L'export JSON sert de sauvegarde et de transfert.
 */

import type { Id, Player, Tournament } from '../domain/types'
import type { Backup, TournamentStore, TournamentSummary } from './types'

const TOURNAMENTS_KEY = 'belote:tournaments'
const PLAYERS_KEY = 'belote:players'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    // Mode privé, quota dépassé, données corrompues : on repart à vide
    // plutôt que de casser l'application en pleine soirée.
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    throw new Error(
      `Impossible d'enregistrer les données localement (${key}). ` +
        `Vérifiez que le navigateur n'est pas en navigation privée. Cause : ${String(error)}`,
    )
  }
}

export class LocalTournamentStore implements TournamentStore {
  async listTournaments(): Promise<TournamentSummary[]> {
    const all = read<Tournament[]>(TOURNAMENTS_KEY, [])
    return all
      .map((t) => ({
        id: t.id,
        name: t.name,
        date: t.date,
        teamCount: t.teams.length,
        roundCount: t.rounds.length,
        updatedAt: t.updatedAt,
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
  }

  async getTournament(id: Id): Promise<Tournament | null> {
    return read<Tournament[]>(TOURNAMENTS_KEY, []).find((t) => t.id === id) ?? null
  }

  async saveTournament(tournament: Tournament): Promise<void> {
    const all = read<Tournament[]>(TOURNAMENTS_KEY, [])
    const next = { ...tournament, updatedAt: new Date().toISOString() }
    const index = all.findIndex((t) => t.id === tournament.id)
    if (index >= 0) all[index] = next
    else all.push(next)
    write(TOURNAMENTS_KEY, all)
  }

  async deleteTournament(id: Id): Promise<void> {
    write(
      TOURNAMENTS_KEY,
      read<Tournament[]>(TOURNAMENTS_KEY, []).filter((t) => t.id !== id),
    )
  }

  async listPlayers(): Promise<Player[]> {
    return read<Player[]>(PLAYERS_KEY, []).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }

  async savePlayer(player: Player): Promise<void> {
    const all = read<Player[]>(PLAYERS_KEY, [])
    const index = all.findIndex((p) => p.id === player.id)
    if (index >= 0) all[index] = player
    else all.push(player)
    write(PLAYERS_KEY, all)
  }

  async deletePlayer(id: Id): Promise<void> {
    write(
      PLAYERS_KEY,
      read<Player[]>(PLAYERS_KEY, []).filter((p) => p.id !== id),
    )
  }

  /** Sauvegarde complète, à télécharger. */
  async exportAll(): Promise<Backup> {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      players: read<Player[]>(PLAYERS_KEY, []),
      tournaments: read<Tournament[]>(TOURNAMENTS_KEY, []),
    }
  }

  /**
   * Restaure une sauvegarde. En mode `merge`, les tournois et joueurs
   * du fichier écrasent ceux de même id sans toucher aux autres.
   */
  async importAll(backup: Backup, mode: 'merge' | 'replace' = 'merge'): Promise<void> {
    if (backup?.version !== 1) {
      throw new Error(`Format de sauvegarde non reconnu (version ${String(backup?.version)})`)
    }

    if (mode === 'replace') {
      write(TOURNAMENTS_KEY, backup.tournaments)
      write(PLAYERS_KEY, backup.players)
      return
    }

    const byId = <T extends { id: Id }>(existing: T[], incoming: T[]): T[] => {
      const map = new Map(existing.map((item) => [item.id, item]))
      for (const item of incoming) map.set(item.id, item)
      return [...map.values()]
    }

    write(TOURNAMENTS_KEY, byId(read<Tournament[]>(TOURNAMENTS_KEY, []), backup.tournaments))
    write(PLAYERS_KEY, byId(read<Player[]>(PLAYERS_KEY, []), backup.players))
  }
}

export const store = new LocalTournamentStore()
