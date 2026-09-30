import { describe, expect, it } from 'vitest'
import {
  latePenalty,
  resolveMatch,
  roundToTen,
  scoreDonne,
  totalFromDonnes,
} from './scoring'
import type { Donne, Match } from './types'

const base = {
  coinche: 'none' as const,
  beloteHolder: null,
  capotRealized: false,
}

describe('roundToTen (§4.1)', () => {
  it('arrondit à la dizaine inférieure de 1 à 5', () => {
    expect(roundToTen(81)).toBe(80)
    expect(roundToTen(85)).toBe(80)
    expect(roundToTen(73)).toBe(70)
  })

  it('arrondit à la dizaine supérieure de 6 à 9', () => {
    expect(roundToTen(86)).toBe(90)
    expect(roundToTen(89)).toBe(90)
    expect(roundToTen(162)).toBe(160)
  })

  it('laisse les dizaines intactes', () => {
    expect(roundToTen(90)).toBe(90)
    expect(roundToTen(0)).toBe(0)
  })
})

describe('contrat réalisé (§4.1)', () => {
  it("reprend l'exemple du règlement : 80 annoncés, 110 faits → 190", () => {
    const s = scoreDonne({ ...base, contract: 80, takerCardPoints: 110 })
    expect(s.realized).toBe(true)
    expect(s.taker).toBe(190)
    expect(s.defense).toBe(50) // 162 - 110 = 52 → 50
  })

  it('les deux camps totalisent 160 plus le contrat', () => {
    const s = scoreDonne({ ...base, contract: 100, takerCardPoints: 103 })
    expect(s.taker + s.defense).toBe(160 + 100)
  })

  it("l'arrondi ne permet pas de réaliser le contrat : 89 demandés à 90 chutent", () => {
    const s = scoreDonne({ ...base, contract: 90, takerCardPoints: 89 })
    expect(s.realized).toBe(false)
    expect(s.taker).toBe(0)
    expect(s.defense).toBe(250) // 160 + 90
  })

  it('la belote permet de réaliser le contrat', () => {
    const s = scoreDonne({ ...base, contract: 90, takerCardPoints: 75, beloteHolder: 'taker' })
    expect(s.realized).toBe(true) // 75 + 20 = 95 >= 90
    expect(s.taker).toBe(180) // arrondi(95) = 90 (dernier chiffre 5), + 90
  })
})

describe('chute du contrat (§4.2)', () => {
  it('le preneur marque 0 et la défense 160 + contrat', () => {
    const s = scoreDonne({ ...base, contract: 120, takerCardPoints: 60 })
    expect(s.taker).toBe(0)
    expect(s.defense).toBe(280)
  })

  it('la belote reste acquise au preneur qui chute', () => {
    const s = scoreDonne({ ...base, contract: 120, takerCardPoints: 60, beloteHolder: 'taker' })
    expect(s.taker).toBe(20)
    expect(s.defense).toBe(280)
  })

  it('la défense marque sa belote en plus de la chute', () => {
    const s = scoreDonne({ ...base, contract: 120, takerCardPoints: 60, beloteHolder: 'defense' })
    expect(s.defense).toBe(300)
  })
})

describe('contre et surcontre (§4.3)', () => {
  it('contrat à 100 contré et réussi vaut 360', () => {
    const s = scoreDonne({ ...base, contract: 100, takerCardPoints: 110, coinche: 'contre' })
    expect(s.taker).toBe(360)
    expect(s.defense).toBe(0)
  })

  it('contrat à 100 surcontré et réussi vaut 460', () => {
    const s = scoreDonne({ ...base, contract: 100, takerCardPoints: 110, coinche: 'surcontre' })
    expect(s.taker).toBe(460)
  })

  it('la défense marque la même valeur quand le preneur contré chute', () => {
    const s = scoreDonne({ ...base, contract: 100, takerCardPoints: 50, coinche: 'contre' })
    expect(s.taker).toBe(0)
    expect(s.defense).toBe(360)
  })

  it('contrat à 140 surcontré réussi avec capot vaut 670', () => {
    const s = scoreDonne({
      contract: 140,
      takerCardPoints: 162,
      coinche: 'surcontre',
      beloteHolder: null,
      capotRealized: true,
    })
    expect(s.taker).toBe(670)
  })
})

