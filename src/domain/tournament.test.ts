import { describe, expect, it } from 'vitest'
import {
  addTeam,
  createTournament,
  nextStep,
  recordScore,
  reopenMatch,
  setDonnes,
  startNextRound,
  tournamentWinner,
  undoLastRound,
} from './tournament'
import { computeStandings } from './standings'
import { computePlayerStats, computeDonneStats } from './stats'
import type { Donne, Tournament } from './types'

function withTeams(count: number, config = {}): Tournament {
  let t = createTournament('Tournoi test', '2026-01-15', config)
  for (let i = 1; i <= count; i++) {
    t = addTeam(t, {
      name: `Équipe ${i}`,
      players: [
        { id: `p${i}a`, name: `Joueur ${i}A` },
        { id: `p${i}b`, name: `Joueur ${i}B` },
      ],
    })
  }
  return t
}

/** Joue toutes les parties en attente : l'équipe A gagne toujours. */
function playAllPending(t: Tournament, scoreA = 1200, scoreB = 900): Tournament {
  let next = t
  for (const round of t.rounds) {
    for (const match of round.matches) {
      if (match.status === 'pending') {
        next = recordScore(next, match.id, { scoreA, scoreB })
      }
    }
  }
  return next
}

describe('cycle de vie du tournoi', () => {
  it('refuse de démarrer avec moins de 2 équipes', () => {
    expect(nextStep(withTeams(1)).kind).toBe('blocked')
    expect(() => startNextRound(withTeams(1))).toThrow()
  })

  it('bloque les équipes dès la première manche tirée', () => {
    const t = startNextRound(withTeams(4))
    expect(() => addTeam(t, { name: 'Retardataire', players: [] })).toThrow()
  })

  it('exige tous les scores avant de tirer la manche suivante', () => {
    const t = startNextRound(withTeams(4))
    expect(nextStep(t).kind).toBe('blocked')
    expect(() => startNextRound(t)).toThrow(/scores/)
  })

  it('enchaîne 4 rondes suisses par défaut puis la finale', () => {
    let t = withTeams(8)
    expect(t.config.swissRounds).toBe(4)
    expect(t.config.playoff).toBe('top2')

    for (let round = 1; round <= 4; round++) {
      t = startNextRound(t)
      expect(nextStep(t).kind).toBe('blocked')
      t = playAllPending(t)
    }

    expect(nextStep(t)).toEqual({ kind: 'final' })

    // La finale oppose les deux premiers du classement des rondes suisses.
    const qualified = computeStandings(t).slice(0, 2).map((r) => r.teamId)
    t = startNextRound(t)
    const final = t.rounds.at(-1)!
    expect(final.kind).toBe('final')
    expect(final.matches).toHaveLength(1)
    expect([final.matches[0]!.teamAId, final.matches[0]!.teamBId]).toEqual(qualified)

    t = playAllPending(t)
    expect(nextStep(t)).toEqual({ kind: 'done' })
    expect(tournamentWinner(t)).toBe(final.matches[0]!.teamAId)
  })

  it('permet une finale avec seulement 2 équipes inscrites', () => {
    let t = withTeams(2, { swissRounds: 1 })
    t = playAllPending(startNextRound(t))

    expect(nextStep(t)).toEqual({ kind: 'final' })
    t = playAllPending(startNextRound(t))
    expect(tournamentWinner(t)).not.toBeNull()
  })

  it('désigne le premier du classement quand il n’y a pas de phase finale', () => {
    let t = withTeams(4, { playoff: 'none', swissRounds: 1 })
    t = playAllPending(startNextRound(t))

    expect(nextStep(t)).toEqual({ kind: 'done' })
    expect(tournamentWinner(t)).toBe(computeStandings(t)[0]!.teamId)
  })

  it('nomme le vainqueur de la finale, pas le premier du classement suisse', () => {
    let t = withTeams(4, { swissRounds: 1 })
    t = playAllPending(startNextRound(t))

    const [first, second] = computeStandings(t)
    t = startNextRound(t)
    const final = t.rounds.at(-1)!.matches[0]!

    // Le deuxième du classement renverse le premier en finale.
    t = recordScore(t, final.id, { scoreA: 500, scoreB: 1500 })
    expect(final.teamAId).toBe(first!.teamId)
    expect(tournamentWinner(t)).toBe(second!.teamId)
  })

  it('exempte une équipe sur un effectif impair, sans score à saisir', () => {
    const t = startNextRound(withTeams(5))
    const bye = t.rounds[0]!.matches.find((m) => m.teamBId === null)!

    expect(bye.status).toBe('done')
    expect(() => recordScore(t, bye.id, { scoreA: 100, scoreB: 0 })).toThrow()
    expect(computeStandings(t).find((r) => r.teamId === bye.teamAId)!.wins).toBe(1)
  })

  it('annule la dernière manche', () => {
    let t = playAllPending(startNextRound(withTeams(4)))
    expect(t.rounds).toHaveLength(1)
    t = undoLastRound(t)
    expect(t.rounds).toHaveLength(0)
    expect(computeStandings(t).every((r) => r.played === 0)).toBe(true)
  })

  it('rouvre une partie pour corriger une saisie', () => {
    let t = playAllPending(startNextRound(withTeams(4)))
    const match = t.rounds[0]!.matches[0]!

    t = reopenMatch(t, match.id)
    expect(nextStep(t).kind).toBe('blocked')

    t = recordScore(t, match.id, { scoreA: 500, scoreB: 1500 })
    const updated = t.rounds[0]!.matches[0]!
    expect(updated.scoreB).toBe(1500)
  })
})

