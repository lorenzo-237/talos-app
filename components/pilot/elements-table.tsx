"use client"

import * as React from "react"
import { FolderInput, Info, Trash2, CheckCheck } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  ETAT_CLASS,
  ETAT_LABELS,
  type ElementModel,
  type EtatVersion,
} from "@/types/pilot"

// ── Shared helpers ────────────────────────────────────────────────────────────

export function first(arr: string[] | undefined): string {
  return arr?.[0] ?? "—"
}

export function EtatBadge({ etat }: { etat: EtatVersion | undefined }) {
  if (etat === undefined) return null
  return (
    <span
      className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${ETAT_CLASS[etat]}`}
    >
      {ETAT_LABELS[etat]}
    </span>
  )
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-x-3 gap-y-0.5 items-baseline border-b py-1.5 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm break-all">{value ?? "—"}</span>
    </div>
  )
}

function ElementDetailModal({
  el,
  open,
  onClose,
}: {
  el: ElementModel
  open: boolean
  onClose: () => void
}) {
  const etat = el.adsion_etatVersion[0]

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {el.id}
            {first(el.adsion_numVersion) !== "—" && (
              <span className="font-mono text-sm text-muted-foreground">
                v{first(el.adsion_numVersion)}
              </span>
            )}
          </DialogTitle>
          {el.description[0] && (
            <p className="text-sm text-muted-foreground">{el.description[0]}</p>
          )}
        </DialogHeader>

        <div className="mt-2 space-y-4">
          {/* Identification */}
          <section>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Identification
            </p>
            <DetailRow label="État" value={etat !== undefined ? <EtatBadge etat={etat} /> : "—"} />
            <DetailRow label="Type" value={first(el.adsion_type)} />
            <DetailRow label="Sous-type" value={first(el.adsion_sousType)} />
            <DetailRow label="Version min." value={first(el.adsion_medocversionMinimale)} />
            <DetailRow label="Checksum" value={
              first(el.adsion_chksum) !== "—"
                ? <span className="font-mono text-xs">{first(el.adsion_chksum)}</span>
                : "—"
            } />
          </section>

          {/* Cible */}
          <section>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cible
            </p>
            <DetailRow label="Répertoire" value={
              <span className="font-mono text-xs">{first(el.adsion_repertoireCible)}</span>
            } />
            <DetailRow label="Table cible" value={first(el.adsion_tableCible)} />
            <DetailRow label="Type installeur" value={first(el.adsion_typeInstalleur)} />
          </section>

          {/* Flags */}
          <section>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Flags
            </p>
            <DetailRow
              label="Suppression"
              value={
                el.isDelete
                  ? <span className="flex items-center gap-1 text-destructive"><Trash2 className="size-3.5" /> Oui</span>
                  : "Non"
              }
            />
            <DetailRow label="Background" value={el.background ? "Oui" : "Non"} />
            <DetailRow
              label="Unique"
              value={
                el.unique
                  ? <span className="flex items-center gap-1"><CheckCheck className="size-3.5" /> Oui</span>
                  : "Non"
              }
            />
            {el.forces.length > 0 && (
              <DetailRow label="Forces" value={el.forces.join(", ")} />
            )}
          </section>

          {/* FTP */}
          {(first(el.adsion_adresseFTP) !== "—" || first(el.adsion_loginFTP) !== "—") && (
            <section>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                FTP
              </p>
              <DetailRow label="Adresse" value={first(el.adsion_adresseFTP)} />
              <DetailRow label="Login" value={first(el.adsion_loginFTP)} />
              <DetailRow label="Chemin" value={
                <span className="font-mono text-xs">{first(el.adsion_cheminFTP)}</span>
              } />
            </section>
          )}

          {/* OctConf */}
          {(first(el.numfact_bsOctappli) !== "—" || first(el.numfact_bsOctadresse) !== "—") && (
            <section>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                OctConf
              </p>
              <DetailRow label="Application" value={first(el.numfact_bsOctappli)} />
              <DetailRow label="Adresse" value={first(el.numfact_bsOctadresse)} />
              <DetailRow label="Type dest." value={first(el.numfact_bsOcttypedest)} />
              <DetailRow label="Num dest." value={el.numfact_bsOctnumdest[0] ?? "—"} />
              <DetailRow label="Mode" value={el.numfact_bsOctmode[0] ?? "—"} />
              <DetailRow
                label="Trans. unique"
                value={el.numfact_bsOcttransunique[0] !== undefined
                  ? el.numfact_bsOcttransunique[0] ? "Oui" : "Non"
                  : "—"}
              />
            </section>
          )}

          {/* Certificat */}
          {first(el.adsion_certificatdn) !== "—" && (
            <section>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Certificat
              </p>
              <DetailRow label="DN" value={
                <span className="font-mono text-xs break-all">{first(el.adsion_certificatdn)}</span>
              } />
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Table ─────────────────────────────────────────────────────────────────────

interface ElementsTableProps {
  elements: ElementModel[]
}

export function ElementsTable({ elements }: ElementsTableProps) {
  const [selected, setSelected] = React.useState<ElementModel | null>(null)

  return (
    <>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Élément</TableHead>
              <TableHead>Type / Sous-type</TableHead>
              <TableHead>État</TableHead>
              <TableHead>
                <span className="flex items-center gap-1">
                  <FolderInput className="size-3.5" />
                  Répertoire cible
                </span>
              </TableHead>
              <TableHead>Version min</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {elements.map((el) => {
              const type = first(el.adsion_type)
              const sousType = el.adsion_sousType[0]
              const cible = first(el.adsion_repertoireCible)
              const etat = el.adsion_etatVersion[0]
              const verMin = el.adsion_medocversionMinimale[0]
              const numVersion = first(el.adsion_numVersion)

              return (
                <TableRow key={el.dn}>
                  {/* Élément + version */}
                  <TableCell>
                    <p className="font-medium leading-tight">{el.id}</p>
                    {numVersion !== "—" && (
                      <p className="font-mono text-xs text-muted-foreground">
                        v{numVersion}
                      </p>
                    )}
                    {el.description[0] && (
                      <p className="max-w-48 truncate text-xs italic text-muted-foreground">
                        {el.description[0]}
                      </p>
                    )}
                  </TableCell>

                  {/* Type / Sous-type */}
                  <TableCell className="text-muted-foreground">
                    {type !== "—" ? (
                      <>
                        {type}
                        {sousType && (
                          <span className="text-muted-foreground/60">
                            {" / "}
                            {sousType}
                          </span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>

                  {/* État */}
                  <TableCell>
                    {etat !== undefined ? <EtatBadge etat={etat} /> : "—"}
                  </TableCell>

                  {/* Répertoire cible */}
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {cible}
                  </TableCell>

                  {/* Version min */}
                  <TableCell className="text-muted-foreground">
                    {verMin ?? "—"}
                  </TableCell>

                  {/* Detail button */}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setSelected(el)}
                      aria-label="Détail"
                    >
                      <Info className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {selected && (
        <ElementDetailModal
          el={selected}
          open={true}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
