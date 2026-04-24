import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Mail, Send, Users, Eye, Palette, Type, Link2,
  AlertTriangle, CheckCircle2, Clock, TrendingUp, UserX, Loader2
} from "lucide-react";

const SEGMENTS = [
  {
    value: "all",
    label: "Tous les utilisateurs",
    icon: Users,
    color: "text-blue-500",
    description: "Envoie à tous les comptes inscrits",
  },
  {
    value: "kyc_verified_no_tx",
    label: "KYC validé — aucune transaction",
    icon: AlertTriangle,
    color: "text-amber-500",
    description: "Utilisateurs vérifiés mais jamais actifs",
  },
  {
    value: "kyc_pending",
    label: "KYC en attente de validation",
    icon: Clock,
    color: "text-orange-500",
    description: "KYC soumis mais pas encore examiné",
  },
  {
    value: "kyc_rejected",
    label: "KYC rejeté",
    icon: UserX,
    color: "text-red-500",
    description: "KYC refusé — encourager à re-soumettre",
  },
  {
    value: "kyc_not_submitted",
    label: "KYC non soumis",
    icon: AlertTriangle,
    color: "text-yellow-500",
    description: "Inscrits mais n'ont jamais soumis le KYC",
  },
  {
    value: "active",
    label: "Utilisateurs très actifs (10+ tx)",
    icon: TrendingUp,
    color: "text-green-500",
    description: "Utilisateurs avec 10 transactions ou plus",
  },
  {
    value: "kyc_verified",
    label: "Tous les utilisateurs avec KYC validé",
    icon: CheckCircle2,
    color: "text-emerald-500",
    description: "Tous les marchands vérifiés actifs ou non",
  },
];

const BUTTON_COLORS = [
  { label: "Or (défaut)", value: "#F0B90B", text: "#000000" },
  { label: "Bleu", value: "#1877F2", text: "#FFFFFF" },
  { label: "Vert", value: "#22C55E", text: "#FFFFFF" },
  { label: "Rouge", value: "#EF4444", text: "#FFFFFF" },
  { label: "Violet", value: "#8B5CF6", text: "#FFFFFF" },
  { label: "Noir", value: "#1F2937", text: "#FFFFFF" },
  { label: "Orange", value: "#F97316", text: "#FFFFFF" },
];

