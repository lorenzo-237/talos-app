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
  canBuildProd: boolean
  canBuildTest: boolean
  canBuildDev: boolean
  canReadPackages: boolean
  canWritePackages: boolean
  canDeletePackages: boolean
  canReadExplorer: boolean
  canWriteExplorer: boolean
  canDeleteExplorer: boolean
  canViewHistory: boolean
  canReadReleases: boolean
  canMoveReleases: boolean
  canDeleteReleases: boolean
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
  canBuildProd: true,
  canBuildTest: true,
  canBuildDev: true,
  canReadPackages: true,
  canWritePackages: true,
  canDeletePackages: true,
  canReadExplorer: true,
  canWriteExplorer: true,
  canDeleteExplorer: true,
  canViewHistory: true,
  canReadReleases: true,
  canMoveReleases: true,
  canDeleteReleases: true,
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
      canBuildProd: false,
      canBuildTest: false,
      canBuildDev: false,
      canReadPackages: false,
      canWritePackages: false,
      canDeletePackages: false,
      canReadExplorer: false,
      canWriteExplorer: false,
      canDeleteExplorer: false,
      canViewHistory: false,
      canReadReleases: false,
      canMoveReleases: false,
      canDeleteReleases: false,
    }
  }

  return {
    canBuildProd: codes.has("talos-build-prod"),
    canBuildTest: codes.has("talos-build-test"),
    canBuildDev: codes.has("talos-build-dev"),
    canReadPackages: codes.has("talos-pkg-read"),
    canWritePackages: codes.has("talos-pkg-write"),
    canDeletePackages: codes.has("talos-pkg-delete"),
    canReadExplorer: codes.has("talos-exp-read"),
    canWriteExplorer: codes.has("talos-exp-write"),
    canDeleteExplorer: codes.has("talos-exp-delete"),
    canViewHistory: codes.has("talos-history"),
    canReadReleases: codes.has("talos-releases-read"),
    canMoveReleases: codes.has("talos-releases-move"),
    canDeleteReleases: codes.has("talos-releases-delete"),
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
