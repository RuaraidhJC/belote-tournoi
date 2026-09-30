/** Statistiques cumulées sur l'ensemble des tournois enregistrés. */

import { useEffect, useState } from 'react'
import { computeDonneStats, computePlayerStats, type PlayerStats } from '../domain/stats'
import type { Tournament } from '../domain/types'
import { store } from '../storage/localStore'

function percent(value: number): string {
  return `${Math.round(value * 100)} %`
}

export function StatsView() {
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null)

  useEffect(() => {
    void (async () => {
      const summaries = await store.listTournaments()
      const loaded = await Promise.all(summaries.map((s) => store.getTournament(s.id)))
      setTournaments(loaded.filter((t): t is Tournament => t !== null))
    })()
  }, [])

  if (tournaments === null) return <p className="empty">Chargement…</p>
  if (tournaments.length === 0) {
    return <p className="empty">Aucun tournoi enregistré pour l'instant.</p>
  }

  const players: PlayerStats[] = computePlayerStats(tournaments)
  const donnes = computeDonneStats(tournaments)

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>Joueurs</h2>
          <span className="small muted">
            {tournaments.length} tournoi(s), {players.length} joueur(s)
          </span>
        </div>

        {players.length === 0 ? (
          <p className="empty">Aucun joueur inscrit.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Joueur</th>
                <th className="num">Titres</th>
                <th className="num hide-sm">Tournois</th>
                <th className="num">V</th>
                <th className="num hide-sm">D</th>
                <th className="num">% V</th>
                <th className="num hide-sm">Goal av.</th>
                <th className="num hide-sm">Pts/partie</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.playerId}>
                  <td>{p.playerName}</td>
                  <td className="num">{p.titles > 0 ? `🏆 ${p.titles}` : '—'}</td>
                  <td className="num hide-sm">{p.tournaments}</td>
                  <td className="num">
                    <strong>{p.wins}</strong>
                  </td>
                  <td className="num hide-sm">{p.losses}</td>
                  <td className="num">{p.matchesPlayed > 0 ? percent(p.winRate) : '—'}</td>
                  <td className="num hide-sm">{p.goalAverage > 0 ? `+${p.goalAverage}` : p.goalAverage}</td>
                  <td className="num hide-sm muted">{p.averagePointsFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Donnes détaillées</h2>
        {donnes.total === 0 ? (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Aucune donne saisie via le calculateur. Utilisez l'onglet « Donne par donne » lors de
            la saisie d'un score pour alimenter ces statistiques.
          </p>
        ) : (
          <table>
            <tbody>
              <tr>
                <th>Donnes jouées</th>
                <td className="num">{donnes.total}</td>
              </tr>
              <tr>
                <th>Contrats réussis</th>
                <td className="num">
                  {donnes.realized} ({percent(donnes.successRate)})
                </td>
              </tr>
              <tr>
                <th>Chutes</th>
                <td className="num">{donnes.chutes}</td>
              </tr>
              <tr>
                <th>Contrat moyen</th>
                <td className="num">{donnes.averageContract}</td>
              </tr>
              <tr>
                <th>Capots</th>
                <td className="num">{donnes.capots}</td>
              </tr>
              <tr>
                <th>Contres / surcontres</th>
                <td className="num">
                  {donnes.contres} / {donnes.surcontres}
                </td>
              </tr>
              <tr>
                <th>Belotes annoncées</th>
                <td className="num">{donnes.belotes}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
