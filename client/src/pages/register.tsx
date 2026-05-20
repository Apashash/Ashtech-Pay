import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelectContent } from "@/components/ui/searchable-select-content";
import { useToast } from "@/hooks/use-toast";
import { registerSchema } from "@shared/schema";
import { apiRequest, queryClient, setAuthToken } from "@/lib/queryClient";
import { Mail, Lock, User, Phone, Loader2, Eye, EyeOff, Home, Clock, ShieldAlert, WifiOff } from "lucide-react";
import { useLanguage } from "@/lib/language";
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

const RATE_LIMIT_KEY = "ashtech_rate_limit_until";

function loadRateLimit(): number | null {
  try {
    const v = localStorage.getItem(RATE_LIMIT_KEY);
    if (!v) return null;
    const ts = parseInt(v, 10);
    if (ts > Date.now()) return ts;
    localStorage.removeItem(RATE_LIMIT_KEY);
  } catch {}
  return null;
}
function saveRateLimit(retryAfter: number) {
  try { localStorage.setItem(RATE_LIMIT_KEY, String(retryAfter)); } catch {}
}
function clearRateLimit() {
  try { localStorage.removeItem(RATE_LIMIT_KEY); } catch {}
}

function useCountdown(retryAfter: number | null) {
  const [remaining, setRemaining] = useState<number>(() => {
    if (!retryAfter) return 0;
    return Math.max(0, Math.ceil((retryAfter - Date.now()) / 1000));
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!retryAfter) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const diff = Math.max(0, Math.ceil((retryAfter - Date.now()) / 1000));
      setRemaining(diff);
      if (diff <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [retryAfter]);

  return remaining;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryData | null>(null);
  const [blockedUntil, setBlockedUntil] = useState<number | null>(() => loadRateLimit());
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [vpnDetected, setVpnDetected] = useState(false);

  const countdown = useCountdown(blockedUntil);
  const isBlocked = blockedUntil !== null && countdown > 0;

  useEffect(() => {
    if (countdown === 0 && blockedUntil !== null) {
      clearRateLimit();
      setBlockedUntil(null);
      setAttemptsLeft(null);
    }
  }, [countdown, blockedUntil]);

  const extendedRegisterSchema = registerSchema.extend({
    confirmPassword: z.string().min(6, t.register.passwordMinError),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t.register.passwordMismatch,
    path: ["confirmPassword"],
  });

  type RegisterFormData = z.infer<typeof extendedRegisterSchema>;

  const { data: rawCountries = fallbackCountries, isLoading: loadingCountries } = useQuery<CountryData[]>({
    queryKey: ["/api/public/countries"],
    queryFn: async () => {
      const res = await fetch("/api/public/countries");
      if (!res.ok) throw new Error("Failed to fetch countries");
      return res.json();
    },
  });

  const countries = rawCountries.filter(c => c.code && c.name);

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
      const json = await res.json();
      if (!res.ok) throw Object.assign(new Error(json.message || "Erreur"), json);
      return json;
    },
    onSuccess: (data) => {
      if (data.token) setAuthToken(data.token);
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({ title: t.register.toastSuccess, description: `${t.register.toastSuccessDescPre}${data.user.fullName}!` });
      setLocation("/dashboard");
    },
    onError: (error: any) => {
      if (error.vpnDetected) {
        setVpnDetected(true);
        return;
      }
      if (error.blocked && error.retryAfter) {
        saveRateLimit(error.retryAfter);
        setBlockedUntil(error.retryAfter);
      } else if (error.attemptsLeft !== undefined) {
        setAttemptsLeft(error.attemptsLeft);
      }
      toast({ title: t.register.toastError, description: error.message || t.register.toastErrorDesc, variant: "destructive" });
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    if (!selectedCountry) {
      toast({ title: t.register.errorCountry, description: t.register.errorNoCountry, variant: "destructive" });
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
              <img src="/logo.png" alt="AshTech Pay" className="h-28 w-auto" />
            </div>
          </Link>
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-foreground">{t.register.title}</h1>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8">
          {vpnDetected ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                <WifiOff className="w-8 h-8 text-orange-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-base mb-2">Connexion VPN détectée</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Vous utilisez un VPN ou un proxy. Veuillez le désactiver pour créer votre compte.
                </p>
              </div>
              <div className="w-full bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 text-center">
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                  Pour votre sécurité et la conformité réglementaire, les connexions via VPN ou proxy ne sont pas autorisées.
                </p>
              </div>
              <Button variant="outline" className="w-full mt-2" onClick={() => setVpnDetected(false)}>
                Réessayer
              </Button>
            </div>
          ) : isBlocked ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground text-base mb-1">Création de compte bloquée</p>
                <p className="text-muted-foreground text-sm mb-4">Trop de tentatives. Réessayez dans :</p>
                <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-6 py-3">
                  <Clock className="w-5 h-5 text-red-400" />
                  <span className="text-2xl font-bold text-red-400 tabular-nums" data-testid="text-countdown">
                    {formatCountdown(countdown)}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Pour votre sécurité, les tentatives sont limitées à {4} par période.
              </p>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {attemptsLeft !== null && attemptsLeft > 0 && (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {attemptsLeft} tentative(s) restante(s) avant blocage temporaire.
                    </p>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-sm">{t.register.fullName}</FormLabel>
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
                      <FormLabel className="font-semibold text-sm">{t.register.username}</FormLabel>
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
                      <FormLabel className="font-semibold text-sm">{t.register.email}</FormLabel>
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
                      <FormLabel className="font-semibold text-sm">{t.register.phone}</FormLabel>
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
                                ) : <span className="text-muted-foreground">{t.register.country}</span>}
                              </SelectValue>
                            </SelectTrigger>
                            <SearchableSelectContent
                              options={countries.map(c => ({
                                value: c.code,
                                label: c.name,
                                flag: c.flag,
                                sub: c.dialCode,
                              }))}
                            />
                          </Select>
                          <div className="relative flex-1">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder="6XX XXX XXX" className="pl-10" inputMode="numeric" data-testid="input-phone" {...field} value={field.value || ""} />
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
                      <FormLabel className="font-semibold text-sm">{t.register.password}</FormLabel>
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
                      <FormLabel className="font-semibold text-sm">{t.register.confirmPassword}</FormLabel>
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
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t.register.submitting}</>
                  ) : t.register.submit}
                </Button>
              </form>
            </Form>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between px-1">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5" data-testid="button-back-home">
              <Home className="w-3.5 h-3.5" />
              {t.register.home}
            </Button>
          </Link>
          <p className="text-muted-foreground text-sm">
            {t.register.hasAccount}{" "}
            <Link href="/login">
              <span className="text-primary hover:underline cursor-pointer font-semibold" data-testid="link-login">
                {t.register.login}
              </span>
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
