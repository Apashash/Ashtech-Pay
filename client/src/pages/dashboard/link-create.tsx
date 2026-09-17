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
import { getUploadErrorMessage, preparePaymentLinkImage } from "@/lib/payment-link-image";
import {
  ArrowLeft, ArrowRight, Loader2, Upload, X, FileText, Link as LinkIcon,
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
    <div className="bg-card border border-border/70 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-4 px-5 py-4 border-b border-border/70">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">{t.links.step} {number}</span>
          <h3 className="font-normal text-foreground text-base leading-tight mt-1">{title}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="p-5 space-y-6">
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
  const [currentStep, setCurrentStep] = useState(1);

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
    const uploadFile = await preparePaymentLinkImage(file);
    const formData = new FormData();
    formData.append("file", uploadFile);
    const response = await fetch("/api/uploads/file", {
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders(),
      body: formData,
    });
    if (!response.ok) {
      throw new Error(await getUploadErrorMessage(response, lk.toastUploadError));
    }
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

  const wizardSteps = [
    { number: 1, title: lk.step1Title, icon: ImageIcon },
    { number: 2, title: lk.step2Title, icon: DollarSign },
    { number: 3, title: lk.step3Title, icon: Globe },
    { number: 4, title: lk.wizardReviewTitle, icon: Eye },
  ];

  const stepFields: Record<number, string[]> = {
    1: ["title"],
    2: ["amount"],
    3: ["customSlug", "expiresAt", "redirectUrl"],
    4: [],
  };

  const handleNextStep = async () => {
    const fields = stepFields[currentStep] || [];
    const isValid = fields.length === 0
      ? true
      : await form.trigger(fields as any, { shouldFocus: true });

    if (isValid) {
      setCurrentStep(step => Math.min(step + 1, 4));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePreviousStep = () => {
    setCurrentStep(step => Math.max(step - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto">

        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/links")}
            className="shrink-0 rounded-2xl"
            data-testid="button-back-links"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{lk.pageCreateTitle}</h1>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {lk.step} {currentStep} {lk.wizardStepOf} 4
              </p>
              <p className="text-sm font-medium text-foreground mt-1">
                {wizardSteps[currentStep - 1].title}
              </p>
            </div>
            <span className="text-xs font-medium text-[#1A237E] whitespace-nowrap">
              {Math.round((currentStep / wizardSteps.length) * 100)}%
            </span>
          </div>

          <div className="mt-4 flex items-center gap-2">
            {wizardSteps.map((step, index) => {
              const StepIcon = step.icon;
              const isCompleted = step.number < currentStep;
              const isCurrent = step.number === currentStep;
              return (
                <div key={step.number} className="flex min-w-0 flex-1 items-center gap-2">
                  <button
                    type="button"
                    disabled={step.number > currentStep}
                    onClick={() => {
                      if (isCompleted) {
                        setCurrentStep(step.number);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    className={`flex min-w-0 items-center gap-2 text-left transition-colors ${
                      step.number > currentStep ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                    }`}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      isCompleted || isCurrent
                        ? "bg-[#1A237E] text-white"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                    </span>
                    <span className={`hidden truncate text-xs sm:block ${
                      isCurrent ? "font-medium text-[#1A237E]" : "text-muted-foreground"
                    }`}>
                      {step.title}
                    </span>
                  </button>
                  {index < wizardSteps.length - 1 && (
                    <div className="h-0.5 min-w-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className={`h-full rounded-full transition-all ${isCompleted ? "w-full bg-[#1A237E]" : "w-0"}`} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={currentStep < 4
              ? (event) => { event.preventDefault(); void handleNextStep(); }
              : form.handleSubmit((d) => createMutation.mutate(d))}
            className="space-y-4"
          >

            {currentStep === 1 && (
            <SectionCard number={1} title={lk.step1Title} subtitle={lk.step1Sub} icon={ImageIcon}>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-normal">{lk.formTitle} <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder={lk.formTitlePlaceholder}
                        className="h-12 rounded-2xl border-border/60 focus:border-primary bg-card text-base"
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
                    <FormLabel className="text-base font-normal">{lk.formDesc}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={lk.formDescPlaceholder}
                        className="rounded-2xl border-border/60 focus:border-primary bg-card text-base resize-none min-h-[96px]"
                        {...field}
                        data-testid="input-link-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel className="text-base font-normal block mb-2">
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
                  <div className="relative rounded-2xl overflow-hidden border border-border/60 group">
                    <img src={imagePreview} alt="Preview" className="w-full h-44 object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => imageInputRef.current?.click()}
                        className="rounded-xl"
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        {lk.formImageChange}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={clearImage}
                        className="rounded-xl"
                      >
                        <X className="w-3.5 h-3.5 mr-1.5" />
                        {lk.formImageDelete}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                      isDragOver
                        ? "border-primary bg-primary/5"
                        : "border-border/60 hover:border-primary/50 hover:bg-muted/30"
                    }`}
                    onClick={() => imageInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <Image className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-base font-normal text-foreground mb-1">{lk.formImageDrag}</p>
                    <p className="text-sm text-muted-foreground">{lk.formImageBrowse}</p>
                  </div>
                )}
              </div>
            </SectionCard>
            )}

            {currentStep === 2 && (
            <SectionCard number={2} title={lk.step2Title} subtitle={lk.step2Sub} icon={DollarSign}>

              <FormField
                control={form.control}
                name="isFixedAmount"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-2xl border border-border/60 p-4 bg-card shadow-sm">
                    <div>
                      <FormLabel className="text-base font-normal cursor-pointer">{lk.formAmountType}</FormLabel>
                      <FormDescription className="text-sm mt-0.5">
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
                      <FormLabel className="text-base font-normal">{lk.formAmount} ({currency}) <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">{currency}</span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            placeholder="0"
                            className="h-12 rounded-2xl border-border/60 focus:border-primary bg-card pl-14 text-base font-medium"
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
                    <FormLabel className="flex items-center gap-2 text-base font-normal">
                      <FileText className="w-4 h-4 text-amber-500" />
                      {lk.formPdf}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="https://drive.google.com/file/d/..."
                          className="h-12 rounded-2xl border-border/60 focus:border-primary bg-card pl-9 text-base"
                          {...field}
                          data-testid="input-link-pdf-url"
                        />
                      </div>
                    </FormControl>
                    <FormDescription className="text-sm text-amber-500/80 flex items-center gap-1">
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
                    <FormItem className="flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4 shadow-sm">
                      <div>
                        <FormLabel className="text-base font-normal text-amber-600 dark:text-amber-400">{lk.formPdfDelivery}</FormLabel>
                        <FormDescription className="text-sm mt-0.5">
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
            )}

            {currentStep === 3 && (
            <SectionCard number={3} title={lk.step3Title} subtitle={lk.step3Sub} icon={Globe}>
              <div className="rounded-2xl border border-border/60 overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setShowCountries(!showCountries)}
                  className="w-full flex items-center justify-between px-4 py-4 bg-card hover:bg-muted/40 transition-colors text-left"
                  data-testid="button-toggle-countries"
                >
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <span className="text-base font-normal">{countriesLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedCountries.length > 0 && (
                      <Badge className="bg-primary/15 text-primary border-primary/20 text-sm">
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
                        className="h-12 rounded-2xl text-base"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={toggleAll}
                        className="shrink-0 text-sm"
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
                            <span className="truncate text-sm">{c.name}</span>
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
                        className="gap-1 cursor-pointer text-sm rounded-xl pr-1.5 hover:bg-destructive/10"
                        onClick={() => toggleCountry(id)}
                      >
                        {country.flag} {country.name}
                        <X className="w-3 h-3" />
                      </Badge>
                    );
                  })}
                  {selectedCountries.length > 8 && (
                    <Badge variant="secondary" className="text-sm rounded-xl">
                      +{selectedCountries.length - 8} {lk.moreLinks}
                    </Badge>
                  )}
                </div>
              )}
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Settings2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-normal text-foreground">{lk.step4Title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{lk.step4Sub}</p>
                </div>
              </div>

              <FormField
                control={form.control}
                name="customSlug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-normal">{lk.formSlug}</FormLabel>
                    <FormControl>
                      <div className="flex items-center rounded-2xl border border-border/60 focus-within:border-primary overflow-hidden bg-card">
                        <span className="px-4 py-3 bg-muted/40 text-muted-foreground text-base border-r border-border/60 whitespace-nowrap shrink-0">/pay/</span>
                        <Input
                          placeholder="mon-lien-unique"
                          className="border-0 rounded-none focus-visible:ring-0 h-12 bg-transparent text-base"
                          {...field}
                          data-testid="input-link-slug"
                        />
                      </div>
                    </FormControl>
                    <FormDescription className="text-sm">{lk.formSlugHint}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="expiresAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-base font-normal">
                      <Calendar className="w-4 h-4" />
                      {lk.formExpiry}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        className="h-12 rounded-2xl border-border/60 focus:border-primary bg-card text-base"
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
                    <FormLabel className="flex items-center gap-2 text-base font-normal">
                      <ExternalLink className="w-4 h-4" />
                      {lk.formRedirect}
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://monsite.com/merci"
                        className="h-12 rounded-2xl border-border/60 focus:border-primary bg-card text-base"
                        {...field}
                        data-testid="input-link-redirect"
                      />
                    </FormControl>
                    <FormDescription className="text-sm">{lk.formRedirectDesc}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            </SectionCard>
            )}

            {currentStep === 4 && (
            <SectionCard number={4} title={lk.wizardReviewTitle} subtitle={lk.wizardReviewSub} icon={Eye}>
            {titleValue && (
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Eye className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-normal text-foreground truncate">{titleValue}</p>
                  {descriptionValue && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">{descriptionValue}</p>}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {formattedAmount && (
                      <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg">{formattedAmount}</span>
                    )}
                    {!isFixedAmount && (
                      <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded-lg">{lk.freeAmount}</span>
                    )}
                    {selectedCountries.length > 0 && (
                      <span className="text-sm text-muted-foreground">{selectedCountries.length} {lk.countriesSelectedPlural}</span>
                    )}
                    {imagePreview && (
                      <span className="text-sm text-green-600 flex items-center gap-1">
                        <Check className="w-3 h-3" /> {lk.imageAdded}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            </SectionCard>
            )}

            <div className="flex gap-3 pt-1 pb-6">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-12 rounded-2xl font-normal text-base"
                onClick={currentStep === 1 ? () => navigate("/dashboard/links") : handlePreviousStep}
                data-testid="button-create-link-cancel"
              >
                {currentStep === 1 ? lk.cancel : (
                  <>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    {lk.wizardBack}
                  </>
                )}
              </Button>
              {currentStep < 4 ? (
                <Button
                  type="button"
                  className="flex-[2] h-12 rounded-2xl font-medium text-base gap-2"
                  onClick={handleNextStep}
                  data-testid="button-create-link-next"
                >
                  {lk.wizardNext}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="flex-[2] h-12 rounded-2xl font-medium text-base gap-2"
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
              )}
            </div>

          </form>
        </Form>
      </div>
    </DashboardLayout>
  );
}
