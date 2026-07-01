import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, TrendingUp, Globe, Code2, CheckCircle, AlertCircle,
  ChevronRight, Zap, Lock
} from "lucide-react";
import { Link } from "wouter";

interface ApiUser {
  id: string;
  isVerified: boolean;
  apiEnabled: boolean;
  hasApiKey: boolean;
  stats: {
    totalTransactions: number;
    sdkTransactions: number;
    hpTransactions: number;
    totalCollected: number;
    sdkCollected: number;
    hpCollected: number;
  };
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "primary",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: "primary" | "green" | "sky" | "amber";
}) {
  const colorMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-600",
    sky: "bg-sky-500/10 text-sky-600",
    amber: "bg-amber-500/10 text-amber-600",
  };
  return (
    <Card>
      <CardContent className="pt-6 pb-5">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${colorMap[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminApiManagement() {
  const { data: users = [], isLoading } = useQuery<ApiUser[]>({
    queryKey: ["/api/admin/api-management"],
  });

  const totalMerchants = users.length;
  const activeApis = users.filter(u => u.apiEnabled).length;
  const verifiedCount = users.filter(u => u.isVerified).length;
  const withKeys = users.filter(u => u.hasApiKey).length;

  const totalHp = users.reduce((s, u) => s + u.stats.hpCollected, 0);
  const totalSdk = users.reduce((s, u) => s + u.stats.sdkCollected, 0);
  const totalApi = totalHp + totalSdk;

  const totalHpTxns = users.reduce((s, u) => s + u.stats.hpTransactions, 0);
  const totalSdkTxns = users.reduce((s, u) => s + u.stats.sdkTransactions, 0);

  return (
    <AdminLayout>
      <div className="space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Gestion des API</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Vue d'ensemble de l'accès API marchand. Activez ou désactivez les accès depuis la page Marchands.
            </p>
          </div>
          <Link href={`${import.meta.env.VITE_ADMIN_PATH}/merchants`}>
            <Button className="gap-2 shrink-0" data-testid="button-go-merchants">
              <Users className="h-4 w-4" />
              Marchands
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Stats grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i}><CardContent className="pt-6 pb-5"><div className="h-16 animate-pulse bg-muted rounded-lg" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Marchands total" value={totalMerchants} color="primary" />
            <StatCard icon={CheckCircle} label="API activées" value={activeApis} sub={`${verifiedCount} vérifiés · ${withKeys} clés générées`} color="green" />
            <StatCard icon={Code2} label="Txn SDK" value={totalSdkTxns} sub={`${totalSdk.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} XAF collectés`} color="sky" />
            <StatCard icon={Globe} label="Txn Hosted Page" value={totalHpTxns} sub={`${totalHp.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} XAF collectés`} color="amber" />
          </div>
        )}

        {/* Volume total */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 pb-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Volume API total collecté</p>
                  <p className="text-3xl font-bold text-foreground">
                    {isLoading ? "…" : totalApi.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " XAF"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    SDK : {totalSdk.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} XAF · Hosted Page : {totalHp.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} XAF
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {totalSdkTxns + totalHpTxns} transactions API au total
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Access rules */}
        {/* Unified API info */}
        <Card className="border-sky-500/20 bg-sky-500/5">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <Zap className="h-4 w-4 text-sky-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Ashtech Pay API — Unifié</p>
                <p className="text-sm text-muted-foreground">
                  Les deux fournisseurs (AfribaPay + PixPay) sont combinés sous une seule API.
                  Le routage est automatique selon le pays et l'opérateur. Tout changement de frais
                  ou de fournisseur dans le panneau admin se propage instantanément à tous les marchands
                  intégrés, <strong className="text-foreground">sans modification de leur code</strong>.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {[
                    { label: "GET /v1/countries", desc: "Pays actifs (admin-géré)" },
                    { label: "POST /v1/collect",  desc: "Collecte paiement" },
                    { label: "GET /v1/fees",      desc: "Frais en temps réel" },
                    { label: "GET /v1/transaction/:id", desc: "Statut transaction" },
                  ].map(e => (
                    <span key={e.label} className="text-xs font-mono bg-muted px-2 py-1 rounded border" title={e.desc}>{e.label}</span>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Code2 className="h-4 w-4 text-sky-500" />
                SDK API <span className="font-mono text-xs text-muted-foreground">ak_live_…</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1.5">
              <p>Le marchand utilise sa clé <code className="text-xs bg-muted px-1 rounded">ak_live_</code> côté serveur pour appeler <code className="text-xs bg-muted px-1 rounded">/v1/collect</code>.</p>
              <p>Chaque transaction est marquée <code className="text-xs bg-muted px-1 rounded">source: "api"</code>.</p>
              <p className="text-xs text-sky-600">Frais admin → propagés automatiquement</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Globe className="h-4 w-4 text-amber-500" />
                Hosted Page <span className="font-mono text-xs text-muted-foreground">hp_live_…</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-1.5">
              <p>Le marchand crée un lien via <code className="text-xs bg-muted px-1 rounded">/v1/hosted-payment/create</code>.</p>
              <p>Le client paie sur la page Ashtech Pay hébergée, sans code frontend.</p>
              <p className="text-xs text-amber-600">Pays actifs → mis à jour par l'admin en temps réel</p>
            </CardContent>
          </Card>
        </div>

        {/* Rule reminder */}
        <Card className="bg-muted/30">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Règle d'accès</strong> — Un marchand doit d'abord être KYC-vérifié avant que vous puissiez lui activer l'API. Rendez-vous sur la page{" "}
                <Link href={`${import.meta.env.VITE_ADMIN_PATH}/merchants`} className="text-primary hover:underline font-medium">Marchands</Link>{" "}
                pour gérer les accès individuels.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
