/**
 * Parcours complet de l'application : création du tournoi, inscription
 * des équipes, tirage des manches, saisie des scores, classement.
 */

import { describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

async function createTournamentWithTeams(teamNames: string[][]) {
  const user = userEvent.setup()
  render(<App />)

  await user.type(screen.getByLabelText('Nom'), 'Tournoi du vendredi')
  await user.clear(screen.getByLabelText('Manches de qualification'))
  await user.type(screen.getByLabelText('Manches de qualification'), '2')
  await user.click(screen.getByRole('button', { name: 'Créer le tournoi' }))

  await user.click(await screen.findByRole('tab', { name: 'Équipes' }))

  for (const [a, b] of teamNames) {
    await user.type(screen.getByLabelText('Joueur 1'), a!)
    await user.type(screen.getByLabelText('Joueur 2'), b!)
    await user.click(screen.getByRole('button', { name: "Ajouter l'équipe" }))
  }

  return user
}

describe('parcours complet', () => {
  it('crée un tournoi, inscrit des équipes et les affiche', async () => {
    await createTournamentWithTeams([
      ['Alice', 'Bob'],
      ['Chloé', 'David'],
    ])

    expect(screen.getByText('2 équipe(s)')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Alice / Bob')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Chloé / David')).toBeInTheDocument()
  })

  it('tire une manche, saisit un score et met à jour le classement', async () => {
    const user = await createTournamentWithTeams([
      ['Alice', 'Bob'],
      ['Chloé', 'David'],
      ['Emma', 'Farid'],
      ['Gwen', 'Hugo'],
    ])

    await user.click(screen.getByRole('tab', { name: 'Manches' }))
    await user.click(screen.getByRole('button', { name: 'Tirer la manche 1' }))

    const saisir = screen.getAllByRole('button', { name: 'Saisir le score' })
    expect(saisir).toHaveLength(2)

    // Première confrontation : 1250 à 910.
    await user.click(saisir[0]!)
    const dialog = screen.getByRole('dialog')
    const inputs = within(dialog).getAllByRole('spinbutton')
    await user.clear(inputs[0]!)
    await user.type(inputs[0]!, '1250')
    await user.clear(inputs[1]!)
    await user.type(inputs[1]!, '910')
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(screen.getByText('1250')).toBeInTheDocument()
    expect(screen.getByText('910')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Classement' }))
    const leader = screen.getAllByRole('row')[1]!
    expect(within(leader).getByText('+340')).toBeInTheDocument()
  })

  it("empêche de tirer la manche suivante tant qu'un score manque", async () => {
    const user = await createTournamentWithTeams([
      ['Alice', 'Bob'],
      ['Chloé', 'David'],
    ])

    await user.click(screen.getByRole('tab', { name: 'Manches' }))
    await user.click(screen.getByRole('button', { name: 'Tirer la manche 1' }))

    expect(screen.getByRole('button', { name: 'Tournoi terminé' })).toBeDisabled()
    expect(screen.getByText(/scores de la manche 1 doivent être saisis/)).toBeInTheDocument()
  })

  it('affiche une équipe exempte sur un effectif impair', async () => {
    const user = await createTournamentWithTeams([
      ['Alice', 'Bob'],
      ['Chloé', 'David'],
      ['Emma', 'Farid'],
    ])

    await user.click(screen.getByRole('tab', { name: 'Manches' }))
    await user.click(screen.getByRole('button', { name: 'Tirer la manche 1' }))

    expect(screen.getByText('Exempte — 1 victoire')).toBeInTheDocument()
  })

  it('calcule le score depuis le calculateur de donne', async () => {
    const user = await createTournamentWithTeams([
      ['Alice', 'Bob'],
      ['Chloé', 'David'],
    ])

    await user.click(screen.getByRole('tab', { name: 'Manches' }))
    await user.click(screen.getByRole('button', { name: 'Tirer la manche 1' }))
    await user.click(screen.getByRole('button', { name: 'Saisir le score' }))

    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('tab', { name: 'Donne par donne' }))

    // Contrat à 100 réussi avec 110 points aux cartes → 210 pour le preneur.
    await user.selectOptions(within(dialog).getByLabelText('Contrat'), '100')
    await user.type(within(dialog).getByLabelText(/Points du preneur/), '110')
    expect(within(dialog).getByText('Contrat réussi')).toBeInTheDocument()
    expect(within(dialog).getByText('210 – 50')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Ajouter la donne' }))
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(screen.getByText('210')).toBeInTheDocument()
    expect(screen.getByText('1 donne(s) détaillée(s)')).toBeInTheDocument()
  })

  it('rouvre le dernier tournoi après un rechargement', async () => {
    const user = await createTournamentWithTeams([
      ['Alice', 'Bob'],
      ['Chloé', 'David'],
    ])
    await user.click(screen.getByRole('tab', { name: 'Manches' }))
    await user.click(screen.getByRole('button', { name: 'Tirer la manche 1' }))

    // Simule un rechargement de page : le stockage survit, pas le DOM.
    cleanup()
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Tournoi du vendredi' })).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: 'Manches' })).toBeInTheDocument()
  })
})
