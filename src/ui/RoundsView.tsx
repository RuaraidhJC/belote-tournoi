/** Déroulement des manches : tirage, confrontations, saisie des scores. */

import { useState } from 'react'
import { resolveMatch } from '../domain/scoring'
import {
  nextStep,
  reopenMatch,
  startNextRound,
  teamName,
  undoLastRound,
} from '../domain/tournament'
import type { Match, Round, Tournament } from '../domain/types'
import { ScoreDialog, type PlayableMatch } from './ScoreDialog'

interface Props {
  tournament: Tournament
  apply: (fn: (t: Tournament) => Tournament) => void
}

function roundTitle(round: Round): string {
  if (round.kind === 'final') return 'Finale'
  return `Manche ${round.number}`
}

export function RoundsView({ tournament, apply }: Props) {
  const [editing, setEditing] = useState<PlayableMatch | null>(null)
  const step = nextStep(tournament)

  const stepLabel =
    step.kind === 'swiss'
      ? `Tirer la manche ${step.roundNumber}`
      : step.kind === 'final'
        ? 'Lancer la finale'
        : null

  return (
    <>
      <div className="card">
        <div className="spread">
          <div>
            <h2 style={{ marginBottom: 4 }}>
              {tournament.rounds.length === 0
                ? 'Tournoi non commencé'
                : roundTitle(tournament.rounds.at(-1)!)}
            </h2>
            <p className="small muted" style={{ margin: 0 }}>
              {step.kind === 'blocked' && step.reason}
              {step.kind === 'done' && 'Toutes les parties sont jouées.'}
              {stepLabel && `Prochaine étape : ${stepLabel.toLowerCase()}.`}
            </p>
          </div>
          <div className="row" style={{ flex: '0 0 auto' }}>
            {tournament.rounds.length > 0 && (
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  if (confirm('Annuler la dernière manche et tous ses scores ?')) {
                    apply(undoLastRound)
                  }
                }}
              >
                Annuler la manche
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => apply((t) => startNextRound(t))}
              disabled={stepLabel === null}
            >
              {stepLabel ?? 'Tournoi terminé'}
            </button>
          </div>
        </div>
      </div>

      {tournament.rounds.length === 0 && (
        <p className="empty">
          Inscrivez les équipes dans l'onglet « Équipes », puis tirez la première manche.
        </p>
      )}

      {[...tournament.rounds].reverse().map((round) => (
        <div className="card" key={`${round.kind}-${round.number}`}>
          <div className="card-head">
            <h2>{roundTitle(round)}</h2>
            <span className="tag">
              {round.matches.filter((m) => m.status === 'done').length} / {round.matches.length}{' '}
              saisis
            </span>
          </div>

          {round.matches.map((match) => (
            <MatchRow
              key={match.id}
              tournament={tournament}
              match={match}
              onEdit={() => setEditing(match as PlayableMatch)}
              onReopen={() => apply((t) => reopenMatch(t, match.id))}
            />
          ))}
        </div>
      ))}

      {editing && (
        <ScoreDialog
          tournament={tournament}
          match={editing}
          apply={apply}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

interface MatchRowProps {
  tournament: Tournament
  match: Match
  onEdit: () => void
  onReopen: () => void
}

function MatchRow({ tournament, match, onEdit, onReopen }: MatchRowProps) {
  const nameA = teamName(tournament, match.teamAId)

  if (match.teamBId === null) {
    return (
      <div className="match done">
        <div className="match-teams">
          <span className="match-team">{nameA}</span>
          <span className="tag tag-bye">Exempte — 1 victoire</span>
        </div>
      </div>
    )
  }

  const nameB = teamName(tournament, match.teamBId)
  const played = match.status === 'done'
  const result = played ? resolveMatch(match, tournament.config.forfaitGoalAverage) : null

  return (
    <div className={`match ${played ? 'done' : 'pending'}`}>
      <div className="match-teams">
        <span className={`match-team ${result?.winnerId === match.teamAId ? 'winner' : ''}`}>
          {nameA}
        </span>
        <span className="score">{played ? result!.finalA : '—'}</span>
        <span className="vs">contre</span>
        <span className="score">{played ? result!.finalB : '—'}</span>
        <span
          className={`match-team ${result?.winnerId === match.teamBId ? 'winner' : ''}`}
          style={{ textAlign: 'right' }}
        >
          {nameB}
        </span>
      </div>

      <div className="spread">
        <div className="small muted">
          {match.forfaitTeamId && (
            <span className="tag tag-danger">
              Forfait : {teamName(tournament, match.forfaitTeamId)}
            </span>
          )}
          {(match.penaltyA !== 0 || match.penaltyB !== 0) && (
            <span className="tag tag-warn">Pénalités appliquées</span>
          )}
          {result?.isDraw && <span className="tag tag-warn">Égalité — demi-victoire</span>}
          {match.donnes.length > 0 && (
            <span className="tag">{match.donnes.length} donne(s) détaillée(s)</span>
          )}
        </div>
        <div className="row" style={{ flex: '0 0 auto' }}>
          {played && (
            <button className="btn btn-sm" onClick={onReopen}>
              Rouvrir
            </button>
          )}
          <button className="btn btn-sm btn-primary" onClick={onEdit}>
            {played ? 'Modifier' : 'Saisir le score'}
          </button>
        </div>
      </div>
    </div>
  )
}
