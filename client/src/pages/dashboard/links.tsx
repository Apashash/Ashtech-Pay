import { useState, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BottomSheet, BottomSheetContent, BottomSheetDescription, BottomSheetHeader, BottomSheetTitle } from "@/components/ui/bottom-sheet";
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
import { apiRequest, queryClient, getAuthHeaders } from "@/lib/queryClient";
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
import { formatCurrency, formatWalletBalance } from "@/lib/currency";
import { useUpload } from "@/hooks/use-upload";
import { useLanguage } from "@/lib/language";
import { uploadPaymentLinkImage } from "@/lib/payment-link-image";
import { getOperatorDisplayName } from "@/lib/operator-logos";

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
  "Rwanda": "rw",
};

function CreateLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageUpload = useUpload({
    onSuccess: (response) => {
      form.setValue("imagePath", response.objectPath);
    },
    onError: (error) => {
      toast({ title: t.links.toastUploadError, description: error.message, variant: "destructive" });
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
    return uploadPaymentLinkImage(file, getAuthHeaders(), "Échec de l'upload");
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
      toast({ title: t.links.toastLinkCreated, description: t.links.toastLinkCreatedDesc });
      form.reset();
      setImageFile(null);
      setImagePreview(null);
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: t.links.toastError, description: error.message, variant: "destructive" });
    },
  });

  return (
    <BottomSheet open={open} onOpenChange={onClose}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>{t.links.createDialogTitle}</BottomSheetTitle>
          <BottomSheetDescription>{t.links.createDialogDesc}</BottomSheetDescription>
        </BottomSheetHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.links.formTitle}</FormLabel>
                    <FormControl>
                      <Input placeholder={t.links.formTitlePlaceholder} {...field} data-testid="input-link-title" />
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
                    <FormLabel>{t.links.formDesc}</FormLabel>
                    <FormControl>
                      <Input placeholder={t.links.formDescPlaceholder} {...field} data-testid="input-link-description" />
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
                      {t.links.formSlug}
                    </FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-sm">/pay/</span>
                        <Input placeholder="mon-lien-unique" {...field} data-testid="input-link-slug" />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">{t.links.formSlugHint}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  {t.links.formImage}
                </FormLabel>
                <FormDescription className="text-xs">
                  {t.links.formImageDesc}
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
                      {t.links.formImageUpload}
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
                      {t.links.formPdf}
                    </FormLabel>
                    <FormDescription className="text-xs text-amber-500">
                      {t.links.formPdfDesc}
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
                        <FormLabel className="text-amber-500">{t.links.formPdfDelivery}</FormLabel>
                        <FormDescription className="text-xs">
                          {t.links.formPdfDeliveryDesc}
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
                      <FormLabel>{t.links.formAmountType}</FormLabel>
                      <FormDescription className="text-xs">
                        {field.value ? t.links.formFixed : t.links.formFree}
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
                      <FormLabel>{t.links.formAmount} ({user?.preferredCurrency || "XAF"}) *</FormLabel>
                      <FormControl>
                        <Input type="text" inputMode="decimal" placeholder="10000" {...field} data-testid="input-link-amount" />
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
                      {t.links.formExpiry}
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
                      {t.links.formRedirect}
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
                {t.links.formCreateButton}
              </Button>
            </form>
          </Form>
        </ScrollArea>
      </BottomSheetContent>
    </BottomSheet>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground select-none pb-1">
      {children}
    </p>
  );
}

function StatCard({ title, value, icon: Icon, imageSrc, trend, color }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  imageSrc?: string;
  trend?: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 flex items-center gap-4 shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            aria-hidden="true"
            className="h-10 w-10 object-contain drop-shadow-[0_3px_3px_rgba(0,0,0,0.14)]"
          />
        ) : (
          <Icon className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-normal text-foreground">{title}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
        {trend && <p className="text-xs text-green-500">{trend}</p>}
      </div>
    </div>
  );
}

