import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WithdrawalNumber, WithdrawalNumberChange } from "@shared/schema";
import { Phone, Plus, Loader2, Edit, Trash2, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useLanguage } from "@/lib/language";

export default function WithdrawalNumbersPage() {
  const { toast } = useToast();
  const { t } = useLanguage();

  const { data: withdrawalNumbers = [], isLoading: numbersLoading } = useQuery<WithdrawalNumber[]>({
    queryKey: ["/api/withdrawal-numbers"],
  });

  const { data: changeRequests = [] } = useQuery<WithdrawalNumberChange[]>({
    queryKey: ["/api/withdrawal-number-changes"],
  });

  const requestDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/withdrawal-numbers/${id}/request-delete`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/withdrawal-number-changes"] });
      toast({
        title: t.withdrawalNumbers.toastDeleteTitle,
        description: t.withdrawalNumbers.toastDeleteDesc,
      });
    },
    onError: (error: Error) => {
      toast({ title: t.withdrawalNumbers.toastError, description: error.message, variant: "destructive" });
    },
  });

  const pendingRequests = changeRequests.filter(r => r.status === "pending");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> {t.withdrawalNumbers.statusPending}</Badge>;
      case "approved":
        return <Badge className="gap-1 bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3" /> {t.withdrawalNumbers.statusApproved}</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> {t.withdrawalNumbers.statusRejected}</Badge>;
      default:
        return null;
    }
  };

  const getActionText = (action: string) => {
    switch (action) {
      case "add": return t.withdrawalNumbers.actionAdd;
      case "update": return t.withdrawalNumbers.actionUpdate;
      case "delete": return t.withdrawalNumbers.actionDelete;
      default: return action;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t.withdrawalNumbers.title}</h1>
            <p className="text-muted-foreground">{t.withdrawalNumbers.subtitle}</p>
          </div>
          {withdrawalNumbers.length < 2 && (
            <Link href="/dashboard/withdrawal-numbers/add">
              <Button data-testid="button-add-number">
                <Plus className="w-4 h-4 mr-2" />
                {t.withdrawalNumbers.addButton}
              </Button>
            </Link>
          )}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t.withdrawalNumbers.registeredNumbers}</p>
          {numbersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : withdrawalNumbers.length === 0 ? (
            <div className="text-center py-10 rounded-xl border border-border bg-card">
              <Phone className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">{t.withdrawalNumbers.noNumbers}</p>
              <p className="text-xs text-muted-foreground mt-1">{t.withdrawalNumbers.noNumbersHint}</p>
              <Link href="/dashboard/withdrawal-numbers/add">
                <Button className="mt-4" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  {t.withdrawalNumbers.addButton}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {withdrawalNumbers.map((number) => (
                <div
                  key={number.id}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors"
                  data-testid={`withdrawal-number-${number.id}`}
                >
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{number.phoneNumber}</p>
                    <p className="text-xs text-muted-foreground">{number.operatorName}{number.label ? ` · ${number.label}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link href={`/dashboard/withdrawal-numbers/edit/${number.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-edit-${number.id}`}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => requestDeleteMutation.mutate(number.id)}
                      disabled={requestDeleteMutation.isPending}
                      data-testid={`button-delete-${number.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {pendingRequests.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t.withdrawalNumbers.pendingApproval}</p>
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 overflow-hidden divide-y divide-yellow-500/20">
              {pendingRequests.map((request) => (
                <div key={request.id} className="flex items-center gap-3 px-4 py-3.5">
                  <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{getActionText(request.action)}</Badge>
                      {getStatusBadge(request.status)}
                    </div>
                    {request.newPhoneNumber && <p className="text-sm text-foreground mt-0.5">{request.newPhoneNumber}</p>}
                    {request.newOperatorName && <p className="text-xs text-muted-foreground">{request.newOperatorName}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {changeRequests.filter(r => r.status !== "pending").length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t.withdrawalNumbers.requestHistory}</p>
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {changeRequests.filter(r => r.status !== "pending").map((request) => (
                <div key={request.id} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{getActionText(request.action)}</Badge>
                      {getStatusBadge(request.status)}
                    </div>
                    {request.newPhoneNumber && <p className="text-xs text-muted-foreground mt-0.5">{request.newPhoneNumber}</p>}
                    {request.adminNote && <p className="text-xs text-muted-foreground">{t.withdrawalNumbers.noteLabel} {request.adminNote}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
