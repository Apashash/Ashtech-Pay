import { Link } from "wouter";
import { AdminLayout } from "./layout";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle, Send, ChevronRight } from "lucide-react";

function getFeesSections() {
  const A = (import.meta.env.VITE_ADMIN_PATH as string) || "/admin";
  return [
    {
      href: `${A}/fees/deposits`,
      icon: ArrowDownCircle,
      color: "text-green-500",
      bg: "bg-green-500/10",
      title: "Frais de Dépôt",
      description: "Configurez les frais par opérateur pour les dépôts et les liens de paiement.",
    },
    {
      href: `${A}/fees/withdrawals`,
      icon: ArrowUpCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
      title: "Frais de Retrait",
      description: "Configurez les frais par opérateur pour les retraits.",
    },
    {
      href: `${A}/fees/transfers`,
      icon: Send,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      title: "Frais d'Envoi",
      description: "Configurez les frais par opérateur pour les transferts entre utilisateurs.",
    },
  ];
}

export default function AdminFees() {
  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Gestion des Frais</h1>
          <p className="text-muted-foreground">
            Sélectionnez un type de transaction pour configurer les frais et les fournisseurs par opérateur.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {FEE_SECTIONS.map(({ href, icon: Icon, color, bg, title, description }) => (
            <Link key={href} href={href}>
              <Card className="cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all group">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl ${bg} shrink-0`}>
                        <Icon className={`w-6 h-6 ${color}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{title}</p>
                        <p className="text-sm text-muted-foreground mt-1">{description}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-400">
          <p className="font-semibold mb-1">Comment ça fonctionne</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-300">
            <li>Choisissez le type de frais (Dépôt, Retrait ou Envoi)</li>
            <li>Sélectionnez un pays pour voir ses opérateurs</li>
            <li>Cliquez sur un opérateur pour configurer ses frais</li>
            <li>Choisissez le fournisseur : <strong>AfribaPay</strong>, <strong>Swychr</strong> ou <strong>PixPay</strong></li>
            <li>Enregistrez — ce fournisseur traitera toutes les transactions de cet opérateur</li>
          </ol>
        </div>
      </div>
    </AdminLayout>
  );
}
