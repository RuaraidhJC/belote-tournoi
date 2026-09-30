/** Écran d'accueil : ouvrir, créer, sauvegarder un tournoi. */

import { useRef, useState } from 'react'
import { createTournament } from '../domain/tournament'
import { store } from '../storage/localStore'
import type { Backup } from '../storage/types'
import type { TournamentSummary } from '../storage/types'

interface Props {
  summaries: TournamentSummary[]
  onOpen: (id: string) => void
  onChanged: () => void | Promise<void>
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TournamentList({ summaries, onOpen, onChanged }: Props) {
  const [name, setName] = useState('')
  const [date, setDate] = useState(todayISO())
  const [swissRounds, setSwissRounds] = useState(4)
  const [playoff, setPlayoff] = useState<'none' | 'top2'>('top2')
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function create() {
    const tournament = createTournament(name, date, { swissRounds, playoff })
    await store.saveTournament(tournament)
    await onChanged()
    onOpen(tournament.id)
  }

  async function remove(id: string, label: string) {
    if (!confirm(`Supprimer définitivement « ${label} » ? Cette action est irréversible.`)) return
    await store.deleteTournament(id)
    await onChanged()
  }

  async function exportAll() {
    const backup = await store.exportAll()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `belote-sauvegarde-${todayISO()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function importFile(file: File) {
    try {
      const backup = JSON.parse(await file.text()) as Backup
      await store.importAll(backup, 'merge')
      await onChanged()
      setMessage({
        kind: 'success',
        text: `${backup.tournaments.length} tournoi(s) et ${backup.players.length} joueur(s) importés.`,
      })
    } catch (e: unknown) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <>
      {message && (
        <div className={`banner banner-${message.kind === 'error' ? 'error' : 'success'}`}>
          {message.text}
        </div>
      )}

      <div className="card">
        <h2>Nouveau tournoi</h2>
        <div className="row">
          <div className="field">
            <label htmlFor="new-name">Nom</label>
            <input
              id="new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tournoi du vendredi"
            />
          </div>
          <div className="field">
            <label htmlFor="new-date">Date</label>
            <input id="new-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="new-rounds">Rondes suisses</label>
            <input
              id="new-rounds"
              type="number"
              min={1}
              max={10}
              value={swissRounds}
              onChange={(e) => setSwissRounds(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
          <div className="field">
            <label htmlFor="new-playoff">Phase finale</label>
            <select
              id="new-playoff"
              value={playoff}
              onChange={(e) => setPlayoff(e.target.value as 'none' | 'top2')}
            >
              <option value="top2">Finale entre les 2 premiers</option>
              <option value="none">Aucune, classement direct</option>
            </select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => void create()}>
          Créer le tournoi
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Tournois enregistrés</h2>
          <div className="row" style={{ flex: '0 0 auto' }}>
            <button className="btn btn-sm" onClick={() => void exportAll()}>
              Exporter tout
            </button>
            <button className="btn btn-sm" onClick={() => fileInput.current?.click()}>
              Importer
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importFile(file)
                e.target.value = ''
              }}
            />
          </div>
        </div>

        {summaries.length === 0 ? (
          <p className="empty">Aucun tournoi pour l'instant. Créez-en un ci-dessus.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th className="hide-sm">Date</th>
                <th className="num">Équipes</th>
                <th className="num hide-sm">Manches</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={() => onOpen(s.id)}
                      style={{ textAlign: 'left' }}
                    >
                      {s.name}
                    </button>
                  </td>
                  <td className="hide-sm muted small">{s.date}</td>
                  <td className="num">{s.teamCount}</td>
                  <td className="num hide-sm">{s.roundCount}</td>
                  <td className="num">
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => void remove(s.id, s.name)}
                      aria-label={`Supprimer ${s.name}`}
                    >
                      Suppr.
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="small muted center">
        Les données sont enregistrées dans ce navigateur. Exportez régulièrement pour les
        conserver ou les transférer sur un autre appareil.
      </p>
    </>
  )
}
