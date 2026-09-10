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
  ArrowLeft,
  ArrowRight,
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
import { createPortal } from "react-dom";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language";
import { LocationMapPicker, type LocationMapPickerHandle } from "@/components/LocationMapPicker";
import preparationGuideImage from "@assets/7ef12cb0a491071f360b23951b55820a_1789045683454.jpg";
import documentFrontGuideImage from "@assets/Screenshot_20260910_140615_Photos_1789045619760.jpg";
import documentBackGuideImage from "@assets/be51e9648060e89b9ff77a8a3922c4ca~2_1789045633889.jpg";
import selfieGuideImage from "@assets/06f166f7f90dde075e178df77302fb0f_1789045683418.jpg";
import securityGuideImage from "@assets/fc66946ad03da8c59e73d0b550811f08_1789045683478.jpg";

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
  const [lieuDit, setLieuDit] = useState("");
  const [detectedCountry, setDetectedCountry] = useState("");
  const [countryMismatch, setCountryMismatch] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const mapRef = useRef<LocationMapPickerHandle>(null);
  const [businessType, setBusinessType] = useState<"physical" | "online" | "">("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

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
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Camera (selfie — front camera only, no file import)
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Attach stream to video element once it appears in the DOM, and wait for
  // an actual frame (loadedmetadata / playing) before allowing capture —
  // this is what prevents the "black screen, can't capture" state.
  useEffect(() => {
    if (!cameraActive || !videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    setCameraReady(false);
    video.srcObject = streamRef.current;

    let cancelled = false;
    const tryPlay = () => { video.play().catch(() => {}); };

    const markReady = () => {
      if (!cancelled && video.videoWidth > 0) setCameraReady(true);
    };

    video.onloadedmetadata = () => { tryPlay(); markReady(); };
    video.oncanplay = () => { tryPlay(); markReady(); };
    video.onplaying = markReady;

    // Some mobile browsers need a couple of retries before the first frame arrives.
    tryPlay();
    const retryTimer = setInterval(() => {
      if (cancelled) return;
      if (video.videoWidth > 0) {
        markReady();
        clearInterval(retryTimer);
      } else {
        tryPlay();
      }
    }, 400);
    const giveUpTimer = setTimeout(() => clearInterval(retryTimer), 6000);

    return () => {
      cancelled = true;
      clearInterval(retryTimer);
      clearTimeout(giveUpTimer);
      video.onloadedmetadata = null;
      video.oncanplay = null;
      video.onplaying = null;
    };
  }, [cameraActive]);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraStarting(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        // Fallback: some devices/browsers reject facingMode constraints entirely.
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      // cameraActive=true first → triggers useEffect above which attaches stream to <video>
      setCameraActive(true);
    } catch (err: any) {
      const name = err?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCameraError("Accès à la caméra refusé. Autorisez la caméra dans les paramètres de votre navigateur puis réessayez.");
      } else if (name === "NotFoundError") {
        setCameraError("Aucune caméra détectée sur cet appareil.");
      } else if (name === "NotReadableError") {
        setCameraError("La caméra est déjà utilisée par une autre application. Fermez-la puis réessayez.");
      } else {
        setCameraError("Impossible d'accéder à la caméra. Vérifiez les autorisations du navigateur.");
      }
    } finally {
      setCameraStarting(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraReady(false);
  }, []);

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setCameraError("La caméra n'a pas encore de flux vidéo. Attendez quelques secondes puis réessayez.");
      return;
    }
    setCapturingPhoto(true);
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
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

  const wizardSteps = [
    {
      number: 1,
      title: t.kyc.wizardStep1Title,
      description: t.kyc.wizardStep1Desc,
      image: preparationGuideImage,
      icon: Shield,
    },
    {
      number: 2,
      title: t.kyc.wizardStep2Title,
      description: t.kyc.wizardStep2Desc,
      image: documentFrontGuideImage,
      icon: CreditCard,
    },
    {
      number: 3,
      title: t.kyc.wizardStep3Title,
      description: t.kyc.wizardStep3Desc,
      image: documentBackGuideImage,
      icon: FileText,
    },
    {
      number: 4,
      title: t.kyc.wizardStep4Title,
      description: t.kyc.wizardStep4Desc,
      image: selfieGuideImage,
      icon: Camera,
    },
    {
      number: 5,
      title: t.kyc.wizardStep5Title,
      description: t.kyc.wizardStep5Desc,
      image: securityGuideImage,
      icon: Building2,
    },
  ];

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
      latitude?: string;
      longitude?: string;
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
        let message = "Échec du téléchargement";
        try {
          const errorBody = await response.json();
          if (typeof errorBody?.error === "string" && errorBody.error.trim()) {
            message = errorBody.error;
          } else if (typeof errorBody?.message === "string" && errorBody.message.trim()) {
            message = errorBody.message;
          }
        } catch {
          // Keep the generic message if the server returned a non-JSON response.
        }
        throw new Error(message);
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
    if (field === "front" && frontInputRef.current) frontInputRef.current.value = "";
    if (field === "back" && backInputRef.current) backInputRef.current.value = "";
    if (field === "selfie" && selfieInputRef.current) selfieInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Collect all missing fields with their labels
    const missing: string[] = [];
    if (!documentType)       missing.push("Type de document");
    if (!documentNumber)     missing.push("Numéro de document");
    if (!city)               missing.push("Ville");
    if (!lieuDit)            missing.push("Lieu dit");
    if (!locationConfirmed)  missing.push("Confirmation de l'emplacement sur la carte");
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

    if (descriptionWordCount < 20) {
      toast({
        title: t.kyc.toastDescTooShort,
        description: t.kyc.toastDescTooShortPre + descriptionWordCount + t.kyc.toastDescTooShortSuf,
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
      documentFrontPath: uploadedPaths.front!,
      documentBackPath: uploadedPaths.back!,
      selfiePath: uploadedPaths.selfie!,
      country: detectedCountry || user?.country || undefined,
      city,
      postalCode: lieuDit,
      latitude: latitude != null ? String(latitude) : undefined,
      longitude: longitude != null ? String(longitude) : undefined,
      businessType,
      businessCategory,
      businessDescription,
    });
  };

  const handleNextStep = () => {
    const missing: string[] = [];

    if (currentStep === 1) {
      if (!city) missing.push("Ville");
      if (!lieuDit) missing.push("Lieu dit");
      if (!locationConfirmed) missing.push("Confirmation de l'emplacement sur la carte");
      if (countryMismatch) missing.push("Emplacement dans le pays d'inscription");
    } else if (currentStep === 2) {
      if (!documentType) missing.push("Type de document");
      if (!documentNumber) missing.push("Numéro de document");
      if (!uploadedPaths.front) missing.push("Photo recto du document");
    } else if (currentStep === 3) {
      if (!uploadedPaths.back) missing.push("Photo verso du document");
    } else if (currentStep === 4) {
      if (!uploadedPaths.selfie) missing.push("Selfie avec le document");
    }

    if (missing.length > 0) {
      toast({
        title: "Champs manquants",
        description: "Veuillez compléter : " + missing.join(", ") + ".",
        variant: "destructive",
      });
      return;
    }

    setCurrentStep(step => Math.min(step + 1, wizardSteps.length));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePreviousStep = () => {
    setCurrentStep(step => Math.max(step - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
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
  const currentWizardStep = wizardSteps[currentStep - 1];
  const CurrentStepIcon = currentWizardStep.icon;

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
          <>
            <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    {t.kyc.wizardStep} {currentStep} {t.kyc.wizardStepOf} {wizardSteps.length}
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">{currentWizardStep.title}</p>
                </div>
                <span className="whitespace-nowrap text-xs font-medium text-[#1A237E]">
                  {Math.round((currentStep / wizardSteps.length) * 100)}%
                </span>
              </div>

              <div className="mt-4 flex items-center gap-1.5 sm:gap-2">
                {wizardSteps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isCompleted = step.number < currentStep;
                  const isCurrent = step.number === currentStep;
                  return (
                    <div key={step.number} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        disabled={step.number > currentStep}
                        onClick={() => {
                          if (isCompleted) {
                            setCurrentStep(step.number);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }
                        }}
                        className={cn(
                          "flex min-w-0 items-center gap-1.5 text-left transition-colors",
                          step.number > currentStep ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                        )}
                        aria-current={isCurrent ? "step" : undefined}
                      >
                        <span className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          isCompleted || isCurrent ? "bg-[#1A237E] text-white" : "bg-muted text-muted-foreground"
                        )}>
                          {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                        </span>
                        <span className={cn(
                          "hidden truncate text-xs sm:block",
                          isCurrent ? "font-medium text-[#1A237E]" : "text-muted-foreground"
                        )}>
                          {step.title}
                        </span>
                      </button>
                      {index < wizardSteps.length - 1 && (
                        <div className="h-0.5 min-w-1 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className={cn("h-full rounded-full transition-all", isCompleted ? "w-full bg-[#1A237E]" : "w-0")} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Card className="overflow-hidden border-[#1A237E]/15">
              <div className="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <div className="relative min-h-[190px] bg-[#1A237E]/10 md:min-h-[230px]">
                  <img
                    src={currentWizardStep.image}
                    alt={currentWizardStep.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A237E]/75 via-[#1A237E]/10 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 text-white">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                      <CurrentStepIcon className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-medium uppercase tracking-[0.16em]">
                      {t.kyc.wizardStep} {currentStep}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col justify-center p-5 sm:p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#1A237E]">
                    {t.kyc.title}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-foreground">{currentWizardStep.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{currentWizardStep.description}</p>
                </div>
              </div>
            </Card>

            <form
              onSubmit={(event) => {
                if (currentStep < wizardSteps.length) {
                  event.preventDefault();
                  handleNextStep();
                } else {
                  handleSubmit(event);
                }
              }}
              className="space-y-6"
            >
            {currentStep === 1 && (
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
                      onChange={(e) => { setCity(e.target.value); setLocationConfirmed(false); }}
                      onBlur={() => {
                        if (city.trim()) {
                          mapRef.current?.search(`${city}${detectedCountry || user?.country ? ", " + (detectedCountry || user?.country) : ""}`);
                        }
                      }}
                      placeholder={t.kyc.cityPlaceholder}
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.kyc.postalCodeLabel}</Label>
                    <Input
                      value={lieuDit}
                      onChange={(e) => setLieuDit(e.target.value)}
                      placeholder={t.kyc.postalCodePlaceholder}
                      data-testid="input-lieu-dit"
                    />
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <Label>Emplacement sur la carte</Label>
                  <LocationMapPicker
                    ref={mapRef}
                    latitude={latitude}
                    longitude={longitude}
                    confirmed={locationConfirmed}
                    onConfirm={() => setLocationConfirmed(true)}
                    onLocationChange={(lat, lng, info) => {
                      setLatitude(lat);
                      setLongitude(lng);
                      setLocationConfirmed(false);
                      // Toujours mettre à jour (même vide) pour effacer les valeurs précédentes
                      setCity(info.city ?? "");
                      setLieuDit(info.locality ?? "");
                      if (info.country) setDetectedCountry(info.country);
                      // Vérification pays : comparer le code pays détecté avec le pays d'inscription
                      if (info.countryCode && user?.country) {
                        const userCode = africanCountries.find(
                          c => c.name.toLowerCase() === (user.country ?? "").toLowerCase()
                        )?.code ?? "";
                        setCountryMismatch(
                          userCode !== "" && info.countryCode !== userCode
                        );
                      } else {
                        setCountryMismatch(false);
                      }
                    }}
                  />
                  {countryMismatch && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 mt-2">
                      <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-500">
                        Le pays sélectionné sur la carte ne correspond pas à votre pays d'inscription (<strong>{user?.country}</strong>). Veuillez déplacer le repère vers votre pays.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              {currentStep >= 2 && currentStep <= 4 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{t.kyc.documentsSection}</p>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                    {t.kyc.documentsTitle}
                  </CardTitle>
                  <CardDescription>{t.kyc.documentsDesc}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {currentStep === 2 && (
                  <>
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
                  </>
                  )}

                  {currentStep === 3 && (
                  renderUploadBox(
                    "back",
                    t.kyc.backLabel,
                    t.kyc.backDesc,
                    <ImageIcon className="w-8 h-8" />,
                    backInputRef as React.RefObject<HTMLInputElement>
                  )
                  )}

                  {/* Selfie — caméra frontale ou galerie */}
                  {currentStep === 4 && (
                  <div className="space-y-2">
                    <Label>{t.kyc.selfieLabel}</Label>
                    <canvas ref={canvasRef} className="hidden" />
                    <input
                      type="file"
                      ref={selfieInputRef}
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleInputChange("selfie")}
                      className="hidden"
                      data-testid="input-file-selfie"
                    />

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
                    ) : (
                      <div className="space-y-2">
                        {cameraError && (
                          <p className="text-xs text-destructive">{cameraError}</p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          {/* Caméra */}
                          <button
                            type="button"
                            onClick={startCamera}
                            disabled={cameraStarting || uploading.selfie}
                            className="border-2 border-dashed border-border rounded-lg p-5 text-center hover:border-primary/50 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <div className="w-10 h-10 mx-auto text-muted-foreground mb-2 flex items-center justify-center">
                              {cameraStarting ? <Loader2 className="w-7 h-7 animate-spin" /> : <Camera className="w-7 h-7" />}
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">
                              {cameraStarting ? "Ouverture…" : "Caméra"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">Prendre une photo</p>
                          </button>
                          {/* Galerie */}
                          <button
                            type="button"
                            onClick={() => selfieInputRef.current?.click()}
                            disabled={uploading.selfie || cameraStarting}
                            className="border-2 border-dashed border-border rounded-lg p-5 text-center hover:border-primary/50 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <div className="w-10 h-10 mx-auto text-muted-foreground mb-2 flex items-center justify-center">
                              {uploading.selfie ? <Loader2 className="w-7 h-7 animate-spin" /> : <ImageIcon className="w-7 h-7" />}
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">
                              {uploading.selfie ? "Envoi…" : "Galerie"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">Depuis vos photos</p>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </CardContent>
              </Card>
              )}

              {currentStep === 5 && (
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
                    <p className={cn("text-xs", descriptionWordCount > 250 || (descriptionWordCount > 0 && descriptionWordCount < 20) ? "text-destructive font-medium" : "text-muted-foreground")}>
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
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handlePreviousStep}
                disabled={currentStep === 1}
                className="rounded-xl"
                data-testid="button-previous-kyc-step"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t.kyc.wizardBack}
              </Button>

              {currentStep < wizardSteps.length ? (
                <Button type="submit" size="lg" className="rounded-xl" data-testid="button-next-kyc-step">
                  {t.kyc.wizardNext}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="lg"
                  disabled={submitMutation.isPending}
                  className="rounded-xl"
                  data-testid="button-submit-kyc"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t.kyc.submitting}
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      {t.kyc.wizardFinish}
                    </>
                  )}
                </Button>
              )}
            </div>
          </form>
          </>
        )}
      </div>

      {/* Full-screen camera overlay — rendered via portal so it covers everything */}
      {cameraActive && createPortal(
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          {/* Video — fills remaining space */}
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
            />
            {/* Loading overlay */}
            {!cameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">Démarrage de la caméra…</p>
              </div>
            )}
            {/* Close button — top right */}
            <button
              type="button"
              onClick={stopCamera}
              className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <X className="w-6 h-6" />
            </button>
            {/* Instruction — top center */}
            <p className="absolute top-4 left-1/2 -translate-x-1/2 text-xs text-white/80 bg-black/40 px-3 py-1 rounded-full whitespace-nowrap">
              Tenez votre pièce visible et regardez la caméra
            </p>
          </div>

          {/* Bottom bar */}
          <div className="safe-area-bottom px-6 py-6 flex flex-col gap-3 bg-black">
            {cameraError && (
              <p className="text-xs text-red-400 text-center">{cameraError}</p>
            )}
            <Button
              type="button"
              onClick={capturePhoto}
              disabled={!cameraReady || capturingPhoto || uploading.selfie}
              className="w-full h-14 text-base bg-yellow-500 hover:bg-yellow-600 text-black font-semibold rounded-2xl"
            >
              {(capturingPhoto || uploading.selfie)
                ? <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                : <Camera className="w-5 h-5 mr-2" />}
              {uploading.selfie ? "Envoi…" : capturingPhoto ? "Capture…" : !cameraReady ? "Chargement…" : "Prendre la photo"}
            </Button>
          </div>
        </div>,
        document.body
      )}
    </DashboardLayout>
  );
}
