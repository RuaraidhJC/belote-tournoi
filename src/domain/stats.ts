/**
 * Statistiques par joueur, agrégées sur plusieurs tournois.
 *
 * Les données sont recalculées à la volée depuis les tournois stockés :
 * rien n'est dénormalisé, donc rien ne peut se désynchroniser.
 */

import { resolveMatch } from './scoring'
import { computeStandings } from './standings'
import type { Id, Tournament } from './types'

export interface PlayerStats {
  playerId: Id
  playerName: string
  tournaments: number
  matchesPlayed: number
  wins: number
  losses: number
  draws: number
  byes: number
  pointsFor: number
  pointsAgainst: number
  goalAverage: number
  /** Meilleur classement obtenu en phase qualificative. */
  bestRank: number | null
  /** Nombre de tournois remportés (finale gagnée, ou 1er sans phase finale). */
  titles: number
  winRate: number
  /** Points marqués par partie jouée. */
  averagePointsFor: number
}

export interface DonneStats {
  total: number
  /** Contrats tenus par le preneur. */
  realized: number
  chutes: number
  capots: number
  contres: number
  surcontres: number
  belotes: number
  averageContract: number
  successRate: number
}

function emptyStats(playerId: Id, playerName: string): PlayerStats {
  return {
    playerId,
    playerName,
    tournaments: 0,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    byes: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    goalAverage: 0,
    bestRank: null,
    titles: 0,
    winRate: 0,
    averagePointsFor: 0,
  }
}

/**
 * Agrège les statistiques de tous les joueurs sur les tournois fournis.
 * Seules les rondes suisses comptent pour les points et le goal average ;
 * les phases finales alimentent uniquement le compteur de titres.
 */
export function computePlayerStats(tournaments: Tournament[]): PlayerStats[] {
  const stats = new Map<Id, PlayerStats>()

  const ensure = (playerId: Id, playerName: string): PlayerStats => {
    const existing = stats.get(playerId)
    if (existing) return existing
    const fresh = emptyStats(playerId, playerName)
    stats.set(playerId, fresh)
    return fresh
  }

  for (const tournament of tournaments) {
    const membersByTeam = new Map(tournament.teams.map((t) => [t.id, t.players]))
    const standings = computeStandings(tournament)

    // Un joueur n'est compté qu'une fois par tournoi.
    const seenThisTournament = new Set<Id>()

    for (const row of standings) {
      const members = membersByTeam.get(row.teamId) ?? []
      for (const member of members) {
        const s = ensure(member.id, member.name)
        s.playerName = member.name

        if (!seenThisTournament.has(member.id)) {
          seenThisTournament.add(member.id)
          s.tournaments += 1
        }

        s.matchesPlayed += row.played
        s.wins += Math.floor(row.wins)
        s.losses += row.losses
        s.draws += row.draws
        s.byes += row.byes
        s.pointsFor += row.pointsFor
        s.pointsAgainst += row.pointsAgainst
        s.goalAverage += row.goalAverage
        s.bestRank = s.bestRank === null ? row.rank : Math.min(s.bestRank, row.rank)
      }
    }

    // Titres : vainqueur de la finale, ou 1er du classement sans phase finale.
    const finalRound = tournament.rounds.find((r) => r.kind === 'final')
    const finalMatch = finalRound?.matches[0]
    let championTeamId: Id | null = null

    if (finalMatch && finalMatch.status === 'done') {
      championTeamId = resolveMatch(finalMatch, tournament.config.forfaitGoalAverage).winnerId
    } else if (
      tournament.config.playoff === 'none' &&
      tournament.rounds.filter((r) => r.kind === 'swiss').length >= tournament.config.swissRounds &&
      tournament.rounds.every((r) => r.matches.every((m) => m.status === 'done'))
    ) {
      championTeamId = standings[0]?.teamId ?? null
    }

    if (championTeamId) {
      for (const member of membersByTeam.get(championTeamId) ?? []) {
        ensure(member.id, member.name).titles += 1
      }
    }
  }

  for (const s of stats.values()) {
    const decided = s.wins + s.losses + s.draws
    s.winRate = decided > 0 ? s.wins / decided : 0
    s.averagePointsFor = s.matchesPlayed > 0 ? Math.round(s.pointsFor / s.matchesPlayed) : 0
  }

  return [...stats.values()].sort(
    (a, b) =>
      b.titles - a.titles ||
      b.winRate - a.winRate ||
      b.goalAverage - a.goalAverage ||
      a.playerName.localeCompare(b.playerName, 'fr'),
  )
}

/** Statistiques sur les donnes saisies via le calculateur. */
export function computeDonneStats(tournaments: Tournament[]): DonneStats {
  const donnes = tournaments.flatMap((t) => t.rounds.flatMap((r) => r.matches.flatMap((m) => m.donnes)))

  if (donnes.length === 0) {
    return {
      total: 0,
      realized: 0,
      chutes: 0,
      capots: 0,
      contres: 0,
      surcontres: 0,
      belotes: 0,
      averageContract: 0,
      successRate: 0,
    }
  }

  let realized = 0
  let contractSum = 0

  for (const d of donnes) {
    const value = d.contract === 'capot' ? 250 : d.contract
    contractSum += value
    const belote = d.beloteTeamId === d.takerTeamId ? 20 : 0
    const ok = d.contract === 'capot' ? d.capotRealized : d.takerCardPoints + belote >= value
    if (ok) realized += 1
  }

  return {
    total: donnes.length,
    realized,
    chutes: donnes.length - realized,
    capots: donnes.filter((d) => d.capotRealized).length,
    contres: donnes.filter((d) => d.coinche === 'contre').length,
    surcontres: donnes.filter((d) => d.coinche === 'surcontre').length,
    belotes: donnes.filter((d) => d.beloteTeamId !== null).length,
    averageContract: Math.round(contractSum / donnes.length),
    successRate: realized / donnes.length,
  }
}
