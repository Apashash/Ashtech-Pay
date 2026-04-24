import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { registerSchema } from "@shared/schema";
import { apiRequest, queryClient, setAuthToken } from "@/lib/queryClient";
import { Mail, Lock, User, Phone, Loader2, Eye, EyeOff, Home } from "lucide-react";

import { z } from "zod";

interface CountryData {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
  currency: string;
  exchangeRate: string;
}

const fallbackCountries: CountryData[] = [
  { code: "CM", name: "Cameroun", flag: "🇨🇲", dialCode: "+237", currency: "XAF", exchangeRate: "1" },
];

const extendedRegisterSchema = registerSchema.extend({
  confirmPassword: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof extendedRegisterSchema>;

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);

  const { data: countries = fallbackCountries, isLoading: loadingCountries } = useQuery<CountryData[]>({
    queryKey: ["/api/public/countries"],
    queryFn: async () => {
      const res = await fetch("/api/public/countries");
      if (!res.ok) throw new Error("Failed to fetch countries");
      return res.json();
    },
  });

  useEffect(() => {
    if (countries.length > 0 && !selectedCountry) setSelectedCountry(countries[0]);
  }, [countries, selectedCountry]);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(extendedRegisterSchema),
    defaultValues: { fullName: "", username: "", email: "", password: "", confirmPassword: "", phone: "" },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      const { confirmPassword, ...submitData } = data;
      const res = await apiRequest("POST", "/api/auth/register", { ...submitData, country: selectedCountry?.name || "" });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.token) setAuthToken(data.token);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: "Inscription réussie", description: `Bienvenue sur Ashtech Pay, ${data.user.fullName}!` });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur d'inscription", description: error.message || "Une erreur est survenue", variant: "destructive" });
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    if (!selectedCountry) {
      toast({ title: "Erreur", description: "Veuillez sélectionner un pays", variant: "destructive" });
      return;
    }
    registerMutation.mutate(data);
  };

  const handleCountryChange = (countryCode: string) => {
    const country = countries.find(c => c.code === countryCode);
    if (country) {
      setSelectedCountry(country);
      const currentPhone = form.getValues("phone");
      if (!currentPhone || countries.some(c => currentPhone.startsWith(c.dialCode))) {
        form.setValue("phone", country.dialCode + " ");
      }
    }
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-8">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src="/logo.png" alt="AshTech Pay" className="h-14 w-auto" />
            </div>
          </Link>
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Créer un compte</h1>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-sm">Nom complet</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Jean Dupont" className="pl-10" data-testid="input-fullname" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-sm">Nom d'utilisateur</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="jeandupont" className="pl-10" data-testid="input-username" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-sm">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="votreemail@exemple.com" className="pl-10" data-testid="input-email" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-sm">Téléphone</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Select value={selectedCountry?.code || ""} onValueChange={handleCountryChange}>
                          <SelectTrigger className="w-[130px]" data-testid="select-country">
                            <SelectValue>
                              {selectedCountry ? (
                                <span className="flex items-center gap-1.5">
                                  <span>{selectedCountry.flag}</span>
                                  <span className="text-sm">{selectedCountry.dialCode}</span>
                                </span>
                              ) : <span className="text-muted-foreground">Pays</span>}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {countries.map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                <span className="flex items-center gap-2">
                                  <span>{country.flag}</span>
                                  <span>{country.name}</span>
                                  <span className="text-muted-foreground">{country.dialCode}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input placeholder="6XX XXX XXX" className="pl-10" data-testid="input-phone" {...field} value={field.value || ""} />
                        </div>
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
                        <Input type={showPassword ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-10" data-testid="input-password" {...field} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="button-toggle-password">
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
                    <FormLabel className="font-semibold text-sm">Confirmer le mot de passe</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input type={showConfirmPassword ? "text" : "password"} placeholder="••••••••" className="pl-10 pr-10" data-testid="input-confirm-password" {...field} />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" data-testid="button-toggle-confirm-password">
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full font-bold text-base h-11 mt-2" disabled={registerMutation.isPending || loadingCountries || !selectedCountry} data-testid="button-register">
                {registerMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Création...</>
                ) : "Créer mon compte"}
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
            Déjà un compte ?{" "}
            <Link href="/login">
              <span className="text-primary hover:underline cursor-pointer font-semibold" data-testid="link-login">
                Se connecter
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
