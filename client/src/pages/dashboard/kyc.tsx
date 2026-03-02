import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { useState, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

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

  const filteredCategories = businessType 
    ? BUSINESS_CATEGORIES.filter(cat => cat.type === businessType)
    : BUSINESS_CATEGORIES;

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
        title: "Demande soumise",
        description: "Votre demande de vérification est en cours de traitement.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = useCallback(async (file: File, field: UploadField) => {
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Type de fichier non autorisé",
        description: "Veuillez utiliser un fichier JPG, PNG ou WebP",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 5 Mo",
        variant: "destructive",
      });
      return;
    }

    setUploading(prev => ({ ...prev, [field]: true }));

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads/file", {
        method: "POST",
        credentials: "include",
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
        title: "Fichier téléchargé",
        description: "Le fichier a été téléchargé avec succès",
      });
    } catch (error) {
      toast({
        title: "Erreur de téléchargement",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setUploading(prev => ({ ...prev, [field]: false }));
    }
  }, [toast]);

  const handleInputChange = (field: UploadField) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, field);
    }
  };

  const removeUpload = (field: UploadField) => {
    setUploadedPaths(prev => ({ ...prev, [field]: null }));
    setUploadPreviews(prev => ({ ...prev, [field]: null }));
    
    const inputRef = field === "front" ? frontInputRef : field === "back" ? backInputRef : selfieInputRef;
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!documentType || !documentNumber || !businessType || !businessCategory || !businessDescription) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    if (!uploadedPaths.front || !uploadedPaths.back || !uploadedPaths.selfie) {
      toast({
        title: "Documents requis",
        description: "Veuillez télécharger tous les documents requis",
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
      city: city || undefined,
      postalCode: postalCode || undefined,
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
                <p className="font-semibold text-foreground">Compte vérifié</p>
                <p className="text-sm text-muted-foreground">
                  Votre compte est entièrement vérifié. Vous avez accès à toutes les fonctionnalités.
                </p>
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
                <p className="font-semibold text-foreground">Vérification en cours</p>
                <p className="text-sm text-muted-foreground">
                  Votre demande est en cours d'examen. Vous serez notifié par email une fois la vérification terminée.
                </p>
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
                <p className="font-semibold text-foreground">Vérification rejetée</p>
                <p className="text-sm text-muted-foreground mb-2">
                  Votre demande a été rejetée. Veuillez soumettre de nouveaux documents.
                </p>
                {kycSubmission.reviewNote && (
                  <div className="bg-red-500/10 rounded-lg p-3 mt-2">
                    <p className="text-sm text-red-400">
                      <strong>Raison :</strong> {kycSubmission.reviewNote}
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
              <p className="font-semibold text-foreground">Vérification non effectuée</p>
              <p className="text-sm text-muted-foreground">
                Complétez votre vérification KYC pour accéder aux fonctionnalités d'envoi, de retrait et de transfert.
              </p>
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
                <span className="text-sm font-medium">Téléchargé</span>
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
              {isUploading ? "Téléchargement en cours..." : description}
            </p>
            <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP - Max 5 Mo</p>
          </button>
        )}
      </div>
    );
  };

  const canSubmitForm = !kycSubmission || kycSubmission.status === "rejected";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vérification KYC</h1>
          <p className="text-muted-foreground">Vérifiez votre identité pour débloquer toutes les fonctionnalités</p>
        </div>

        {renderStatusCard()}

        {canSubmitForm && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Informations personnelles
                </CardTitle>
                <CardDescription>
                  Ces informations proviennent de votre compte et ne peuvent pas être modifiées ici
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Nom complet</Label>
                    <Input
                      value={user?.fullName || ""}
                      disabled
                      className="bg-muted/50"
                      data-testid="input-fullname-readonly"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Adresse email</Label>
                    <Input
                      value={user?.email || ""}
                      disabled
                      className="bg-muted/50"
                      data-testid="input-email-readonly"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Numéro de téléphone</Label>
                    <Input
                      value={user?.phone || "Non renseigné"}
                      disabled
                      className="bg-muted/50"
                      data-testid="input-phone-readonly"
                    />
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Pays</Label>
                    <Input
                      value={user?.country || "Non renseigné"}
                      disabled
                      className="bg-muted/50"
                      data-testid="input-country-readonly"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ville</Label>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ex: Douala"
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Code postal</Label>
                    <Input
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="Ex: 00237"
                      data-testid="input-postal-code"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Pièce d'identité
                  </CardTitle>
                  <CardDescription>
                    Téléchargez une copie de votre pièce d'identité valide
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type de document *</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger data-testid="select-document-type">
                        <SelectValue placeholder="Choisir le type de document" />
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
                    <Label>Numéro du document *</Label>
                    <Input
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      placeholder="Ex: 123456789"
                      data-testid="input-document-number"
                    />
                  </div>

                  {renderUploadBox(
                    "front",
                    "Recto du document *",
                    "Cliquez pour télécharger le recto",
                    <ImageIcon className="w-8 h-8" />,
                    frontInputRef as React.RefObject<HTMLInputElement>
                  )}

                  {renderUploadBox(
                    "back",
                    "Verso du document *",
                    "Cliquez pour télécharger le verso",
                    <ImageIcon className="w-8 h-8" />,
                    backInputRef as React.RefObject<HTMLInputElement>
                  )}

                  {renderUploadBox(
                    "selfie",
                    "Selfie avec le document *",
                    "Prenez un selfie en tenant votre document",
                    <Camera className="w-8 h-8" />,
                    selfieInputRef as React.RefObject<HTMLInputElement>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Informations sur l'activité
                  </CardTitle>
                  <CardDescription>
                    Décrivez votre activité professionnelle ou commerciale
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type d'activité *</Label>
                    <Select 
                      value={businessType} 
                      onValueChange={(value: "physical" | "online") => {
                        setBusinessType(value);
                        setBusinessCategory("");
                      }}
                    >
                      <SelectTrigger data-testid="select-business-type">
                        <SelectValue placeholder="Choisir le type d'activité" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="physical">Commerce physique / Service en personne</SelectItem>
                        <SelectItem value="online">Commerce en ligne / Service numérique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Catégorie d'activité *</Label>
                    <Select 
                      value={businessCategory} 
                      onValueChange={setBusinessCategory}
                      disabled={!businessType}
                    >
                      <SelectTrigger data-testid="select-business-category">
                        <SelectValue placeholder={businessType ? "Choisir la catégorie" : "Sélectionnez d'abord le type"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {filteredCategories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Description de l'activité *</Label>
                    <Textarea
                      value={businessDescription}
                      onChange={(e) => setBusinessDescription(e.target.value)}
                      placeholder="Décrivez brièvement votre activité, les produits ou services que vous proposez..."
                      rows={4}
                      data-testid="textarea-business-description"
                    />
                    <p className="text-xs text-muted-foreground">
                      Minimum 20 caractères
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                    <h4 className="font-medium text-sm">Documents requis</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-center gap-2">
                        {uploadedPaths.front ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-muted-foreground" />
                        )}
                        Recto du document d'identité
                      </li>
                      <li className="flex items-center gap-2">
                        {uploadedPaths.back ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-muted-foreground" />
                        )}
                        Verso du document d'identité
                      </li>
                      <li className="flex items-center gap-2">
                        {uploadedPaths.selfie ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-muted-foreground" />
                        )}
                        Selfie avec le document
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
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Soumettre pour vérification
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