export default function AdminEmailCampaigns() {
  const { toast } = useToast();

  const [segment, setSegment] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [body, setBody] = useState("");
  const [hasButton, setHasButton] = useState(false);
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [buttonColor, setButtonColor] = useState("#F0B90B");
  const [buttonTextColor, setButtonTextColor] = useState("#000000");
  const [showPreview, setShowPreview] = useState(false);

  const selectedSegment = SEGMENTS.find(s => s.value === segment);
  const selectedBtnColor = BUTTON_COLORS.find(c => c.value === buttonColor);

  const { data: segmentCount, isLoading: countLoading } = useQuery<{ count: number }>({
    queryKey: ["/api/admin/email-segment-count", segment],
    enabled: !!segment,
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/send-email-campaign", {
        segment,
        subject,
        previewText,
        body,
        hasButton,
        buttonText: hasButton ? buttonText : undefined,
        buttonUrl: hasButton ? buttonUrl : undefined,
        buttonColor: hasButton ? buttonColor : undefined,
        buttonTextColor: hasButton ? buttonTextColor : undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Campagne envoyée",
        description: `Email envoyé à ${data.sent} destinataire(s).`,
      });
      setSubject("");
      setPreviewText("");
      setBody("");
      setButtonText("");
      setButtonUrl("");
      setHasButton(false);
    },
    onError: (err: Error) => {
      toast({
        title: "Erreur d'envoi",
        description: err.message || "Impossible d'envoyer la campagne",
        variant: "destructive",
      });
    },
  });

  const canSend =
    segment &&
    subject.trim() &&
    body.trim() &&
    (!hasButton || (buttonText.trim() && buttonUrl.trim()));

  const buildPreviewHtml = () => {
    const btnHtml = hasButton && buttonText && buttonUrl
      ? `<div style="text-align:center;margin:28px 0;">
          <a href="${buttonUrl}" style="display:inline-block;background:${buttonColor};color:${buttonTextColor};font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;">${buttonText}</a>
        </div>`
      : "";

    const bodyHtml = body
      .split("\n\n")
      .map(p => `<p style="margin:0 0 16px;font-size:14px;color:#1F2937;line-height:1.75;">${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");

    return `
      <div style="background:#F5F7FA;padding:24px;font-family:Arial,sans-serif;border-radius:12px;">
        <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden;">
          <div style="background:#FFFFFF;padding:28px 36px 20px;text-align:center;border-bottom:2px solid #F0B90B;">
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
              <tr>
                <td style="vertical-align:middle;text-align:center;">
                  <img src="/logo.png" height="52" style="display:inline-block;max-height:52px;width:auto;" alt="AshTech Pay"/>
                </td>
              </tr>
            </table>
          </div>
          <div style="padding:32px 36px;">
            <h2 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#1F2937;">${subject || "(Objet du mail)"}</h2>
            ${bodyHtml || '<p style="color:#9CA3AF;">Corps du message…</p>'}
            ${btnHtml}
          </div>
          <div style="padding:16px 36px 20px;border-top:1px solid #E5E7EB;text-align:center;">
            <p style="margin:0;font-size:11px;color:#6B7280;">© 2026 AshTech Pay — Tous droits réservés</p>
          </div>
        </div>
      </div>`;
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Campagnes Email</h1>
            <p className="text-sm text-muted-foreground">Compose et envoie des emails ciblés aux utilisateurs</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT — Compose */}
          <div className="space-y-5">
            {/* Segment */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Destinataires
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={segment} onValueChange={setSegment}>
                  <SelectTrigger data-testid="select-segment">
                    <SelectValue placeholder="Choisir un segment d'utilisateurs…" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTS.map(s => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="flex items-center gap-2">
                          <s.icon className={`w-4 h-4 ${s.color}`} />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedSegment && (
                  <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                    <p className="text-xs text-muted-foreground">{selectedSegment.description}</p>
                    {countLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {segmentCount?.count ?? "—"} destinataire(s)
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Subject & Preview Text */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Type className="w-4 h-4 text-primary" />
                  Objet
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Objet de l'email *</Label>
                  <Input
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Ex: 🎉 Offre spéciale pour vous !"
                    data-testid="input-subject"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Texte de prévisualisation (optionnel)</Label>
                  <Input
                    value={previewText}
                    onChange={e => setPreviewText(e.target.value)}
                    placeholder="Résumé court affiché avant d'ouvrir l'email…"
                    data-testid="input-preview-text"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Body */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mail className="w-4 h-4 text-primary" />
                  Corps du message
                </CardTitle>
                <CardDescription className="text-xs">Sépare les paragraphes par une ligne vide.</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder={"Bonjour {prenom},\n\nVoici un message important pour vous…\n\nMerci de votre confiance !"}
                  className="min-h-[180px] resize-y text-sm"
                  data-testid="textarea-body"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Utilise <code className="bg-muted px-1 rounded">{"{prenom}"}</code> pour personnaliser avec le prénom.
                </p>
              </CardContent>
            </Card>

            {/* Button */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  Bouton d'action (optionnel)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Ajouter un bouton</Label>
                  <Switch
                    checked={hasButton}
                    onCheckedChange={setHasButton}
                    data-testid="switch-has-button"
                  />
                </div>

                {hasButton && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Texte du bouton *</Label>
                        <Input
                          value={buttonText}
                          onChange={e => setButtonText(e.target.value)}
                          placeholder="Ex: Accéder au dashboard"
                          data-testid="input-button-text"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Lien du bouton *</Label>
                        <Input
                          value={buttonUrl}
                          onChange={e => setButtonUrl(e.target.value)}
                          placeholder="https://ashtechpay.top/..."
                          data-testid="input-button-url"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs flex items-center gap-1">
                        <Palette className="w-3 h-3" />
                        Couleur du bouton
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {BUTTON_COLORS.map(c => (
                          <button
                            key={c.value}
                            onClick={() => {
                              setButtonColor(c.value);
                              setButtonTextColor(c.text);
                            }}
                            className={`h-8 px-3 rounded-md text-xs font-semibold border-2 transition-all ${
                              buttonColor === c.value ? "border-foreground scale-105" : "border-transparent"
                            }`}
                            style={{ background: c.value, color: c.text }}
                            data-testid={`button-color-${c.label}`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {buttonText && (
                      <div className="flex justify-center pt-2">
                        <div
                          className="px-6 py-3 rounded-lg text-sm font-bold"
                          style={{ background: buttonColor, color: buttonTextColor }}
                        >
                          {buttonText}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Send */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => setShowPreview(!showPreview)}
                data-testid="button-preview"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? "Masquer" : "Prévisualiser"}
              </Button>
              <Button
                className="flex-1 gap-2"
                disabled={!canSend || sendMutation.isPending}
                onClick={() => sendMutation.mutate()}
                data-testid="button-send"
              >
                {sendMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {sendMutation.isPending
                  ? "Envoi en cours…"
                  : `Envoyer${segmentCount?.count ? ` (${segmentCount.count})` : ""}`}
              </Button>
            </div>

            {!canSend && (
              <p className="text-xs text-muted-foreground text-center">
                Remplis le segment, l'objet et le corps du message pour envoyer.
              </p>
            )}
          </div>

          {/* RIGHT — Preview */}
          <div className="space-y-5">
            <Card className="sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  Aperçu de l'email
                </CardTitle>
                {subject && (
                  <p className="text-xs text-muted-foreground">
                    Objet : <strong className="text-foreground">{subject}</strong>
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div
                  className="rounded-xl overflow-hidden border border-border"
                  dangerouslySetInnerHTML={{ __html: buildPreviewHtml() }}
                />
                <Separator className="my-4" />
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                    <span>Header : Logo AshTech Pay + nom de la plateforme</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                    <span>Footer : copyright + liens de support (WhatsApp / Facebook)</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                    <span>Personnalisation automatique du prénom par destinataire</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
