import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPaymentLinkSchema } from "@shared/schema";
import type { User } from "@shared/schema";
import { apiRequest, queryClient, getAuthHeaders } from "@/lib/queryClient";
import { useLanguage } from "@/lib/language";
import {
  ArrowLeft, Loader2, Upload, X, FileText, Link as LinkIcon,
  ExternalLink, Calendar, Image, Globe, Check, Link2,
  DollarSign, Settings2, ImageIcon, ChevronDown, ChevronUp,
  Eye, Sparkles, AlertCircle
} from "lucide-react";
import { z } from "zod";

interface CountryConfig {
  id: string;
  name: string;
  flag: string;
  currency: string;
}

interface DepositConfigResponse {
  countries: CountryConfig[];
}

function SectionCard({ number, title, subtitle, icon: Icon, children }: {
  number: number;
  title: string;
  subtitle: string;
  icon: any;
  children: React.ReactNode;
}) {
  const { t } = useLanguage();
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-4 px-5 py-4 border-b border-border bg-muted/20">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted/60 border border-border shrink-0">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.links.step} {number}</span>
          <h3 className="font-semibold text-foreground text-sm leading-tight mt-0.5">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="p-5 space-y-5">
        {children}
      </div>
    </div>
  );
}

export default function LinkCreatePage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useLanguage();
  const lk = t.links;
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [showCountries, setShowCountries] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const { data: depositConfigData } = useQuery<DepositConfigResponse>({
    queryKey: ["/api/public/deposit-config"],
  });
  const allCountries = depositConfigData?.countries || [];
  const filteredCountries = allCountries.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.flag.includes(countrySearch)
  );

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
      allowedCountries: [],
    },
  });

  const isFixedAmount = form.watch("isFixedAmount");
  const pdfPathValue = form.watch("pdfPath");
  const titleValue = form.watch("title");
  const descriptionValue = form.watch("description");
  const amountValue = form.watch("amount");

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

  const processImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
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
      headers: getAuthHeaders(),
      body: formData,
    });
    if (!response.ok) throw new Error(lk.toastUploadError);
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
      finalData.allowedCountries = selectedCountries.length > 0 ? selectedCountries : [];
      const res = await apiRequest("POST", "/api/payment-links", finalData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-links"] });
      toast({ title: lk.toastLinkCreated, description: lk.toastLinkCreatedDesc });
      navigate("/dashboard/links");
    },
    onError: (error: Error) => {
      toast({ title: lk.toastError, description: error.message, variant: "destructive" });
    },
  });

  const currency = user?.preferredCurrency || "XAF";
  const formattedAmount = amountValue
    ? new Intl.NumberFormat("fr-FR").format(Number(amountValue)) + ` ${currency}`
    : null;

  const countriesLabel = selectedCountries.length === 0
    ? lk.allCountries
    : `${selectedCountries.length} ${selectedCountries.length > 1 ? lk.countriesSelectedPlural : lk.countriesSelected}`;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/links")}
            className="shrink-0 rounded-xl"
            data-testid="button-back-links"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{lk.pageCreateTitle}</h1>
            <p className="text-muted-foreground text-sm">{lk.pageCreateSub}</p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">

            <SectionCard number={1} title={lk.step1Title} subtitle={lk.step1Sub} icon={ImageIcon}>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{lk.formTitle} <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder={lk.formTitlePlaceholder}
                        className="h-11 rounded-xl border-border/60 focus:border-primary bg-background"
                        {...field}
                        data-testid="input-link-title"
                      />
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
                    <FormLabel className="text-sm font-medium">{lk.formDesc}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={lk.formDescPlaceholder}
                        className="rounded-xl border-border/60 focus:border-primary bg-background resize-none min-h-[80px]"
                        {...field}
                        data-testid="input-link-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel className="text-sm font-medium block mb-2">
                  {lk.formImage}
                </FormLabel>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  data-testid="input-link-image"
                />
                {imagePreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-border/60 group">
                    <img src={imagePreview} alt="Preview" className="w-full h-44 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => imageInputRef.current?.click()}
                        className="rounded-lg"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        {lk.formImageChange}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={clearImage}
                        className="rounded-lg"
                      >
                        <X className="w-3.5 h-3.5 mr-1.5" />
                        {lk.formImageDelete}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                      isDragOver
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-primary/50 hover:bg-muted/30"
                    }`}
                    onClick={() => imageInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <Image className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">{lk.formImageDrag}</p>
                    <p className="text-xs text-muted-foreground">{lk.formImageBrowse}</p>
                  </div>
                )}
              </div>
            </SectionCard>

            <SectionCard number={2} title={lk.step2Title} subtitle={lk.step2Sub} icon={DollarSign}>

              <FormField
                control={form.control}
                name="isFixedAmount"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-xl border border-border/60 p-4 bg-muted/20">
                    <div>
                      <FormLabel className="text-sm font-medium cursor-pointer">{lk.formAmountType}</FormLabel>
                      <FormDescription className="text-xs mt-0.5">
                        {field.value ? lk.formFixedDesc : lk.formFreeDesc}
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
                      <FormLabel className="text-sm font-medium">{lk.formAmount} ({currency}) <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">{currency}</span>
                          <Input
                            type="number"
                            placeholder="0"
                            className="h-11 rounded-xl border-border/60 focus:border-primary bg-background pl-14 text-lg font-semibold"
                            {...field}
                            data-testid="input-link-amount"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="pdfPath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="w-4 h-4 text-amber-500" />
                      {lk.formPdf}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="https://drive.google.com/file/d/..."
                          className="h-11 rounded-xl border-border/60 focus:border-primary bg-background pl-9"
                          {...field}
                          data-testid="input-link-pdf-url"
                        />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs text-amber-500/80 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {lk.formPdfAuto}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {pdfPathValue && (
                <FormField
                  control={form.control}
                  name="hasPdfDelivery"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/8 p-4">
                      <div>
                        <FormLabel className="text-sm font-medium text-amber-600 dark:text-amber-400">{lk.formPdfDelivery}</FormLabel>
                        <FormDescription className="text-xs mt-0.5">
                          {lk.formPdfDeliveryDesc}
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
            </SectionCard>

            <SectionCard number={3} title={lk.step3Title} subtitle={lk.step3Sub} icon={Globe}>
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowCountries(!showCountries)}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                  data-testid="button-toggle-countries"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{countriesLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedCountries.length > 0 && (
                      <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">
                        {selectedCountries.length}
                      </Badge>
                    )}
                    {showCountries ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>

                {showCountries && (
                  <div className="border-t border-border/60">
                    <div className="p-3 border-b border-border/40 flex items-center gap-2">
                      <Input
                        placeholder={lk.countrySearch}
                        value={countrySearch}
                        onChange={e => setCountrySearch(e.target.value)}
                        className="h-9 rounded-lg text-sm"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={toggleAll}
                        className="shrink-0 text-xs"
                        data-testid="button-toggle-all-countries"
                      >
                        {selectedCountries.length === allCountries.length && allCountries.length > 0 ? lk.deselectAll : lk.selectAll}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 max-h-56 overflow-y-auto">
                      {filteredCountries.map((c) => {
                        const isSelected = selectedCountries.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => toggleCountry(c.id)}
                            className={`flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors border-b border-r border-border/30 ${
                              isSelected
                                ? "bg-primary/10 text-primary font-medium"
                                : "hover:bg-muted/40 text-foreground"
                            }`}
                            data-testid={`button-country-${c.id}`}
                          >
                            <span className={`w-4 h-4 shrink-0 flex items-center justify-center rounded border ${
                              isSelected ? "bg-primary border-primary" : "border-border"
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                            </span>
                            <span className="mr-0.5">{c.flag}</span>
                            <span className="truncate text-xs">{c.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {selectedCountries.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedCountries.slice(0, 8).map(id => {
                    const country = allCountries.find(c => c.id === id);
                    if (!country) return null;
                    return (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="gap-1 cursor-pointer text-xs rounded-lg pr-1.5 hover:bg-destructive/10"
                        onClick={() => toggleCountry(id)}
                      >
                        {country.flag} {country.name}
                        <X className="w-3 h-3" />
                      </Badge>
                    );
                  })}
                  {selectedCountries.length > 8 && (
                    <Badge variant="secondary" className="text-xs rounded-lg">
                      +{selectedCountries.length - 8} {lk.moreLinks}
                    </Badge>
                  )}
                </div>
              )}
            </SectionCard>

            <SectionCard number={4} title={lk.step4Title} subtitle={lk.step4Sub} icon={Settings2}>

              <FormField
                control={form.control}
                name="customSlug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium">{lk.formSlug}</FormLabel>
                    <FormControl>
                      <div className="flex items-center rounded-xl border border-border/60 focus-within:border-primary overflow-hidden bg-background">
                        <span className="px-3 py-2 bg-muted/40 text-muted-foreground text-sm border-r border-border/60 whitespace-nowrap shrink-0">/pay/</span>
                        <Input
                          placeholder="mon-lien-unique"
                          className="border-0 rounded-none focus-visible:ring-0 h-11 bg-transparent"
                          {...field}
                          data-testid="input-link-slug"
                        />
                      </div>
                    </FormControl>
                    <FormDescription className="text-xs">{lk.formSlugHint}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-medium">
                      <Calendar className="w-4 h-4" />
                      {lk.formExpiry}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        className="h-11 rounded-xl border-border/60 focus:border-primary bg-background"
                        {...field}
                        data-testid="input-link-expiry"
                      />
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
                    <FormLabel className="flex items-center gap-2 text-sm font-medium">
                      <ExternalLink className="w-4 h-4" />
                      {lk.formRedirect}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://monsite.com/merci"
                        className="h-11 rounded-xl border-border/60 focus:border-primary bg-background"
                        {...field}
                        data-testid="input-link-redirect"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">{lk.formRedirectDesc}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SectionCard>

            {titleValue && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Eye className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{titleValue}</p>
                  {descriptionValue && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{descriptionValue}</p>}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {formattedAmount && (
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">{formattedAmount}</span>
                    )}
                    {!isFixedAmount && (
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{lk.freeAmount}</span>
                    )}
                    {selectedCountries.length > 0 && (
                      <span className="text-xs text-muted-foreground">{selectedCountries.length} {lk.countriesSelectedPlural}</span>
                    )}
                    {imagePreview && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> {lk.imageAdded}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1 pb-6">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 rounded-xl font-medium"
                onClick={() => navigate("/dashboard/links")}
                data-testid="button-create-link-cancel"
              >
                {lk.cancel}
              </Button>
              <Button
                type="submit"
                className="flex-[2] h-12 rounded-xl font-semibold text-base gap-2"
                disabled={createMutation.isPending}
                data-testid="button-create-link-confirm"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {lk.creating}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {lk.formCreateButton}
                  </>
                )}
              </Button>
            </div>

          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
