import React, { useEffect, useLayoutEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, removeAuthToken, getQueryFn, getAuthHeaders } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useSSE } from "@/hooks/use-sse";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/language";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import AdminLoginOtpPage from "@/pages/admin-login-otp";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import DashboardHome from "@/pages/dashboard/index";
import TransactionsPage from "@/pages/dashboard/transactions";
import TransactionDetailPage from "@/pages/dashboard/transaction-detail";
import PaymentLinksPage from "@/pages/dashboard/links";
import LinkDetailPage from "@/pages/dashboard/link-detail";
import LinkCreatePage from "@/pages/dashboard/link-create";
import LinkEditPage from "@/pages/dashboard/link-edit";
import DepositPage from "@/pages/dashboard/deposit";
import WithdrawPage from "@/pages/dashboard/withdraw";
import WithdrawalNumbersPage from "@/pages/dashboard/withdrawal-numbers";
import AddWithdrawalNumberPage from "@/pages/dashboard/add-withdrawal-number";
import EditWithdrawalNumberPage from "@/pages/dashboard/edit-withdrawal-number";
import TransferPage from "@/pages/dashboard/transfer";
import SendMoneyPage from "@/pages/dashboard/send";
import FeeExplanationsPage from "@/pages/dashboard/fee-details";
import GlobalMessagePage from "@/pages/dashboard/global-message";
import WalletsPage from "@/pages/dashboard/wallets";
import ConvertPage from "@/pages/dashboard/convert";
import KYCPage from "@/pages/dashboard/kyc";
import KYCVerifiedPage from "@/pages/dashboard/kyc-verified";
import SupportPage from "@/pages/dashboard/support";
import ApiKeysPage from "@/pages/dashboard/api-keys";
import DeveloperPage from "@/pages/dashboard/developer";
import HostedPageDashboard from "@/pages/dashboard/hosted-page";
import HostedPageDocs from "@/pages/dashboard/hosted-page-docs";
import TestPaymentPage from "@/pages/docs/test-payment";
import HPayPage from "@/pages/hpay";
import SettingsPage from "@/pages/dashboard/settings";
import PaymentPage from "@/pages/payment";
import CheckoutPage from "@/pages/checkout";
import NotFound from "@/pages/not-found";
import AdminDashboard from "@/pages/admin/index";
import AdminUsers from "@/pages/admin/users";
import AdminUserDetail from "@/pages/admin/user-detail";
import AdminTransactions from "@/pages/admin/transactions";
import AdminFees from "@/pages/admin/fees";
import AdminCountries from "@/pages/admin/countries";
import AdminLinks from "@/pages/admin/links";
import AdminSupport from "@/pages/admin/support";
import AdminLogs from "@/pages/admin/logs";
import AdminSettings from "@/pages/admin/settings";
import AdminSettingsPlatform from "@/pages/admin/settings/platform";
import AdminSettingsPublicInfo from "@/pages/admin/settings/public-info";
import AdminSettingsMaintenance from "@/pages/admin/settings/maintenance";
import AdminSettingsLimits from "@/pages/admin/settings/limits";
import AdminSettingsTurnstile from "@/pages/admin/settings/turnstile";
import AdminWithdrawalNumbers from "@/pages/admin/withdrawal-numbers";
import AdminDeposits from "@/pages/admin/transactions/deposits";
import AdminWithdrawals from "@/pages/admin/transactions/withdrawals";
import AdminTransfers from "@/pages/admin/transactions/transfers";
import AdminTransactionDetail from "@/pages/admin/transaction-detail";
import AdminFeesDeposits from "@/pages/admin/fees/deposits";
import AdminFeesWithdrawals from "@/pages/admin/fees/withdrawals";
import AdminFeesTransfers from "@/pages/admin/fees/transfers";
import AdminGlobalMessages from "@/pages/admin/global-messages";
import AdminKYC from "@/pages/admin/kyc";
import AdminConversions from "@/pages/admin/conversions";
import AdminPendingPayouts from "@/pages/admin/pending-payouts";
import AdminAfribaPay from "@/pages/admin/afribapay";
import AdminPixPay from "@/pages/admin/pixpay";
import AdminEmailCampaigns from "@/pages/admin/email-campaigns";
import AdminApiManagement from "@/pages/admin/api-management";
import AdminMerchants from "@/pages/admin/merchants";
import AdminBlockedIps from "@/pages/admin/blocked-ips";
import AdminAuditLogs from "@/pages/admin/audit";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import LegalPage from "@/pages/legal";
import AboutPage from "@/pages/about";
import CareersPage from "@/pages/careers";
import BlogPage from "@/pages/blog";
import HelpPage from "@/pages/help";
import ContactPage from "@/pages/contact";
import FAQPage from "@/pages/faq";
import CountryBlockedPage from "@/pages/country-blocked";
import BlockedPage from "@/pages/blocked";
import { getBlockedUntil, getGeoCache, setGeoCache, GEO_BYPASS_PATHS, GEO_CACHE_KEY } from "@/lib/appUtils";

