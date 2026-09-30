/** Modèle de données du tournoi. Tout est sérialisable en JSON. */

export type Id = string

export type Suit = 'pique' | 'coeur' | 'carreau' | 'trefle'

export const SUITS: readonly Suit[] = ['pique', 'coeur', 'carreau', 'trefle']

export const SUIT_LABELS: Record<Suit, string> = {
  pique: '♠ Pique',
  coeur: '♥ Cœur',
  carreau: '♦ Carreau',
  trefle: '♣ Trèfle',
}

/** Un joueur. L'id est stable entre tournois : c'est la clé des statistiques. */
export interface Player {
  id: Id
  name: string
  createdAt: string
}

/**
 * Une équipe de 2 joueurs, propre à un tournoi.
 * Le nom des joueurs est recopié ici pour qu'un tournoi exporté
 * reste lisible sans le registre global des joueurs.
 */
export interface Team {
  id: Id
  name: string
  players: { id: Id; name: string }[]
}

/** Contrat annoncé : 80 à 180 par tranches de 10, ou capot. */
export type Contract = number | 'capot'

export type Coinche = 'none' | 'contre' | 'surcontre'

/** Une donne, saisie via le calculateur optionnel. */
export interface Donne {
  id: Id
  contract: Contract
  suit: Suit
  /** Équipe preneuse. */
  takerTeamId: Id
  /** Points faits aux cartes par le preneur, 0 à 162 (10 de der inclus). */
  takerCardPoints: number
  coinche: Coinche
  /** Équipe détenant la belote-rebelote, ou null. */
  beloteTeamId: Id | null
  /** Le preneur a-t-il ramassé les 8 plis. */
  capotRealized: boolean
}

export type MatchKind = 'swiss' | 'semifinal' | 'final'

/**
 * Une partie. `teamBId` à null signifie que `teamAId` est exempte
 * (nombre impair d'équipes) : elle marque une victoire.
 */
export interface Match {
  id: Id
  kind: MatchKind
  /** Numéro de manche pour les rondes suisses, 1-indexé. */
  roundNumber: number
  teamAId: Id
  teamBId: Id | null
  scoreA: number
  scoreB: number
  /** Pénalités de retard, en points négatifs (200 par tranche de 5 min). */
  penaltyA: number
  penaltyB: number
  /** Équipe déclarée forfait (30 min de retard) : goal average de -1001. */
  forfaitTeamId: Id | null
  /** Détail donne par donne si le calculateur a été utilisé. */
  donnes: Donne[]
  /** Un match sans score saisi reste `pending` et ne compte pas au classement. */
  status: 'pending' | 'done'
}

export interface Round {
  number: number
  kind: MatchKind
  matches: Match[]
  /** Horodatage de création de l'appariement. */
  createdAt: string
}

export interface TournamentConfig {
  /** Nombre de manches de qualification (3 dans le règlement de référence). */
  swissRounds: number
  /** Phase finale après les rondes suisses. */
  playoff: 'none' | 'top4'
  /** Pénalité de retard, en points, par tranche de 5 minutes. */
  latePenaltyPer5Min: number
  /** Goal average infligé à une équipe forfait. */
  forfaitGoalAverage: number
}

export const DEFAULT_CONFIG: TournamentConfig = {
  swissRounds: 3,
  playoff: 'top4',
  latePenaltyPer5Min: 200,
  forfaitGoalAverage: 1001,
}

export interface Tournament {
  id: Id
  name: string
  /** Date du tournoi, ISO court (AAAA-MM-JJ). */
  date: string
  createdAt: string
  updatedAt: string
  config: TournamentConfig
  teams: Team[]
  rounds: Round[]
}

/** Ligne de classement, recalculée depuis les matchs — jamais stockée. */
export interface Standing {
  teamId: Id
  teamName: string
  /** Victoires ; un match nul vaut 0,5. */
  wins: number
  losses: number
  draws: number
  byes: number
  /** Somme des différentiels de points. */
  goalAverage: number
  pointsFor: number
  pointsAgainst: number
  played: number
  /** Ids des équipes déjà rencontrées, pour éviter les revanches. */
  opponentIds: Id[]
  rank: number
}
