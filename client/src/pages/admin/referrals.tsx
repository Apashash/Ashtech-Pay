import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { getAdminPath } from "@/lib/adminPath";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Search, Users, RefreshCw, Loader2, ShieldCheck, ShieldAlert, CalendarDays,
  CircleCheck, CircleX, Clock3, Sparkles, UserRound,
} from "lucide-react";

interface ReferralAccount {
  userId: string;
  username: string;
  kycVerified: boolean;
  code: string;
  startsAt: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  referrerUsername: string | null;
  completedTransactions: number;
  qualifiedAt: string | null;
  qualifyingTransactions: { id: string; reference: string; type: string; confirmedAt: string | null; available: boolean }[];
}

interface AdminReferralsData {
  accounts: ReferralAccount[];
  serverNow: string;
}

type PromotionAction = "activate" | "cancel";

function displayDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function accountStatus(account: ReferralAccount, now: number) {
  if (account.cancelledAt) return { label: "Annulée", style: "bg-red-50 text-red-700 border-red-200", icon: CircleX };
  if (account.startsAt && account.expiresAt) {
    const start = new Date(account.startsAt).getTime();
    const end = new Date(account.expiresAt).getTime();
    if (start <= now && end > now) return { label: "Active", style: "bg-green-50 text-green-700 border-green-200", icon: CircleCheck };
    if (end <= now) return { label: "Terminée", style: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock3 };
    return { label: "Planifiée", style: "bg-amber-50 text-amber-700 border-amber-200", icon: CalendarDays };
  }
  if (account.qualifiedAt) return { label: "Admissible", style: "bg-[#eff4e6] text-[#526a3e] border-[#d7e2c6]", icon: Sparkles };
  return { label: "En attente", style: "bg-slate-100 text-slate-600 border-slate-200", icon: Clock3 };
}