describe('saisie donne par donne', () => {
  const donne = (over: Partial<Donne>): Donne => ({
    id: crypto.randomUUID(),
    contract: 100,
    suit: 'coeur',
    takerTeamId: 'x',
    takerCardPoints: 110,
    coinche: 'none',
    beloteTeamId: null,
    capotRealized: false,
    ...over,
  })

  it('recalcule le score du match depuis les donnes', () => {
    let t = startNextRound(withTeams(4))
    const match = t.rounds[0]!.matches[0]!

    t = setDonnes(t, match.id, [
      donne({ takerTeamId: match.teamAId }),
      donne({ takerTeamId: match.teamBId!, contract: 80, takerCardPoints: 90 }),
    ])

    const updated = t.rounds[0]!.matches[0]!
    // A preneur à 100 avec 110 pts → 210 ; B marque arrondi(52) = 50
    // B preneur à 80 avec 90 pts → 170 ; A marque arrondi(72) = 70
    expect(updated.scoreA).toBe(280)
    expect(updated.scoreB).toBe(220)
    expect(updated.status).toBe('done')
  })

  it('repasse la partie en attente si toutes les donnes sont retirées', () => {
    let t = startNextRound(withTeams(4))
    const match = t.rounds[0]!.matches[0]!
    t = setDonnes(t, match.id, [donne({ takerTeamId: match.teamAId })])
    t = setDonnes(t, match.id, [])
    expect(t.rounds[0]!.matches[0]!.status).toBe('pending')
  })
})

describe('pénalités et forfait', () => {
  it('une pénalité de retard peut renverser le résultat', () => {
    let t = startNextRound(withTeams(4))
    const match = t.rounds[0]!.matches[0]!
    t = recordScore(t, match.id, { scoreA: 1000, scoreB: 900, penaltyA: -200 })

    const standings = computeStandings(t)
    expect(standings.find((r) => r.teamId === match.teamBId)!.wins).toBe(1)
    expect(standings.find((r) => r.teamId === match.teamAId)!.losses).toBe(1)
  })

  it('un forfait applique le goal average de -1001', () => {
    let t = startNextRound(withTeams(4))
    const match = t.rounds[0]!.matches[0]!
    t = recordScore(t, match.id, { scoreA: 0, scoreB: 0, forfaitTeamId: match.teamBId })

    const standings = computeStandings(t)
    expect(standings.find((r) => r.teamId === match.teamBId)!.goalAverage).toBe(-1001)
    expect(standings.find((r) => r.teamId === match.teamAId)!.goalAverage).toBe(1001)
  })
})

describe('statistiques joueurs', () => {
  /**
   * Fait gagner largement l'équipe du joueur `p1a`, quel que soit le
   * tirage au sort, pour que le champion soit le même d'un tournoi à l'autre.
   */
  function playFavouring(t: Tournament, playerId: string): Tournament {
    const teamOfPlayer = t.teams.find((team) => team.players.some((p) => p.id === playerId))!
    let next = t
    for (const round of t.rounds) {
      for (const match of round.matches) {
        if (match.status !== 'pending') continue
        if (match.teamAId === teamOfPlayer.id) {
          next = recordScore(next, match.id, { scoreA: 1200, scoreB: 100 })
        } else if (match.teamBId === teamOfPlayer.id) {
          next = recordScore(next, match.id, { scoreA: 100, scoreB: 1200 })
        } else {
          next = recordScore(next, match.id, { scoreA: 1000, scoreB: 900 })
        }
      }
    }
    return next
  }

  it('cumule victoires et titres sur plusieurs tournois', () => {
    const t1 = playFavouring(startNextRound(withTeams(4, { swissRounds: 1, playoff: 'none' })), 'p1a')
    const t2 = playFavouring(startNextRound(withTeams(4, { swissRounds: 1, playoff: 'none' })), 'p1a')

    const stats = computePlayerStats([t1, t2])
    const champion = stats.find((s) => s.playerId === 'p1a')!

    expect(champion.tournaments).toBe(2)
    expect(champion.titles).toBe(2)
    expect(champion.matchesPlayed).toBe(2)
    expect(champion.winRate).toBe(1)
    expect(champion.goalAverage).toBe(2200)
    expect(champion.bestRank).toBe(1)
    // 4 équipes × 2 joueurs, les ids de joueur étant stables d'un tournoi à l'autre.
    expect(stats).toHaveLength(8)
  })

  it('ne compte pas de titre tant que le tournoi n’est pas fini', () => {
    const t = startNextRound(withTeams(4, { swissRounds: 1, playoff: 'none' }))
    expect(computePlayerStats([t]).every((s) => s.titles === 0)).toBe(true)
  })

  it('résume les donnes saisies', () => {
    let t = startNextRound(withTeams(4))
    const match = t.rounds[0]!.matches[0]!
    t = setDonnes(t, match.id, [
      {
        id: '1',
        contract: 100,
        suit: 'pique',
        takerTeamId: match.teamAId,
        takerCardPoints: 110,
        coinche: 'contre',
        beloteTeamId: match.teamAId,
        capotRealized: false,
      },
      {
        id: '2',
        contract: 120,
        suit: 'coeur',
        takerTeamId: match.teamBId!,
        takerCardPoints: 60,
        coinche: 'none',
        beloteTeamId: null,
        capotRealized: false,
      },
    ])

    const stats = computeDonneStats([t])
    expect(stats.total).toBe(2)
    expect(stats.realized).toBe(1)
    expect(stats.chutes).toBe(1)
    expect(stats.contres).toBe(1)
    expect(stats.belotes).toBe(1)
    expect(stats.averageContract).toBe(110)
  })

  it('renvoie un résumé vide sans aucune donne', () => {
    expect(computeDonneStats([]).total).toBe(0)
  })
})
