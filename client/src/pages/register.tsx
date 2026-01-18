import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { registerSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Mail, Lock, User, Phone, Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";
import logoImage from "@assets/photo_2026-01-10_21-16-00_1768076188815.jpg";
import { z } from "zod";

const africanCountries = [
  { code: "CM", name: "Cameroun", flag: "🇨🇲", dialCode: "+237" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳", dialCode: "+221" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮", dialCode: "+225" },
  { code: "ML", name: "Mali", flag: "🇲🇱", dialCode: "+223" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫", dialCode: "+226" },
  { code: "NE", name: "Niger", flag: "🇳🇪", dialCode: "+227" },
  { code: "TG", name: "Togo", flag: "🇹🇬", dialCode: "+228" },
  { code: "BJ", name: "Bénin", flag: "🇧🇯", dialCode: "+229" },
  { code: "GA", name: "Gabon", flag: "🇬🇦", dialCode: "+241" },
  { code: "CG", name: "Congo", flag: "🇨🇬", dialCode: "+242" },
  { code: "CD", name: "RD Congo", flag: "🇨🇩", dialCode: "+243" },
  { code: "CF", name: "Centrafrique", flag: "🇨🇫", dialCode: "+236" },
  { code: "TD", name: "Tchad", flag: "🇹🇩", dialCode: "+235" },
  { code: "GN", name: "Guinée", flag: "🇬🇳", dialCode: "+224" },
  { code: "MG", name: "Madagascar", flag: "🇲🇬", dialCode: "+261" },
  { code: "MA", name: "Maroc", flag: "🇲🇦", dialCode: "+212" },
  { code: "TN", name: "Tunisie", flag: "🇹🇳", dialCode: "+216" },
  { code: "DZ", name: "Algérie", flag: "🇩🇿", dialCode: "+213" },
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
  const [selectedCountry, setSelectedCountry] = useState(africanCountries[0]);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(extendedRegisterSchema),
    defaultValues: {
      fullName: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFormData) => {
      const { confirmPassword, ...submitData } = data;
      const res = await apiRequest("POST", "/api/auth/register", {
        ...submitData,
        country: selectedCountry.name,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Inscription réussie",
        description: `Bienvenue sur Ashtech Pay, ${data.user.fullName}!`,
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur d'inscription",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    registerMutation.mutate(data);
  };

  const handleCountryChange = (countryCode: string) => {
    const country = africanCountries.find(c => c.code === countryCode);
    if (country) {
      setSelectedCountry(country);
      const currentPhone = form.getValues("phone");
      if (!currentPhone || africanCountries.some(c => currentPhone.startsWith(c.dialCode))) {
        form.setValue("phone", country.dialCode + " ");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      
      <Card className="w-full max-w-md relative z-10 bg-card border-border my-8">
        <CardHeader className="text-center space-y-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="absolute left-4 top-4" data-testid="button-back-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Accueil
            </Button>
          </Link>
          <Link href="/">
            <div className="flex items-center justify-center cursor-pointer pt-4">
              <img src={logoImage} alt="Ashtech-Pay Afrique" className="h-24 w-auto" />
            </div>
          </Link>
          <CardTitle className="text-2xl font-bold">Créer un compte</CardTitle>
          <CardDescription>
            Rejoignez Ashtech Pay et commencez à transférer
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom complet</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="Jean Dupont" 
                          className="pl-10"
                          data-testid="input-fullname"
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
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom d'utilisateur</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="jeandupont" 
                          className="pl-10"
                          data-testid="input-username"
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                          placeholder="votreemail@exemple.com" 
                          className="pl-10"
                          data-testid="input-email"
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Select value={selectedCountry.code} onValueChange={handleCountryChange}>
                          <SelectTrigger className="w-[140px]" data-testid="select-country">
                            <SelectValue>
                              <span className="flex items-center gap-2">
                                <span className="text-lg">{selectedCountry.flag}</span>
                                <span className="text-sm">{selectedCountry.dialCode}</span>
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {africanCountries.map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                <span className="flex items-center gap-2">
                                  <span className="text-lg">{country.flag}</span>
                                  <span>{country.name}</span>
                                  <span className="text-muted-foreground">{country.dialCode}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="relative flex-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input 
                            placeholder="6XX XXX XXX" 
                            className="pl-10"
                            data-testid="input-phone"
                            {...field} 
                          />
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
                disabled={registerMutation.isPending}
                data-testid="button-register"
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Créer mon compte"
                )}
              </Button>
            </form>
          </Form>
          
          <div className="mt-6 text-center">
            <p className="text-muted-foreground text-sm">
              Déjà un compte ?{" "}
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