export default function AdminReferralsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [serverClock, setServerClock] = useState(Date.now());
  const [selected, setSelected] = useState<{ account: ReferralAccount; action: PromotionAction } | null>(null);
  const [reason, setReason] = useState("");
  const queryUrl = `/api/admin/referrals?search=${encodeURIComponent(debouncedSearch.trim())}`;

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const {
    data, isLoading, isError, error, refetch, isFetching,
  } = useQuery<AdminReferralsData>({
    queryKey: ["/api/admin/referrals", debouncedSearch.trim()],
    queryFn: async () => {
      const response = await apiRequest("GET", queryUrl);
      return await response.json() as AdminReferralsData;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!data?.serverNow) return;
    const offset = new Date(data.serverNow).getTime() - Date.now();
    setServerClock(Date.now() + offset);
    const timer = window.setInterval(() => setServerClock(Date.now() + offset), 30_000);
    return () => window.clearInterval(timer);
  }, [data?.serverNow]);

  const promotionMutation = useMutation({
    mutationFn: async ({ userId, action, reason: actionReason }: { userId: string; action: PromotionAction; reason: string }) => {
      const response = await apiRequest("POST", `/api/admin/referrals/${encodeURIComponent(userId)}/promotion`, {
        action,
        reason: actionReason,
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/referrals"] });
      setSelected(null);
      setReason("");
      toast({
        title: variables.action === "activate" ? "Promotion activée" : "Promotion annulée",
        description: "La liste a été actualisée.",
      });
    },
    onError: (mutationError: Error) => {
      toast({ title: "Action impossible", description: mutationError.message || "Réessayez dans un instant.", variant: "destructive" });
    },
  });

  function submitAction(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !reason.trim()) return;
    promotionMutation.mutate({
      userId: selected.account.userId,
      action: selected.action,
      reason: reason.trim(),
    });
  }

  function openAction(account: ReferralAccount, action: PromotionAction) {
    setReason("");
    setSelected({ account, action });
  }

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Acquisition & avantages</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight" data-testid="text-page-title">Parrainages</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Rechercher les comptes, vérifier leur admissibilité et gérer la période promotionnelle.</p>
          </div>
          {data && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{data.accounts.length} résultat{data.accounts.length === 1 ? "" : "s"}</span>
            </div>
          )}
        </header>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <Label htmlFor="referral-search" className="mb-2 block text-sm font-medium">Rechercher un compte</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="referral-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nom d’utilisateur, code ou parrain…"
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching} aria-label="Actualiser les comptes">
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">La recherche est appliquée à tous les comptes renvoyés par le serveur.</p>
        </section>

        <section aria-label="Comptes de parrainage" className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {isLoading ? (
            <div className="space-y-3 p-5" aria-label="Chargement des comptes">
              {[1, 2, 3].map((item) => <div key={item} className="h-[76px] animate-pulse rounded-xl bg-muted/70" />)}
            </div>
          ) : isError ? (
            <div role="alert" className="p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-700"><ShieldAlert className="h-6 w-6" /></div>
              <h2 className="mt-4 font-semibold">Impossible de charger les comptes</h2>
              <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Une erreur est survenue."}</p>
              <Button variant="outline" className="mt-4" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Réessayer
              </Button>
            </div>
          ) : data && data.accounts.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eff4e6] text-[#526a3e]"><Users className="h-6 w-6" /></div>
              <h2 className="mt-4 font-semibold">{debouncedSearch.trim() ? "Aucun compte trouvé" : "Aucun parrainage pour le moment"}</h2>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                {debouncedSearch.trim()
                  ? "Essayez un autre nom d’utilisateur, code de parrainage ou nom de parrain."
                  : "Les comptes apparaîtront ici dès que des utilisateurs partageront leur lien ou seront référés."}
              </p>
            </div>
          ) : data ? (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/35 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th scope="col" className="px-5 py-3 font-semibold">Compte</th>
                      <th scope="col" className="px-5 py-3 font-semibold">Parrainage</th>
                      <th scope="col" className="px-5 py-3 font-semibold">Progression</th>
                      <th scope="col" className="px-5 py-3 font-semibold">Période</th>
                      <th scope="col" className="px-5 py-3 font-semibold">Statut</th>
                      <th scope="col" className="px-5 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.accounts.map((account) => {
                      const status = accountStatus(account, serverClock);
                      const StatusIcon = status.icon;
                      const active = status.label === "Active" || status.label === "Planifiée";
                      return (
                        <tr key={account.userId} className="align-top transition-colors hover:bg-muted/20">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#edf1f7] text-[#344b73]"><UserRound className="h-4 w-4" /></div>
                              <div className="min-w-0">
                                <p className="max-w-[170px] truncate font-medium">{account.username}</p>
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                  {account.kycVerified ? <ShieldCheck className="h-3.5 w-3.5 text-green-600" /> : <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />}
                                  {account.kycVerified ? "Vérifié" : "Non vérifié"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium">{account.referrerUsername || "Sans parrain"}</p>
                            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{account.code}</p>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium">{account.completedTransactions} opération{account.completedTransactions === 1 ? "" : "s"}</p>
                            <details className="mt-1 text-xs">
                              <summary className="cursor-pointer">Transactions admissibles</summary>
                              <ul className="mt-1 space-y-1">{account.qualifyingTransactions.map(tx => (
                                <li key={tx.id}>{tx.available ? <a className="underline" href={`${getAdminPath()}/transactions/${encodeURIComponent(tx.id)}`}>{tx.reference || tx.id}</a> : <span>{tx.reference || tx.id} (historique archivé)</span>} · {tx.type === "deposit" ? "Dépôt" : "Retrait"} · {displayDate(tx.confirmedAt)}</li>
                              ))}</ul>
                            </details>
                            <p className="mt-0.5 text-xs text-muted-foreground">{account.qualifiedAt ? `Admissible depuis le ${displayDate(account.qualifiedAt)}` : "3 opérations requises"}</p>
                          </td>
                          <td className="px-5 py-4 text-xs leading-5 text-muted-foreground">
                            <p>Début : {displayDate(account.startsAt)}</p>
                            <p>Fin : {displayDate(account.expiresAt)}</p>
                            {account.cancelledAt && <p className="text-red-700">Annulée : {displayDate(account.cancelledAt)}</p>}
                          </td>
                          <td className="px-5 py-4">
                            <Badge variant="outline" className={`gap-1 whitespace-nowrap ${status.style}`}><StatusIcon className="h-3.5 w-3.5" />{status.label}</Badge>
                          </td>
                          <td className="px-5 py-4 text-right">
                            {active ? (
                              <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => openAction(account, "cancel")}>Annuler</Button>
                            ) : (
                              <Button size="sm" onClick={() => openAction(account, "activate")} disabled={!account.kycVerified}>
                                Activer
                              </Button>
                            )}
                            {!account.kycVerified && !active && <p className="mt-1 text-right text-[11px] text-muted-foreground">Vérification requise</p>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-border md:hidden">
                {data.accounts.map((account) => {
                  const status = accountStatus(account, serverClock);
                  const StatusIcon = status.icon;
                  const active = status.label === "Active" || status.label === "Planifiée";
                  return (
                    <article key={account.userId} className="space-y-4 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{account.username}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{account.referrerUsername ? `Parrainé par ${account.referrerUsername}` : "Sans parrain"}</p>
                        </div>
                        <Badge variant="outline" className={`gap-1 whitespace-nowrap ${status.style}`}><StatusIcon className="h-3.5 w-3.5" />{status.label}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/35 p-3 text-xs">
                        <div><p className="text-muted-foreground">Vérification</p><p className="mt-1 font-medium">{account.kycVerified ? "Vérifié" : "Non vérifié"}</p></div>
                        <div><p className="text-muted-foreground">Opérations</p><p className="mt-1 font-medium">{account.completedTransactions} · {account.qualifiedAt ? "Admissible" : "3 requises"}</p></div>
                        <div><p className="text-muted-foreground">Début</p><p className="mt-1 font-medium">{displayDate(account.startsAt)}</p></div>
                        <div><p className="text-muted-foreground">Fin</p><p className="mt-1 font-medium">{displayDate(account.expiresAt)}</p></div>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">Code : {account.code}</p>
                      <details className="text-xs"><summary className="cursor-pointer">Transactions admissibles</summary>
                        <ul className="mt-2 space-y-2">{account.qualifyingTransactions.map(tx => (
                          <li key={tx.id}>{tx.available ? <a className="underline" href={`${getAdminPath()}/transactions/${encodeURIComponent(tx.id)}`}>{tx.reference || tx.id}</a> : <span>{tx.reference || tx.id} (historique archivé)</span>} · {tx.type === "deposit" ? "Dépôt" : "Retrait"} · {displayDate(tx.confirmedAt)}</li>
                        ))}</ul>
                      </details>
                      {active ? (
                        <Button variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50" onClick={() => openAction(account, "cancel")}>Annuler la promotion</Button>
                      ) : (
                        <Button className="w-full" onClick={() => openAction(account, "activate")} disabled={!account.kycVerified}>
                          Activer la promotion
                        </Button>
                      )}
                      {!account.kycVerified && !active && <p className="text-center text-xs text-muted-foreground">La vérification du compte est requise avant activation.</p>}
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Chargement…</div>
          )}
        </section>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open && !promotionMutation.isPending) setSelected(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.action === "activate" ? "Activer la promotion" : "Annuler la promotion"}</DialogTitle>
            <DialogDescription>
              {selected?.action === "activate"
                ? `La promotion de ${selected.account.username} commencera après confirmation.`
                : `La période promotionnelle de ${selected?.account.username} sera annulée.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitAction} className="space-y-4">
            <div className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Compte : </span><span className="font-medium">{selected?.account.username}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="promotion-reason">Motif obligatoire</Label>
              <Textarea
                id="promotion-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Indiquez le motif de cette décision…"
                rows={3}
                maxLength={500}
                required
              />
              <p className="text-right text-xs text-muted-foreground">{reason.length}/500</p>
            </div>
            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="outline" onClick={() => setSelected(null)} disabled={promotionMutation.isPending}>Retour</Button>
              <Button
                type="submit"
                variant={selected?.action === "cancel" ? "destructive" : "default"}
                disabled={reason.trim().length < 5 || promotionMutation.isPending || (selected?.action === "activate" && !selected.account.kycVerified)}
              >
                {promotionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selected?.action === "activate" ? "Confirmer l’activation" : "Confirmer l’annulation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
