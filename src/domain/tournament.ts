/**
 * Opérations sur un tournoi. Toutes les fonctions sont pures :
 * elles renvoient un nouveau tournoi sans modifier l'entrée.
 */

import { resolveMatch, totalFromDonnes } from './scoring'
import { computeStandings } from './standings'
import { computeFinalPairing, computePairings, type Pairing, type Rng } from './swiss'
import {
  DEFAULT_CONFIG,
  type Donne,
  type Id,
  type Match,
  type MatchKind,
  type Round,
  type Team,
  type Tournament,
  type TournamentConfig,
} from './types'

const newId = (): Id => crypto.randomUUID()

export function createTournament(
  name: string,
  date: string,
  config: Partial<TournamentConfig> = {},
): Tournament {
  const now = new Date().toISOString()
  return {
    id: newId(),
    name: name.trim() || 'Tournoi de belote',
    date,
    createdAt: now,
    updatedAt: now,
    config: { ...DEFAULT_CONFIG, ...config },
    teams: [],
    rounds: [],
  }
}

/** Une équipe ne peut plus être modifiée dès qu'une manche est lancée. */
export function canEditTeams(tournament: Tournament): boolean {
  return tournament.rounds.length === 0
}

export function addTeam(tournament: Tournament, team: Omit<Team, 'id'>): Tournament {
  if (!canEditTeams(tournament)) {
    throw new Error('Les équipes ne peuvent plus changer une fois la première manche tirée')
  }
  return { ...tournament, teams: [...tournament.teams, { ...team, id: newId() }] }
}

export function removeTeam(tournament: Tournament, teamId: Id): Tournament {
  if (!canEditTeams(tournament)) {
    throw new Error('Les équipes ne peuvent plus changer une fois la première manche tirée')
  }
  return { ...tournament, teams: tournament.teams.filter((t) => t.id !== teamId) }
}

export function renameTeam(tournament: Tournament, teamId: Id, name: string): Tournament {
  return {
    ...tournament,
    teams: tournament.teams.map((t) => (t.id === teamId ? { ...t, name } : t)),
  }
}

export type NextStep =
  | { kind: 'swiss'; roundNumber: number }
  | { kind: 'final' }
  | { kind: 'done' }
  | { kind: 'blocked'; reason: string }

/** Ce que l'on peut lancer maintenant, ou pourquoi on ne peut pas. */
export function nextStep(tournament: Tournament): NextStep {
  const { config, teams, rounds } = tournament

  if (teams.length < 2) {
    return { kind: 'blocked', reason: 'Il faut au moins 2 équipes pour lancer le tournoi' }
  }

  const swissRounds = rounds.filter((r) => r.kind === 'swiss')
  const pending = rounds.find((r) => r.matches.some((m) => m.status === 'pending'))
  if (pending) {
    const label = pending.kind === 'swiss' ? `la manche ${pending.number}` : 'la finale'
    return { kind: 'blocked', reason: `Tous les scores de ${label} doivent être saisis` }
  }

  if (swissRounds.length < config.swissRounds) {
    return { kind: 'swiss', roundNumber: swissRounds.length + 1 }
  }

  if (config.playoff === 'none') return { kind: 'done' }
  if (!rounds.some((r) => r.kind === 'final')) return { kind: 'final' }
  return { kind: 'done' }
}

function matchFromPairing(pairing: Pairing, kind: MatchKind, roundNumber: number): Match {
  return {
    id: newId(),
    kind,
    roundNumber,
    teamAId: pairing.teamAId,
    teamBId: pairing.teamBId,
    scoreA: 0,
    scoreB: 0,
    penaltyA: 0,
    penaltyB: 0,
    forfaitTeamId: null,
    donnes: [],
    // Une exemption n'a pas de score à saisir : elle est acquise d'office.
    status: pairing.teamBId === null ? 'done' : 'pending',
  }
}

/**
 * Tire la manche suivante : ronde suisse, demi-finales ou finale
 * selon l'avancement du tournoi.
 */
