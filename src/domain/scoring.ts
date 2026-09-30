/**
 * Décompte des points de la belote contrée, règlement de la
 * Belote Contrée Parisienne (2019), section 4.
 */

import type { Coinche, Contract, Donne, Id, Match } from './types'

/** Total des points aux cartes dans une donne, 10 de der compris. */
export const CARD_POINTS_TOTAL = 162

/** Valeur du capot, annoncé ou non. */
export const CAPOT_VALUE = 250

/** Base marquée par le camp qui profite d'une chute (162 arrondi). */
export const CHUTE_BASE = 160

/** Valeur de la belote-rebelote. */
export const BELOTE_VALUE = 20

/** Contrats annonçables, hors capot. */
export const CONTRACT_VALUES = [80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180] as const

/**
 * Arrondi du règlement : dernier chiffre de 1 à 5 → dizaine inférieure,
 * de 6 à 9 → dizaine supérieure.
 */
export function roundToTen(points: number): number {
  const last = points % 10
  if (last === 0) return points
  return last <= 5 ? points - last : points + (10 - last)
}

export function contractValue(contract: Contract): number {
  return contract === 'capot' ? CAPOT_VALUE : contract
}

export function coincheMultiplier(coinche: Coinche): 1 | 2 | 3 {
  if (coinche === 'surcontre') return 3
  if (coinche === 'contre') return 2
  return 1
}

export interface DonneInput {
  contract: Contract
  /** Points faits aux cartes par le preneur, 0 à 162. */
  takerCardPoints: number
  coinche: Coinche
  /** Camp détenant la belote, ou null. */
  beloteHolder: 'taker' | 'defense' | null
  /** Le preneur a ramassé les 8 plis. */
  capotRealized: boolean
}

export interface DonneScore {
  taker: number
  defense: number
  /** Le contrat est-il rempli. */
  realized: boolean
  /** Points du preneur belote comprise, avant arrondi : sert au test du contrat. */
  takerRawTotal: number
  contractValue: number
  multiplier: 1 | 2 | 3
}

/**
 * Score d'une donne.
 *
 * Contrat réussi (§4.1) : le preneur marque ses points + le contrat.
 * L'arrondi ne permet pas de réaliser le contrat : 89 demandés à 90 chutent.
 * Chute (§4.2) : le preneur marque 0, la défense 160 + le contrat.
 * Contre / surcontre (§4.3) : contrat × 2 ou × 3, + 160 (+ 250 si capot).
 * Capot (§4.4) : 250 au lieu des points aux cartes.
 * La belote (20) revient toujours à son détenteur, y compris en cas de
 * chute ou de capot subi — elle n'est pas imprenable.
 */
export function scoreDonne(input: DonneInput): DonneScore {
  const { contract, takerCardPoints, coinche, beloteHolder, capotRealized } = input

  if (!Number.isInteger(takerCardPoints) || takerCardPoints < 0 || takerCardPoints > CARD_POINTS_TOTAL) {
    throw new RangeError(`Points du preneur hors bornes : ${takerCardPoints} (attendu 0 à ${CARD_POINTS_TOTAL})`)
  }
  if (capotRealized && takerCardPoints !== CARD_POINTS_TOTAL) {
    throw new RangeError(`Un capot suppose les ${CARD_POINTS_TOTAL} points aux cartes, reçu ${takerCardPoints}`)
  }

  const value = contractValue(contract)
  const multiplier = coincheMultiplier(coinche)
  const takerBelote = beloteHolder === 'taker' ? BELOTE_VALUE : 0
  const defenseBelote = beloteHolder === 'defense' ? BELOTE_VALUE : 0

  const takerRawTotal = takerCardPoints + takerBelote
  const defenseCardPoints = CARD_POINTS_TOTAL - takerCardPoints

  // Un capot annoncé n'est réalisé que si les 8 plis sont faits.
  // Sinon le contrat tombe si les points bruts sont sous la valeur annoncée.
  const realized = contract === 'capot' ? capotRealized : takerRawTotal >= value

  // La belote (20) revient toujours à son détenteur : elle n'est pas
  // imprenable et reste acquise sur une chute comme sur un capot subi.
  let taker: number
  let defense: number

  if (multiplier === 1 && realized && capotRealized) {
    taker = CAPOT_VALUE + value + takerBelote
    defense = defenseBelote
  } else if (multiplier === 1 && realized) {
    // Le preneur marque ses points (belote comprise) plus le contrat.
    taker = roundToTen(takerRawTotal) + value
    defense = roundToTen(defenseCardPoints + defenseBelote)
  } else if (multiplier === 1) {
    taker = takerBelote
    defense = CHUTE_BASE + value + defenseBelote
  } else if (realized) {
    // Contré ou surcontré et réussi : les points aux cartes ne comptent plus.
    taker = value * multiplier + (capotRealized ? CAPOT_VALUE : CHUTE_BASE) + takerBelote
    defense = defenseBelote
  } else {
    taker = takerBelote
    defense = value * multiplier + CHUTE_BASE + defenseBelote
  }

  return { taker, defense, realized, takerRawTotal, contractValue: value, multiplier }
}

