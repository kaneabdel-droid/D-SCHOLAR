'use client'

import {
  findOfflineAccount,
  saveOfflineAccount,
  getOfflineAccounts,
  removeOfflineAccount,
  type OfflineStoredAccount,
} from './offline-storage'
import { normaliserIdentifiant } from '../auth-identifier'

export interface OfflineUserContext {
  userId: string
  nomComplet?: string | null
  identifiant: string
  telephone?: string | null
  email?: string | null
  role: string
  etablissementId: string
  etablissementNom: string
  gieId?: string
  gieNom?: string
  devise?: string
  permissions?: any
}

export interface OfflineSession {
  user: OfflineUserContext
  isOffline: boolean
  token: string
  createdAt: string
  expiresAt: number
}

const STORAGE_SESSION_KEY = 'demba_offline_dscholar_session'
const COOKIE_OFFLINE_KEY = 'demba_offline_active'

export function generateSalt(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const bytes = new Uint8Array(16)
    window.crypto.getRandomValues(bytes)
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

export async function hashPasswordWithSalt(password: string, salt: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    let hash = 0
    const str = `demba:${salt}:${password}`
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash).toString(16)
  }

  const encoder = new TextEncoder()
  const data = encoder.encode(`demba_salt:${salt}:${password}`)
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function cacheOfflineAccount(
  rawIdentifier: string,
  password: string,
  context: OfflineUserContext
): Promise<void> {
  if (!password || !rawIdentifier) return

  const salt = generateSalt()
  const passwordHash = await hashPasswordWithSalt(password, salt)

  const idList = [
    normaliserIdentifiant(rawIdentifier),
    context.identifiant ? normaliserIdentifiant(context.identifiant) : null,
    context.telephone ? normaliserIdentifiant(context.telephone) : null,
    context.email ? normaliserIdentifiant(context.email) : null,
  ].filter(Boolean) as string[]

  const uniqueIdentifiers = Array.from(new Set(idList))

  const account: OfflineStoredAccount = {
    id: context.userId,
    identifier: normaliserIdentifiant(rawIdentifier),
    identifiers: uniqueIdentifiers,
    salt,
    passwordHash,
    userContext: {
      ...context,
      etablissementId: context.etablissementId,
      etablissementNom: context.etablissementNom,
      gieId: context.gieId || context.etablissementId,
      gieNom: context.gieNom || context.etablissementNom,
    },
    lastLoginAt: new Date().toISOString(),
  }

  await saveOfflineAccount(account)
}

export async function verifyOfflineCredentials(
  identifierOrPhone: string,
  password: string
): Promise<{ success: boolean; session?: OfflineSession; error?: string }> {
  if (!identifierOrPhone || !identifierOrPhone.trim()) {
    return { success: false, error: "Veuillez renseigner votre identifiant, téléphone ou e-mail." }
  }
  if (!password) {
    return { success: false, error: "Veuillez renseigner votre mot de passe." }
  }

  const account = await findOfflineAccount(identifierOrPhone)
  if (!account) {
    return {
      success: false,
      error: "Ce compte n'est pas encore synchronisé pour la connexion hors-ligne sur cet appareil. Connectez-vous au moins une fois avec Internet.",
    }
  }

  const computedHash = await hashPasswordWithSalt(password, account.salt)
  if (computedHash !== account.passwordHash) {
    return {
      success: false,
      error: "Mot de passe incorrect pour le compte hors-ligne.",
    }
  }

  const now = Date.now()
  const context: OfflineUserContext = {
    userId: account.userContext.userId,
    nomComplet: account.userContext.nomComplet,
    identifiant: account.userContext.identifiant,
    telephone: account.userContext.telephone,
    email: account.userContext.email,
    role: account.userContext.role,
    etablissementId: account.userContext.etablissementId || account.userContext.gieId || '',
    etablissementNom: account.userContext.etablissementNom || account.userContext.gieNom || 'Mon Établissement',
    gieId: account.userContext.gieId || account.userContext.etablissementId,
    gieNom: account.userContext.gieNom || account.userContext.etablissementNom,
    devise: account.userContext.devise,
    permissions: account.userContext.permissions,
  }

  const session: OfflineSession = {
    user: context,
    isOffline: true,
    token: `demba_off_${now}_${Math.random().toString(36).substring(2, 9)}`,
    createdAt: new Date().toISOString(),
    expiresAt: now + 30 * 24 * 60 * 60 * 1000,
  }

  setOfflineSession(session)

  account.lastLoginAt = new Date().toISOString()
  await saveOfflineAccount(account)

  return { success: true, session }
}

export function setOfflineSession(session: OfflineSession): void {
  if (typeof window === 'undefined') return

  try {
    const raw = JSON.stringify(session)
    sessionStorage.setItem(STORAGE_SESSION_KEY, raw)
    localStorage.setItem(STORAGE_SESSION_KEY, raw)
    document.cookie = `${COOKIE_OFFLINE_KEY}=1; path=/; max-age=2592000; SameSite=Lax`
  } catch (e) {
    console.error('Erreur stockage session hors-ligne D-SCHOLAR:', e)
  }
}

export function getOfflineSession(): OfflineSession | null {
  if (typeof window === 'undefined') return null

  try {
    let raw = sessionStorage.getItem(STORAGE_SESSION_KEY)
    if (!raw) raw = localStorage.getItem(STORAGE_SESSION_KEY)
    if (!raw) return null

    const session: OfflineSession = JSON.parse(raw)
    if (session.expiresAt && Date.now() > session.expiresAt) {
      clearOfflineSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function clearOfflineSession(): void {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.removeItem(STORAGE_SESSION_KEY)
    localStorage.removeItem(STORAGE_SESSION_KEY)
    document.cookie = `${COOKIE_OFFLINE_KEY}=; path=/; max-age=0`
  } catch {}
}
