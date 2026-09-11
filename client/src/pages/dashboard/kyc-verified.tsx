import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/lib/language";

export default function KYCVerifiedPage() {
  const [, setLocation] = useLocation();
  const { t } = useLanguage();

  const handleUpdateKYC = () => {
    setLocation("/dashboard/kyc?update=true&confirmed=true");
  };

  const handleGoBack = () => {
    setLocation("/dashboard");
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <ShieldCheck className="w-10 h-10 text-green-500" />
            </div>
            <CardTitle className="text-2xl">{t.kycVerified.title}</CardTitle>
            <CardDescription className="text-base mt-2">
              {t.kycVerified.desc}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {t.kycVerified.updateQuestion}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={handleGoBack}>
                {t.kycVerified.noBack}
              </Button>
              <Button onClick={handleUpdateKYC}>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t.kycVerified.yesUpdate}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
