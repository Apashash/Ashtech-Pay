import React, { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import {
  ShieldCheck,
  TrendingDown,
  RefreshCw,
  BadgeCheck,
  Sparkles,
  ArrowLeft,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

const APP_VERSION = "v1.7h ASH";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Fee {
  id: string;
  transactionType: string;
  feeType: string;    // "percentage" | "fixed"
  feeValue: number;   // Ashtech margin / base fee
  ashtechMargin?: number;
  minFee?: number;
  maxFee?: number;
  swychrFee?: number;
  afribapayFee?: number;
  pixpayFee?: number;
  countryId?: string | null;
  operatorId?: string | null;
  isActive: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function feeTotal(fee: Fee): number {
  // Total = feeValue (ashtech) + highest provider fee available
  const base = fee.feeValue ?? 0;
  const providers = [fee.swychrFee ?? 0, fee.afribapayFee ?? 0, fee.pixpayFee ?? 0].filter(v => v > 0);
  const providerMax = providers.length > 0 ? Math.max(...providers) : 0;
  return base + providerMax;
}

function fmtFee(fee: Fee): string {
  const total = feeTotal(fee);
  if (fee.feeType === "percentage") {
    return `${total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
  }
  return `${total.toLocaleString("fr-FR")} XAF`;
}

function feesByType(fees: Fee[], type: string): Fee[] {
  return fees.filter(f => f.transactionType === type && f.isActive);
}

function lowestFeeStr(fees: Fee[], type: string): string | null {
  const group = feesByType(fees, type);
  if (group.length === 0) return null;
  const totals = group.map(feeTotal);
  const min = Math.min(...totals);
  const fee = group[totals.indexOf(min)];
  return fmtFee(fee);
}

// ─── Update cards data ────────────────────────────────────────────────────────
type UpdateEntry = {
  num: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  date: string;
  summary: string;
  bullets: string[];
  feeSection?: React.ReactNode;
};

// ─── Fee Display sub-component ───────────────────────────────────────────────
function FeeSummaryBlock({ fees }: { fees: Fee[] }) {
  const types = [
    { key: "deposit",    label: "Dépôts" },
    { key: "withdrawal", label: "Retraits" },
    { key: "transfer",   label: "Transferts" },
    { key: "conversion", label: "Conversions" },
  ];

  return (
    <div className="mt-3 rounded-lg border border-border overflow-hidden">
      <div className="bg-muted/40 px-3 py-2 border-b border-border">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Frais actuels configurés
        </p>
      </div>
      <div className="divide-y divide-border">
        {types.map(({ key, label }) => {
          const str = lowestFeeStr(fees, key);
          return (
            <div key={key} className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm text-foreground">{label}</span>
              <span className="text-sm font-semibold text-primary">
                {str ? `dès ${str}` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Single update card ───────────────────────────────────────────────────────
function UpdateCard({
  entry,
  expanded,
  onToggle,
  fees,
}: {
  entry: UpdateEntry;
  expanded: boolean;
  onToggle: () => void;
  fees: Fee[];
}) {
  const Icon = entry.icon;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/40 transition-colors text-left"
      >
        <div className={`w-9 h-9 rounded-full ${entry.iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-4.5 h-4.5 ${entry.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground/60 font-mono">#{entry.num.toString().padStart(2, "0")}</span>
            <p className="text-sm font-semibold text-foreground leading-tight truncate">{entry.title}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{entry.date}</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-muted-foreground/40 shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 bg-muted/10 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{entry.summary}</p>
          <ul className="space-y-2">
            {entry.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {b}
              </li>
            ))}
          </ul>

          {/* Fees block for update #2 and #3 */}
          {(entry.num === 2 || entry.num === 3) && fees.length > 0 && (
            <FeeSummaryBlock fees={fees} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UpdatesPage() {
  const [expanded, setExpanded] = useState<number | null>(1);

  const { data: feesRaw, isLoading } = useQuery<Fee[] | null>({
    queryKey: ["/api/public/fees"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 5 * 60 * 1000,
  });
  const fees: Fee[] = Array.isArray(feesRaw) ? feesRaw : [];

  const updates: UpdateEntry[] = [
    {
      num: 1,
      icon: ShieldCheck,
      iconBg: "bg-green-500/15",
      iconColor: "text-green-600 dark:text-green-400",
      title: "Mise à jour de sécurité",
      date: "Juillet 2026",
      summary:
        "Des améliorations importantes ont été apportées à la sécurité de votre compte et à la protection de vos transactions.",
      bullets: [
        "Renforcement du chiffrement des données de session",
        "Détection améliorée des connexions suspectes",
        "Délai d'expiration de session optimisé",
        "Journalisation renforcée des accès administrateurs",
        "Blocage automatique après plusieurs tentatives échouées",
      ],
    },
    {
      num: 2,
      icon: TrendingDown,
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-600 dark:text-blue-400",
      title: "Frais de transactions réduits",
      date: "Juillet 2026",
      summary:
        "Les frais de transactions (dépôts, retraits, transferts) ont été revus à la baisse pour plusieurs pays afin de vous offrir un meilleur tarif.",
      bullets: [
        "Réduction des frais pour les opérations Mobile Money",
        "Nouveaux tarifs compétitifs pour les transferts inter-pays",
        "Frais minimaux ajustés pour les petits montants",
        "Transparence totale : frais affichés avant confirmation",
      ],
    },
    {
      num: 3,
      icon: RefreshCw,
      iconBg: "bg-purple-500/15",
      iconColor: "text-purple-600 dark:text-purple-400",
      title: "Frais de conversion réduits",
      date: "Juillet 2026",
      summary:
        "Les taux appliqués lors des conversions de devises ont été améliorés. Vous bénéficiez désormais de spreads plus compétitifs.",
      bullets: [
        "Marge de conversion réduite sur toutes les paires de devises",
        "Affichage du taux en temps réel avant confirmation",
        "Conversions instantanées sans frais cachés",
        "Les frais totaux (marge Ashtech + opérateur) sont affichés ci-dessous",
      ],
    },
    {
      num: 4,
      icon: BadgeCheck,
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-600 dark:text-amber-400",
      title: "KYC — Nouvelle procédure de vérification",
      date: "Juillet 2026",
      summary:
        "Le processus de vérification d'identité (KYC) a été entièrement repensé pour être plus rapide, plus sécurisé et plus professionnel.",
      bullets: [
        "Suppression du récépissé comme document accepté",
        "Suppression de la carte électorale comme document accepté",
        "Ajout de la carte graphique (carte d'identité graphique) — plus moderne et sécurisée",
        "Interface KYC redessinée : plus intuitive et professionnelle",
        "Validation plus rapide grâce à une meilleure reconnaissance documentaire",
        "Documents acceptés : CNI, Passeport, Carte graphique",
      ],
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto pb-10">
        {/* ── Header ── */}
        <div className="px-4 pt-2 pb-5">
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Paramètres
          </Link>

          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Mises à jour</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Nouveautés et améliorations</p>
            </div>
            {/* Version badge */}
            <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-primary font-mono">{APP_VERSION}</span>
            </div>
          </div>
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ── Update list ── */}
        <div className="px-4 space-y-3">
          {updates.map((entry) => (
            <UpdateCard
              key={entry.num}
              entry={entry}
              fees={fees}
              expanded={expanded === entry.num}
              onToggle={() => setExpanded(expanded === entry.num ? null : entry.num)}
            />
          ))}
        </div>

        <div className="h-8" />
      </div>
    </DashboardLayout>
  );
}

