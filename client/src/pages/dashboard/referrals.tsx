import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, Clock3, Copy, Link2, Loader2,
  RefreshCw, Share2, ShieldCheck, Users, WalletCards,
} from "lucide-react";

interface ReferralInvite {
  id: string;
  username: string;
  createdAt: string;
  kycVerified: boolean;
  completedTransactions: number;
  qualifiedAt: string | null;
}

interface ReferralData {
  code: string;
  serverNow: string;
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  promo: null | {
    startsAt: string;
    expiresAt: string;
    remainingSeconds: number;
  };
  invited: ReferralInvite[];
  rules: {
    durationDays: number;
    requiredTransactions: number;
    marginPercent: number;
    maxDiscountedOperations: number;
    maxVolumeMultiplier: number;
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

export default function ReferralsPage() {
  const { toast } = useToast();
  const [clock, setClock] = useState(() => Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [invitePage, setInvitePage] = useState(1);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ReferralData>({
    queryKey: ["/api/referrals/me", invitePage],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/referrals/me?page=${invitePage}`);
      return await response.json() as ReferralData;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data?.serverNow) setServerOffset(new Date(data.serverNow).getTime() - Date.now());
  }, [data?.serverNow]);

  useEffect(() => {
    if (data?.pagination && data.pagination.page !== invitePage) setInvitePage(data.pagination.page);
  }, [data?.pagination, invitePage]);

  const referralUrl = useMemo(
    () => data ? `${window.location.origin}/register?ref=${encodeURIComponent(data.code)}` : "",
    [data],
  );
  const remainingSeconds = useMemo(() => {
    if (!data?.promo) return 0;
    const expiresAt = new Date(data.promo.expiresAt).getTime();
    return Math.max(0, Math.floor((expiresAt - (clock + serverOffset)) / 1000));
  }, [clock, data, serverOffset]);
  const remainingDays = Math.floor(remainingSeconds / 86400);
  const remainingHours = Math.floor((remainingSeconds % 86400) / 3600);

  async function copyReferralLink() {
    try {
      await navigator.clipboard.writeText(referralUrl);
      toast({ title: "Lien copié", description: "Votre lien de parrainage est prêt à être partagé." });
    } catch {
      toast({ title: "Copie impossible", description: "Sélectionnez et copiez le lien manuellement.", variant: "destructive" });
    }
  }

  async function shareReferralLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "AshTech Pay",
          text: "Rejoignez-moi sur AshTech Pay avec mon lien de parrainage.",
          url: referralUrl,
        });
        return;
      } catch (shareError) {
        if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      }
    }
    await copyReferralLink();
  }

  return (
    <DashboardLayout>
      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6 pb-8">
        {isLoading ? (
          <section aria-label="Chargement des informations de parrainage" className="space-y-4">
            <div className="h-36 animate-pulse rounded-2xl bg-muted/70" />
            <div className="h-56 animate-pulse rounded-2xl bg-muted/70" />
          </section>
        ) : isError ? (
          <section role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
            <h2 className="font-semibold text-foreground">Vos informations ne sont pas disponibles</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Une erreur est survenue lors du chargement."}
            </p>
            <Button className="mt-4" variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Réessayer
            </Button>
          </section>
        ) : data ? (
          <>
            <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <Card className="min-w-0 p-5 transition-colors sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Votre lien personnel</p>
                    <h2 className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">Un lien, un compte invité.</h2>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Link2 className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <div className="flex min-h-12 min-w-0 flex-1 items-center rounded-xl border border-border bg-muted/40 px-3">
                    <span className="truncate font-mono text-sm text-foreground" title={referralUrl}>{referralUrl}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 sm:flex-none" onClick={copyReferralLink} aria-label="Copier le lien de parrainage">
                      <Copy className="mr-2 h-4 w-4" /> Copier
                    </Button>
                    <Button variant="outline" className="flex-1 sm:flex-none" onClick={shareReferralLink}>
                      <Share2 className="mr-2 h-4 w-4" /> Partager
                    </Button>
                  </div>
                </div>
              </Card>

              <Card className="relative overflow-hidden bg-muted/55 p-5 transition-colors sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Période de frais réduits</p>
                    <p className="mt-2 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                      {data.promo ? (remainingSeconds > 0 ? "En cours" : "Terminée") : "À débloquer"}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Clock3 className="h-5 w-5" />
                  </span>
                </div>
                {data.promo ? (
                  <>
                    <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight text-foreground" aria-live="polite">
                      {remainingDays}<span className="ml-1 text-sm font-sans font-medium">j</span>
                      <span className="ml-3">{String(remainingHours).padStart(2, "0")}<span className="ml-1 text-sm font-sans font-medium">h</span></span>
                    </p>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {remainingSeconds > 0 ? `Fin prévue le ${formatDate(data.promo.expiresAt)}` : "Cette période est arrivée à son terme."}
                    </p>
                  </>
                ) : (
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    La période commence lorsque votre invité remplit les conditions et que son compte est vérifié.
                  </p>
                )}
                <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Durée du programme : {data.rules.durationDays} jours</span>
                </div>
              </Card>
            </section>

            <section className="shadcn-card overflow-hidden rounded-xl border border-card-border bg-card text-card-foreground shadow-sm">
              <div className="flex flex-col gap-3 border-b border-border px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Votre réseau</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight sm:text-xl">Personnes invitées</h2>
                </div>
                <p className="text-sm text-muted-foreground">{data.pagination.total} compte{data.pagination.total === 1 ? "" : "s"} associé{data.pagination.total === 1 ? "" : "s"}</p>
              </div>
              {data.invited.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users className="h-6 w-6" /></div>
                  <h3 className="mt-4 font-semibold">Votre réseau commence ici</h3>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {data.invited.map((person) => {
                    const progress = Math.min(data.rules.requiredTransactions, person.completedTransactions);
                    const qualified = !!person.qualifiedAt;
                    return (
                      <li key={person.id} className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(200px,0.8fr)_auto] sm:items-center sm:px-7">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                            {(person.username || "?").slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{person.username}</p>
                            <p className="text-xs text-muted-foreground">Inscrit·e le {formatDate(person.createdAt)}</p>
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium">{qualified ? "Conditions remplies" : `${progress} / ${data.rules.requiredTransactions} opérations`}</span>
                            <span className="text-muted-foreground">{person.kycVerified ? "Compte vérifié" : "Vérification requise"}</span>
                          </div>
                          <div className="flex gap-1.5" aria-label={`${progress} opérations terminées sur ${data.rules.requiredTransactions}`}>
                            {Array.from({ length: data.rules.requiredTransactions }, (_, index) => (
                              <span key={index} className={`h-1.5 flex-1 rounded-full ${index < progress ? "bg-primary" : "bg-muted"}`} />
                            ))}
                          </div>
                        </div>
                        <div className="sm:text-right">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${qualified ? "bg-primary/10 text-foreground" : "bg-muted text-muted-foreground"}`}>
                            {qualified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                            {qualified ? "Admissible" : "En progression"}
                          </span>
                          {person.qualifiedAt && <p className="mt-1 text-xs text-muted-foreground">Depuis le {formatDate(person.qualifiedAt)}</p>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {data.pagination.total > 0 && (
                <nav aria-label="Pagination des personnes invitées" className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                  <p aria-live="polite" className="text-sm text-muted-foreground">
                    {(data.pagination.page - 1) * data.pagination.pageSize + 1}–{Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)} sur {data.pagination.total}
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant="outline" size="sm" disabled={isFetching || data.pagination.page <= 1} onClick={() => setInvitePage(data.pagination.page - 1)}>Précédent</Button>
                    <span className="text-sm text-muted-foreground">Page {data.pagination.page} / {data.pagination.totalPages}</span>
                    <Button variant="outline" size="sm" disabled={isFetching || data.pagination.page >= data.pagination.totalPages} onClick={() => setInvitePage(data.pagination.page + 1)}>Suivant</Button>
                  </div>
                </nav>
              )}
            </section>

            <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
              <Card className="p-5 transition-colors sm:p-7">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Comment ça marche</p>
                <h2 className="mt-2 text-lg font-semibold tracking-tight sm:text-xl">Trois opérations complétées.</h2>
                <ol className="mt-5 space-y-4">
                  {[
                    ["01", "Votre invité crée son compte avec votre lien."],
                    ["02", `Il vérifie son compte et termine ${data.rules.requiredTransactions} opérations.`],
                    ["03", `Une période de ${data.rules.durationDays} jours de frais réduits commence.`],
                  ].map(([step, text]) => (
                    <li key={step} className="flex gap-3 text-sm leading-relaxed">
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">{step}</span><span>{text}</span>
                    </li>
                  ))}
                </ol>
              </Card>
              <Card className="bg-muted/55 p-5 transition-colors sm:p-7">
                <div className="flex items-center gap-2 text-foreground">
                  <WalletCards className="h-5 w-5" />
                  <h2 className="font-semibold tracking-tight">Des frais expliqués clairement</h2>
                </div>
                <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground marker:text-primary">
                  <li>L’avantage est une réduction de frais, pas un versement en espèces. Il s’applique aux dépôts et retraits Mobile Money éligibles, pas aux opérations USDT.</li>
                  <li>Les frais réduits restent calculés à partir du coût du prestataire, avec une marge de {data.rules.marginPercent}%.</li>
                  <li>Le tarif habituel est conservé si le coût de traitement n’est pas renseigné, si ce tarif est déjà plus bas, ou si les plafonds promotionnels sont atteints.</li>
                  <li>La troisième opération requise est facturée normalement. Il n’y a pas de promesse de réduction de 50%.</li>
                  <li>Jusqu’à {data.rules.maxDiscountedOperations} opérations peuvent bénéficier de l’avantage. Le volume cumulé, par devise, est plafonné à {data.rules.maxVolumeMultiplier}× le maximum d’opération configuré.</li>
                  <li>Les plafonds d’opération configurés pour le pays concerné continuent de s’appliquer.</li>
                </ul>
                <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                  Les plafonds et l’éligibilité dépendent des limites en vigueur dans votre pays et chez l’opérateur Mobile Money.
                </p>
              </Card>
            </section>
          </>
        ) : (
          <section role="status" className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            <Loader2 className="mb-2 h-5 w-5 animate-spin" /> Chargement des informations de parrainage…
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
