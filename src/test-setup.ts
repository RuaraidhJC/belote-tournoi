import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

/**
 * Node 25 expose un `localStorage` expérimental qui masque celui de jsdom
 * par un objet vide, sans `getItem` ni `clear`. On installe donc une
 * implémentation mémoire conforme, remise à zéro avant chaque test.
 */
class MemoryStorage implements Storage {
  #data = new Map<string, string>()

  get length(): number {
    return this.#data.size
  }

  clear(): void {
    this.#data.clear()
  }

  getItem(key: string): string | null {
    return this.#data.get(String(key)) ?? null
  }

  key(index: number): string | null {
    return [...this.#data.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.#data.delete(String(key))
  }

  setItem(key: string, value: string): void {
    this.#data.set(String(key), String(value))
  }
}

const storage = new MemoryStorage()

for (const target of [globalThis, globalThis.window].filter(Boolean)) {
  Object.defineProperty(target, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  })
}

beforeEach(() => {
  storage.clear()
})

// `globals` étant désactivé, le nettoyage automatique de Testing Library
// ne s'enregistre pas : on démonte explicitement entre deux tests.
afterEach(cleanup)
