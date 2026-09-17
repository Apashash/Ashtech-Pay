import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/language";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetDescription,
  BottomSheetFooter,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@/components/ui/bottom-sheet";
import {
  ArrowRight,
  CheckCircle2,
  Globe2,
  ShieldCheck,
} from "lucide-react";

function OptionCard({
  iconSrc,
  iconAlt,
  iconClassName,
  title,
  description,
  points,
  buttonLabel,
  buttonDisabled,
  onClick,
  testId,
}: {
  iconSrc: string;
  iconAlt: string;
  iconClassName: string;
  title: string;
  description: string;
  points: string[];
  buttonLabel: string;
  buttonDisabled?: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <Card className="h-full overflow-hidden border-border/80 transition-all hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="flex h-full flex-col p-5 sm:p-6">
        <div className={`mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl p-1 ${iconClassName}`}>
          <img src={iconSrc} alt={iconAlt} className="h-full w-full object-contain" />
        </div>
        <h2 className="text-lg font-semibold leading-6 text-foreground">{title}</h2>
        <p className="mt-2 min-h-[3.5rem] text-[15px] leading-6 text-muted-foreground">{description}</p>
        <ul className="mt-5 space-y-3 text-[15px] leading-6 text-foreground">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <Button onClick={onClick} disabled={buttonDisabled} className="mt-7 w-full gap-2" data-testid={testId}>
          {buttonLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ApiKeysPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const copy = t.apiHub;
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });
  const isKycVerified = user?.role === "admin" || user?.isVerified === true;
  const directApiEnabled = user?.role === "admin" || user?.apiEnabled === true;
  const [showKycDialog, setShowKycDialog] = useState(false);

  useEffect(() => {
    if (user && !isKycVerified) setShowKycDialog(true);
  }, [user, isKycVerified]);

  const openFeature = (path: string) => {
    if (!isKycVerified) {
      setShowKycDialog(true);
      return;
    }
    setLocation(path);
  };

  return (
    <DashboardLayout>
      <div className="w-full max-w-5xl space-y-7">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold leading-8 tracking-tight text-foreground sm:text-3xl">
            {copy.title}
          </h1>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <OptionCard
            iconSrc="/embedded-checkout-icon.png"
            iconAlt="Hosted Checkout"
            iconClassName="bg-violet-500/10 text-violet-500"
            title={copy.embeddedTitle}
            description={copy.embeddedDescription}
            points={[copy.embeddedPoint1, copy.embeddedPoint2, copy.embeddedPoint3]}
            buttonLabel={copy.embeddedButton}
            onClick={() => openFeature("/dashboard/hosted-page")}
            testId="button-api-embedded-checkout"
          />
          <OptionCard
            iconSrc="/api-integration-icon.png"
            iconAlt="Direct API"
            iconClassName="bg-blue-500/10 text-blue-500"
            title={copy.directTitle}
            description={directApiEnabled ? copy.directDescription : copy.directDisabledDescription}
            points={[copy.directPoint1, copy.directPoint2, copy.directPoint3]}
            buttonLabel={!isKycVerified ? copy.kycRequiredButton : directApiEnabled ? copy.directButton : copy.directDisabledButton}
            buttonDisabled={isKycVerified && !directApiEnabled}
            onClick={() => openFeature("/dashboard/direct-api")}
            testId="button-api-direct"
          />
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
          <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-[15px] leading-6 text-muted-foreground">{copy.footer}</p>
        </div>
      </div>
      <BottomSheet open={showKycDialog} onOpenChange={setShowKycDialog}>
        <BottomSheetContent>
          <BottomSheetHeader className="pt-5 pb-3 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
              <ShieldCheck className="h-7 w-7 text-amber-600" />
            </div>
            <BottomSheetTitle className="text-xl">{copy.kycRequiredTitle}</BottomSheetTitle>
            <BottomSheetDescription className="mx-auto max-w-sm text-[15px] leading-6">
              {copy.kycRequiredDescription}
            </BottomSheetDescription>
          </BottomSheetHeader>
          <BottomSheetFooter className="flex-col gap-2 pb-7 pt-2">
            <Button
              className="w-full bg-amber-500 text-white hover:bg-amber-600"
              onClick={() => setLocation("/dashboard/kyc")}
            >
              {copy.kycRequiredButton}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowKycDialog(false)}
            >
              {copy.kycRequiredCancel}
            </Button>
          </BottomSheetFooter>
        </BottomSheetContent>
      </BottomSheet>
    </DashboardLayout>
  );
}