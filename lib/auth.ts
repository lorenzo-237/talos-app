export const AUTH_TOKEN_COOKIE = "talos_token"
export const REFRESH_TOKEN_COOKIE = "talos_refresh"

export const AUTH_TOKEN_MAX_AGE = 60 * 60 * 24 // 24h
export const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 7 // 7j

export interface UserProfile {
  uid: string
  displayName: string
  mail: string
  initials: string
}

export interface UserRights {
  canBuild: boolean
  canReadPackages: boolean
  canWritePackages: boolean
  canDeletePackages: boolean
  canReadExplorer: boolean
  canWriteExplorer: boolean
  canDeleteExplorer: boolean
  canViewHistory: boolean
}

export interface AuthUser {
  profile: UserProfile
  rights: UserRights
  isAdmin: boolean
}

// Raw response from GET /api/v1/users/me
export interface UserMeResponse {
  uid: string[]
  displayName: string[]
  mail: string[]
  initials: string[]
  adsion_droitsMps: string[]
  profiles: { api: Array<{ isAdmin: boolean }> } | null
  isAdmin: boolean
  isSuperuser: boolean
}

const ALL_RIGHTS: UserRights = {
  canBuild: true,
  canReadPackages: true,
  canWritePackages: true,
  canDeletePackages: true,
  canReadExplorer: true,
  canWriteExplorer: true,
  canDeleteExplorer: true,
  canViewHistory: true,
}

export function deriveRights(me: UserMeResponse): UserRights {
  const isGlobalAdmin =
    me.isAdmin ||
    me.isSuperuser ||
    (me.profiles?.api?.some((p) => p.isAdmin) ?? false)

  if (isGlobalAdmin) return { ...ALL_RIGHTS }

  const codes = new Set(me.adsion_droitsMps ?? [])
  // talos-read = droit d'accès de base ; sans lui, aucune fonctionnalité
  if (!codes.has("talos-read")) {
    return {
      canBuild: false,
      canReadPackages: false,
      canWritePackages: false,
      canDeletePackages: false,
      canReadExplorer: false,
      canWriteExplorer: false,
      canDeleteExplorer: false,
      canViewHistory: false,
    }
  }

  return {
    canBuild: codes.has("talos-build"),
    canReadPackages: codes.has("talos-pkg-read"),
    canWritePackages: codes.has("talos-pkg-write"),
    canDeletePackages: codes.has("talos-pkg-delete"),
    canReadExplorer: codes.has("talos-exp-read"),
    canWriteExplorer: codes.has("talos-exp-write"),
    canDeleteExplorer: codes.has("talos-exp-delete"),
    canViewHistory: codes.has("talos-history"),
  }
}

export function hasAnyRight(rights: UserRights): boolean {
  return Object.values(rights).some(Boolean)
}

export function buildAuthUser(me: UserMeResponse): AuthUser {
  return {
    profile: {
      uid: me.uid[0] ?? "",
      displayName: me.displayName[0] ?? "",
      mail: me.mail[0] ?? "",
      initials: me.initials[0] ?? "",
    },
    rights: deriveRights(me),
    isAdmin: me.isAdmin || me.isSuperuser,
  }
}