describe('capot (§4.4)', () => {
  it('capot non demandé vaut 250 + le contrat', () => {
    const s = scoreDonne({ ...base, contract: 110, takerCardPoints: 162, capotRealized: true })
    expect(s.taker).toBe(360)
    expect(s.defense).toBe(0)
  })

  it('capot demandé et réalisé vaut 500', () => {
    const s = scoreDonne({ ...base, contract: 'capot', takerCardPoints: 162, capotRealized: true })
    expect(s.taker).toBe(500)
  })

  it('capot demandé et chuté vaut 410 pour la défense', () => {
    const s = scoreDonne({ ...base, contract: 'capot', takerCardPoints: 150 })
    expect(s.realized).toBe(false)
    expect(s.taker).toBe(0)
    expect(s.defense).toBe(410)
  })

  it('capot contré réussi vaut 750', () => {
    const s = scoreDonne({
      contract: 'capot',
      takerCardPoints: 162,
      coinche: 'contre',
      beloteHolder: null,
      capotRealized: true,
    })
    expect(s.taker).toBe(750)
  })

  it('capot contré chuté vaut 660', () => {
    const s = scoreDonne({ ...base, contract: 'capot', takerCardPoints: 140, coinche: 'contre' })
    expect(s.defense).toBe(660)
  })

  it('capot surcontré réussi vaut 1000', () => {
    const s = scoreDonne({
      contract: 'capot',
      takerCardPoints: 162,
      coinche: 'surcontre',
      beloteHolder: null,
      capotRealized: true,
    })
    expect(s.taker).toBe(1000)
  })

  it('capot surcontré chuté vaut 910', () => {
    const s = scoreDonne({ ...base, contract: 'capot', takerCardPoints: 0, coinche: 'surcontre' })
    expect(s.defense).toBe(910)
  })

  it("l'équipe qui subit le capot conserve sa belote", () => {
    const s = scoreDonne({
      contract: 130,
      takerCardPoints: 162,
      coinche: 'none',
      beloteHolder: 'defense',
      capotRealized: true,
    })
    expect(s.taker).toBe(380) // 250 + 130
    expect(s.defense).toBe(20)
  })
})

describe('validation des entrées', () => {
  it('refuse des points aux cartes hors bornes', () => {
    expect(() => scoreDonne({ ...base, contract: 80, takerCardPoints: 200 })).toThrow(RangeError)
    expect(() => scoreDonne({ ...base, contract: 80, takerCardPoints: -1 })).toThrow(RangeError)
  })

  it('refuse un capot sans les 162 points', () => {
    expect(() =>
      scoreDonne({ ...base, contract: 80, takerCardPoints: 150, capotRealized: true }),
    ).toThrow(RangeError)
  })
})

describe('cumul des donnes sur un match', () => {
  const donne = (over: Partial<Donne>): Donne => ({
    id: crypto.randomUUID(),
    contract: 80,
    suit: 'pique',
    takerTeamId: 'A',
    takerCardPoints: 100,
    coinche: 'none',
    beloteTeamId: null,
    capotRealized: false,
    ...over,
  })

  it('additionne les donnes du bon côté du match', () => {
    const totals = totalFromDonnes(
      [donne({}), donne({ takerTeamId: 'B', takerCardPoints: 120, contract: 110 })],
      'A',
      'B',
    )
    // Donne 1 : A preneur à 80, 100 pts → 180 ; B marque arrondi(62) = 60
    // Donne 2 : B preneur à 110, 120 pts → 230 ; A marque arrondi(42) = 40
    expect(totals).toEqual({ a: 220, b: 290 })
  })

  it('rejette une donne dont le preneur est étranger au match', () => {
    expect(() => totalFromDonnes([donne({ takerTeamId: 'Z' })], 'A', 'B')).toThrow()
  })
})

describe('résolution du match', () => {
  const match = (over: Partial<Match>): Match => ({
    id: 'm',
    kind: 'swiss',
    roundNumber: 1,
    teamAId: 'A',
    teamBId: 'B',
    scoreA: 1000,
    scoreB: 900,
    penaltyA: 0,
    penaltyB: 0,
    forfaitTeamId: null,
    donnes: [],
    status: 'done',
    ...over,
  })

  it('désigne le vainqueur au score net', () => {
    const r = resolveMatch(match({}), 1001)
    expect(r.winnerId).toBe('A')
    expect(r.finalA - r.finalB).toBe(100)
  })

  it('applique les pénalités de retard avant de désigner le vainqueur', () => {
    const r = resolveMatch(match({ penaltyA: -200 }), 1001)
    expect(r.finalA).toBe(800)
    expect(r.winnerId).toBe('B')
  })

  it('inflige un goal average de -1001 à une équipe forfait', () => {
    const r = resolveMatch(match({ forfaitTeamId: 'B' }), 1001)
    expect(r.winnerId).toBe('A')
    expect(r.finalA - r.finalB).toBe(1001)
  })

  it('traite une exemption comme une victoire sans goal average', () => {
    const r = resolveMatch(match({ teamBId: null }), 1001)
    expect(r.isBye).toBe(true)
    expect(r.winnerId).toBe('A')
    expect(r.finalA).toBe(0)
    expect(r.finalB).toBe(0)
  })

  it('signale une égalité stricte', () => {
    const r = resolveMatch(match({ scoreB: 1000 }), 1001)
    expect(r.isDraw).toBe(true)
    expect(r.winnerId).toBeNull()
  })
})

describe('pénalité de retard', () => {
  it('compte 200 points par tranche de 5 minutes entamée', () => {
    expect(latePenalty(0, 200)).toBe(0)
    expect(latePenalty(1, 200)).toBe(-200)
    expect(latePenalty(5, 200)).toBe(-200)
    expect(latePenalty(6, 200)).toBe(-400)
    expect(latePenalty(25, 200)).toBe(-1000)
  })
})
