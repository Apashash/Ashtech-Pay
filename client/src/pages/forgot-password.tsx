import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { forgotPasswordSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Mail, Loader2, ArrowLeft, CheckCircle, ShieldCheck } from "lucide-react";
import { z } from "zod";

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState(false);
  const [submittedIdentifier, setSubmittedIdentifier] = useState("");

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: "" },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordFormData) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      setSubmittedIdentifier(variables.identifier);
      setEmailSent(true);
      toast({
        title: "Email envoyé",
        description: "Vérifiez votre boîte mail pour le lien de réinitialisation.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer le lien de réinitialisation",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    forgotPasswordMutation.mutate(data);
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

        <Card className="w-full max-w-md relative z-10 bg-card border-border">
          <CardHeader className="text-center space-y-4 pb-4">
            <Link href="/">
              <div className="flex items-center justify-center gap-3 cursor-pointer">
                <img src="/logo.png" alt="AshTech Pay" className="h-32 w-auto" />
              </div>
            </Link>
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Email envoyé !</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Un lien de réinitialisation a été envoyé à<br />
              <span className="text-primary font-medium">{submittedIdentifier}</span>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Instructions */}
            <div className="bg-secondary/40 rounded-xl border border-border p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Que faire maintenant ?
              </p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <span className="text-base mt-0.5">📧</span>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Ouvre ton application email et cherche un message d'<strong className="text-foreground">Ashtech Pay</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-base mt-0.5">🔗</span>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Clique sur le bouton <strong className="text-foreground">"Réinitialiser mon mot de passe"</strong> dans l'email.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-base mt-0.5">⏱️</span>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Le lien est valide pendant <strong className="text-foreground">1 heure</strong> seulement.
                  </p>
                </div>
              </div>
            </div>

            {/* Security note */}
            <div className="flex items-start gap-3 bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
              <ShieldCheck className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Si tu n'as pas reçu l'email dans quelques minutes, vérifie ton dossier <strong className="text-foreground">Spam</strong>.
                Ashtech Pay ne te demandera jamais ton mot de passe par téléphone.
              </p>
            </div>

            {/* Resend option */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setEmailSent(false)}
              data-testid="button-resend"
            >
              Renvoyer l'email
            </Button>

            <div className="text-center">
              <Link href="/login">
                <span className="text-muted-foreground hover:text-foreground text-sm cursor-pointer transition-colors" data-testid="link-back-login">
                  ← Retour à la connexion
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

      <Card className="w-full max-w-md relative z-10 bg-card border-border">
        <CardHeader className="text-center space-y-4">
          <Link href="/login">
            <Button variant="ghost" size="sm" className="absolute left-4 top-4" data-testid="button-back-login">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <Link href="/">
            <div className="flex items-center justify-center gap-3 cursor-pointer pt-4">
              <img src="/logo.png" alt="AshTech Pay" className="h-32 w-auto" />
            </div>
          </Link>
          <CardTitle className="text-2xl font-bold">Mot de passe oublié</CardTitle>
          <CardDescription>
            Entre ton email pour recevoir un lien de réinitialisation sécurisé
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email ou Téléphone</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="votreemail@exemple.com ou +237..."
                          className="pl-10"
                          data-testid="input-identifier"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={forgotPasswordMutation.isPending}
                data-testid="button-submit"
              >
                {forgotPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  "Envoyer le lien par email"
                )}
              </Button>
            </form>
          </Form>

          {/* Security note on form */}
          <div className="mt-5 flex items-start gap-2.5 bg-secondary/30 rounded-lg p-3">
            <ShieldCheck className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Le lien de réinitialisation est valable <strong className="text-foreground">1 heure</strong> et ne peut être utilisé qu'une seule fois. Ashtech Pay ne te contactera jamais pour te demander ce lien.
            </p>
          </div>

          <div className="mt-5 text-center">
            <p className="text-muted-foreground text-sm">
              Tu te souviens de ton mot de passe ?{" "}
              <Link href="/login">
                <span className="text-primary hover:underline cursor-pointer font-medium" data-testid="link-login">
                  Se connecter
                </span>
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
