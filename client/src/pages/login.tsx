import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { loginSchema } from "@shared/schema";
import { apiRequest, queryClient, setAuthToken } from "@/lib/queryClient";
import { Mail, Lock, Loader2, Eye, EyeOff, Home } from "lucide-react";
import logoImage from "@assets/logo.png";
import { z } from "zod";

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.token) setAuthToken(data.token);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Connexion réussie",
        description: `Bienvenue, ${data.user.fullName}!`,
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur de connexion",
        description: error.message || "Identifiants incorrects",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-black px-8 pt-8 pb-6 flex flex-col items-center gap-3">
            <Link href="/">
              <img src={logoImage} alt="Ashtech-Pay Afrique" className="h-12 w-auto cursor-pointer" />
            </Link>
            <div className="text-center">
              <h1 className="text-xl font-bold text-white">Connexion</h1>
              <p className="text-sm text-white/60 mt-0.5">Accédez à votre compte Ashtech Pay</p>
            </div>
          </div>

          <div className="px-8 py-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(loginMutation.mutate)} className="space-y-4">
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

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mot de passe</FormLabel>
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

                <div className="flex justify-end">
                  <Link href="/forgot-password">
                    <span className="text-sm text-primary hover:underline cursor-pointer" data-testid="link-forgot-password">
                      Mot de passe oublié ?
                    </span>
                  </Link>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connexion...
                    </>
                  ) : (
                    "Se connecter"
                  )}
                </Button>
              </form>
            </Form>

            <div className="mt-5 flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Pas encore de compte ?{" "}
                <Link href="/register">
                  <span className="text-primary hover:underline cursor-pointer font-medium" data-testid="link-register">
                    Créer un compte
                  </span>
                </Link>
              </p>
              <Link href="/">
                <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-back-home">
                  <Home className="w-3.5 h-3.5" />
                  Accueil
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
