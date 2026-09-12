import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language";
import { useLocation } from "wouter";
import {
  ArrowRight,
  CheckCircle2,
  Code2,
  CreditCard,
  Globe2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

function OptionCard({
  icon: Icon,
  iconClassName,
  title,
  description,
  points,
  buttonLabel,
  onClick,
  testId,
}: {
  icon: React.ElementType;
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
        <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ${iconClassName}`}>
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="mt-2 min-h-[3.5rem] text-sm leading-6 text-muted-foreground">{description}</p>
        <ul className="mt-5 space-y-3 text-sm text-foreground">
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
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-500">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {copy.eyebrow}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
            {copy.subtitle}
          </p>
        </div>

        <Card className="overflow-hidden border-primary/15 bg-primary/[0.04]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{copy.bannerTitle}</p>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{copy.bannerDescription}</p>
              </div>
            </div>
            <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-600">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {copy.status}
            </span>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <OptionCard
            icon={CreditCard}
            iconClassName="bg-violet-500/10 text-violet-500"
            title={copy.embeddedTitle}
            description={copy.embeddedDescription}
            points={[copy.embeddedPoint1, copy.embeddedPoint2, copy.embeddedPoint3]}
            buttonLabel={copy.embeddedButton}
            onClick={() => setLocation("/dashboard/hosted-page")}
            testId="button-api-embedded-checkout"
          />
          <OptionCard
            icon={Code2}
            iconClassName="bg-blue-500/10 text-blue-500"
            title={copy.directTitle}
            description={copy.directDescription}
            points={[copy.directPoint1, copy.directPoint2, copy.directPoint3]}
            buttonLabel={copy.directButton}
            onClick={() => setLocation("/docs/api")}
            testId="button-api-direct"
          />
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
          <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-sm leading-6 text-muted-foreground">{copy.footer}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}