import React from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Info, Percent, ShieldCheck, Wallet } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

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

const COUNTRY_FEES = [
  { country: "Cameroun", percentage: "3.50%", min: "450 XAF" },
  { country: "Burkina Faso", percentage: "3.80%", min: "450 XOF" },
  { country: "Bénin", percentage: "3.80%", min: "0 XOF" },
  { country: "Congo Brazzaville", percentage: "4.00%", min: "700 XAF" },
  { country: "Congo RDC", percentage: "3.80%", min: "0 CDF" },
  { country: "Côte d'Ivoire", percentage: "3.80%", min: "450 XOF" },
  { country: "Gabon", percentage: "3.80%", min: "450 XAF" },
  { country: "Ghana", percentage: "4.00%", min: "15 GHS" },
  { country: "Guinée Conakry", percentage: "4.00%", min: "6500 GNF" },
  { country: "Inde", percentage: "3.50%", min: "10 INR" },
  { country: "Kenya", percentage: "3.50%", min: "100 KES" },
  { country: "Mali", percentage: "3.80%", min: "450 XOF" },
  { country: "Niger", percentage: "4.50%", min: "690 XOF" },
  { country: "Nigeria", percentage: "4.00%", min: "100 NGN" },
  { country: "Rwanda", percentage: "3.80%", min: "2300 RWF" },
  { country: "Sénégal", percentage: "3.80%", min: "450 XOF" },
  { country: "Togo", percentage: "3.80%", min: "0 XOF" },
  { country: "Tanzanie", percentage: "6.00%", min: "0 TZS" },
  { country: "Ouganda", percentage: "6.00%", min: "0 UGX" },
  { country: "États-Unis", percentage: "5.00%", min: "50 USD" },
];

export default function FeeExplanationsPage() {
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
                  {COUNTRY_FEES.map((row) => (
                    <TableRow key={row.country} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium">{row.country}</TableCell>
                      <TableCell>{row.percentage}</TableCell>
                      <TableCell className="text-right font-mono">{row.min}</TableCell>
                    </TableRow>
                  ))}
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
