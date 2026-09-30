import { describe, expect, it } from 'vitest'
import { computeFinalPairing, computePairings, shuffle } from './swiss'
import { computeStandings } from './standings'
import type { Match, Standing, Tournament } from './types'
import { DEFAULT_CONFIG } from './types'

function standing(over: Partial<Standing> & { teamId: string }): Standing {
  return {
    teamName: over.teamId,
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
    ...over,
  }
}

/** Générateur déterministe pour rendre les tirages reproductibles. */
function seededRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe('shuffle', () => {
  it('conserve tous les éléments sans muter la source', () => {
    const src = [1, 2, 3, 4, 5]
    const out = shuffle(src, seededRng(42))
    expect(out).toHaveLength(5)
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5])
    expect(src).toEqual([1, 2, 3, 4, 5])
  })
})

describe('manche 1 — tirage au sort intégral', () => {
  it('apparie toutes les équipes', () => {
    const teams = ['A', 'B', 'C', 'D', 'E', 'F'].map((t) => standing({ teamId: t }))
    const pairings = computePairings({ standings: teams, roundNumber: 1, rng: seededRng(7) })

    expect(pairings).toHaveLength(3)
    const used = pairings.flatMap((p) => [p.teamAId, p.teamBId]).filter(Boolean)
    expect(new Set(used).size).toBe(6)
  })

  it('exempte une équipe si le nombre est impair', () => {
    const teams = ['A', 'B', 'C', 'D', 'E'].map((t) => standing({ teamId: t }))
    const pairings = computePairings({ standings: teams, roundNumber: 1, rng: seededRng(3) })

    const byes = pairings.filter((p) => p.teamBId === null)
    expect(byes).toHaveLength(1)
    expect(pairings).toHaveLength(3)
  })
})

describe('manches suivantes — appariement par victoires puis goal average', () => {
  it('oppose la 1re à la 2e, la 3e à la 4e', () => {
    const teams = [
      standing({ teamId: 'A', wins: 1, goalAverage: 500 }),
      standing({ teamId: 'B', wins: 1, goalAverage: 300 }),
      standing({ teamId: 'C', wins: 0, goalAverage: -300 }),
      standing({ teamId: 'D', wins: 0, goalAverage: -500 }),
    ]
    const pairings = computePairings({ standings: teams, roundNumber: 2 })

    expect(pairings).toEqual([
      { teamAId: 'A', teamBId: 'B', isRematch: false },
      { teamAId: 'C', teamBId: 'D', isRematch: false },
    ])
  })

  it('évite de rejouer un adversaire déjà rencontré', () => {
    // A et B se sont déjà joués : l'appariement doit glisser.
    const teams = [
      standing({ teamId: 'A', wins: 1, goalAverage: 500, opponentIds: ['B'] }),
      standing({ teamId: 'B', wins: 1, goalAverage: 300, opponentIds: ['A'] }),
      standing({ teamId: 'C', wins: 1, goalAverage: 100, opponentIds: ['D'] }),
      standing({ teamId: 'D', wins: 1, goalAverage: 0, opponentIds: ['C'] }),
    ]
    const pairings = computePairings({ standings: teams, roundNumber: 2 })

    expect(pairings.every((p) => !p.isRematch)).toBe(true)
    expect(pairings).toEqual([
      { teamAId: 'A', teamBId: 'C', isRematch: false },
      { teamAId: 'B', teamBId: 'D', isRematch: false },
    ])
  })

  it('fait descendre une équipe quand un groupe de victoires est impair', () => {
    // 3 équipes à 1 victoire, 3 à 0 : une équipe à 1 victoire joue contre une à 0.
    const teams = [
      standing({ teamId: 'A', wins: 1, goalAverage: 500 }),
      standing({ teamId: 'B', wins: 1, goalAverage: 400 }),
      standing({ teamId: 'C', wins: 1, goalAverage: 300 }),
      standing({ teamId: 'D', wins: 0, goalAverage: -300 }),
      standing({ teamId: 'E', wins: 0, goalAverage: -400 }),
      standing({ teamId: 'F', wins: 0, goalAverage: -500 }),
    ]
    const pairings = computePairings({ standings: teams, roundNumber: 2 })

    expect(pairings).toEqual([
      { teamAId: 'A', teamBId: 'B', isRematch: false },
      { teamAId: 'C', teamBId: 'D', isRematch: false },
      { teamAId: 'E', teamBId: 'F', isRematch: false },
    ])
  })

  it("donne l'exemption à la dernière équipe qui n'en a pas eu", () => {
    const teams = [
      standing({ teamId: 'A', wins: 1 }),
      standing({ teamId: 'B', wins: 1 }),
      standing({ teamId: 'C', wins: 0 }),
      standing({ teamId: 'D', wins: 0, byes: 1 }),
      standing({ teamId: 'E', wins: 0, goalAverage: -900 }),
    ]
    const pairings = computePairings({ standings: teams, roundNumber: 2 })
    const bye = pairings.find((p) => p.teamBId === null)

    // D est déjà passé : l'exemption revient à E, dernier au classement.
    expect(bye?.teamAId).toBe('E')
  })

  it('signale la revanche quand aucun autre appariement n’existe', () => {
    const teams = [
      standing({ teamId: 'A', wins: 1, opponentIds: ['B'] }),
      standing({ teamId: 'B', wins: 1, opponentIds: ['A'] }),
    ]
    const pairings = computePairings({ standings: teams, roundNumber: 3 })

    expect(pairings).toEqual([{ teamAId: 'A', teamBId: 'B', isRematch: true }])
  })

  it('apparie sans revanche un plateau de 16 équipes sur 4 manches', () => {
    let teams = Array.from({ length: 16 }, (_, i) =>
      standing({ teamId: `T${i}`, goalAverage: -i }),
    )

    for (let round = 1; round <= 4; round++) {
      const pairings = computePairings({
        standings: teams,
        roundNumber: round,
        rng: seededRng(round * 17),
      })
      expect(pairings.every((p) => !p.isRematch)).toBe(true)

      const byId = new Map(teams.map((t) => [t.teamId, t]))
      for (const p of pairings) {
        if (!p.teamBId) continue
        const a = byId.get(p.teamAId)!
        const b = byId.get(p.teamBId)!
        a.opponentIds = [...a.opponentIds, b.teamId]
        b.opponentIds = [...b.opponentIds, a.teamId]
        // L'équipe la mieux classée gagne, pour produire un historique plausible.
        a.wins += 1
        a.goalAverage += 200
        b.goalAverage -= 200
      }
      teams = [...byId.values()]
    }
  })
})