function EditLinkDialog({ link, onClose, userCurrency }: { 
  link: PaymentLink; 
  onClose: () => void; 
  userCurrency: SupportedCurrency;
}) {
  const { toast } = useToast();
  const { t } = useLanguage();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(link.imagePath || null);
  
  const imageUpload = useUpload({
    onError: (error) => {
      toast({ title: t.links.toastUploadError, description: error.message, variant: "destructive" });
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
    return uploadPaymentLinkImage(file, getAuthHeaders(), "Échec de l'upload");
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
      toast({ title: t.links.toastLinkUpdated, description: t.links.toastLinkUpdatedDesc });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: t.links.toastError, description: error.message, variant: "destructive" });
    },
  });

  return (
    <BottomSheet open={true} onOpenChange={onClose}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle>{t.links.editDialogTitle}</BottomSheetTitle>
          <BottomSheetDescription>{t.links.editDialogDesc}</BottomSheetDescription>
        </BottomSheetHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.links.formTitle}</FormLabel>
                    <FormControl>
                      <Input placeholder={t.links.formTitlePlaceholder} {...field} data-testid="input-edit-title" />
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
                    <FormLabel>{t.links.formDesc}</FormLabel>
                    <FormControl>
                      <Input placeholder={t.links.formDescPlaceholder} {...field} data-testid="input-edit-description" />
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
                      {t.links.formSlug}
                    </FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground whitespace-nowrap">{window.location.origin}/pay/</span>
                        <Input placeholder="mon-lien" {...field} data-testid="input-edit-slug" />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">
                      {t.links.formSlugHint}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3 rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  <span className="text-sm font-medium">{t.links.formImage}</span>
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
                    <p className="text-xs text-muted-foreground">{t.links.formImageAdd}</p>
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
                      {t.links.formPdf}
                    </FormLabel>
                    <FormDescription className="text-xs text-amber-500">
                      {t.links.formPdfDesc}
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
                          {t.links.formPdfDelivery}
                        </FormLabel>
                        <FormDescription className="text-xs">
                          {t.links.formPdfDeliveryDesc}
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
                      <FormLabel>{t.links.formAmountType}</FormLabel>
                      <FormDescription className="text-xs">
                        {field.value ? t.links.formFixed : t.links.formFree}
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
                      <FormLabel>{t.links.formAmount} ({userCurrency}) *</FormLabel>
                      <FormControl>
                        <Input type="text" inputMode="decimal" placeholder="10000" {...field} data-testid="input-edit-amount" />
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
                      {t.links.formExpiry}
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
                      {t.links.formRedirect}
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
                  {t.links.cancel}
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="flex-1" data-testid="button-edit-save">
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t.links.formSaveButton}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </BottomSheetContent>
    </BottomSheet>
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
  const { t } = useLanguage();
  const { data, isLoading } = useQuery<LinkAnalytics>({
    queryKey: ["/api/payment-links", linkId, "analytics"],
    queryFn: async () => {
      const res = await fetch(`/api/payment-links/${linkId}/analytics`, { credentials: "include", headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Erreur de chargement");
      return res.json();
    },
    enabled: !!linkId,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "success":
      case "succeeded":
        return <Badge className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-600 border-green-500/30 font-medium">{t.transactions.statusCompleted}</Badge>;
      case "pending":
      case "pending_manual":
        return <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-600 border-amber-500/30 font-medium">{t.transactions.statusPending}</Badge>;
      case "failed":
        return <Badge className="text-[10px] px-1.5 py-0 bg-red-500/20 text-red-600 border-red-500/30 font-medium">{t.transactions.statusFailed}</Badge>;
      case "cancelled":
        return <Badge className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground font-medium">{t.transactions.statusCancelled}</Badge>;
      default:
        return <Badge className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">{status}</Badge>;
    }
  };

  const getTransactionRowClass = (status: string) => {
    if (["completed", "success", "succeeded"].includes(status)) {
      return "border-l-4 border-green-500 bg-green-500/10 hover:bg-green-500/15";
    }
    if (["pending", "pending_manual"].includes(status)) {
      return "border-l-4 border-amber-500 bg-amber-500/10 hover:bg-amber-500/15";
    }
    if (["failed", "cancelled", "rejected"].includes(status)) {
      return "border-l-4 border-red-500 bg-red-500/10 hover:bg-red-500/15";
    }
    return "hover:bg-muted/40";
  };

  const getAmountColor = (tx: Transaction) => {
    if (["completed", "success", "succeeded"].includes(tx.status)) return "text-green-500";
    if (tx.status === "pending" || tx.status === "pending_manual") return "text-amber-500";
    return "text-muted-foreground";
  };

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};
    for (const tx of data?.transactions || []) {
      const dateKey = tx.createdAt ? format(new Date(tx.createdAt), "yyyy-MM-dd") : "inconnu";
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(tx);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [data?.transactions]);

  const formatDateLabel = (dateKey: string) => {
    try {
      const date = new Date(dateKey);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (format(date, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) return t.transactions.today;
      if (format(date, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd")) return t.transactions.yesterday;
      return format(date, "d MMMM yyyy", { locale: fr });
    } catch {
      return dateKey;
    }
  };

  return (
    <BottomSheet open={!!linkId} onOpenChange={onClose}>
      <BottomSheetContent>
        <BottomSheetHeader>
          <BottomSheetTitle className="flex items-center gap-3">
            {data?.paymentLink.imagePath && (
              <img 
                src={getImageSrc(data.paymentLink.imagePath)} 
                alt="" 
                className="w-10 h-10 rounded-lg object-cover"
              />
            )}
            {data?.paymentLink.title || "Chargement..."}
          </BottomSheetTitle>
          <BottomSheetDescription>
            Statistiques et historique des transactions
          </BottomSheetDescription>
        </BottomSheetHeader>
        
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
                  <p className="text-xl font-bold">{data.analytics.clickCount}</p>
                  <p className="text-xs text-muted-foreground">Clics</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <ArrowDownUp className="w-5 h-5 mx-auto mb-2 text-green-500" />
                  <p className="text-xl font-bold">{data.analytics.completedCount}</p>
                  <p className="text-xs text-muted-foreground">Validés</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <Clock className="w-5 h-5 mx-auto mb-2 text-amber-500" />
                  <p className="text-xl font-bold">{data.analytics.pendingCount}</p>
                  <p className="text-xs text-muted-foreground">En cours</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <TrendingUp className="w-5 h-5 mx-auto mb-2 text-purple-500" />
                  <p className="text-xl font-bold">{data.analytics.conversionRate}%</p>
                  <p className="text-xs text-muted-foreground">Conversion</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-muted-foreground text-xs mb-1">Total collecté</p>
                    <p className="text-lg font-bold text-green-500">
                      {formatCurrency(parseFloat(data.analytics.totalCollected), userCurrency)}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-muted-foreground text-xs mb-1">En attente</p>
                    <p className="text-lg font-bold text-amber-500">
                      {formatCurrency(parseFloat(data.analytics.totalPending), userCurrency)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Historique des transactions ({data.transactions.length})
                </h4>
                {data.transactions.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    Aucune transaction pour ce lien
                  </p>
                ) : (
                  <div className="space-y-5">
                    {groupedByDate.map(([dateKey, txs]) => (
                      <div key={dateKey}>
                        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground mb-3">
                          {formatDateLabel(dateKey)}
                        </p>
                        <div className="space-y-3">
                          {txs.map((tx) => (
                            <div
                              key={tx.id}
                              className={`flex items-center gap-3 rounded-2xl border border-border/70 px-4 py-4 shadow-sm transition-colors ${getTransactionRowClass(tx.status)}`}
                              data-testid={`link-transaction-item-${tx.id}`}
                            >
                              <div className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-primary/10">
                                <img
                                  src="/sidebar-icons/links.png"
                                  alt=""
                                  aria-hidden="true"
                                  className="h-7 w-7 object-contain drop-shadow-[0_3px_3px_rgba(0,0,0,0.14)]"
                                />
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-normal text-foreground truncate max-w-[180px]">
                                    {t.transactions.typePaymentLink}
                                  </p>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {tx.payerName || tx.payerEmail || "—"}
                                  {tx.createdAt && <span className="ml-1">· {format(new Date(tx.createdAt), "HH:mm")}</span>}
                                </p>
                              </div>

                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className={`text-sm font-medium whitespace-nowrap ${getAmountColor(tx)}`}>
                                  +{formatWalletBalance(tx.amount, tx.currency || userCurrency)}
                                </span>
                                {getStatusBadge(tx.status)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </BottomSheetContent>
    </BottomSheet>
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
  const { toast } = useToast();
  const { t } = useLanguage();

  const periodOptions = [
    { value: "today", label: t.links.periodToday },
    { value: "week", label: t.links.periodWeek },
    { value: "month", label: t.links.periodMonth },
    { value: "last_month", label: t.links.periodLastMonth },
    { value: "year", label: t.links.periodYear },
    { value: "all", label: t.links.periodAll },
  ];
  
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
        if (operator) return getOperatorDisplayName(operator.name);
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
      toast({ title: t.links.toastLinkUpdated, description: t.links.toastLinkUpdatedDesc });
    },
    onError: () => {
      toast({ title: t.links.toastError, description: "Impossible de modifier le lien", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/payment-links/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({ title: t.links.toastDeleted, description: t.links.toastDeletedDesc });
    },
    onError: (error: Error) => {
      toast({ 
        title: t.links.toastError, 
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
    doc.text(t.links.pdfReportTitle, pageWidth / 2, 20, { align: "center" });
    
    doc.setFontSize(14);
    doc.text(link.title, 20, 40);
    
    doc.setFontSize(12);
    doc.text(`URL: ${window.location.origin}/pay/${link.slug}`, 20, 55);
    doc.text(`Type: ${link.isFixedAmount ? t.links.pdfFixed : t.links.pdfFree}`, 20, 65);
    doc.text(`Montant: ${link.isFixedAmount ? formatCurrency(link.amount, (user?.preferredCurrency || "XAF") as SupportedCurrency) : t.links.pdfFree}`, 20, 75);
    doc.text(`Statut: ${link.isActive ? t.links.pdfActive : t.links.pdfInactive}`, 20, 85);
    doc.text(`Clics: ${link.clickCount || 0}`, 20, 100);
    doc.text(`Transactions: ${stats.transactionCount}`, 20, 110);
    doc.text(`Total: ${formatCurrency(stats.totalCollected, (user?.preferredCurrency || "XAF") as SupportedCurrency)}`, 20, 120);
    doc.text(`Date: ${link.createdAt ? format(new Date(link.createdAt), "dd/MM/yyyy HH:mm", { locale: fr }) : "-"}`, 20, 135);
    
    doc.save(`${link.slug}-rapport.pdf`);
    toast({ title: t.links.toastPdf, description: t.links.toastPdfDesc });
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
      "mobile_money": t.links.methodMobileMoney,
      "card": t.links.methodCard,
      "paypal": t.links.methodPaypal,
      "other": t.links.methodOther,
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
      sources: sources.length > 0 ? sources : [{ name: t.links.noData, value: 100, color: "#6B7280" }],
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
    toast({ title: t.links.toastCopied, description: t.links.toastCopiedDesc });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t.links.title}</h1>
          </div>
          <Button className="h-12 rounded-2xl px-4 text-sm shadow-sm" onClick={() => navigate("/dashboard/links/new")} data-testid="button-new-link">
            <Plus className="w-4 h-4 mr-2" />
            {t.links.newLink}
          </Button>
        </div>

        {/* Recent Links Section */}
        {paymentLinks.length > 0 && (
          <div>
            <SectionLabel>
              {showAllRecentLinks ? `${t.links.allYourLinks} ${sortedLinks.length} ${t.links.linksWord}` : t.links.recentLinks}
            </SectionLabel>
            <div className="space-y-3">
              {recentLinks.map((link) => {
                const stats = getLinkStats(link.id);
                return (
                  <div
                    key={link.id}
                    className={`overflow-hidden rounded-2xl border border-[#1A237E] bg-[#1A237E] shadow-sm cursor-pointer hover:bg-[#151c6a] transition-colors ${!link.isActive ? "opacity-60" : ""}`}
                    data-testid={`recent-link-${link.id}`}
                    onClick={() => navigate(`/dashboard/links/${link.id}`)}
                  >
                    <div className="flex items-center gap-3 px-4 py-4">
                      {link.imagePath ? (
                        <img src={getImageSrc(link.imagePath)} alt={link.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                          <Link2 className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                           <p className="text-sm font-normal text-white truncate">{link.title}</p>
                          {link.isActive
                            ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            : <XCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                        </div>
                         <div className="flex items-center gap-3 text-xs text-white/70 mt-1">
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{link.clickCount || 0} {t.links.clicks}</span>
                          <span>{link.isFixedAmount ? formatCurrency(link.amount, (user?.preferredCurrency || "XAF") as SupportedCurrency) : t.links.freeAmount}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-white">{formatCurrency(stats.totalCollected, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</p>
                        <p className="text-xs text-white/70">{stats.transactionCount} pmt.</p>
                      </div>
                    </div>
                     <div className="flex items-center justify-between px-4 py-3 gap-2 border-t border-white/15">
                       <p className="text-sm text-white/70 truncate">/pay/{link.slug}</p>
                       <div className="flex items-center gap-0.5 shrink-0 text-white/75" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(link.slug)} title="Copier" data-testid={`button-copy-${link.id}`}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQrModalLink(link)} title="QR Code" data-testid={`button-qr-${link.id}`}>
                          <QrCode className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => generatePDF(link)} title="PDF" data-testid={`button-pdf-${link.id}`}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                          <a href={`/pay/${link.slug}`} target="_blank" rel="noopener noreferrer" data-testid={`button-open-${link.id}`}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/dashboard/links/${link.id}/edit`)} title="Modifier" data-testid={`button-edit-${link.id}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className={`h-7 w-7 ${link.isActive ? "text-orange-500 hover:text-orange-600" : "text-green-500 hover:text-green-600"}`} onClick={() => deactivateMutation.mutate({ id: link.id, isActive: !link.isActive })} title={link.isActive ? t.links.deactivate : t.links.activate} data-testid={`button-toggle-${link.id}`}>
                          <Power className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { if (confirm(t.links.deleteConfirm)) deleteMutation.mutate(link.id); }} title={t.links.deactivate} data-testid={`button-delete-${link.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {sortedLinks.length > 5 && (
                <button
                   className="w-full flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card px-4 py-4 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-sm hover:bg-muted/40 transition-colors"
                  onClick={() => setShowAllRecentLinks(!showAllRecentLinks)}
                  data-testid="button-toggle-all-links"
                >
                  {showAllRecentLinks ? <XCircle className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showAllRecentLinks ? t.links.showLess : `${t.links.seeMore} ${sortedLinks.length - 5} ${t.links.moreLinks}`}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedLink} onValueChange={setSelectedLink}>
              <SelectTrigger className="w-48 h-12 rounded-2xl bg-card text-sm shadow-sm" data-testid="select-link-filter">
                <SelectValue placeholder={t.links.allLinks} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.links.allLinks}</SelectItem>
                {paymentLinks.map((link) => (
                  <SelectItem key={link.id} value={link.id}>{link.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-48 h-12 rounded-2xl bg-card text-sm shadow-sm" data-testid="select-period-filter">
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
            title={t.links.statClicks} 
            value={analytics.clicks.toLocaleString('fr-FR')} 
            icon={MousePointer} 
            imageSrc="/dashboard-icons/stat-clicks.png"
            trend={t.links.trendVsPrevious}
            color="bg-blue-500/10 text-blue-500"
          />
          <StatCard 
            title={t.links.statTransactions} 
            value={analytics.transactions} 
            icon={ArrowDownUp} 
            imageSrc="/dashboard-icons/stat-transactions.png"
            trend={t.links.trendTransactions}
            color="bg-green-500/10 text-green-500"
          />
          <StatCard 
            title={t.links.statCollected} 
            value={formatCurrency(analytics.totalCollected, (user?.preferredCurrency || "XAF") as SupportedCurrency)} 
            icon={Wallet} 
            imageSrc="/dashboard-icons/stat-collected.png"
            color="bg-primary/10 text-primary"
          />
          <StatCard 
            title={t.links.statConversion} 
            value={analytics.clicks > 0 ? `${((analytics.transactions / analytics.clicks) * 100).toFixed(1)}%` : "0%"}
            icon={TrendingUp} 
            imageSrc="/dashboard-icons/stat-active-links.png"
            color="bg-purple-500/10 text-purple-500"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-2 h-auto bg-transparent p-0">
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="w-4 h-4 mr-2" />
              {t.links.tabAnalytics}
            </TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-payments">
              <Wallet className="w-4 h-4 mr-2" />
              {t.links.tabPayments} ({paymentIntents.length})
            </TabsTrigger>
            <TabsTrigger value="links" data-testid="tab-links">
              <Link2 className="w-4 h-4 mr-2" />
              {t.links.tabLinks} ({paymentLinks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-6 mt-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.links.tabAnalytics}</p>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    {t.links.chartTitle}
                  </CardTitle>
                  <CardDescription>
                    {selectedPeriod === "week" ? t.links.chartDescWeek : t.links.chartDescMonths}
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
                          formatter={(value: number) => [formatCurrency(value, (user?.preferredCurrency || "XAF") as SupportedCurrency), t.links.chartTitle]}
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
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.links.geoSection}</p>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    {t.links.geoTitle}
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
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.links.methodsSection}</p>
                <CardTitle className="text-sm">{t.links.methodsTitle}</CardTitle>
                <CardDescription>{t.links.methodsDesc}</CardDescription>
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
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.links.tabPayments}</p>
                  <CardTitle className="flex items-center gap-2 text-sm">
                  <Wallet className="w-4 h-4 text-muted-foreground" />
                  {t.links.paymentsTitle}
                </CardTitle>
                <CardDescription>{t.links.paymentsDesc}</CardDescription>
              </CardHeader>
              <CardContent>
                {paymentIntents.length === 0 ? (
                  <div className="text-center py-12">
                    <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">{t.links.noPayments}</p>
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
                                  <CheckCircle className="w-3 h-3" /> {t.links.statusCompleted}
                                </span>
                              ) : intent.status === "pending" ? (
                                <span className="flex items-center gap-1 text-xs text-yellow-500">
                                  <Loader2 className="w-3 h-3" /> {t.links.statusPending}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-red-500">
                                  <XCircle className="w-3 h-3" /> {t.links.statusFailed}
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
                                <span className="text-base font-bold text-primary">
                                  {formatCurrency(
                                    intent.feeAmount 
                                      ? parseFloat(String(intent.amount)) - parseFloat(intent.feeAmount)
                                      : parseFloat(String(intent.amount)),
                                    (intent.currency as SupportedCurrency) || "XAF"
                                  )}
                                </span>
                                {intent.feeAmount && parseFloat(intent.feeAmount) > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {t.links.amountPaid} {formatCurrency(intent.amount, (intent.currency as SupportedCurrency) || "XAF")}
                                    <span className="text-amber-500 ml-1">
                                      (-{formatCurrency(parseFloat(intent.feeAmount), (intent.currency as SupportedCurrency) || "XAF")} {t.links.fee})
                                    </span>
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {intent.paymentMethod === "mobile_money" ? t.links.methodMobileMoney : intent.paymentMethod}
                                {intent.operator && ` - ${getOperatorDisplay(intent.operator)}`}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {t.links.ref}: {intent.reference}
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
            <div>
              <SectionLabel>{t.links.allLinksSection} ({paymentLinks.length})</SectionLabel>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : paymentLinks.length === 0 ? (
                <div className="text-center py-12 rounded-2xl border border-border/70 bg-card shadow-sm">
                  <Link2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">{t.links.noLinks}</p>
                  <Button className="h-12 rounded-2xl px-4 text-sm shadow-sm" onClick={() => navigate("/dashboard/links/new")} data-testid="button-create-first-link">
                    <Plus className="w-4 h-4 mr-2" />
                    {t.links.createFirstLink}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentLinks.map((link) => {
                    const stats = getLinkStats(link.id);
                    return (
                      <div
                        key={link.id}
                        className={`overflow-hidden rounded-2xl border border-[#1A237E] bg-[#1A237E] shadow-sm ${!link.isActive ? "opacity-60" : ""}`}
                        data-testid={`link-item-${link.id}`}
                      >
                        <div className="flex items-center gap-3 px-4 py-4">
                          {link.imagePath ? (
                            <img src={getImageSrc(link.imagePath)} alt={link.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                          ) : (
                               <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                 <Link2 className="w-5 h-5 text-white" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                                <p className="text-sm font-normal text-white truncate">{link.title}</p>
                              {link.isActive ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                            </div>
                              <div className="flex items-center gap-3 text-xs text-white/70 mt-1">
                              <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{link.clickCount || 0} {t.links.clicks}</span>
                              <span className="flex items-center gap-1"><ArrowDownUp className="w-3 h-3" />{stats.transactionCount} {t.links.pmtShort}</span>
                              <span>{link.isFixedAmount ? formatCurrency(link.amount, (user?.preferredCurrency || "XAF") as SupportedCurrency) : t.links.freeAmount}</span>
                            </div>
                              {link.description && <p className="text-xs text-white/70 mt-1 truncate">{link.description}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-medium text-white">{formatCurrency(stats.totalCollected, (user?.preferredCurrency || "XAF") as SupportedCurrency)}</p>
                            <p className="text-xs text-white/70">{link.createdAt ? format(new Date(link.createdAt), "d MMM yy", { locale: fr }) : "-"}</p>
                          </div>
                        </div>
                          <div className="flex items-center justify-between px-4 py-3 gap-2 border-t border-white/15">
                            <p className="text-xs text-white/70 truncate">/pay/{link.slug}</p>
                           <div className="flex items-center gap-0.5 shrink-0 text-white/75">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyLink(link.slug)} title="Copier" data-testid={`button-copy-all-${link.id}`}><Copy className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setQrModalLink(link)} title="QR" data-testid={`button-qr-all-${link.id}`}><QrCode className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => generatePDF(link)} title="PDF" data-testid={`button-pdf-all-${link.id}`}><Download className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild><a href={`/pay/${link.slug}`} target="_blank" rel="noopener noreferrer" data-testid={`button-open-all-${link.id}`}><ExternalLink className="w-3.5 h-3.5" /></a></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/dashboard/links/${link.id}/edit`)} title="Modifier" data-testid={`button-edit-all-${link.id}`}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className={`h-7 w-7 ${link.isActive ? "text-orange-500 hover:text-orange-600" : "text-green-500 hover:text-green-600"}`} onClick={() => deactivateMutation.mutate({ id: link.id, isActive: !link.isActive })} title={link.isActive ? t.links.deactivate : t.links.activate} data-testid={`button-toggle-all-${link.id}`}><Power className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { if (confirm(t.links.deleteConfirm)) deleteMutation.mutate(link.id); }} title={t.links.deactivate} data-testid={`button-delete-all-${link.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <CreateLinkDialog open={showCreate} onClose={() => setShowCreate(false)} />

      {/* QR Code Modal */}
      <BottomSheet open={!!qrModalLink} onOpenChange={() => setQrModalLink(null)}>
        <BottomSheetContent>
          <BottomSheetHeader>
            <BottomSheetTitle>{t.links.qrTitle}</BottomSheetTitle>
            <BottomSheetDescription>
              {t.links.qrModalDesc}
            </BottomSheetDescription>
          </BottomSheetHeader>
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
                {t.links.copyLink}
              </Button>
            </div>
          )}
        </BottomSheetContent>
      </BottomSheet>

    </DashboardLayout>
  );
}
