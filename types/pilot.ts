// ── Base ──────────────────────────────────────────────────────────────────────

/**
 * Modèle de base commun à toutes les entrées LDAP.
 * Retourné dans OuNodeDto.children pour chaque enfant direct.
 */
export interface BaseLdapModel {
  /** Distinguished Name LDAP complet */
  dn: string
  /** Identifiant court (valeur de uid= ou ou= selon le type) */
  id: string
  /** objectClass LDAP — permet de distinguer le type d'entrée */
  types: string[]
}

/**
 * Étend BaseLdapModel. Retourné dans OuNodeDto.node (l'OU courante).
 */
export interface LdapOrganizationalUnit extends BaseLdapModel {
  ou: string[]
  description: string[]
}

/**
 * Structure retournée par GET /logiciels et GET /logiciels/{slug}.
 * node = l'OU courante, children = ses enfants directs.
 *
 * Pour distinguer les types d'enfants, inspecter children[].types :
 *   - "organizationalUnit"   → sous-dossier logiciel, naviguer via slug
 *   - "versionMedocAdsion"   → version, détail via GET /versions/{uid}
 */
export interface OuNodeDto {
  node: LdapOrganizationalUnit
  children: BaseLdapModel[]
}

// ── Versions ──────────────────────────────────────────────────────────────────

/** 0 = bêta, 1 = test, 2 = prod */
export type EtatVersion = 0 | 1 | 2

export const ETAT_LABELS: Record<EtatVersion, string> = {
  0: "Bêta",
  1: "Test",
  2: "Prod",
}

export const ETAT_CLASS: Record<EtatVersion, string> = {
  0: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  1: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
  2: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
}

/** Retourné par GET /logiciels/{slug}/versions/{uid} */
export interface VersionModel extends BaseLdapModel {
  adsion_etatVersion: EtatVersion[]
  adsion_numVersion: string[]
  adsion_loginFTP: string[]
  adsion_mdpFTP: string[]
  adsion_adresseFTP: string[]
  adsion_cheminFTP: string[]
  adsion_element: string[]
}

export interface VersionResponseDto {
  count: number
  rows: VersionModel[]
}

// ── Éléments ──────────────────────────────────────────────────────────────────

/** Retourné par GET /logiciels/{slug}/versions/{uid}/elements */
export interface ElementModel extends BaseLdapModel {
  // Identifiants
  adsion_numVersion: string[]
  adsion_etatVersion: EtatVersion[]
  adsion_element: string[]

  // Cible
  adsion_tableCible: string[]
  adsion_type: string[]
  adsion_sousType: string[]
  adsion_medocversionMinimale: string[]
  adsion_chksum: string[]
  adsion_repertoireCible: string[]
  adsion_typeInstalleur: string[]
  description: string[]

  // Flags
  background: boolean
  unique: boolean
  isDelete: boolean
  forces: string[]

  // FTP
  adsion_loginFTP: string[]
  adsion_mdpFTP: string[]
  adsion_adresseFTP: string[]
  adsion_cheminFTP: string[]

  // OctConf
  numfact_bsOcttypedest: string[]
  numfact_bsOcttransunique: boolean[]
  numfact_bsOctnumdest: number[]
  numfact_bsOctmode: number[]
  numfact_bsOctappli: string[]
  numfact_bsOctadresse: string[]
  adsion_certificatdn: string[]
}

export interface ElementResponseDto {
  count: number
  rows: ElementModel[]
}

// ── Type guards ───────────────────────────────────────────────────────────────

export function isOu(child: BaseLdapModel): boolean {
  return child.types.includes("organizationalUnit")
}

export function isVersion(child: BaseLdapModel): boolean {
  return child.types.includes("versionMedocAdsion")
}
