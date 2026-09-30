/** État du tournoi courant, persisté à chaque modification. */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Tournament } from '../domain/types'
import { store } from '../storage/localStore'
import type { TournamentSummary } from '../storage/types'

export function useTournamentList(): {
  summaries: TournamentSummary[]
  reload: () => Promise<void>
} {
  const [summaries, setSummaries] = useState<TournamentSummary[]>([])

  const reload = useCallback(async () => {
    setSummaries(await store.listTournaments())
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return { summaries, reload }
}

/**
 * `missing` distingue « pas encore chargé » de « introuvable ».
 * Sans cette distinction, l'appelant refermerait le tournoi pendant
 * le chargement, avant même que le stockage ait répondu.
 */
export type TournamentStatus = 'idle' | 'loading' | 'loaded' | 'missing'

export interface TournamentHandle {
  tournament: Tournament | null
  status: TournamentStatus
  error: string | null
  /** Applique une transformation pure et enregistre le résultat. */
  apply: (fn: (t: Tournament) => Tournament) => void
  clearError: () => void
}

export function useTournament(id: string | null): TournamentHandle {
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [status, setStatus] = useState<TournamentStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const requestedId = useRef<string | null>(null)

  useEffect(() => {
    requestedId.current = id
    if (!id) {
      setTournament(null)
      setStatus('idle')
      return
    }

    setStatus('loading')
    void store
      .getTournament(id)
      .then((loaded) => {
        // Une navigation plus récente a pu changer de tournoi entre-temps.
        if (requestedId.current !== id) return
        setTournament(loaded)
        setStatus(loaded ? 'loaded' : 'missing')
      })
      .catch((e: unknown) => {
        if (requestedId.current !== id) return
        setError(e instanceof Error ? e.message : String(e))
        setStatus('missing')
      })
  }, [id])

  const apply = useCallback((fn: (t: Tournament) => Tournament) => {
    setError(null)
    setTournament((previous) => {
      if (!previous) return previous
      try {
        const next = fn(previous)
        void store.saveTournament(next).catch((e: unknown) => setError(String(e)))
        return next
      } catch (e: unknown) {
        // Les règles du domaine remontent leurs refus ici : on conserve
        // l'état précédent intact et on affiche le motif.
        setError(e instanceof Error ? e.message : String(e))
        return previous
      }
    })
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { tournament, status, error, apply, clearError }
}
