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
import { Mail, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import logoImage from "@assets/logo.png";
import { z } from "zod";

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [emailSent, setEmailSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      identifier: "",
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordFormData) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      return res.json();
    },
    onSuccess: (data) => {
      setEmailSent(true);
      setResetToken(data.resetToken);
      toast({
        title: "Lien envoyé",
        description: "Un lien de réinitialisation a été généré.",
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

  if (emailSent && resetToken) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        
        <Card className="w-full max-w-md relative z-10 bg-card border-border">
          <CardHeader className="text-center space-y-4">
            <Link href="/">
              <div className="flex items-center justify-center cursor-pointer">
                <img src={logoImage} alt="Ashtech-Pay Afrique" className="h-24 w-auto" />
              </div>
            </Link>
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Lien généré</CardTitle>
            <CardDescription>
              Utilisez ce lien pour réinitialiser votre mot de passe
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div className="p-4 bg-secondary/50 rounded-lg border border-border">
              <p className="text-sm text-muted-foreground mb-2">Votre lien de réinitialisation :</p>
              <Link href={`/reset-password?token=${resetToken}`}>
                <span className="text-primary hover:underline cursor-pointer break-all text-sm" data-testid="link-reset-password">
                  {window.location.origin}/reset-password?token={resetToken}
                </span>
              </Link>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              Ce lien expire dans 1 heure. Ne le partagez avec personne.
            </p>
            
            <Link href={`/reset-password?token=${resetToken}`}>
              <Button className="w-full" data-testid="button-go-reset">
                Réinitialiser mon mot de passe
              </Button>
            </Link>
            
            <div className="text-center">
              <Link href="/login">
                <span className="text-muted-foreground hover:text-foreground text-sm cursor-pointer" data-testid="link-back-login">
                  Retour à la connexion
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
            <div className="flex items-center justify-center cursor-pointer pt-4">
              <img src={logoImage} alt="Ashtech-Pay Afrique" className="h-24 w-auto" />
            </div>
          </Link>
          <CardTitle className="text-2xl font-bold">Mot de passe oublié</CardTitle>
          <CardDescription>
            Entrez votre email ou numéro de téléphone pour recevoir un lien de réinitialisation
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
                  "Envoyer le lien"
                )}
              </Button>
            </form>
          </Form>
          
          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              Vous vous souvenez de votre mot de passe ?{" "}
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
