import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { resetPasswordSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Lock, Loader2, ArrowLeft, Eye, EyeOff, CheckCircle } from "lucide-react";

import { z } from "zod";

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  const token = searchParams.get("token") || "";
  
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: token,
      password: "",
      confirmPassword: "",
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordFormData) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", data);
      return res.json();
    },
    onSuccess: () => {
      setResetSuccess(true);
      toast({
        title: "Mot de passe réinitialisé",
        description: "Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de réinitialiser le mot de passe",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ResetPasswordFormData) => {
    resetPasswordMutation.mutate({ ...data, token });
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        
        <Card className="w-full max-w-md relative z-10 bg-card border-border">
          <CardHeader className="text-center space-y-4">
            <Link href="/">
              <div className="flex items-center justify-center cursor-pointer">
                <img src="/logo.png" alt="Ashtech-Pay Afrique" className="h-28 w-auto" />
              </div>
            </Link>
            <CardTitle className="text-xl font-semibold text-destructive">Lien invalide</CardTitle>
            <CardDescription>
              Ce lien de réinitialisation est invalide ou a expiré.
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Link href="/forgot-password">
              <Button className="w-full" data-testid="button-request-new">
                Demander un nouveau lien
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

  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        
        <Card className="w-full max-w-md relative z-10 bg-card border-border">
          <CardHeader className="text-center space-y-4">
            <Link href="/">
              <div className="flex items-center justify-center cursor-pointer">
                <img src="/logo.png" alt="Ashtech-Pay Afrique" className="h-28 w-auto" />
              </div>
            </Link>
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>
            <CardTitle className="text-xl font-semibold">Mot de passe réinitialisé</CardTitle>
            <CardDescription>
              Votre mot de passe a été changé avec succès
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Link href="/login">
              <Button className="w-full" data-testid="button-go-login">
                Se connecter
              </Button>
            </Link>
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
            <Button variant="ghost" size="sm" className="absolute left-4 top-4" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <Link href="/">
            <div className="flex items-center justify-center cursor-pointer pt-4">
              <div className="bg-black rounded-2xl px-6 py-3">
                <img src="/logo.png" alt="Ashtech-Pay Afrique" className="h-28 w-auto" />
              </div>
            </div>
          </Link>
          <CardTitle className="text-xl font-semibold">Nouveau mot de passe</CardTitle>
          <CardDescription>
            Créez un nouveau mot de passe sécurisé pour votre compte
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nouveau mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10 pr-10"
                          data-testid="input-password"
                          {...field} 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10 pr-10"
                          data-testid="input-confirm-password"
                          {...field} 
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          data-testid="button-toggle-confirm-password"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={resetPasswordMutation.isPending}
                data-testid="button-submit"
              >
                {resetPasswordMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Réinitialisation...
                  </>
                ) : (
                  "Réinitialiser le mot de passe"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
