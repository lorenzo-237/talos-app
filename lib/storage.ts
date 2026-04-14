/**
 * Utilitaire centralisé pour le localStorage
 * Toutes les clés de persistance de l'application passent par ici.
 *
 * Deux catégories :
 *  - Globales  : indépendantes du projet (ex. projet sélectionné)
 *  - Par projet : préfixées par l'id du projet
 */

const PREFIX = "talos"

function globalKey(name: string): string {
  return `${PREFIX}_${name}`
}

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // localStorage non disponible
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // localStorage non disponible
  }
}

export const storage = {}
