import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getAuthHeaders } from "@/lib/queryClient";
import type { User, KycSubmission } from "@shared/schema";
import { KYC_DOCUMENT_TYPES, BUSINESS_CATEGORIES } from "@shared/schema";
import {
  Shield,
  CheckCircle,
  Clock,
  Upload,
  FileText,
  Building2,
  AlertCircle,
  Camera,
  CreditCard,
  Loader2,
  X,
  Image as ImageIcon
} from "lucide-react";
import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language";

const africanCountries = [
  { code: "CM", name: "Cameroun", flag: "🇨🇲" },
  { code: "SN", name: "Sénégal", flag: "🇸🇳" },
  { code: "CI", name: "Côte d'Ivoire", flag: "🇨🇮" },
  { code: "ML", name: "Mali", flag: "🇲🇱" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "NE", name: "Niger", flag: "🇳🇪" },
  { code: "TG", name: "Togo", flag: "🇹🇬" },
  { code: "BJ", name: "Bénin", flag: "🇧🇯" },
  { code: "GA", name: "Gabon", flag: "🇬🇦" },
  { code: "CG", name: "Congo", flag: "🇨🇬" },
  { code: "CD", name: "RD Congo", flag: "🇨🇩" },
  { code: "GN", name: "Guinée", flag: "🇬🇳" },
  { code: "TD", name: "Tchad", flag: "🇹🇩" },
  { code: "CF", name: "Centrafrique", flag: "🇨🇫" },
  { code: "GQ", name: "Guinée équatoriale", flag: "🇬🇶" },
];

type UploadField = "front" | "back" | "selfie";

interface UploadState {
  front: string | null;
  back: string | null;
  selfie: string | null;
}

interface UploadPreview {
  front: string | null;
  back: string | null;
  selfie: string | null;
}

