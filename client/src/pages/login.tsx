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

import { z } from "zod";

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.token) setAuthToken(data.token);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Connexion réussie", description: `Bienvenue, ${data.user.fullName}!`, duration: 2000, className: "bg-blue-600 text-white border-blue-700" });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur de connexion", description: error.message || "Identifiants incorrects", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/logo.png" alt="Ashtech-Pay Afrique" className="h-10 w-auto" />
              <span className="font-bold text-xl text-foreground tracking-tight">AshTech Pay</span>
            </div>
          </Link>
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Connexion</h1>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(loginMutation.mutate)} className="space-y-5">
              <FormField
                control={form.control}
                name="identifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-sm">Email ou Téléphone</FormLabel>
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
                    <FormLabel className="font-semibold text-sm">Mot de passe</FormLabel>
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
                  <span className="text-sm text-primary hover:underline cursor-pointer font-medium" data-testid="link-forgot-password">
                    Mot de passe oublié ?
                  </span>
                </Link>
              </div>

              <Button type="submit" className="w-full font-bold text-base h-11" disabled={loginMutation.isPending} data-testid="button-login">
                {loginMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Connexion...</>
                ) : "Se connecter"}
              </Button>
            </form>
          </Form>
        </div>

        <div className="mt-5 flex items-center justify-between px-1">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-back-home">
              <Home className="w-3.5 h-3.5" />
              Accueil
            </Button>
          </Link>
          <p className="text-muted-foreground text-sm">
            Pas encore de compte ?{" "}
            <Link href="/register">
              <span className="text-primary hover:underline cursor-pointer font-semibold" data-testid="link-register">
                Créer un compte
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
