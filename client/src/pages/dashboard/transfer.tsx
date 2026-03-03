import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transferSchema, type SupportedCurrency } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { Send, User as UserIcon, Loader2, ArrowRight, Shield } from "lucide-react";
import { z } from "zod";
import { formatCurrency } from "@/lib/currency";
import { useLocation } from "wouter";

export default function TransferPage() {
  const { toast } = useToast();
  
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const balance = parseFloat(user?.balance || "0");
  
  const form = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { recipientUsername: "", amount: "", description: "" },
  });

  const transferMutation = useMutation({
    mutationFn: async (data: z.infer<typeof transferSchema>) => {
      const res = await apiRequest("POST", "/api/transfers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      toast({ title: "Transfert effectué", description: "L'argent a été envoyé avec succès" });
      form.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const watchedAmount = form.watch("amount");
  const amountValue = parseFloat(watchedAmount) || 0;

  const [, setLocation] = useLocation();
  const isVerified = user?.isVerified;

  if (user && !isVerified) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Envoyer de l'argent</h1>
            <p className="text-muted-foreground">Transférez de l'argent à un autre utilisateur</p>
          </div>
          
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Shield className="w-8 h-8 text-yellow-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Compte non vérifié</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                Pour envoyer de l'argent, vous devez d'abord vérifier votre compte. 
                La vérification permet de sécuriser vos transactions et d'accéder à toutes les fonctionnalités.
              </p>
              <Button 
                onClick={() => setLocation("/dashboard/kyc")}
                className="mt-4"
                data-testid="button-go-to-kyc"
              >
                <Shield className="w-4 h-4 mr-2" />
                Passer la vérification
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Envoyer de l'argent</h1>
          <p className="text-muted-foreground">Transférez de l'argent à un autre utilisateur</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                Nouveau transfert
              </CardTitle>
              <CardDescription>Remplissez les informations du destinataire</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((d) => transferMutation.mutate(d))} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="recipientUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destinataire</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input 
                              placeholder="+237 6XX XXX XXX"
                              className="pl-10"
                              {...field} 
                              onChange={(e) => {
                                let val = e.target.value;
                                if (val && !val.startsWith("+") && /^\d/.test(val)) {
                                  if (user?.country?.toLowerCase().includes("cameroun") || user?.country?.toLowerCase().includes("cameroon")) {
                                    val = "+237" + val;
                                  }
                                }
                                field.onChange(val);
                              }}
                              data-testid="input-recipient"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montant (XAF)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="10000" 
                            className="text-2xl h-14"
                            {...field} 
                            data-testid="input-amount"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex flex-wrap gap-2">
                    {[1000, 5000, 10000, 25000, 50000].map((amount) => (
                      <Button
                        key={amount}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => form.setValue("amount", amount.toString())}
                        disabled={amount > balance}
                        data-testid={`button-preset-${amount}`}
                      >
                        {formatCurrency(amount, (user?.preferredCurrency || "XAF") as SupportedCurrency)}
                      </Button>
                    ))}
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Note (optionnel)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ajouter une note pour le destinataire..."
                            {...field} 
                            data-testid="input-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    className="w-full" 
                    size="lg" 
                    disabled={transferMutation.isPending || amountValue > balance || amountValue <= 0}
                    data-testid="button-send-confirm"
                  >
                    {transferMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Envoyer {amountValue > 0 ? formatCurrency(amountValue, (user?.preferredCurrency || "XAF") as SupportedCurrency) : ""}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-1">Votre solde</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(balance, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</p>
              </CardContent>
            </Card>

            {amountValue > 0 && amountValue <= balance && (
              <Card>
                <CardContent className="p-6 space-y-3">
                  <p className="text-sm text-muted-foreground">Résumé</p>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground">Montant</span>
                    <span className="font-medium">{formatCurrency(amountValue, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground">Frais</span>
                    <span className="font-medium text-green-500">Gratuit</span>
                  </div>
                  <div className="border-t border-border pt-3 flex items-center justify-between">
                    <span className="font-medium text-foreground">Total</span>
                    <span className="font-bold text-lg">{formatCurrency(amountValue, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-2 text-muted-foreground">
                    <span>{formatCurrency(balance, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</span>
                    <ArrowRight className="w-4 h-4" />
                    <span>{formatCurrency(balance - amountValue, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
