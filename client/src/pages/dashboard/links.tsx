import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPaymentLinkSchema, type SupportedCurrency, EXCHANGE_RATES } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getImageSrc } from "@/lib/image";
import type { PaymentLink, Transaction, User, PaymentIntent } from "@shared/schema";
import { 
  Link2, Plus, Copy, ExternalLink, Loader2, CheckCircle, XCircle, 
  MousePointer, ArrowDownUp, Wallet, TrendingUp, Globe, BarChart3,
  Calendar, Filter, Image, FileText, Link as LinkIcon, QrCode, 
  Download, Pencil, Power, Trash2, Eye, Upload, X, Clock, AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import jsPDF from "jspdf";
import { format, subDays, subMonths, startOfDay, startOfWeek, startOfMonth, startOfYear, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { z } from "zod";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from "recharts";
import { formatCurrency } from "@/lib/currency";
import { useUpload } from "@/hooks/use-upload";

const periodOptions = [
  { value: "today", label: "Aujourd'hui" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois-ci" },
  { value: "last_month", label: "Mois dernier" },
  { value: "year", label: "Cette année" },
  { value: "all", label: "Tout" },
];

const countryCodeMap: Record<string, string> = {
  "Cameroon": "cm",
  "Senegal": "sn",
  "Côte d'Ivoire": "ci",
  "Mali": "ml",
  "Burkina Faso": "bf",
  "Benin": "bj",
  "Togo": "tg",
  "Niger": "ne",
  "Guinea-Bissau": "gw",
  "Chad": "td",
  "Central African Republic": "cf",
  "Republic of the Congo": "cg",
  "Gabon": "ga",
  "Equatorial Guinea": "gq",
  "Nigeria": "ng",
  "Ghana": "gh",
  "Kenya": "ke",
  "Rwanda": "rw",
};

function CreateLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageUpload = useUpload({
    onSuccess: (response) => {
      form.setValue("imagePath", response.objectPath);
    },
    onError: (error) => {
      toast({ title: "Erreur upload image", description: error.message, variant: "destructive" });
    }
  });

  const form = useForm<z.infer<typeof createPaymentLinkSchema>>({
    resolver: zodResolver(createPaymentLinkSchema),
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
    },
  });

  const isFixedAmount = form.watch("isFixedAmount");
  const hasPdfDelivery = form.watch("hasPdfDelivery");
  const pdfPathValue = form.watch("pdfPath");

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
    const response = await fetch("/api/uploads/file", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!response.ok) throw new Error("Échec de l'upload");
    const result = await response.json();
    return result.url || result.objectPath;
  };

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof createPaymentLinkSchema>) => {
      let finalData = { ...data };
      
      if (imageFile) {
        const imageUrl = await uploadImage(imageFile);
        finalData.imagePath = imageUrl;
      }
      
      const res = await apiRequest("POST", "/api/payment-links", finalData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({ title: "Lien créé", description: "Votre lien de paiement a été créé avec succès" });
      form.reset();
      setImageFile(null);
      setImagePreview(null);
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Créer un lien de paiement</DialogTitle>
          <DialogDescription>Créez un lien partageable pour recevoir des paiements</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Paiement commande #123" {...field} data-testid="input-link-title" />
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
                      <Input placeholder="Description du paiement..." {...field} data-testid="input-link-description" />
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
                        <span className="text-muted-foreground text-sm">/pay/</span>
                        <Input placeholder="mon-lien-unique" {...field} data-testid="input-link-slug" />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">Laissez vide pour générer automatiquement</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Image (optionnel)
                </FormLabel>
                <FormDescription className="text-xs">
                  Cette image s'affichera sur la page de paiement
                </FormDescription>
                <div className="space-y-2">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    data-testid="input-link-image"
                  />
                  {imagePreview ? (
                    <div className="relative">
                      <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded-lg" />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6"
                        onClick={clearImage}
                      >
                        <X className="w-3 h-3" />
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
                </div>
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
                          data-testid="input-link-pdf-url"
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
                    <FormItem className="flex items-center justify-between rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
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
                          data-testid="switch-pdf-delivery"
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
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
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
                        data-testid="switch-fixed-amount"
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
                        <Input type="number" placeholder="10000" {...field} data-testid="input-link-amount" />
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
                      <Input type="datetime-local" {...field} data-testid="input-link-expiry" />
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
                      <Input placeholder="https://monsite.com/merci" {...field} data-testid="input-link-redirect" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-create-link-confirm">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Créer le lien
              </Button>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ title, value, icon: Icon, trend, color }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-muted-foreground text-sm mb-1">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {trend && <p className="text-xs text-green-500 mt-1">{trend}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditLinkDialog({ link, onClose, userCurrency }: { 
  link: PaymentLink; 
  onClose: () => void; 
  userCurrency: SupportedCurrency;
}) {
  const { toast } = useToast();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(link.imagePath || null);
  
  const imageUpload = useUpload({
    onError: (error) => {
      toast({ title: "Erreur upload image", description: error.message, variant: "destructive" });
    }
  });

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
  });

  const form = useForm<z.infer<typeof updateSchema>>({
    resolver: zodResolver(updateSchema),
    defaultValues: { 
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
    },
  });

  const isFixedAmount = form.watch("isFixedAmount");
  const hasPdfDelivery = form.watch("hasPdfDelivery");

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
    const response = await fetch("/api/uploads/file", {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!response.ok) throw new Error("Échec de l'upload");
    const result = await response.json();
    return result.url || result.objectPath;
  };

  const updateMutation = useMutation({
    mutationFn: async (data: z.infer<typeof updateSchema>) => {
      let finalData: Record<string, any> = { 
        title: data.title,
        description: data.description || null,
        customSlug: data.customSlug,
        isFixedAmount: data.isFixedAmount,
        amount: data.isFixedAmount ? data.amount : "0",
        hasPdfDelivery: data.hasPdfDelivery,
        pdfPath: data.pdfPath || null,
        redirectUrl: data.redirectUrl || null,
        expiresAt: data.expiresAt || null,
      };
      
      // Handle image upload
      if (imageFile) {
        const imageUrl = await uploadImage(imageFile);
        finalData.imagePath = imageUrl;
      } else if (!imagePreview) {
        finalData.imagePath = null;
      }
      
      const res = await apiRequest("PATCH", `/api/payment-links/${link.id}`, finalData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({ title: "Lien modifié", description: "Les modifications ont été enregistrées" });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Modifier le lien de paiement</DialogTitle>
          <DialogDescription>Modifiez les informations de votre lien</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
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
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{window.location.origin}/pay/</span>
                        <Input placeholder="mon-lien" {...field} data-testid="input-edit-slug" />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">
                      Laissez vide pour générer automatiquement
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  <span className="text-sm font-medium">Image (optionnel)</span>
                </div>
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} alt="Aperçu" className="w-full h-32 object-cover rounded-lg" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={clearImage}
                      data-testid="button-edit-clear-image"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <div 
                    className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover-elevate"
                    onClick={() => imageInputRef.current?.click()}
                  >
                    <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Cliquez pour ajouter une image</p>
                  </div>
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                  data-testid="input-edit-image-file"
                />
              </div>

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

              {form.watch("pdfPath") && (
                <FormField
                  control={form.control}
                  name="hasPdfDelivery"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-amber-500 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Livraison PDF après paiement
                        </FormLabel>
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
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
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
                      <FormLabel>Montant ({userCurrency}) *</FormLabel>
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

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onClose} className="flex-1" data-testid="button-edit-cancel">
                  Annuler
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="flex-1" data-testid="button-edit-save">
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface LinkAnalytics {
  paymentLink: PaymentLink;
  analytics: {
    totalTransactions: number;
    completedCount: number;
    pendingCount: number;
    failedCount: number;
    totalCollected: string;
    totalPending: string;
    clickCount: number;
    conversionRate: string;
  };
  transactions: Transaction[];
}

function LinkAnalyticsDialog({ 
  linkId, 
  onClose,
  userCurrency 
}: { 
  linkId: string | null; 
  onClose: () => void;
  userCurrency: SupportedCurrency;
}) {
  const { data, isLoading } = useQuery<LinkAnalytics>({
    queryKey: ["/api/payment-links", linkId, "analytics"],
    queryFn: async () => {
      const res = await fetch(`/api/payment-links/${linkId}/analytics`);
      if (!res.ok) throw new Error("Erreur de chargement");
      return res.json();
    },
    enabled: !!linkId,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Validé</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">En cours</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Rejeté</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={!!linkId} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {data?.paymentLink.imagePath && (
              <img 
                src={getImageSrc(data.paymentLink.imagePath)} 
                alt="" 
                className="w-10 h-10 rounded-lg object-cover"
              />
            )}
            {data?.paymentLink.title || "Chargement..."}
          </DialogTitle>
          <DialogDescription>
            Statistiques et historique des transactions
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <MousePointer className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                  <p className="text-2xl font-bold">{data.analytics.clickCount}</p>
                  <p className="text-xs text-muted-foreground">Clics</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <ArrowDownUp className="w-5 h-5 mx-auto mb-2 text-green-500" />
                  <p className="text-2xl font-bold">{data.analytics.completedCount}</p>
                  <p className="text-xs text-muted-foreground">Validés</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Clock className="w-5 h-5 mx-auto mb-2 text-amber-500" />
                  <p className="text-2xl font-bold">{data.analytics.pendingCount}</p>
                  <p className="text-xs text-muted-foreground">En cours</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <TrendingUp className="w-5 h-5 mx-auto mb-2 text-purple-500" />
                  <p className="text-2xl font-bold">{data.analytics.conversionRate}%</p>
                  <p className="text-xs text-muted-foreground">Conversion</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-muted-foreground text-sm mb-1">Total collecté</p>
                    <p className="text-xl font-bold text-green-500">
                      {formatCurrency(parseFloat(data.analytics.totalCollected), userCurrency)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-muted-foreground text-sm mb-1">En attente</p>
                    <p className="text-xl font-bold text-amber-500">
                      {formatCurrency(parseFloat(data.analytics.totalPending), userCurrency)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Historique des transactions ({data.transactions.length})
                </h4>
                {data.transactions.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    Aucune transaction pour ce lien
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.transactions.map((tx) => (
                      <div 
                        key={tx.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{tx.payerName || "Client"}</p>
                            {getStatusBadge(tx.status)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {tx.payerEmail} {tx.createdAt && `• ${format(new Date(tx.createdAt), "dd/MM/yyyy HH:mm", { locale: fr })}`}
                          </p>
                        </div>
                        <p className={`font-bold ${tx.status === "completed" ? "text-green-500" : tx.status === "pending" ? "text-amber-500" : "text-red-500"}`}>
                          {formatCurrency(parseFloat(tx.amount), tx.currency as SupportedCurrency)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default function PaymentLinksPage() {
  const [, navigate] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [selectedLink, setSelectedLink] = useState("all");
  const [activeTab, setActiveTab] = useState("analytics");
  const [showAllRecentLinks, setShowAllRecentLinks] = useState(false);
  const [qrModalLink, setQrModalLink] = useState<PaymentLink | null>(null);
  const [editModalLink, setEditModalLink] = useState<PaymentLink | null>(null);
  const { toast } = useToast();
  
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: paymentLinks = [], isLoading } = useQuery<PaymentLink[]>({
    queryKey: ["/api/payment-links"],
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: paymentIntents = [] } = useQuery<PaymentIntent[]>({
    queryKey: ["/api/payment-intents"],
  });

  const { data: countriesData } = useQuery<{ countries: Array<{ id: string; name: string; flag: string; code: string }> }>({
    queryKey: ["/api/public/deposit-config"],
  });
  const countriesList = countriesData?.countries || [];

  const getCountryDisplay = (countryValue: string | null | undefined): string => {
    if (!countryValue) return "Autre";
    // If it looks like a UUID, try to find the country
    if (countryValue.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const country = countriesList.find(c => c.id === countryValue);
      return country ? `${country.flag || ''} ${country.name}`.trim() : countryValue;
    }
    return countryValue;
  };

  const getOperatorDisplay = (operatorValue: string | null | undefined): string => {
    if (!operatorValue) return "";
    // If it looks like a UUID, try to find the operator
    if (operatorValue.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      for (const country of countriesList) {
        const operators = (country as any).operators || [];
        const operator = operators.find((o: { id: string; name: string }) => o.id === operatorValue);
        if (operator) return operator.name;
      }
      return operatorValue;
    }
    return operatorValue;
  };

  const deactivateMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/payment-links/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({ title: "Lien mis à jour", description: "Le statut du lien a été modifié" });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier le lien", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/payment-links/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({ title: "Lien supprimé", description: "Le lien a été supprimé définitivement" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erreur", 
        description: error.message || "Impossible de supprimer le lien", 
        variant: "destructive" 
      });
    },
  });

  const getLinkStats = (linkId: string) => {
    const toXAF = (amount: string, currency: string) => {
      const rate = EXCHANGE_RATES[currency as SupportedCurrency] || 1;
      return parseFloat(amount) / rate;
    };
    const linkIntents = paymentIntents.filter(i => i.paymentLinkId === linkId && i.status === "completed");
    const totalCollected = linkIntents.reduce((sum, i) => {
      const grossAmount = toXAF(i.amount, i.currency);
      const feeAmount = i.feeAmount ? toXAF(i.feeAmount, i.currency) : 0;
      return sum + (grossAmount - feeAmount);
    }, 0);
    return { totalCollected, transactionCount: linkIntents.length };
  };

  const generatePDF = (link: PaymentLink) => {
    const stats = getLinkStats(link.id);
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(20);
    doc.text("Rapport du lien de paiement", pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.text(link.title, 20, 40);
    
    doc.setFontSize(12);
    doc.text(`URL: ${window.location.origin}/pay/${link.slug}`, 20, 55);
    doc.text(`Type: ${link.isFixedAmount ? "Montant fixe" : "Montant flexible"}`, 20, 65);
    doc.text(`Montant: ${link.isFixedAmount ? formatCurrency(link.amount, (user?.preferredCurrency || "XAF") as SupportedCurrency) : "Variable"}`, 20, 75);
    doc.text(`Statut: ${link.isActive ? "Actif" : "Inactif"}`, 20, 85);
    doc.text(`Clics: ${link.clickCount || 0}`, 20, 100);
    doc.text(`Transactions: ${stats.transactionCount}`, 20, 110);
    doc.text(`Total collecté: ${formatCurrency(stats.totalCollected, (user?.preferredCurrency || "XAF") as SupportedCurrency)}`, 20, 120);
    doc.text(`Créé le: ${link.createdAt ? format(new Date(link.createdAt), "dd/MM/yyyy HH:mm", { locale: fr }) : "-"}`, 20, 135);
    
    doc.save(`${link.slug}-rapport.pdf`);
    toast({ title: "PDF téléchargé", description: "Le rapport a été généré avec succès" });
  };

  const analytics = useMemo(() => {
    const toXAF = (amount: string, currency: string) => {
      const rate = EXCHANGE_RATES[currency as SupportedCurrency] || 1;
      return parseFloat(amount) / rate;
    };

    const totalClicks = paymentLinks.reduce((sum, link) => sum + (link.clickCount || 0), 0);
    const completedIntents = paymentIntents.filter(i => i.status === "completed");
    const getNetAmount = (i: typeof completedIntents[0]) => {
      const gross = toXAF(i.amount, i.currency);
      const fee = i.feeAmount ? toXAF(i.feeAmount, i.currency) : 0;
      return gross - fee;
    };
    const totalCollected = completedIntents.reduce((sum, i) => sum + getNetAmount(i), 0);
    
    const countryStats: Record<string, number> = {};
    completedIntents.forEach(intent => {
      const country = getCountryDisplay(intent.payerCountry);
      countryStats[country] = (countryStats[country] || 0) + getNetAmount(intent);
    });
    
    const totalForCountries = Object.values(countryStats).reduce((a, b) => a + b, 0) || 1;
    const countries = Object.entries(countryStats)
      .map(([name, amount]) => ({
        name,
        code: countryCodeMap[name] || "other",
        amount,
        percentage: Math.round((amount / totalForCountries) * 100)
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const methodStats: Record<string, number> = {};
    completedIntents.forEach(intent => {
      const method = intent.paymentMethod || "other";
      methodStats[method] = (methodStats[method] || 0) + getNetAmount(intent);
    });
    const totalForMethods = Object.values(methodStats).reduce((a, b) => a + b, 0) || 1;
    const methodColors: Record<string, string> = {
      "mobile_money": "#F0B90B",
      "card": "#3B82F6",
      "paypal": "#22C55E",
      "other": "#A855F7"
    };
    const methodLabels: Record<string, string> = {
      "mobile_money": "Mobile Money",
      "card": "Carte bancaire",
      "paypal": "PayPal",
      "other": "Autre"
    };
    const sources = Object.entries(methodStats).map(([method, amount]) => ({
      name: methodLabels[method] || method,
      value: Math.round((amount / totalForMethods) * 100),
      color: methodColors[method] || "#A855F7"
    }));

    return {
      clicks: totalClicks,
      transactions: completedIntents.length,
      totalCollected,
      countries,
      sources: sources.length > 0 ? sources : [{ name: "Aucune donnée", value: 100, color: "#6B7280" }],
    };
  }, [paymentLinks, paymentIntents, countriesList]);

  const chartData = useMemo(() => {
    const toXAF = (amount: string, currency: string) => {
      const rate = EXCHANGE_RATES[currency as SupportedCurrency] || 1;
      return parseFloat(amount) / rate;
    };
    const getNetAmount = (i: typeof paymentIntents[0]) => {
      const gross = toXAF(i.amount, i.currency);
      const fee = i.feeAmount ? toXAF(i.feeAmount, i.currency) : 0;
      return gross - fee;
    };
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    const completedIntents = paymentIntents.filter(i => i.status === "completed");

    if (selectedPeriod === "week") {
      const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
      const weekData = days.map(period => ({ period, amount: 0 }));
      
      completedIntents.forEach(intent => {
        if (!intent.createdAt) return;
        const date = new Date(intent.createdAt);
        const weekAgo = subDays(new Date(), 7);
        if (date >= weekAgo) {
          const dayIndex = date.getDay();
          weekData[dayIndex].amount += getNetAmount(intent);
        }
      });
      return weekData;
    } else {
      const now = new Date();
      const last6Months: { period: string; amount: number; year: number; month: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(now, i);
        last6Months.push({
          period: monthNames[d.getMonth()],
          amount: 0,
          year: d.getFullYear(),
          month: d.getMonth()
        });
      }
      
      completedIntents.forEach(intent => {
        if (!intent.createdAt) return;
        const date = new Date(intent.createdAt);
        const bucket = last6Months.find(b => b.year === date.getFullYear() && b.month === date.getMonth());
        if (bucket) {
          bucket.amount += getNetAmount(intent);
        }
      });
      return last6Months.map(({ period, amount }) => ({ period, amount }));
    }
  }, [paymentIntents, selectedPeriod]);

  // Sort links by creation date (most recent first) and take the first 5
  const sortedLinks = useMemo(() => {
    return [...paymentLinks].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [paymentLinks]);

  const recentLinks = showAllRecentLinks ? sortedLinks : sortedLinks.slice(0, 5);

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/pay/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Lien copié", description: "Le lien a été copié dans le presse-papier" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Mes liens de paiement</h1>
            <p className="text-muted-foreground">Gérez vos liens et analysez vos performances</p>
          </div>
          <Button onClick={() => setShowCreate(true)} data-testid="button-new-link">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau lien
          </Button>
        </div>

        {/* Recent Links Section */}
        {paymentLinks.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 pb-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  Liens récents
                </CardTitle>
                <CardDescription>
                  {showAllRecentLinks 
                    ? `Tous vos ${sortedLinks.length} liens` 
                    : `Les ${Math.min(5, sortedLinks.length)} derniers liens créés`}
                </CardDescription>
              </div>
              {sortedLinks.length > 5 && (
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={() => setShowAllRecentLinks(!showAllRecentLinks)}
                  data-testid="button-toggle-all-links"
                >
                  {showAllRecentLinks ? (
                    <XCircle className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {recentLinks.map((link) => {
                  const stats = getLinkStats(link.id);
                  return (
                    <div 
                      key={link.id} 
                      className={`p-4 rounded-lg border ${link.isActive ? 'bg-muted/30 border-border' : 'bg-muted/10 border-border/50 opacity-60'} cursor-pointer hover-elevate transition-all`}
                      data-testid={`recent-link-${link.id}`}
                      onClick={() => navigate(`/dashboard/links/${link.id}`)}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          {link.imagePath ? (
                            <img 
                              src={getImageSrc(link.imagePath)} 
                              alt={link.title}
                              className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Link2 className="w-6 h-6 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-bold text-lg text-foreground truncate">{link.title}</h4>
                              <span className="font-bold text-lg text-foreground whitespace-nowrap">
                                {formatCurrency(stats.totalCollected, (user?.preferredCurrency || "XAF") as SupportedCurrency)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                              <Eye className="w-4 h-4" />
                              <span>{link.clickCount || 0} clics</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="border-t border-border pt-3 space-y-1">
                          <p className="text-sm text-muted-foreground break-all">
                            {window.location.origin}/pay/{link.slug}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {link.isFixedAmount 
                              ? formatCurrency(link.amount, (user?.preferredCurrency || "XAF") as SupportedCurrency)
                              : "Montant flexible"}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between pt-2 border-t border-border gap-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => { e.stopPropagation(); copyLink(link.slug); }} 
                              title="Copier le lien"
                              data-testid={`button-copy-${link.id}`}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => { e.stopPropagation(); setQrModalLink(link); }}
                              title="Afficher QR code"
                              data-testid={`button-qr-${link.id}`}
                            >
                              <QrCode className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => { e.stopPropagation(); generatePDF(link); }}
                              title="Télécharger PDF"
                              data-testid={`button-pdf-${link.id}`}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" asChild title="Ouvrir le lien" onClick={(e) => e.stopPropagation()}>
                              <a href={`/pay/${link.slug}`} target="_blank" rel="noopener noreferrer" data-testid={`button-open-${link.id}`}>
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </Button>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); setEditModalLink(link); }}
                              title="Modifier"
                              data-testid={`button-edit-${link.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); deactivateMutation.mutate({ id: link.id, isActive: !link.isActive }); }}
                              title={link.isActive ? "Désactiver" : "Activer"}
                              className={link.isActive ? "text-orange-500 hover:text-orange-600" : "text-green-500 hover:text-green-600"}
                              data-testid={`button-toggle-${link.id}`}
                            >
                              <Power className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Êtes-vous sûr de vouloir supprimer ce lien définitivement ?")) {
                                  deleteMutation.mutate(link.id);
                                }
                              }}
                              title="Supprimer"
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-${link.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedLink} onValueChange={setSelectedLink}>
              <SelectTrigger className="w-48" data-testid="select-link-filter">
                <SelectValue placeholder="Tous les liens" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les liens</SelectItem>
                {paymentLinks.map((link) => (
                  <SelectItem key={link.id} value={link.id}>{link.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48" data-testid="select-period-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard 
            title="Clics sur les liens" 
            value={analytics.clicks.toLocaleString('fr-FR')} 
            icon={MousePointer} 
            trend="+12% vs période précédente"
            color="bg-blue-500/10 text-blue-500"
          />
          <StatCard 
            title="Transactions" 
            value={analytics.transactions} 
            icon={ArrowDownUp} 
            trend="+8% vs période précédente"
            color="bg-green-500/10 text-green-500"
          />
          <StatCard 
            title="Total collecté" 
            value={formatCurrency(analytics.totalCollected, (user?.preferredCurrency || "XAF") as SupportedCurrency)} 
            icon={Wallet} 
            color="bg-primary/10 text-primary"
          />
          <StatCard 
            title="Taux de conversion" 
            value={analytics.clicks > 0 ? `${((analytics.transactions / analytics.clicks) * 100).toFixed(1)}%` : "0%"}
            icon={TrendingUp} 
            color="bg-purple-500/10 text-purple-500"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-2 h-auto bg-transparent p-0">
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analytiques
            </TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-payments">
              <Wallet className="w-4 h-4 mr-2" />
              Paiements ({paymentIntents.length})
            </TabsTrigger>
            <TabsTrigger value="links" data-testid="tab-links">
              <Link2 className="w-4 h-4 mr-2" />
              Liens ({paymentLinks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6 mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Montants collectés par période
                  </CardTitle>
                  <CardDescription>
                    {selectedPeriod === "week" ? "Cette semaine" : "Ces 6 derniers mois"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis 
                          dataKey="period" 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                        />
                        <YAxis 
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                        />
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value, (user?.preferredCurrency || "XAF") as SupportedCurrency), "Montant"]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          labelStyle={{ color: "hsl(var(--foreground))" }}
                        />
                        <Bar dataKey="amount" fill="#F0B90B" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Pays principaux
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analytics.countries.map((country) => (
                    <div key={country.code} className="flex items-center gap-3">
                      {country.code !== "other" && (
                        <img 
                          src={`https://flagcdn.com/w40/${country.code}.png`}
                          alt={country.name}
                          className="w-6 h-4 rounded object-cover"
                        />
                      )}
                      {country.code === "other" && (
                        <div className="w-6 h-4 bg-muted rounded flex items-center justify-center">
                          <Globe className="w-3 h-3 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-foreground">{country.name}</span>
                          <span className="text-xs text-muted-foreground">{country.percentage}%</span>
                        </div>
                        <div className="w-full h-2 bg-muted rounded-full">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${country.percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Sources de paiement</CardTitle>
                <CardDescription>Répartition des paiements par méthode</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.sources}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {analytics.sources.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`${value}%`, "Part"]}
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-4 flex flex-col justify-center">
                    {analytics.sources.map((source) => (
                      <div key={source.name} className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: source.color }} 
                        />
                        <span className="flex-1 text-foreground">{source.name}</span>
                        <span className="font-semibold text-foreground">{source.value}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Paiements reçus
                </CardTitle>
                <CardDescription>Tous les paiements effectués via vos liens</CardDescription>
              </CardHeader>
              <CardContent>
                {paymentIntents.length === 0 ? (
                  <div className="text-center py-12">
                    <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Aucun paiement reçu pour le moment</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paymentIntents.map((intent) => (
                      <div key={intent.id} className="p-4 rounded-lg bg-muted/30 border border-border" data-testid={`payment-${intent.id}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-foreground">{intent.payerName}</h4>
                              {intent.status === "completed" ? (
                                <span className="flex items-center gap-1 text-xs text-green-500">
                                  <CheckCircle className="w-3 h-3" /> Complété
                                </span>
                              ) : intent.status === "pending" ? (
                                <span className="flex items-center gap-1 text-xs text-yellow-500">
                                  <Loader2 className="w-3 h-3" /> En attente
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-red-500">
                                  <XCircle className="w-3 h-3" /> Échoué
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                              <span>{intent.payerEmail}</span>
                              <span>{intent.payerPhone}</span>
                              <span>{getCountryDisplay(intent.payerCountry)}</span>
                            </div>
                            <div className="flex items-center gap-4 mt-2 flex-wrap">
                              <div className="flex flex-col">
                                <span className="text-lg font-bold text-primary">
                                  {formatCurrency(
                                    intent.feeAmount 
                                      ? parseFloat(String(intent.amount)) - parseFloat(intent.feeAmount)
                                      : parseFloat(String(intent.amount)),
                                    (intent.currency as SupportedCurrency) || "XAF"
                                  )}
                                </span>
                                {intent.feeAmount && parseFloat(intent.feeAmount) > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    Montant payé: {formatCurrency(intent.amount, (intent.currency as SupportedCurrency) || "XAF")}
                                    <span className="text-amber-500 ml-1">
                                      (-{formatCurrency(parseFloat(intent.feeAmount), (intent.currency as SupportedCurrency) || "XAF")} frais)
                                    </span>
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {intent.paymentMethod === "mobile_money" ? "Mobile Money" : intent.paymentMethod}
                                {intent.operator && ` - ${getOperatorDisplay(intent.operator)}`}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                Réf: {intent.reference}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              {intent.createdAt ? format(new Date(intent.createdAt), "d MMMM yyyy à HH:mm", { locale: fr }) : "-"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="links" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  Tous les liens
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                ) : paymentLinks.length === 0 ? (
                  <div className="text-center py-12">
                    <Link2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">Aucun lien de paiement créé</p>
                    <Button onClick={() => setShowCreate(true)} data-testid="button-create-first-link">
                      <Plus className="w-4 h-4 mr-2" />
                      Créer votre premier lien
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paymentLinks.map((link) => {
                      const stats = getLinkStats(link.id);
                      return (
                        <div 
                          key={link.id} 
                          className={`p-4 rounded-lg border ${link.isActive ? 'bg-muted/30 border-border' : 'bg-muted/10 border-border/50 opacity-60'}`}
                          data-testid={`link-item-${link.id}`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-lg text-foreground">{link.title}</h4>
                                {link.isActive ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                              <span className="font-bold text-lg text-foreground whitespace-nowrap">
                                {formatCurrency(stats.totalCollected, (user?.preferredCurrency || "XAF") as SupportedCurrency)}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4 text-muted-foreground text-sm">
                              <span className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                {link.clickCount || 0} clics
                              </span>
                              <span className="flex items-center gap-1">
                                <ArrowDownUp className="w-4 h-4" />
                                {stats.transactionCount} paiements
                              </span>
                            </div>
                            
                            {link.description && <p className="text-sm text-muted-foreground">{link.description}</p>}
                            
                            <div className="border-t border-border pt-3 space-y-1">
                              <p className="text-sm text-muted-foreground break-all">
                                {window.location.origin}/pay/{link.slug}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {link.isFixedAmount 
                                  ? formatCurrency(link.amount, (user?.preferredCurrency || "XAF") as SupportedCurrency)
                                  : "Montant flexible"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Créé le {link.createdAt ? format(new Date(link.createdAt), "d MMMM yyyy", { locale: fr }) : "-"}
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-between pt-2 border-t border-border gap-2 flex-wrap">
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => copyLink(link.slug)} title="Copier" data-testid={`button-copy-all-${link.id}`}>
                                  <Copy className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setQrModalLink(link)} title="QR Code" data-testid={`button-qr-all-${link.id}`}>
                                  <QrCode className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => generatePDF(link)} title="Télécharger PDF" data-testid={`button-pdf-all-${link.id}`}>
                                  <Download className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" asChild title="Ouvrir">
                                  <a href={`/pay/${link.slug}`} target="_blank" rel="noopener noreferrer" data-testid={`button-open-all-${link.id}`}>
                                    <ExternalLink className="w-4 h-4" />
                                  </a>
                                </Button>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => setEditModalLink(link)} title="Modifier" data-testid={`button-edit-all-${link.id}`}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => deactivateMutation.mutate({ id: link.id, isActive: !link.isActive })}
                                  title={link.isActive ? "Désactiver" : "Activer"}
                                  className={link.isActive ? "text-orange-500 hover:text-orange-600" : "text-green-500 hover:text-green-600"}
                                  data-testid={`button-toggle-all-${link.id}`}
                                >
                                  <Power className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  onClick={() => {
                                    if (confirm("Êtes-vous sûr de vouloir supprimer ce lien définitivement ?")) {
                                      deleteMutation.mutate(link.id);
                                    }
                                  }}
                                  title="Supprimer"
                                  className="text-destructive hover:text-destructive"
                                  data-testid={`button-delete-all-${link.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <CreateLinkDialog open={showCreate} onClose={() => setShowCreate(false)} />

      {/* QR Code Modal */}
      <Dialog open={!!qrModalLink} onOpenChange={() => setQrModalLink(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code</DialogTitle>
            <DialogDescription>
              Scannez ce code pour accéder au lien de paiement
            </DialogDescription>
          </DialogHeader>
          {qrModalLink && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG 
                  value={`${window.location.origin}/pay/${qrModalLink.slug}`}
                  size={200}
                  level="H"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center break-all">
                {window.location.origin}/pay/{qrModalLink.slug}
              </p>
              <Button onClick={() => copyLink(qrModalLink.slug)} className="w-full" data-testid="button-copy-qr-link">
                <Copy className="w-4 h-4 mr-2" />
                Copier le lien
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Link Modal */}
      {editModalLink && (
        <EditLinkDialog 
          link={editModalLink} 
          onClose={() => setEditModalLink(null)} 
          userCurrency={(user?.preferredCurrency || "XAF") as SupportedCurrency}
        />
      )}

    </DashboardLayout>
  );
}
