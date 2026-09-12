import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language";
import { useLocation } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  Globe2,
} from "lucide-react";

function OptionCard({
  iconSrc,
  iconAlt,
  iconClassName,
  title,
  description,
  points,
  buttonLabel,
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
        <Button onClick={onClick} className="mt-7 w-full gap-2" data-testid={testId}>
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
            iconAlt="Embedded checkout"
            iconClassName="bg-violet-500/10 text-violet-500"
            title={copy.embeddedTitle}
            description={copy.embeddedDescription}
            points={[copy.embeddedPoint1, copy.embeddedPoint2, copy.embeddedPoint3]}
            buttonLabel={copy.embeddedButton}
            onClick={() => setLocation("/dashboard/hosted-page")}
            testId="button-api-embedded-checkout"
          />
          <OptionCard
            iconSrc="/api-integration-icon.png"
            iconAlt="Direct API"
            iconClassName="bg-blue-500/10 text-blue-500"
            title={copy.directTitle}
            description={copy.directDescription}
            points={[copy.directPoint1, copy.directPoint2, copy.directPoint3]}
            buttonLabel={copy.directButton}
            onClick={() => setLocation("/dashboard/direct-api")}
            testId="button-api-direct"
          />
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
          <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-[15px] leading-6 text-muted-foreground">{copy.footer}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}