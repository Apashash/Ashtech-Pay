import React, { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import {
  ShieldCheck,
  TrendingDown,
  RefreshCw,
  BadgeCheck,
  Sparkles,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";

const APP_VERSION = "v1.7h ASH";

// ─── Types ───────────────────────────────────────────────────────────────────
type UpdateEntry = {
  num: number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  title: string;
  date: string;
  summary: string;
  bullets: string[];
};

// ─── Single update card ───────────────────────────────────────────────────────
function UpdateCard({
  entry,
  expanded,
  onToggle,
}: {
  entry: UpdateEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = entry.icon;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/40 transition-colors text-left"
      >
        <div className={`w-9 h-9 rounded-full ${entry.iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${entry.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-muted-foreground/60 font-mono">
              #{entry.num.toString().padStart(2, "0")}
            </span>
            <p className="text-sm font-semibold text-foreground leading-tight truncate">{entry.title}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{entry.date}</p>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-muted-foreground/40 shrink-0 transition-transform duration-200 ${
            expanded ? "rotate-90" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4 bg-muted/10 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{entry.summary}</p>
          <ul className="space-y-2">
            {entry.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function UpdatesPage() {
  const [expanded, setExpanded] = useState<number | null>(1);

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
        "Les frais de transactions ont été revus à la baisse pour plusieurs pays afin de vous offrir un meilleur tarif.",
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
        "Taux de conversion améliorés sur toutes les paires de devises",
        "Affichage du taux en temps réel avant confirmation",
        "Conversions instantanées sans frais cachés",
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
        "Ajout de la carte graphique — plus moderne et sécurisée",
        "Interface KYC redessinée : plus intuitive et professionnelle",
        "Validation plus rapide grâce à une meilleure reconnaissance documentaire",
        "Documents acceptés : CNI, Passeport, Carte graphique",
      ],
    },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto pb-10">
        {/* Header */}
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
            <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-full px-3 py-1.5 shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-primary font-mono">{APP_VERSION}</span>
            </div>
          </div>
        </div>

        {/* Update list */}
        <div className="px-4 space-y-3">
          {updates.map((entry) => (
            <UpdateCard
              key={entry.num}
              entry={entry}
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