export function startNextRound(tournament: Tournament, rng?: Rng): Tournament {
  const step = nextStep(tournament)
  if (step.kind === 'blocked') throw new Error(step.reason)
  if (step.kind === 'done') throw new Error('Le tournoi est terminé')

  const standings = computeStandings(tournament)
  const createdAt = new Date().toISOString()

  let pairings: Pairing[]
  let number: number

  if (step.kind === 'swiss') {
    number = step.roundNumber
    pairings = computePairings({
      standings,
      roundNumber: number,
      byesByTeam: new Map(standings.map((s) => [s.teamId, s.byes])),
      ...(rng ? { rng } : {}),
    })
  } else {
    // La finale oppose les deux premiers du classement des rondes suisses.
    number = tournament.config.swissRounds + 1
    pairings = [computeFinalPairing(standings)]
  }

  const round: Round = {
    number,
    kind: step.kind,
    createdAt,
    matches: pairings.map((p) => matchFromPairing(p, step.kind, number)),
  }

  return { ...tournament, rounds: [...tournament.rounds, round] }
}

/** Annule la dernière manche tirée, scores compris. */
export function undoLastRound(tournament: Tournament): Tournament {
  if (tournament.rounds.length === 0) throw new Error('Aucune manche à annuler')
  return { ...tournament, rounds: tournament.rounds.slice(0, -1) }
}

function mapMatch(tournament: Tournament, matchId: Id, fn: (m: Match) => Match): Tournament {
  let found = false
  const rounds = tournament.rounds.map((round) => ({
    ...round,
    matches: round.matches.map((m) => {
      if (m.id !== matchId) return m
      found = true
      return fn(m)
    }),
  }))
  if (!found) throw new Error(`Partie introuvable : ${matchId}`)
  return { ...tournament, rounds }
}

export interface ScoreInput {
  scoreA: number
  scoreB: number
  penaltyA?: number
  penaltyB?: number
  forfaitTeamId?: Id | null
}

/** Saisie directe du score final d'une partie. */
export function recordScore(tournament: Tournament, matchId: Id, input: ScoreInput): Tournament {
  return mapMatch(tournament, matchId, (m) => {
    if (m.teamBId === null) throw new Error('Une équipe exempte n’a pas de score à saisir')
    if (!Number.isFinite(input.scoreA) || !Number.isFinite(input.scoreB)) {
      throw new Error('Les scores doivent être des nombres')
    }
    return {
      ...m,
      scoreA: Math.round(input.scoreA),
      scoreB: Math.round(input.scoreB),
      penaltyA: input.penaltyA ?? m.penaltyA,
      penaltyB: input.penaltyB ?? m.penaltyB,
      forfaitTeamId: input.forfaitTeamId === undefined ? m.forfaitTeamId : input.forfaitTeamId,
      status: 'done',
    }
  })
}

/**
 * Remplace le détail des donnes d'une partie et recalcule les scores.
 * Les pénalités et le forfait éventuels sont conservés.
 */
export function setDonnes(tournament: Tournament, matchId: Id, donnes: Donne[]): Tournament {
  return mapMatch(tournament, matchId, (m) => {
    if (m.teamBId === null) throw new Error('Une équipe exempte n’a pas de donnes à saisir')
    const totals = totalFromDonnes(donnes, m.teamAId, m.teamBId)
    return {
      ...m,
      donnes,
      scoreA: totals.a,
      scoreB: totals.b,
      status: donnes.length > 0 ? 'done' : 'pending',
    }
  })
}

/** Rouvre une partie pour corriger une saisie. */
export function reopenMatch(tournament: Tournament, matchId: Id): Tournament {
  return mapMatch(tournament, matchId, (m) => {
    if (m.teamBId === null) throw new Error('Une exemption ne se rouvre pas')
    return { ...m, status: 'pending' }
  })
}

/** Le vainqueur du tournoi, une fois la finale jouée. */
export function tournamentWinner(tournament: Tournament): Id | null {
  const final = tournament.rounds.find((r) => r.kind === 'final')
  const match = final?.matches[0]
  if (!match || match.status !== 'done') {
    // Sans phase finale, c'est le premier du classement suisse.
    if (tournament.config.playoff === 'none' && nextStep(tournament).kind === 'done') {
      return computeStandings(tournament)[0]?.teamId ?? null
    }
    return null
  }
  return resolveMatch(match, tournament.config.forfaitGoalAverage).winnerId
}

export function findMatch(tournament: Tournament, matchId: Id): Match | null {
  for (const round of tournament.rounds) {
    const match = round.matches.find((m) => m.id === matchId)
    if (match) return match
  }
  return null
}

export function teamName(tournament: Tournament, teamId: Id | null): string {
  if (teamId === null) return 'Exempte'
  return tournament.teams.find((t) => t.id === teamId)?.name ?? 'Équipe inconnue'
}
