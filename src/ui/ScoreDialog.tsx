/** Saisie du score d'une partie : total direct ou donne par donne. */

import { useState } from 'react'
import { donneScoreByTeam, latePenalty, scoreDonne, CONTRACT_VALUES, CARD_POINTS_TOTAL } from '../domain/scoring'
import { recordScore, setDonnes, teamName } from '../domain/tournament'
import { SUITS, SUIT_LABELS, type Coinche, type Contract, type Donne, type Match, type Suit, type Tournament } from '../domain/types'

/** Une exemption n'a pas de score : le type impose un adversaire. */
export type PlayableMatch = Match & { teamBId: string }

interface Props {
  tournament: Tournament
  match: PlayableMatch
  apply: (fn: (t: Tournament) => Tournament) => void
  onClose: () => void
}

type Mode = 'total' | 'donnes'

export function ScoreDialog({ tournament, match, apply, onClose }: Props) {
  const teamBId = match.teamBId
  const nameA = teamName(tournament, match.teamAId)
  const nameB = teamName(tournament, teamBId)

  const [mode, setMode] = useState<Mode>(match.donnes.length > 0 ? 'donnes' : 'total')
  const [scoreA, setScoreA] = useState(String(match.scoreA))
  const [scoreB, setScoreB] = useState(String(match.scoreB))
  const [donnes, setLocalDonnes] = useState<Donne[]>(match.donnes)
  const [minutesA, setMinutesA] = useState('0')
  const [minutesB, setMinutesB] = useState('0')
  const [forfait, setForfait] = useState<string>(match.forfaitTeamId ?? '')
  const [error, setError] = useState<string | null>(null)

  const per5 = tournament.config.latePenaltyPer5Min
  const penaltyA = latePenalty(Number(minutesA) || 0, per5)
  const penaltyB = latePenalty(Number(minutesB) || 0, per5)

  const donneTotals = donnes.reduce(
    (acc, d) => {
      const { a, b } = donneScoreByTeam(d, match.teamAId, teamBId)
      return { a: acc.a + a, b: acc.b + b }
    },
    { a: 0, b: 0 },
  )

  function save() {
    setError(null)
    if (mode === 'donnes' && donnes.length === 0) {
      setError('Ajoutez au moins une donne, ou saisissez le score final.')
      return
    }
    try {
      if (mode === 'donnes') {
        apply((t) => setDonnes(t, match.id, donnes))
        apply((t) =>
          recordScore(t, match.id, {
            scoreA: donneTotals.a,
            scoreB: donneTotals.b,
            penaltyA,
            penaltyB,
            forfaitTeamId: forfait || null,
          }),
        )
      } else {
        apply((t) =>
          recordScore(t, match.id, {
            scoreA: Number(scoreA) || 0,
            scoreB: Number(scoreB) || 0,
            penaltyA,
            penaltyB,
            forfaitTeamId: forfait || null,
          }),
        )
      }
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const finalA = (mode === 'donnes' ? donneTotals.a : Number(scoreA) || 0) + penaltyA
  const finalB = (mode === 'donnes' ? donneTotals.b : Number(scoreB) || 0) + penaltyB

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Saisie du score">
      <div className="modal">
        <div className="card-head">
          <h2 style={{ margin: 0 }}>
            {nameA} <span className="muted">contre</span> {nameB}
          </h2>
          <button className="btn btn-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'total'} onClick={() => setMode('total')}>
            Score final
          </button>
          <button role="tab" aria-selected={mode === 'donnes'} onClick={() => setMode('donnes')}>
            Donne par donne
          </button>
        </div>

        {mode === 'total' ? (
          <div className="row">
            <div className="field">
              <label htmlFor="sa">{nameA}</label>
              <input
                id="sa"
                type="number"
                inputMode="numeric"
                value={scoreA}
                onChange={(e) => setScoreA(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div className="field">
              <label htmlFor="sb">{nameB}</label>
              <input
                id="sb"
                type="number"
                inputMode="numeric"
                value={scoreB}
                onChange={(e) => setScoreB(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>
        ) : (
          <DonneEditor
            donnes={donnes}
            onChange={setLocalDonnes}
            teamAId={match.teamAId}
            teamBId={teamBId}
            nameA={nameA}
            nameB={nameB}
          />
        )}

        <details>
          <summary className="small muted" style={{ cursor: 'pointer', padding: '8px 0' }}>
            Retard et forfait
          </summary>
          <div className="row">
            <div className="field">
              <label htmlFor="ma">Retard {nameA} (min)</label>
              <input
                id="ma"
                type="number"
                min={0}
                value={minutesA}
                onChange={(e) => setMinutesA(e.target.value)}
              />
              {penaltyA !== 0 && <span className="small tag tag-warn">{penaltyA} points</span>}
            </div>
            <div className="field">
              <label htmlFor="mb">Retard {nameB} (min)</label>
              <input
                id="mb"
                type="number"
                min={0}
                value={minutesB}
                onChange={(e) => setMinutesB(e.target.value)}
              />
              {penaltyB !== 0 && <span className="small tag tag-warn">{penaltyB} points</span>}
            </div>
          </div>
          <div className="field">
            <label htmlFor="ff">Équipe déclarée forfait (30 min de retard)</label>
            <select id="ff" value={forfait} onChange={(e) => setForfait(e.target.value)}>
              <option value="">Aucune</option>
              <option value={match.teamAId}>{nameA}</option>
              <option value={teamBId}>{nameB}</option>
            </select>
            {forfait && (
              <span className="small tag tag-danger">
                Partie perdue, goal average de -{tournament.config.forfaitGoalAverage}
              </span>
            )}
          </div>
        </details>

        <div className="preview spread">
          <span className="small muted">Score retenu</span>
          <span className="score">
            {forfait ? '—' : `${finalA} – ${finalB}`}
            {!forfait && (penaltyA !== 0 || penaltyB !== 0) && (
              <span className="small muted"> (pénalités comprises)</span>
            )}
          </span>
        </div>

        <div className="row">
          <button className="btn btn-primary" onClick={save}>
            Enregistrer
          </button>
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  )
}

interface EditorProps {
  donnes: Donne[]
  onChange: (donnes: Donne[]) => void
  teamAId: string
  teamBId: string
  nameA: string
  nameB: string
}

/** Calculateur de donne appliquant le barème de la belote contrée. */
function DonneEditor({ donnes, onChange, teamAId, teamBId, nameA, nameB }: EditorProps) {
  const [contract, setContract] = useState<Contract>(80)
  const [suit, setSuit] = useState<Suit>('pique')
  const [taker, setTaker] = useState(teamAId)
  const [points, setPoints] = useState('')
  const [coinche, setCoinche] = useState<Coinche>('none')
  const [belote, setBelote] = useState('')
  const [capot, setCapot] = useState(false)

  const cardPoints = capot ? CARD_POINTS_TOTAL : Number(points) || 0
  const valid = capot || (points !== '' && cardPoints >= 0 && cardPoints <= CARD_POINTS_TOTAL)

  let preview: { taker: number; defense: number; realized: boolean } | null = null
  if (valid) {
    try {
      preview = scoreDonne({
        contract,
        takerCardPoints: cardPoints,
        coinche,
        beloteHolder: belote === '' ? null : belote === taker ? 'taker' : 'defense',
        capotRealized: capot,
      })
    } catch {
      preview = null
    }
  }

  function add() {
    if (!valid) return
    onChange([
      ...donnes,
      {
        id: crypto.randomUUID(),
        contract,
        suit,
        takerTeamId: taker,
        takerCardPoints: cardPoints,
        coinche,
        beloteTeamId: belote || null,
        capotRealized: capot,
      },
    ])
    setPoints('')
    setCoinche('none')
    setBelote('')
    setCapot(false)
  }

  const totals = donnes.reduce(
    (acc, d) => {
      const { a, b } = donneScoreByTeam(d, teamAId, teamBId)
      return { a: acc.a + a, b: acc.b + b }
    },
    { a: 0, b: 0 },
  )

  return (
    <div>
      {donnes.length > 0 && (
        <div className="donne-list">
          <table>
            <thead>
              <tr>
                <th>Contrat</th>
                <th>Preneur</th>
                <th className="num">{nameA}</th>
                <th className="num">{nameB}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {donnes.map((d) => {
                const s = donneScoreByTeam(d, teamAId, teamBId)
                return (
                  <tr key={d.id}>
                    <td className="small">
                      {d.contract === 'capot' ? 'Capot' : d.contract} {SUIT_LABELS[d.suit].slice(0, 1)}
                      {d.coinche === 'contre' && <span className="tag tag-warn"> contré</span>}
                      {d.coinche === 'surcontre' && <span className="tag tag-danger"> surcontré</span>}
                    </td>
                    <td className="small muted">{d.takerTeamId === teamAId ? nameA : nameB}</td>
                    <td className="num">{s.a}</td>
                    <td className="num">{s.b}</td>
                    <td className="num">
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => onChange(donnes.filter((x) => x.id !== d.id))}
                        aria-label="Supprimer cette donne"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={2}>Total</th>
                <th className="num">{totals.a}</th>
                <th className="num">{totals.b}</th>
                <th />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <h3>Nouvelle donne</h3>
      <div className="row">
        <div className="field">
          <label htmlFor="d-contract">Contrat</label>
          <select
            id="d-contract"
            value={String(contract)}
            onChange={(e) => {
              const v = e.target.value
              setContract(v === 'capot' ? 'capot' : Number(v))
              if (v === 'capot') setCapot(false)
            }}
          >
            {CONTRACT_VALUES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
            <option value="capot">Capot</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="d-suit">Atout</label>
          <select id="d-suit" value={suit} onChange={(e) => setSuit(e.target.value as Suit)}>
            {SUITS.map((s) => (
              <option key={s} value={s}>
                {SUIT_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="d-taker">Preneur</label>
          <select id="d-taker" value={taker} onChange={(e) => setTaker(e.target.value)}>
            <option value={teamAId}>{nameA}</option>
            <option value={teamBId}>{nameB}</option>
          </select>
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="d-points">Points du preneur aux cartes (sur 162)</label>
          <input
            id="d-points"
            type="number"
            inputMode="numeric"
            min={0}
            max={CARD_POINTS_TOTAL}
            value={capot ? CARD_POINTS_TOTAL : points}
            disabled={capot}
            onChange={(e) => setPoints(e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div className="field">
          <label htmlFor="d-coinche">Contre</label>
          <select
            id="d-coinche"
            value={coinche}
            onChange={(e) => setCoinche(e.target.value as Coinche)}
          >
            <option value="none">Non contré</option>
            <option value="contre">Contré (× 2)</option>
            <option value="surcontre">Surcontré (× 3)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="d-belote">Belote-rebelote</label>
          <select id="d-belote" value={belote} onChange={(e) => setBelote(e.target.value)}>
            <option value="">Personne</option>
            <option value={teamAId}>{nameA}</option>
            <option value={teamBId}>{nameB}</option>
          </select>
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input
          type="checkbox"
          checked={capot}
          onChange={(e) => setCapot(e.target.checked)}
          style={{ width: 'auto', minHeight: 0 }}
        />
        Capot réalisé (le preneur ramasse les 8 plis)
      </label>

      {preview && (
        <div className="preview spread">
          <span className="small">
            {preview.realized ? (
              <span className="tag tag-bye">Contrat réussi</span>
            ) : (
              <span className="tag tag-danger">Chute</span>
            )}
          </span>
          <span className="score">
            {taker === teamAId
              ? `${preview.taker} – ${preview.defense}`
              : `${preview.defense} – ${preview.taker}`}
          </span>
        </div>
      )}

      <button className="btn btn-primary" onClick={add} disabled={!valid}>
        Ajouter la donne
      </button>
    </div>
  )
}