export default function KYCPage() {
  const { toast } = useToast();
  const { t } = useLanguage();
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: kycSubmission, isLoading: isLoadingKyc } = useQuery<KycSubmission | null>({
    queryKey: ["/api/kyc"],
  });

  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [businessType, setBusinessType] = useState<"physical" | "online" | "">("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);

  const [uploadedPaths, setUploadedPaths] = useState<UploadState>({
    front: null,
    back: null,
    selfie: null,
  });

  const [uploadPreviews, setUploadPreviews] = useState<UploadPreview>({
    front: null,
    back: null,
    selfie: null,
  });

  const [uploading, setUploading] = useState<{ [key in UploadField]: boolean }>({
    front: false,
    back: false,
    selfie: false,
  });

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  // Camera (selfie — front camera only, no file import)
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturingPhoto, setCapturingPhoto] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Attach stream to video element once it appears in the DOM
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      // cameraActive=true first → triggers useEffect above which attaches stream to <video>
      setCameraActive(true);
    } catch {
      setCameraError("Impossible d'accéder à la caméra. Vérifiez les autorisations du navigateur.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setCapturingPhoto(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) { setCapturingPhoto(false); return; }
      const file = new File([blob], "selfie.jpg", { type: "image/jpeg" });
      stopCamera();
      await handleFileUpload(file, "selfie");
      setCapturingPhoto(false);
    }, "image/jpeg", 0.92);
  }, [stopCamera]);

  const filteredCategories = useMemo(() => businessType
    ? BUSINESS_CATEGORIES.filter(cat => cat.type === businessType)
    : BUSINESS_CATEGORIES, [businessType]);

  const descriptionWordCount = useMemo(() => {
    const words = businessDescription.trim().split(/\s+/).filter(Boolean);
    return words.length;
  }, [businessDescription]);

  const submitMutation = useMutation({
    mutationFn: async (data: {
      documentType: string;
      documentNumber: string;
      documentFrontPath: string;
      documentBackPath: string;
      selfiePath: string;
      country?: string;
      city?: string;
      postalCode?: string;
      businessType: string;
      businessCategory: string;
      businessDescription: string;
    }) => {
      const response = await apiRequest("POST", "/api/kyc", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kyc"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: t.kyc.toastSubmitted,
        description: t.kyc.toastSubmittedDesc,
      });
    },
    onError: (error: Error) => {
      toast({
        title: t.kyc.toastError,
        description: error.message || t.common.error,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = useCallback(async (file: File, field: UploadField) => {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: t.kyc.toastFileTypeError,
        description: t.kyc.toastFileTypeDesc,
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: t.kyc.toastFileSizeError,
        description: t.kyc.toastFileSizeDesc,
        variant: "destructive",
      });
      return;
    }

    setUploading(prev => ({ ...prev, [field]: true }));

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads/file?folder=kyc", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Échec du téléchargement");
      }

      const result = await response.json();
      const storedPath = result.url || result.objectPath;

      setUploadedPaths(prev => ({ ...prev, [field]: storedPath }));

      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadPreviews(prev => ({ ...prev, [field]: e.target?.result as string }));
      };
      reader.readAsDataURL(file);

      toast({
        title: t.kyc.toastFileUploaded,
        description: t.kyc.toastFileUploadedDesc,
      });
    } catch (error) {
      toast({
        title: t.kyc.toastUploadError,
        description: error instanceof Error ? error.message : t.common.error,
        variant: "destructive",
      });
    } finally {
      setUploading(prev => ({ ...prev, [field]: false }));
    }
  }, [toast, t]);

  const handleInputChange = (field: UploadField) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, field);
    }
  };

  const removeUpload = (field: UploadField) => {
    setUploadedPaths(prev => ({ ...prev, [field]: null }));
    setUploadPreviews(prev => ({ ...prev, [field]: null }));
    if (field !== "selfie") {
      const inputRef = field === "front" ? frontInputRef : backInputRef;
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Collect all missing fields with their labels
    const missing: string[] = [];
    if (!documentType)       missing.push("Type de document");
    if (!documentNumber)     missing.push("Numéro de document");
    if (!city)               missing.push("Ville");
    if (!postalCode)         missing.push("Code postal");
    if (!businessType)       missing.push("Type d'activité");
    if (!businessCategory)   missing.push("Catégorie d'activité");
    if (!businessDescription) missing.push("Description de l'activité");
    if (!uploadedPaths.front)  missing.push("Photo recto du document");
    if (!uploadedPaths.back)   missing.push("Photo verso du document");
    if (!uploadedPaths.selfie) missing.push("Selfie avec le document");

    if (missing.length > 0) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir : " + missing.join(", ") + ".",
        variant: "destructive",
      });
      return;
    }

    if (descriptionWordCount > 250) {
      toast({
        title: t.kyc.toastDescTooLong,
        description: t.kyc.toastDescTooLongPre + descriptionWordCount + t.kyc.toastDescTooLongSuf,
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate({
      documentType,
      documentNumber,
      documentFrontPath: uploadedPaths.front,
      documentBackPath: uploadedPaths.back,
      selfiePath: uploadedPaths.selfie,
      country: user?.country || undefined,
      city,
      postalCode,
      businessType,
      businessCategory,
      businessDescription,
    });
  };

  const renderStatusCard = () => {
    if (isLoadingKyc) {
      return (
        <Card className="border-border">
          <CardContent className="p-6 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      );
    }

    if (kycSubmission?.status === "approved" || user?.isVerified) {
      return (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
              <div>
                <p className="font-semibold text-foreground">{t.kyc.statusApproved}</p>
                <p className="text-sm text-muted-foreground">{t.kyc.statusApprovedDesc}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (kycSubmission?.status === "pending") {
      return (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Clock className="w-10 h-10 text-yellow-500" />
              <div>
                <p className="font-semibold text-foreground">{t.kyc.statusPending}</p>
                <p className="text-sm text-muted-foreground">{t.kyc.statusPendingDesc}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (kycSubmission?.status === "rejected") {
      return (
        <Card className="border-red-500/50 bg-red-500/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-10 h-10 text-red-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-foreground">{t.kyc.statusRejected}</p>
                <p className="text-sm text-muted-foreground mb-2">{t.kyc.statusRejectedDesc}</p>
                {kycSubmission.reviewNote && (
                  <div className="bg-red-500/10 rounded-lg p-3 mt-2">
                    <p className="text-sm text-red-400">
                      <strong>{t.kyc.statusRejectedReason}</strong> {kycSubmission.reviewNote}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-yellow-500/50 bg-yellow-500/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <Shield className="w-10 h-10 text-yellow-500" />
            <div>
              <p className="font-semibold text-foreground">{t.kyc.statusNone}</p>
              <p className="text-sm text-muted-foreground">{t.kyc.statusNoneDesc}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderUploadBox = (
    field: UploadField,
    label: string,
    description: string,
    icon: React.ReactNode,
    inputRef: React.RefObject<HTMLInputElement>
  ) => {
    const isUploading = uploading[field];
    const preview = uploadPreviews[field];
    const hasUploaded = !!uploadedPaths[field];

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <input
          type="file"
          ref={inputRef}
          accept="image/jpeg,image/png,image/webp"
          onChange={handleInputChange(field)}
          className="hidden"
          data-testid={`input-file-${field}`}
        />

        {hasUploaded && preview ? (
          <div className="relative border-2 border-green-500/50 bg-green-500/5 rounded-lg p-4">
            <button
              type="button"
              onClick={() => removeUpload(field)}
              className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/80"
              data-testid={`button-remove-${field}`}
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-4">
              <img
                src={preview}
                alt={label}
                className="w-20 h-20 object-cover rounded-lg"
              />
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{t.kyc.uploaded}</span>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            data-testid={`button-upload-${field}`}
          >
            {isUploading ? (
              <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-2" />
            ) : (
              <div className="w-12 h-12 mx-auto text-muted-foreground mb-2 flex items-center justify-center">
                {icon}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {isUploading ? t.kyc.uploading : description}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t.kyc.fileFormat}</p>
          </button>
        )}
      </div>
    );
  };

  const canSubmitForm = !kycSubmission || kycSubmission.status === "rejected";

  if (isLoadingKyc) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div>
            <div className="h-8 w-48 bg-muted rounded mb-2" />
            <div className="h-4 w-72 bg-muted rounded" />
          </div>
          <div className="h-24 bg-muted rounded-xl" />
          <div className="h-64 bg-muted rounded-xl" />
          <div className="h-48 bg-muted rounded-xl" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t.kyc.title}</h1>
          <p className="text-muted-foreground">{t.kyc.subtitle}</p>
        </div>

        {renderStatusCard()}

        {canSubmitForm && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.kyc.identitySection}</p>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  {t.kyc.identityTitle}
                </CardTitle>
                <CardDescription>{t.kyc.identityDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t.kyc.fullNameLabel}</Label>
                    <Input
                      value={user?.fullName || ""}
                      disabled
                      className="bg-muted/50"
                      data-testid="input-fullname-readonly"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t.kyc.emailLabel}</Label>
                    <Input
                      value={user?.email || ""}
                      disabled
                      className="bg-muted/50"
                      data-testid="input-email-readonly"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t.kyc.phoneLabel}</Label>
                    <Input
                      value={user?.phone || t.kyc.notFilled}
                      disabled
                      className="bg-muted/50"
                      data-testid="input-phone-readonly"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">{t.kyc.countryLabel}</Label>
                    <Input
                      value={user?.country || t.kyc.notFilled}
                      disabled
                      className="bg-muted/50"
                      data-testid="input-country-readonly"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.kyc.cityLabel}</Label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder={t.kyc.cityPlaceholder}
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.kyc.postalCodeLabel}</Label>
                    <Input
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder={t.kyc.postalCodePlaceholder}
                      inputMode="numeric"
                      data-testid="input-postal-code"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.kyc.documentsSection}</p>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    {t.kyc.documentsTitle}
                  </CardTitle>
                  <CardDescription>{t.kyc.documentsDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t.kyc.documentTypeLabel}</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger data-testid="select-document-type">
                        <SelectValue placeholder={t.kyc.documentTypePlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {KYC_DOCUMENT_TYPES.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            {doc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.kyc.documentNumberLabel}</Label>
                    <Input
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      placeholder={t.kyc.documentNumberPlaceholder}
                      data-testid="input-document-number"
                    />
                  </div>

                  {renderUploadBox(
                    "front",
                    t.kyc.frontLabel,
                    t.kyc.frontDesc,
                    <ImageIcon className="w-8 h-8" />,
                    frontInputRef as React.RefObject<HTMLInputElement>
                  )}

                  {renderUploadBox(
                    "back",
                    t.kyc.backLabel,
                    t.kyc.backDesc,
                    <ImageIcon className="w-8 h-8" />,
                    backInputRef as React.RefObject<HTMLInputElement>
                  )}

                  {/* Selfie — caméra frontale uniquement, import désactivé */}
                  <div className="space-y-2">
                    <Label>{t.kyc.selfieLabel}</Label>
                    <canvas ref={canvasRef} className="hidden" />

                    {uploadedPaths.selfie && uploadPreviews.selfie ? (
                      <div className="relative border-2 border-green-500/50 bg-green-500/5 rounded-lg p-4">
                        <button
                          type="button"
                          onClick={() => removeUpload("selfie")}
                          className="absolute top-2 right-2 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/80"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-4">
                          <img src={uploadPreviews.selfie} alt="Selfie" className="w-20 h-20 object-cover rounded-lg" />
                          <div className="flex items-center gap-2 text-green-500">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">{t.kyc.uploaded}</span>
                          </div>
                        </div>
                      </div>
                    ) : cameraActive ? (
                      <div className="space-y-3">
                        <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover scale-x-[-1]"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            onClick={capturePhoto}
                            disabled={capturingPhoto || uploading.selfie}
                            className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-black"
                          >
                            {(capturingPhoto || uploading.selfie)
                              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              : <Camera className="w-4 h-4 mr-2" />}
                            {uploading.selfie ? "Envoi…" : capturingPhoto ? "Capture…" : "Prendre la photo"}
                          </Button>
                          <Button type="button" variant="ghost" onClick={stopCamera}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">
                          Tenez votre pièce d'identité visible et regardez la caméra
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {cameraError && (
                          <p className="text-xs text-destructive">{cameraError}</p>
                        )}
                        <button
                          type="button"
                          onClick={startCamera}
                          className="w-full border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer"
                        >
                          <div className="w-12 h-12 mx-auto text-muted-foreground mb-2 flex items-center justify-center">
                            <Camera className="w-8 h-8" />
                          </div>
                          <p className="text-sm text-muted-foreground">{t.kyc.selfieDesc}</p>
                          <p className="text-xs text-muted-foreground mt-1">Caméra frontale uniquement • Aucun import de fichier autorisé</p>
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.kyc.activitySection}</p>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    {t.kyc.activityTitle}
                  </CardTitle>
                  <CardDescription>{t.kyc.activityDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t.kyc.businessTypeLabel}</Label>
                    <Select
                      value={businessType}
                      onValueChange={(value: "physical" | "online") => {
                        setBusinessType(value);
                        setBusinessCategory("");
                      }}
                    >
                      <SelectTrigger data-testid="select-business-type">
                        <SelectValue placeholder={t.kyc.businessTypePlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">{t.kyc.businessTypePhysical}</SelectItem>
                        <SelectItem value="online">{t.kyc.businessTypeOnline}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.kyc.businessCategoryLabel}</Label>
                    <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={categoryOpen}
                          disabled={!businessType}
                          className="w-full justify-between font-normal"
                          data-testid="select-business-category"
                        >
                          {businessCategory
                            ? filteredCategories.find(c => c.id === businessCategory)?.name ?? t.kyc.categoryChoose
                            : businessType ? t.kyc.categoryChoose : t.kyc.categorySelectType}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder={t.kyc.categorySearch} data-testid="input-category-search" />
                          <CommandList>
                            <CommandEmpty>{t.kyc.categoryEmpty}</CommandEmpty>
                            <CommandGroup>
                              {filteredCategories.map((cat) => (
                                <CommandItem
                                  key={cat.id}
                                  value={cat.name}
                                  onSelect={() => {
                                    setBusinessCategory(cat.id);
                                    setCategoryOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn("mr-2 h-4 w-4", businessCategory === cat.id ? "opacity-100" : "opacity-0")}
                                  />
                                  {cat.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.kyc.businessDescLabel}</Label>
                    <Textarea
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      placeholder={t.kyc.businessDescPlaceholder}
                      rows={4}
                      data-testid="textarea-business-description"
                    />
                    <p className={cn("text-xs", descriptionWordCount > 250 ? "text-destructive font-medium" : "text-muted-foreground")}>
                      {descriptionWordCount} {t.kyc.wordsOf}
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <h4 className="font-medium text-sm">{t.kyc.requiredDocs}</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2">
                        {uploadedPaths.front ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-muted-foreground" />
                        )}
                        {t.kyc.docFront}
                      </li>
                      <li className="flex items-center gap-2">
                        {uploadedPaths.back ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-muted-foreground" />
                        )}
                        {t.kyc.docBack}
                      </li>
                      <li className="flex items-center gap-2">
                        {uploadedPaths.selfie ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-muted-foreground" />
                        )}
                        {t.kyc.docSelfie}
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                size="lg"
                disabled={submitMutation.isPending}
                data-testid="button-submit-kyc"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t.kyc.submitting}
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    {t.kyc.submitButton}
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
