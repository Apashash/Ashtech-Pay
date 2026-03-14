import { useLocation } from "wouter";
import { AdminLayout } from "../layout";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function RatesSettings() {
  const [, setLocation] = useLocation();
  
  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/admin/settings")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Device et taux</h1>
            <p className="text-muted-foreground">Taux de change par devise</p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>À venir</CardTitle>
          </CardHeader>
        </Card>
      </div>
    </AdminLayout>
  );
}