/** Score d'une donne rapporté aux deux équipes d'un match. */
export function donneScoreByTeam(donne: Donne, teamAId: Id, teamBId: Id): { a: number; b: number } {
  const beloteHolder =
    donne.beloteTeamId === null ? null : donne.beloteTeamId === donne.takerTeamId ? 'taker' : 'defense'

  const score = scoreDonne({
    contract: donne.contract,
    takerCardPoints: donne.takerCardPoints,
    coinche: donne.coinche,
    beloteHolder,
    capotRealized: donne.capotRealized,
  })

  const takerIsA = donne.takerTeamId === teamAId
  if (!takerIsA && donne.takerTeamId !== teamBId) {
    throw new Error(`Le preneur ${donne.takerTeamId} n'appartient pas à ce match`)
  }
  return takerIsA ? { a: score.taker, b: score.defense } : { a: score.defense, b: score.taker }
}

/** Cumul des donnes saisies pour un match. */
export function totalFromDonnes(donnes: Donne[], teamAId: Id, teamBId: Id): { a: number; b: number } {
  return donnes.reduce(
    (acc, d) => {
      const { a, b } = donneScoreByTeam(d, teamAId, teamBId)
      return { a: acc.a + a, b: acc.b + b }
    },
    { a: 0, b: 0 },
  )
}

export interface MatchResult {
  finalA: number
  finalB: number
  /** Id de l'équipe gagnante, ou null en cas d'égalité ou de match non joué. */
  winnerId: Id | null
  isDraw: boolean
  isBye: boolean
}

/**
 * Résultat net d'un match : scores bruts, moins les pénalités de retard.
 * Un forfait fixe directement le différentiel (goal average de -1001).
 */
export function resolveMatch(match: Match, forfaitGoalAverage: number): MatchResult {
  if (match.teamBId === null) {
    return { finalA: 0, finalB: 0, winnerId: match.teamAId, isDraw: false, isBye: true }
  }

  if (match.forfaitTeamId !== null) {
    const aForfeits = match.forfaitTeamId === match.teamAId
    return {
      finalA: aForfeits ? -forfaitGoalAverage : 0,
      finalB: aForfeits ? 0 : -forfaitGoalAverage,
      winnerId: aForfeits ? match.teamBId : match.teamAId,
      isDraw: false,
      isBye: false,
    }
  }

  const finalA = match.scoreA + match.penaltyA
  const finalB = match.scoreB + match.penaltyB
  const isDraw = finalA === finalB
  return {
    finalA,
    finalB,
    winnerId: isDraw ? null : finalA > finalB ? match.teamAId : match.teamBId,
    isDraw,
    isBye: false,
  }
}

/** Pénalité de retard : 200 points par tranche de 5 minutes entamée. */
export function latePenalty(minutesLate: number, per5Min: number): number {
  if (minutesLate <= 0) return 0
  return -Math.ceil(minutesLate / 5) * per5Min
}
