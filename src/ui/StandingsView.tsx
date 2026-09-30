/** Classement des rondes suisses. */

import { computeStandings } from '../domain/standings'
import { tournamentWinner, teamName } from '../domain/tournament'
import type { Tournament } from '../domain/types'

interface Props {
  tournament: Tournament
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n)
}

export function StandingsView({ tournament }: Props) {
  const standings = computeStandings(tournament)
  const winner = tournamentWinner(tournament)
  const qualifies = tournament.config.playoff === 'top2' ? 2 : 0

  if (standings.length === 0) {
    return <p className="empty">Aucune équipe inscrite.</p>
  }

  return (
    <>
      {winner && (
        <div className="banner banner-success">
          <strong>Vainqueur : {teamName(tournament, winner)}</strong>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Classement</h2>
          <span className="small muted">Victoires, puis goal average</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: '1%' }}>#</th>
              <th>Équipe</th>
              <th className="num">V</th>
              <th className="num hide-sm">D</th>
              <th className="num">Goal av.</th>
              <th className="num hide-sm">Pour</th>
              <th className="num hide-sm">Contre</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.teamId} className={qualifies > 0 && row.rank <= qualifies ? 'qualified' : ''}>
                <td className="muted">{row.rank}</td>
                <td>
                  {row.teamName}
                  {row.byes > 0 && <span className="tag tag-bye"> exempte ×{row.byes}</span>}
                </td>
                <td className="num">
                  <strong>{row.wins}</strong>
                </td>
                <td className="num hide-sm">{row.losses}</td>
                <td className="num">{signed(row.goalAverage)}</td>
                <td className="num hide-sm muted">{row.pointsFor}</td>
                <td className="num hide-sm muted">{row.pointsAgainst}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {qualifies > 0 && standings.length >= qualifies && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Les {qualifies} premières équipes (surlignées) disputent la finale.
          </p>
        )}
      </div>
    </>
  )
}