// Redirige immédiatement vers /blocked si l'IP est bloquée (vérif. localStorage)
// useLayoutEffect + return null = aucun flash de la page login/register
function BlockGuard({ children }: { children: React.ReactNode }) {
  const [, navigate] = useLocation();
  const blockedUntil = getBlockedUntil();

  useLayoutEffect(() => {
    if (blockedUntil !== null) {
      navigate(`/blocked?until=${blockedUntil}`, { replace: true });
    }
  }, [blockedUntil]);

  if (blockedUntil !== null) return null;
  return <>{children}</>;
}


function GeoGuard({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const isBypass = GEO_BYPASS_PATHS.some((p) => location.startsWith(p));

  const cachedGeo = isBypass ? null : getGeoCache();

  const { data } = useQuery<{ country: string; countryName: string; isAfrica: boolean }>({
    queryKey: ["/api/public/geo"],
    queryFn: async () => {
      const res = await fetch("/api/public/geo");
      if (!res.ok) return { country: "XX", countryName: "Unknown", isAfrica: true };
      const result = await res.json();
      setGeoCache(result);
      return result;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
    enabled: !isBypass,
    initialData: cachedGeo ?? undefined,
  });

  if (isBypass) return <>{children}</>;
  // Render optimistically — only block if we have confirmed data saying isAfrica === false
  if (data && data.isAfrica === false) return <CountryBlockedPage />;
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/docs/api" component={() => <DeveloperPage publicMode />} />
      <Route path="/docs/hosted-page" component={() => <HostedPageDocs publicMode />} />
      <Route path="/docs/test-pay" component={TestPaymentPage} />
      <Route path="/blocked" component={BlockedPage} />
      <Route path="/login">
        <BlockGuard><LoginPage /></BlockGuard>
      </Route>
      <Route path="/admin-login-otp" component={AdminLoginOtpPage} />
      <Route path="/register">
        <BlockGuard><RegisterPage /></BlockGuard>
      </Route>
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/dashboard" component={DashboardHome} />
      <Route path="/dashboard/transactions" component={TransactionsPage} />
      <Route path="/dashboard/transactions/:id" component={TransactionDetailPage} />
      <Route path="/dashboard/links" component={PaymentLinksPage} />
      <Route path="/dashboard/links/new" component={LinkCreatePage} />
      <Route path="/dashboard/links/:id/edit" component={LinkEditPage} />
      <Route path="/dashboard/links/:id" component={LinkDetailPage} />
      <Route path="/dashboard/deposit" component={DepositPage} />
      <Route path="/dashboard/withdraw" component={WithdrawPage} />
      <Route path="/dashboard/withdrawal-numbers" component={WithdrawalNumbersPage} />
      <Route path="/dashboard/withdrawal-numbers/add" component={AddWithdrawalNumberPage} />
      <Route path="/dashboard/withdrawal-numbers/edit/:id" component={EditWithdrawalNumberPage} />
      <Route path="/dashboard/transfer" component={TransferPage} />
      <Route path="/dashboard/send" component={SendMoneyPage} />
      <Route path="/dashboard/fee-details" component={FeeExplanationsPage} />
      <Route path="/dashboard/global-message" component={GlobalMessagePage} />
      <Route path="/dashboard/wallets" component={WalletsPage} />
      <Route path="/dashboard/convert" component={ConvertPage} />
      <Route path="/dashboard/kyc" component={KYCPage} />
      <Route path="/dashboard/kyc-verified" component={KYCVerifiedPage} />
      <Route path="/dashboard/support" component={SupportPage} />
      <Route path="/dashboard/api-keys" component={ApiKeysPage} />
      <Route path="/dashboard/hosted-page" component={HostedPageDashboard} />
      <Route path="/hpay/:id" component={HPayPage} />
      <Route path="/dashboard/settings" component={SettingsPage} />
      <Route path="/pay/:slug" component={PaymentPage} />
      <Route path="/checkout/:transactionId" component={CheckoutPage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/users/:id" component={AdminUserDetail} />
      <Route path="/admin/transactions" component={AdminTransactions} />
      <Route path="/admin/transactions/deposits" component={AdminDeposits} />
      <Route path="/admin/transactions/withdrawals" component={AdminWithdrawals} />
      <Route path="/admin/transactions/transfers" component={AdminTransfers} />
      <Route path="/admin/transactions/:id" component={AdminTransactionDetail} />
      <Route path="/admin/fees" component={AdminFees} />
      <Route path="/admin/fees/deposits" component={AdminFeesDeposits} />
      <Route path="/admin/fees/withdrawals" component={AdminFeesWithdrawals} />
      <Route path="/admin/fees/transfers" component={AdminFeesTransfers} />
      <Route path="/admin/countries" component={AdminCountries} />
      <Route path="/admin/links" component={AdminLinks} />
      <Route path="/admin/support" component={AdminSupport} />
      <Route path="/admin/logs" component={AdminLogs} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/settings/platform" component={AdminSettingsPlatform} />
      <Route path="/admin/settings/public-info" component={AdminSettingsPublicInfo} />
      <Route path="/admin/settings/maintenance" component={AdminSettingsMaintenance} />
      <Route path="/admin/settings/limits" component={AdminSettingsLimits} />
      <Route path="/admin/settings/turnstile" component={AdminSettingsTurnstile} />
      <Route path="/admin/withdrawal-numbers" component={AdminWithdrawalNumbers} />
      <Route path="/admin/global-messages" component={AdminGlobalMessages} />
      <Route path="/admin/kyc" component={AdminKYC} />
      <Route path="/admin/conversions" component={AdminConversions} />
      <Route path="/admin/pending-payouts" component={AdminPendingPayouts} />
      <Route path="/admin/afribapay" component={AdminAfribaPay} />
      <Route path="/admin/pixpay" component={AdminPixPay} />
      <Route path="/admin/email-campaigns" component={AdminEmailCampaigns} />
      <Route path="/admin/api-management" component={AdminApiManagement} />
      <Route path="/admin/merchants" component={AdminMerchants} />
      <Route path="/admin/blocked-ips" component={AdminBlockedIps} />
      <Route path="/admin/audit" component={AdminAuditLogs} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/legal" component={LegalPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/careers" component={CareersPage} />
      <Route path="/blog" component={BlogPage} />
      <Route path="/help" component={HelpPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/faq" component={FAQPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Connexion SSE globale — expulse l'ancien navigateur en temps réel quand un nouveau login arrive
function SSEForceLogoutListener() {
  useSSE((event) => {
    if (event.type === "force_logout") {
      queryClient.clear();
      removeAuthToken();
      window.dispatchEvent(new CustomEvent("force-logout", { detail: event.data }));
    }
  });
  return null;
}


function GlobalSSEWatcher() {
  const { data: user } = useQuery({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    staleTime: 30000,
    refetchOnWindowFocus: "always",
  });

  // Filet de sécurité : vérifie la validité de session toutes les 10s via /api/auth/ping.
  // Passe par requireAuth → détecte les kicks single-device et les IPs bloquées.
  useEffect(() => {
    if (!user) return;
    const check = async () => {
      try {
        const res = await fetch("/api/auth/ping", {
          credentials: "include",
          headers: getAuthHeaders(),
        });
        if (res.status === 401) {
          try {
            const body = await res.json();
            if (body.sessionRevoked) {
              queryClient.clear();
              removeAuthToken();
              window.dispatchEvent(new CustomEvent("force-logout", { detail: { reason: "new_device", retryAfter: body.retryAfter } }));
              return;
            }
          } catch {}
          queryClient.clear();
          removeAuthToken();
          window.dispatchEvent(new CustomEvent("force-logout", { detail: {} }));
          return;
        }
        if (res.ok) {
          const data = await res.json();
          if (data.blocked && data.retryAfter) {
            try { localStorage.setItem("ashtech_rate_limit_until", String(data.retryAfter)); } catch {}
            queryClient.clear();
            removeAuthToken();
            window.dispatchEvent(new CustomEvent("force-logout", { detail: { retryAfter: data.retryAfter } }));
          }
        }
      } catch {}
    };
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) return null;
  return <SSEForceLogoutListener />;
}

function VpnDisconnectGuard() {
  useEffect(() => {
    const handler = (e: Event) => {
      queryClient.clear();
      removeAuthToken();
      window.location.href = "/";
    };
    window.addEventListener("vpn-disconnect", handler);
    return () => window.removeEventListener("vpn-disconnect", handler);
  }, []);

  return null;
}

function ForceLogoutGuard() {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      queryClient.clear();
      removeAuthToken();
      const retryAfter = detail?.retryAfter;
      const reason = detail?.reason;
      if (retryAfter) {
        try { localStorage.setItem("ashtech_rate_limit_until", String(retryAfter)); } catch {}
        window.location.href = `/blocked?until=${retryAfter}`;
      } else if (reason === "new_device") {
        window.location.href = "/";
      } else {
        window.location.href = "/";
      }
    };
    window.addEventListener("force-logout", handler);
    return () => window.removeEventListener("force-logout", handler);
  }, []);

  return null;
}

function ImpersonationBanner() {
  const [, navigate] = useLocation();
  const { data: user } = useQuery<any>({ queryKey: ["/api/user"], retry: false });

  const ssImpersonated = sessionStorage.getItem("impersonatedBy");
  const ssUsername = sessionStorage.getItem("impersonatedUsername");

  const isImpersonating = !!(user?.impersonatedBy || ssImpersonated);
  const displayUsername = user?.username || ssUsername || "";

  const [expanded, setExpanded] = React.useState(false);
  const [pos, setPos] = React.useState(() => {
    const saved = sessionStorage.getItem("impersonationBannerPos");
    return saved ? JSON.parse(saved) : { x: window.innerWidth - 80, y: 80 };
  });
  const dragging = React.useRef(false);
  const dragOffset = React.useRef({ x: 0, y: 0 });
  const moved = React.useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    moved.current = false;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    moved.current = true;
    const newX = Math.min(Math.max(0, e.clientX - dragOffset.current.x), window.innerWidth - 60);
    const newY = Math.min(Math.max(0, e.clientY - dragOffset.current.y), window.innerHeight - 60);
    setPos({ x: newX, y: newY });
    setExpanded(false);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    sessionStorage.setItem("impersonationBannerPos", JSON.stringify(pos));
    if (!moved.current) setExpanded(v => !v);
  };

  const handleExit = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // 1. Restaure immédiatement le token admin depuis sessionStorage (sauvegardé au démarrage de l'impersonation)
    //    Cela garantit le retour même si l'appel API échoue (session expirée, multi-process PM2, etc.)
    const savedAdminToken = sessionStorage.getItem("adminOriginalToken");
    if (savedAdminToken) {
      localStorage.setItem("ashtech_auth_token", savedAdminToken);
    }

    // 2. Nettoyage sessionStorage
    sessionStorage.removeItem("impersonatedBy");
    sessionStorage.removeItem("impersonatedUsername");
    sessionStorage.removeItem("impersonationBannerPos");
    sessionStorage.removeItem("adminOriginalToken");

    // 3. Appel API pour synchroniser la session serveur (best-effort)
    try {
      const res = await fetch("/api/admin/impersonate/exit", {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        // Si le serveur retourne un nouveau token admin, on l'utilise (plus récent)
        if (data.token) {
          localStorage.setItem("ashtech_auth_token", data.token);
        }
      }
    } catch {}

    // 4. Redirection vers l'admin
    window.location.href = "/admin/users";
  };

  if (!isImpersonating) return null;

  return (
    <div
      style={{ left: pos.x, top: pos.y, touchAction: "none" }}
      className="fixed z-[9999] select-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {expanded ? (
        <div className="flex flex-col items-center gap-2 bg-red-600 text-white rounded-2xl shadow-2xl px-4 py-3 min-w-[160px] cursor-grab active:cursor-grabbing">
          <span className="text-xs font-medium opacity-80">Mode admin</span>
          <span className="font-bold text-sm">@{displayUsername}</span>
          <button
            onClick={handleExit}
            onPointerDown={e => e.stopPropagation()}
            onPointerUp={e => e.stopPropagation()}
            className="w-full mt-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white text-red-600 font-semibold text-xs hover:bg-red-50 transition-colors shadow-sm"
          >
            ← Retour admin
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-600 shadow-2xl cursor-grab active:cursor-grabbing border-2 border-white/30">
          <span className="text-xl">👁</span>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <VpnDisconnectGuard />
            <ForceLogoutGuard />
            <GlobalSSEWatcher />
            <ImpersonationBanner />
            <GeoGuard>
              <Router />
            </GeoGuard>
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
