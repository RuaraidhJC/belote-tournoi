/** Classement : victoires puis goal average, recalculé depuis les matchs. */

import { resolveMatch } from './scoring'
import type { Id, Standing, Tournament } from './types'

/**
 * Classement des équipes sur les rondes suisses.
 *
 * Les matchs `pending` sont ignorés : une manche en cours ne déforme pas
 * le classement affiché. Les matchs de phase finale n'entrent pas non plus
 * dans le classement de qualification.
 */
export function computeStandings(tournament: Tournament): Standing[] {
  const rows = new Map<Id, Standing>()

  for (const team of tournament.teams) {
    rows.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      wins: 0,
      losses: 0,
      draws: 0,
      byes: 0,
      goalAverage: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      played: 0,
      opponentIds: [],
      rank: 0,
    })
  }

  for (const round of tournament.rounds) {
    if (round.kind !== 'swiss') continue

    for (const match of round.matches) {
      if (match.status !== 'done') continue
      const a = rows.get(match.teamAId)
      if (!a) continue

      // Équipe exempte : une victoire, sans incidence sur le goal average.
      if (match.teamBId === null) {
        a.wins += 1
        a.byes += 1
        continue
      }

      const b = rows.get(match.teamBId)
      if (!b) continue

      const result = resolveMatch(match, tournament.config.forfaitGoalAverage)

      a.played += 1
      b.played += 1
      a.opponentIds.push(b.teamId)
      b.opponentIds.push(a.teamId)

      a.pointsFor += result.finalA
      a.pointsAgainst += result.finalB
      b.pointsFor += result.finalB
      b.pointsAgainst += result.finalA

      a.goalAverage += result.finalA - result.finalB
      b.goalAverage += result.finalB - result.finalA

      if (result.isDraw) {
        // Égalité stricte : une demi-victoire chacune, pour que
        // l'appariement suisse reste cohérent.
        a.draws += 1
        b.draws += 1
        a.wins += 0.5
        b.wins += 0.5
      } else if (result.winnerId === a.teamId) {
        a.wins += 1
        b.losses += 1
      } else {
        b.wins += 1
        a.losses += 1
      }
    }
  }

  const sorted = [...rows.values()].sort(compareStandings)
  sorted.forEach((row, i) => {
    row.rank = i + 1
  })
  return sorted
}

/** Victoires, puis goal average, puis points marqués, puis nom. */
export function compareStandings(a: Standing, b: Standing): number {
  if (b.wins !== a.wins) return b.wins - a.wins
  if (b.goalAverage !== a.goalAverage) return b.goalAverage - a.goalAverage
  if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor
  return a.teamName.localeCompare(b.teamName, 'fr')
}

/** Vrai si toutes les parties de la manche ont un score saisi. */
export function isRoundComplete(tournament: Tournament, roundNumber: number): boolean {
  const round = tournament.rounds.find((r) => r.number === roundNumber && r.kind === 'swiss')
  if (!round) return false
  return round.matches.every((m) => m.status === 'done')
}