describe('phase finale', () => {
  it('oppose les deux premiers du classement', () => {
    const teams = ['A', 'B', 'C', 'D'].map((t, i) => standing({ teamId: t, wins: 4 - i }))
    expect(computeFinalPairing(teams)).toEqual({
      teamAId: 'A',
      teamBId: 'B',
      isRematch: false,
    })
  })

  it('compose la finale même si les deux finalistes se sont déjà rencontrés', () => {
    const teams = [
      standing({ teamId: 'A', wins: 3, opponentIds: ['B'] }),
      standing({ teamId: 'B', wins: 2, opponentIds: ['A'] }),
    ]
    expect(computeFinalPairing(teams).teamBId).toBe('B')
  })

  it('refuse une finale à moins de 2 équipes', () => {
    expect(() => computeFinalPairing([standing({ teamId: 'A' })])).toThrow()
  })
})

describe('classement', () => {
  function tournament(matches: Match[]): Tournament {
    return {
      id: 't',
      name: 'Test',
      date: '2026-01-01',
      createdAt: '',
      updatedAt: '',
      config: DEFAULT_CONFIG,
      teams: ['A', 'B', 'C', 'D'].map((id) => ({ id, name: id, players: [] })),
      rounds: [{ number: 1, kind: 'swiss', createdAt: '', matches }],
    }
  }

  const m = (over: Partial<Match>): Match => ({
    id: crypto.randomUUID(),
    kind: 'swiss',
    roundNumber: 1,
    teamAId: 'A',
    teamBId: 'B',
    scoreA: 0,
    scoreB: 0,
    penaltyA: 0,
    penaltyB: 0,
    forfaitTeamId: null,
    donnes: [],
    status: 'done',
    ...over,
  })

  it('classe par victoires puis goal average', () => {
    const t = tournament([
      m({ teamAId: 'A', teamBId: 'B', scoreA: 1200, scoreB: 800 }),
      m({ teamAId: 'C', teamBId: 'D', scoreA: 1000, scoreB: 900 }),
    ])
    const rows = computeStandings(t)

    expect(rows.map((r) => r.teamId)).toEqual(['A', 'C', 'D', 'B'])
    expect(rows[0]!.goalAverage).toBe(400)
    expect(rows[1]!.goalAverage).toBe(100)
    expect(rows[3]!.goalAverage).toBe(-400)
  })

  it('ignore les matchs sans score saisi', () => {
    const t = tournament([m({ scoreA: 1200, scoreB: 800, status: 'pending' })])
    expect(computeStandings(t).every((r) => r.played === 0)).toBe(true)
  })

  it('compte une exemption comme une victoire sans goal average', () => {
    const t = tournament([m({ teamAId: 'A', teamBId: null })])
    const a = computeStandings(t).find((r) => r.teamId === 'A')!

    expect(a.wins).toBe(1)
    expect(a.byes).toBe(1)
    expect(a.goalAverage).toBe(0)
    expect(a.played).toBe(0)
  })

  it('applique le goal average de forfait', () => {
    const t = tournament([m({ forfaitTeamId: 'B' })])
    const rows = computeStandings(t)

    expect(rows.find((r) => r.teamId === 'A')!.goalAverage).toBe(1001)
    expect(rows.find((r) => r.teamId === 'B')!.goalAverage).toBe(-1001)
  })

  it('partage une demi-victoire en cas d’égalité stricte', () => {
    const t = tournament([m({ scoreA: 1000, scoreB: 1000 })])
    const rows = computeStandings(t)

    expect(rows.find((r) => r.teamId === 'A')!.wins).toBe(0.5)
    expect(rows.find((r) => r.teamId === 'B')!.draws).toBe(1)
  })

  it('retient les adversaires rencontrés pour l’appariement suivant', () => {
    const t = tournament([m({ scoreA: 1000, scoreB: 900 })])
    expect(computeStandings(t).find((r) => r.teamId === 'A')!.opponentIds).toEqual(['B'])
  })
})
