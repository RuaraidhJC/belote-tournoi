/** Inscription des équipes (2 joueurs chacune) avant le premier tirage. */

import { useEffect, useState } from 'react'
import { addTeam, canEditTeams, removeTeam, renameTeam } from '../domain/tournament'
import type { Player, Tournament } from '../domain/types'
import { store } from '../storage/localStore'

interface Props {
  tournament: Tournament
  apply: (fn: (t: Tournament) => Tournament) => void
}

/** Nom d'équipe par défaut : « Dupont / Martin ». */
function defaultTeamName(a: string, b: string): string {
  const parts = [a.trim(), b.trim()].filter(Boolean)
  return parts.join(' / ') || 'Équipe sans nom'
}

export function SetupView({ tournament, apply }: Props) {
  const [playerA, setPlayerA] = useState('')
  const [playerB, setPlayerB] = useState('')
  const [teamName, setTeamName] = useState('')
  const [knownPlayers, setKnownPlayers] = useState<Player[]>([])

  useEffect(() => {
    void store.listPlayers().then(setKnownPlayers)
  }, [])

  const editable = canEditTeams(tournament)

  /**
   * Retrouve un joueur déjà connu par son nom, sinon en crée un.
   * C'est ce qui permet de suivre un joueur d'un tournoi à l'autre.
   */
  async function resolvePlayer(name: string): Promise<{ id: string; name: string }> {
    const trimmed = name.trim()
    const existing = knownPlayers.find(
      (p) => p.name.localeCompare(trimmed, 'fr', { sensitivity: 'base' }) === 0,
    )
    if (existing) return { id: existing.id, name: existing.name }

    const created: Player = {
      id: crypto.randomUUID(),
      name: trimmed,
      createdAt: new Date().toISOString(),
    }
    await store.savePlayer(created)
    setKnownPlayers((prev) => [...prev, created])
    return { id: created.id, name: created.name }
  }

  async function submit() {
    if (!playerA.trim() && !playerB.trim()) return

    const players: { id: string; name: string }[] = []
    if (playerA.trim()) players.push(await resolvePlayer(playerA))
    if (playerB.trim()) players.push(await resolvePlayer(playerB))

    const name = teamName.trim() || defaultTeamName(playerA, playerB)
    apply((t) => addTeam(t, { name, players }))

    setPlayerA('')
    setPlayerB('')
    setTeamName('')
  }

  return (
    <>
      {!editable && (
        <div className="banner banner-info">
          La première manche est tirée : la composition des équipes est figée. Seuls les noms
          restent modifiables.
        </div>
      )}

      {editable && (
        <div className="card">
          <h2>Inscrire une équipe</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <div className="row">
              <div className="field">
                <label htmlFor="pa">Joueur 1</label>
                <input
                  id="pa"
                  list="known-players"
                  value={playerA}
                  onChange={(e) => setPlayerA(e.target.value)}
                  placeholder="Nom"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="pb">Joueur 2</label>
                <input
                  id="pb"
                  list="known-players"
                  value={playerB}
                  onChange={(e) => setPlayerB(e.target.value)}
                  placeholder="Nom"
                  autoComplete="off"
                />
              </div>
              <div className="field">
                <label htmlFor="tn">Nom d'équipe (facultatif)</label>
                <input
                  id="tn"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder={defaultTeamName(playerA, playerB)}
                />
              </div>
            </div>
            <datalist id="known-players">
              {knownPlayers.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!playerA.trim() && !playerB.trim()}
            >
              Ajouter l'équipe
            </button>
            <p className="small muted" style={{ marginBottom: 0 }}>
              Un joueur déjà saisi lors d'un tournoi précédent est reconnu par son nom : ses
              statistiques se cumulent automatiquement.
            </p>
          </form>
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h2>Équipes inscrites</h2>
          <span className="tag">{tournament.teams.length} équipe(s)</span>
        </div>

        {tournament.teams.length === 0 ? (
          <p className="empty">Aucune équipe inscrite.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: '1%' }}>#</th>
                <th>Équipe</th>
                <th className="hide-sm">Joueurs</th>
                {editable && <th />}
              </tr>
            </thead>
            <tbody>
              {tournament.teams.map((team, i) => (
                <tr key={team.id}>
                  <td className="muted">{i + 1}</td>
                  <td>
                    <input
                      value={team.name}
                      onChange={(e) => apply((t) => renameTeam(t, team.id, e.target.value))}
                      aria-label={`Nom de l'équipe ${i + 1}`}
                    />
                  </td>
                  <td className="hide-sm muted small">
                    {team.players.map((p) => p.name).join(', ') || '—'}
                  </td>
                  {editable && (
                    <td className="num">
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => apply((t) => removeTeam(t, team.id))}
                        aria-label={`Retirer ${team.name}`}
                      >
                        Retirer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tournament.teams.length % 2 === 1 && tournament.teams.length > 0 && (
          <p className="small muted" style={{ marginBottom: 0 }}>
            Effectif impair : à chaque manche, une équipe sera exempte et marquera une victoire.
          </p>
        )}
      </div>
    </>
  )
}
