import { useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "@shared/schema";
import { apiRequest, queryClient, getAuthHeaders } from "@/lib/queryClient";
import { ArrowLeft, Loader2, Upload, X, FileText, Link as LinkIcon, ExternalLink, Calendar, Image, Globe, Check } from "lucide-react";
import { z } from "zod";

interface PaymentLink {
  id: string;
  title: string;
  description?: string | null;
  amount?: string | null;
  slug: string;
  isFixedAmount: boolean;
  imagePath?: string | null;
  pdfPath?: string | null;
  hasPdfDelivery: boolean;
  redirectUrl?: string | null;
  expiresAt?: string | null;
  allowedCountries?: string[] | null;
}

interface CountryConfig {
  id: string;
  name: string;
  flag: string;
  currency: string;
}

interface DepositConfigResponse {
  countries: CountryConfig[];
}

const updateSchema = z.object({
  title: z.string().min(1, "Titre requis"),
  description: z.string().optional(),
  amount: z.string().optional(),
  customSlug: z.string().optional(),
  isFixedAmount: z.boolean(),
  imagePath: z.string().optional(),
  pdfPath: z.string().optional(),
  hasPdfDelivery: z.boolean(),
  redirectUrl: z.string().optional(),
  expiresAt: z.string().optional(),
  allowedCountries: z.array(z.string()).optional(),
});

export default function LinkEditPage() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  const { data: depositConfigData } = useQuery<DepositConfigResponse>({
    queryKey: ["/api/public/deposit-config"],
  });
  const allCountries = depositConfigData?.countries || [];

  const { data: link, isLoading: linkLoading } = useQuery<PaymentLink>({
    queryKey: ["/api/payment-links", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/payment-links/${params.id}`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Lien introuvable");
      return res.json();
    },
  });

  const form = useForm<z.infer<typeof updateSchema>>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      title: "",
      description: "",
      amount: "",
      customSlug: "",
      isFixedAmount: true,
      imagePath: "",
      pdfPath: "",
      hasPdfDelivery: false,
      redirectUrl: "",
      expiresAt: "",
      allowedCountries: [],
    },
  });

  if (link && !initialized) {
    const countries = link.allowedCountries || [];
    form.reset({
      title: link.title,
      description: link.description || "",
      amount: link.amount || "",
      customSlug: link.slug || "",
      isFixedAmount: link.isFixedAmount ?? true,
      imagePath: link.imagePath || "",
      pdfPath: link.pdfPath || "",
      hasPdfDelivery: link.hasPdfDelivery ?? false,
      redirectUrl: link.redirectUrl || "",
      expiresAt: link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 16) : "",
      allowedCountries: countries,
    });
    setImagePreview(link.imagePath || null);
    setSelectedCountries(countries);
    setInitialized(true);
  }

  const isFixedAmount = form.watch("isFixedAmount");
  const pdfPathValue = form.watch("pdfPath");

  const toggleCountry = (id: string) => {
    setSelectedCountries(prev => {
      const next = prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id];
      form.setValue("allowedCountries", next);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedCountries.length === allCountries.length) {
      setSelectedCountries([]);
      form.setValue("allowedCountries", []);
    } else {
      const all = allCountries.map(c => c.id);
      setSelectedCountries(all);
      form.setValue("allowedCountries", all);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    form.setValue("imagePath", "");
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/uploads/file", {
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders(),
      body: formData,
    });
    if (!res.ok) throw new Error("Échec de l'upload");
    const result = await res.json();
    return result.url || result.objectPath;
  };

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof updateSchema>) => {
      const finalData: Record<string, any> = {
        title: data.title,
        description: data.description || null,
        customSlug: data.customSlug,
        isFixedAmount: data.isFixedAmount,
        amount: data.isFixedAmount ? data.amount : "0",
        hasPdfDelivery: data.hasPdfDelivery,
        pdfPath: data.pdfPath || null,
        redirectUrl: data.redirectUrl || null,
        expiresAt: data.expiresAt || null,
        allowedCountries: selectedCountries.length > 0 ? selectedCountries : null,
      };
      if (imageFile) {
        finalData.imagePath = await uploadImage(imageFile);
      } else if (!imagePreview) {
        finalData.imagePath = null;
      }
      const res = await apiRequest("PATCH", `/api/payment-links/${params.id}`, finalData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({ title: "Lien modifié", description: "Les modifications ont été enregistrées" });
      navigate("/dashboard/links");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  if (linkLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!link) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Lien introuvable</p>
          <Button onClick={() => navigate("/dashboard/links")} className="mt-4">Retour</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/links")}
            data-testid="button-back-links"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Modifier le lien de paiement</h1>
            <p className="text-muted-foreground text-sm">Modifiez les informations de votre lien</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-6">

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titre *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Paiement commande #123" {...field} data-testid="input-edit-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (optionnel)</FormLabel>
                      <FormControl>
                        <Input placeholder="Description du paiement..." {...field} data-testid="input-edit-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customSlug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <LinkIcon className="w-4 h-4" />
                        URL personnalisée (optionnel)
                      </FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-sm whitespace-nowrap">/pay/</span>
                          <Input placeholder="mon-lien" {...field} data-testid="input-edit-slug" />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">Laissez vide pour générer automatiquement</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Country selection */}
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    Pays disponibles pour ce lien
                  </FormLabel>
                  <FormDescription className="text-xs">
                    Sélectionnez les pays depuis lesquels les clients peuvent payer. Laissez vide pour autoriser tous les pays.
                  </FormDescription>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
                      <span className="text-sm font-medium">
                        {selectedCountries.length === 0
                          ? "Tous les pays autorisés"
                          : `${selectedCountries.length} pays sélectionné${selectedCountries.length > 1 ? "s" : ""}`}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={toggleAll}
                        data-testid="button-toggle-all-countries"
                      >
                        {selectedCountries.length === allCountries.length && allCountries.length > 0
                          ? "Tout désélectionner"
                          : "Tout sélectionner"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-0 max-h-64 overflow-y-auto">
                      {allCountries.map((c) => {
                        const isSelected = selectedCountries.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleCountry(c.id)}
                            className={`flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors border-b border-r border-border/40 ${
                              isSelected
                                ? "bg-primary/10 text-primary font-medium"
                                : "hover:bg-muted/50 text-foreground"
                            }`}
                            data-testid={`button-country-${c.id}`}
                          >
                            <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                              {isSelected
                                ? <Check className="w-3.5 h-3.5 text-primary" />
                                : <span className="w-3.5 h-3.5 rounded border border-border block" />}
                            </span>
                            <span className="mr-1">{c.flag}</span>
                            <span className="truncate">{c.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {selectedCountries.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-2">
                      {selectedCountries.map(id => {
                        const country = allCountries.find(c => c.id === id);
                        if (!country) return null;
                        return (
                          <Badge
                            key={id}
                            variant="secondary"
                            className="gap-1 cursor-pointer"
                            onClick={() => toggleCountry(id)}
                          >
                            {country.flag} {country.name}
                            <X className="w-3 h-3" />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </FormItem>

                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Image className="w-4 h-4" />
                    Image (optionnel)
                  </FormLabel>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    data-testid="input-edit-image"
                  />
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="Aperçu" className="w-full h-48 object-cover rounded-lg" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={clearImage}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Choisir une image
                    </Button>
                  )}
                </FormItem>

                <FormField
                  control={form.control}
                  name="pdfPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Lien PDF (optionnel)
                      </FormLabel>
                      <FormDescription className="text-xs text-amber-500">
                        Ce PDF sera envoyé au client uniquement après paiement réussi
                      </FormDescription>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <Input
                            placeholder="https://drive.google.com/file/d/..."
                            {...field}
                            data-testid="input-edit-pdf-url"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {pdfPathValue && (
                  <FormField
                    control={form.control}
                    name="hasPdfDelivery"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border border-amber-500/50 bg-amber-500/10 p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-amber-500">Livraison PDF après paiement</FormLabel>
                          <FormDescription className="text-xs">
                            Le client recevra ce lien PDF après avoir payé avec succès
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-edit-pdf-delivery"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="isFixedAmount"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Type de montant</FormLabel>
                        <FormDescription className="text-xs">
                          {field.value ? "Montant fixe défini par vous" : "Montant libre choisi par le payeur"}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="switch-edit-fixed-amount"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {isFixedAmount && (
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Montant ({user?.preferredCurrency || "XAF"}) *</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="10000" {...field} data-testid="input-edit-amount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="expiresAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Date d'expiration (optionnel)
                      </FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} data-testid="input-edit-expiry" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="redirectUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4" />
                        URL de redirection après paiement (optionnel)
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="https://monsite.com/merci" {...field} data-testid="input-edit-redirect" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate("/dashboard/links")}
                    data-testid="button-edit-cancel"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={updateMutation.isPending}
                    data-testid="button-edit-save"
                  >
                    {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Enregistrer
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
