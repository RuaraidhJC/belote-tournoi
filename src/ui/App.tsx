/** Coquille de l'application : sélection du tournoi et navigation par onglets. */

import { useEffect, useState } from 'react'
import { RoundsView } from './RoundsView'
import { SetupView } from './SetupView'
import { StandingsView } from './StandingsView'
import { StatsView } from './StatsView'
import { TournamentList } from './TournamentList'
import { useTournament, useTournamentList } from './useTournament'

type Tab = 'teams' | 'rounds' | 'standings' | 'stats'

const TABS: { id: Tab; label: string }[] = [
  { id: 'teams', label: 'Équipes' },
  { id: 'rounds', label: 'Manches' },
  { id: 'standings', label: 'Classement' },
  { id: 'stats', label: 'Statistiques' },
]

/** Le tournoi ouvert est mémorisé pour survivre à un rafraîchissement. */
const LAST_OPENED_KEY = 'belote:lastOpened'

function readLastOpened(): string | null {
  try {
    return localStorage.getItem(LAST_OPENED_KEY)
  } catch {
    return null
  }
}

export function App() {
  const [openId, setOpenId] = useState<string | null>(readLastOpened)
  const [tab, setTab] = useState<Tab>('rounds')
  const { summaries, reload } = useTournamentList()
  const { tournament, status, error, apply, clearError } = useTournament(openId)

  useEffect(() => {
    try {
      if (openId) localStorage.setItem(LAST_OPENED_KEY, openId)
      else localStorage.removeItem(LAST_OPENED_KEY)
    } catch {
      // Navigation privée : on continue sans mémoriser.
    }
  }, [openId])

  // Un tournoi supprimé entre deux sessions ne doit pas bloquer l'écran.
  useEffect(() => {
    if (status === 'missing') setOpenId(null)
  }, [status])

  function close() {
    setOpenId(null)
    void reload()
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="grow">
          <h1 style={{ margin: 0 }}>{tournament ? tournament.name : 'Tournoi de belote'}</h1>
          <div className="subtitle">
            {tournament
              ? `${tournament.date} · ${tournament.teams.length} équipes · ${tournament.config.swissRounds} manches`
              : 'Belote contrée en rondes suisses'}
          </div>
        </div>
        {tournament && (
          <button className="btn btn-sm" onClick={close}>
            Changer de tournoi
          </button>
        )}
      </header>

      {error && (
        <div className="banner banner-error" onClick={clearError} role="alert">
          {error}
          <button className="btn btn-sm" style={{ marginLeft: 12 }} onClick={clearError}>
            Fermer
          </button>
        </div>
      )}

      {!tournament ? (
        <TournamentList summaries={summaries} onOpen={setOpenId} onChanged={reload} />
      ) : (
        <>
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {tab === 'teams' && <SetupView tournament={tournament} apply={apply} />}
          {tab === 'rounds' && <RoundsView tournament={tournament} apply={apply} />}
          {tab === 'standings' && <StandingsView tournament={tournament} />}
          {tab === 'stats' && <StatsView />}
        </>
      )}
    </div>
  )
}
