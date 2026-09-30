/**
 * Appariement en rondes suisses.
 *
 * Manche 1 : tirage au sort intégral.
 * Manches suivantes : les équipes sont triées par victoires puis goal
 * average, et appariées de proche en proche (1re contre 2e, 3e contre 4e…),
 * en évitant de rejouer un adversaire déjà rencontré. Un groupe de victoires
 * en nombre impair fait naturellement « descendre » sa dernière équipe dans
 * le groupe suivant, conformément au règlement.
 */

import { compareStandings } from './standings'
import type { Id, Standing } from './types'

export type Rng = () => number

/** Mélange de Fisher-Yates, sans mutation de l'entrée. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const a = out[i]!
    const b = out[j]!
    out[i] = b
    out[j] = a
  }
  return out
}

export interface PairingInput {
  standings: Standing[]
  roundNumber: number
  /** Nombre d'exemptions déjà accordées à chaque équipe. */
  byesByTeam?: Map<Id, number>
  rng?: Rng
}

export interface Pairing {
  teamAId: Id
  teamBId: Id | null
  /** Vrai si l'appariement a dû rejouer une confrontation déjà eue. */
  isRematch: boolean
}

/** Nombre maximum de branches explorées avant de tolérer une revanche. */
const SEARCH_BUDGET = 200_000

/**
 * Calcule les appariements d'une manche.
 *
 * Renvoie une exemption (`teamBId: null`) si le nombre d'équipes est impair.
 * L'exemption va à l'équipe la moins bien classée n'en ayant pas encore eu.
 */
export function computePairings(input: PairingInput): Pairing[] {
  const { standings, roundNumber, byesByTeam, rng = Math.random } = input

  if (standings.length < 2) {
    return standings.length === 1
      ? [{ teamAId: standings[0]!.teamId, teamBId: null, isRematch: false }]
      : []
  }

  // Manche 1 : tirage au sort intégral, aucun historique à respecter.
  const ordered =
    roundNumber === 1 ? shuffle(standings, rng) : [...standings].sort(compareStandings)

  const pairings: Pairing[] = []
  let pool = ordered

  if (pool.length % 2 === 1) {
    const byeIndex = pickByeIndex(pool, byesByTeam)
    const exempt = pool[byeIndex]!
    pairings.push({ teamAId: exempt.teamId, teamBId: null, isRematch: false })
    pool = pool.filter((_, i) => i !== byeIndex)
  }

  const played = new Map<Id, Set<Id>>()
  for (const s of pool) played.set(s.teamId, new Set(s.opponentIds))

  const budget = { remaining: SEARCH_BUDGET }
  const exact = pairWithoutRematch(pool, played, budget)

  if (exact) {
    for (const [a, b] of exact) pairings.push({ teamAId: a, teamBId: b, isRematch: false })
    return pairings
  }

  // Aucun appariement sans revanche n'existe : on retombe sur
  // l'appariement de proche en proche, en signalant les revanches.
  for (let i = 0; i + 1 < pool.length; i += 2) {
    const a = pool[i]!
    const b = pool[i + 1]!
    pairings.push({
      teamAId: a.teamId,
      teamBId: b.teamId,
      isRematch: played.get(a.teamId)?.has(b.teamId) ?? false,
    })
  }
  return pairings
}

/**
 * L'exemption revient à l'équipe la moins bien classée qui n'en a pas
 * encore bénéficié, pour ne pas offrir deux victoires gratuites.
 */
function pickByeIndex(pool: Standing[], byesByTeam?: Map<Id, number>): number {
  const byes = byesByTeam ?? new Map<Id, number>()
  let best = pool.length - 1
  let bestByes = Number.POSITIVE_INFINITY

  for (let i = pool.length - 1; i >= 0; i--) {
    const count = byes.get(pool[i]!.teamId) ?? pool[i]!.byes
    if (count < bestByes) {
      bestByes = count
      best = i
      if (count === 0) break
    }
  }
  return best
}

/**
 * Recherche en profondeur d'un appariement parfait sans revanche.
 *
 * La première équipe non appariée est confrontée aux suivantes dans l'ordre
 * du classement : le premier candidat essayé est donc toujours le voisin
 * immédiat, ce qui reproduit la règle « 1re contre 2e » tant qu'elle est
 * praticable. Renvoie null si le budget d'exploration est épuisé ou si
 * aucun appariement complet n'existe.
 */
function pairWithoutRematch(
  pool: Standing[],
  played: Map<Id, Set<Id>>,
  budget: { remaining: number },
): [Id, Id][] | null {
  if (pool.length === 0) return []
  if (budget.remaining-- <= 0) return null

  const [first, ...rest] = pool
  const firstId = first!.teamId
  const seen = played.get(firstId) ?? new Set<Id>()

  for (let i = 0; i < rest.length; i++) {
    const candidate = rest[i]!
    if (seen.has(candidate.teamId)) continue

    const remaining = rest.filter((_, j) => j !== i)
    const sub = pairWithoutRematch(remaining, played, budget)
    if (sub) return [[firstId, candidate.teamId], ...sub]
    if (budget.remaining <= 0) return null
  }
  return null
}

/**
 * Appariement de la finale : les deux premières équipes du classement
 * à l'issue des rondes suisses.
 */
export function computeFinalPairing(standings: Standing[]): Pairing {
  if (standings.length < 2) {
    throw new Error(`Une finale demande au moins 2 équipes, ${standings.length} inscrites`)
  }
  const [first, second] = standings
  return { teamAId: first!.teamId, teamBId: second!.teamId, isRematch: false }
}
