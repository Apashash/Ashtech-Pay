import React from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Info, Percent, ShieldCheck, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Fee, Country } from "@shared/schema";

const FEE_EXPLANATIONS = [
  {
    title: "Frais en pourcentage (%)",
    description: "C'est la commission prélevée sur le montant total envoyé ou retiré. Elle inclut les frais de Swychr et la marge de service Ashtech Pay.",
    icon: Percent,
    color: "text-blue-500",
    bg: "bg-blue-500/10"
  },
  {
    title: "Minimum Payout Charge",
    description: "C'est le montant minimum garanti. Si le calcul du pourcentage est inférieur à ce seuil, c'est ce montant fixe qui s'applique.",
    icon: Wallet,
    color: "text-orange-500",
    bg: "bg-orange-500/10"
  },
  {
    title: "Règle du montant élevé",
    description: "Le système compare toujours le pourcentage et le frais minimum, puis retient automatiquement le montant le plus élevé des deux.",
    icon: ShieldCheck,
    color: "text-green-500",
    bg: "bg-green-500/10"
  }
];

export default function FeeExplanationsPage() {
  const { data: fees } = useQuery<Fee[]>({
    queryKey: ["/api/public/fees"],
  });

  const { data: countries } = useQuery<Country[]>({
    queryKey: ["/api/public/countries"],
  });

  const displayFees = React.useMemo(() => {
    if (!fees || !countries) return [];
    
    // Filtrer pour n'avoir qu'une ligne par pays (les frais sont synchronisés)
    const transferFees = fees.filter(f => f.transactionType === "transfer" && f.countryId);
    
    return transferFees.map(fee => {
      const country = countries.find(c => c.id === fee.countryId);
      return {
        country: country?.name || "Inconnu",
        percentage: `${parseFloat(fee.feeValue).toFixed(2)}%`,
        min: `${fee.minFee || 0} ${country?.currency || "XAF"}`
      };
    }).sort((a, b) => a.country.localeCompare(b.country));
  }, [fees, countries]);

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Détails des Frais</h1>
          <p className="text-muted-foreground mt-2">Comprendre comment sont calculés vos frais de transfert et de retrait</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {FEE_EXPLANATIONS.map((item, index) => (
            <Card key={index} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className={`w-12 h-12 rounded-lg ${item.bg} flex items-center justify-center mb-4`}>
                  <item.icon className={`w-6 h-6 ${item.color}`} />
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" />
              Grille tarifaire par pays
            </CardTitle>
            <CardDescription>
              Les tarifs ci-dessous incluent les frais Swychr et la commission Ashtech Pay.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-bold">Pays</TableHead>
                    <TableHead className="font-bold">Frais (%)</TableHead>
                    <TableHead className="font-bold text-right">Minimum Payout Charge</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayFees.length > 0 ? (
                    displayFees.map((row) => (
                      <TableRow key={row.country} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium">{row.country}</TableCell>
                        <TableCell>{row.percentage}</TableCell>
                        <TableCell className="text-right font-mono">{row.min}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        Chargement de la grille tarifaire...
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="bg-primary/5 border border-primary/10 rounded-xl p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-bold text-foreground">Note importante sur les devises</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Les montants minimums sont indiqués dans la devise locale du pays de destination. Si votre solde est en XAF, une conversion automatique basée sur le taux de change en vigueur sera appliquée lors du calcul du minimum.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
