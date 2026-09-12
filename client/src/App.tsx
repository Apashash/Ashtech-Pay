import { getAdminPath } from "@/lib/adminPath";
import React, { Suspense, useEffect, useLayoutEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, removeAuthToken, getQueryFn, getAuthHeaders } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useSSE } from "@/hooks/use-sse";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/language";
import { PUBLIC_API_DOCS_URL, PUBLIC_CHECKOUT_DOCS_URL } from "@/lib/public-links";
const LandingPage = React.lazy(() => import("@/pages/landing"));
const LoginPage = React.lazy(() => import("@/pages/login"));
const RegisterPage = React.lazy(() => import("@/pages/register"));
const ForgotPasswordPage = React.lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = React.lazy(() => import("@/pages/reset-password"));
const DashboardHome = React.lazy(() => import("@/pages/dashboard/index"));
const TransactionsPage = React.lazy(() => import("@/pages/dashboard/transactions"));
const TransactionDetailPage = React.lazy(() => import("@/pages/dashboard/transaction-detail"));
const PaymentLinksPage = React.lazy(() => import("@/pages/dashboard/links"));
const LinkDetailPage = React.lazy(() => import("@/pages/dashboard/link-detail"));
const LinkCreatePage = React.lazy(() => import("@/pages/dashboard/link-create"));
const LinkEditPage = React.lazy(() => import("@/pages/dashboard/link-edit"));
const DepositPage = React.lazy(() => import("@/pages/dashboard/deposit"));
const WithdrawPage = React.lazy(() => import("@/pages/dashboard/withdraw"));
const WithdrawalNumbersPage = React.lazy(() => import("@/pages/dashboard/withdrawal-numbers"));
const AddWithdrawalNumberPage = React.lazy(() => import("@/pages/dashboard/add-withdrawal-number"));
const EditWithdrawalNumberPage = React.lazy(() => import("@/pages/dashboard/edit-withdrawal-number"));
const TransferPage = React.lazy(() => import("@/pages/dashboard/transfer"));
const SendMoneyPage = React.lazy(() => import("@/pages/dashboard/send"));
const FeeExplanationsPage = React.lazy(() => import("@/pages/dashboard/fee-details"));
const GlobalMessagePage = React.lazy(() => import("@/pages/dashboard/global-message"));
const WalletsPage = React.lazy(() => import("@/pages/dashboard/wallets"));
const ConvertPage = React.lazy(() => import("@/pages/dashboard/convert"));
const KYCPage = React.lazy(() => import("@/pages/dashboard/kyc"));
const KYCVerifiedPage = React.lazy(() => import("@/pages/dashboard/kyc-verified"));
const SupportPage = React.lazy(() => import("@/pages/dashboard/support"));
const ApiKeysPage = React.lazy(() => import("@/pages/dashboard/api-keys"));
const DirectApiPage = React.lazy(() => import("@/pages/dashboard/direct-api"));
const DeveloperPage = React.lazy(() => import("@/pages/dashboard/developer"));
const HostedPageDashboard = React.lazy(() => import("@/pages/dashboard/hosted-page"));
const HostedPageGenerate = React.lazy(() => import("@/pages/dashboard/hosted-page-generate"));
const HostedPageDocs = React.lazy(() => import("@/pages/dashboard/hosted-page-docs"));
const TestPaymentPage = React.lazy(() => import("@/pages/docs/test-payment"));
const TestCryptoPage = React.lazy(() => import("@/pages/docs/test-crypto"));
const HPayPage = React.lazy(() => import("@/pages/hpay"));
const SettingsPage = React.lazy(() => import("@/pages/dashboard/settings"));
const AutoConversionPage = React.lazy(() => import("@/pages/dashboard/auto-conversion"));
const UpdatesPage = React.lazy(() => import("@/pages/dashboard/updates"));
const NotificationsPage = React.lazy(() => import("@/pages/dashboard/notifications"));
const PaymentPage = React.lazy(() => import("@/pages/payment"));
const CheckoutPage = React.lazy(() => import("@/pages/checkout"));
const NotFound = React.lazy(() => import("@/pages/not-found"));
const AdminDashboard = React.lazy(() => import("@/pages/admin/index"));
const AdminUsers = React.lazy(() => import("@/pages/admin/users"));
const AdminUserDetail = React.lazy(() => import("@/pages/admin/user-detail"));
const AdminTransactions = React.lazy(() => import("@/pages/admin/transactions"));
const AdminFees = React.lazy(() => import("@/pages/admin/fees"));
const AdminCountries = React.lazy(() => import("@/pages/admin/countries"));
const AdminLinks = React.lazy(() => import("@/pages/admin/links"));
const AdminSupport = React.lazy(() => import("@/pages/admin/support"));
const AdminLogs = React.lazy(() => import("@/pages/admin/logs"));
const AdminSettings = React.lazy(() => import("@/pages/admin/settings"));
const AdminSettingsPlatform = React.lazy(() => import("@/pages/admin/settings/platform"));
const AdminSettingsPublicInfo = React.lazy(() => import("@/pages/admin/settings/public-info"));
const AdminSettingsMaintenance = React.lazy(() => import("@/pages/admin/settings/maintenance"));
const AdminSettingsOtp = React.lazy(() => import("@/pages/admin/settings/otp"));
const AdminSettingsLimits = React.lazy(() => import("@/pages/admin/settings/limits"));
const AdminSettingsTurnstile = React.lazy(() => import("@/pages/admin/settings/turnstile"));
const AdminSettingsPawaPay = React.lazy(() => import("@/pages/admin/settings/pawapay"));
const AdminWithdrawalNumbers = React.lazy(() => import("@/pages/admin/withdrawal-numbers"));
const AdminDeposits = React.lazy(() => import("@/pages/admin/transactions/deposits"));
const AdminWithdrawals = React.lazy(() => import("@/pages/admin/transactions/withdrawals"));
const AdminTransfers = React.lazy(() => import("@/pages/admin/transactions/transfers"));
const AdminTransactionDetail = React.lazy(() => import("@/pages/admin/transaction-detail"));
const AdminFeesDeposits = React.lazy(() => import("@/pages/admin/fees/deposits"));
const AdminFeesWithdrawals = React.lazy(() => import("@/pages/admin/fees/withdrawals"));
const AdminFeesTransfers = React.lazy(() => import("@/pages/admin/fees/transfers"));
const AdminGlobalMessages = React.lazy(() => import("@/pages/admin/global-messages"));
const AdminKYC = React.lazy(() => import("@/pages/admin/kyc"));
const AdminConversions = React.lazy(() => import("@/pages/admin/conversions"));
const AdminPendingPayouts = React.lazy(() => import("@/pages/admin/pending-payouts"));
const AdminAfribaPay = React.lazy(() => import("@/pages/admin/afribapay"));
const AdminPixPay = React.lazy(() => import("@/pages/admin/pixpay"));
const AdminEmailCampaigns = React.lazy(() => import("@/pages/admin/email-campaigns"));
const AdminApiManagement = React.lazy(() => import("@/pages/admin/api-management"));
const AdminMerchants = React.lazy(() => import("@/pages/admin/merchants"));
const AdminBlockedIps = React.lazy(() => import("@/pages/admin/blocked-ips"));
const AdminAuditLogs = React.lazy(() => import("@/pages/admin/audit"));
const AdminSessionDebug = React.lazy(() => import("@/pages/admin/session-debug"));
const AdminPanelVerifyPage = React.lazy(() => import("@/pages/admin-panel-verify"));
const AdminLoginOtpPage = React.lazy(() => import("@/pages/admin-login-otp"));
const TermsPage = React.lazy(() => import("@/pages/terms"));
const PrivacyPage = React.lazy(() => import("@/pages/privacy"));
const LegalPage = React.lazy(() => import("@/pages/legal"));
const AboutPage = React.lazy(() => import("@/pages/about"));
const CareersPage = React.lazy(() => import("@/pages/careers"));
const BlogPage = React.lazy(() => import("@/pages/blog"));
const HelpPage = React.lazy(() => import("@/pages/help"));
const ContactPage = React.lazy(() => import("@/pages/contact"));
const FAQPage = React.lazy(() => import("@/pages/faq"));
const CountryBlockedPage = React.lazy(() => import("@/pages/country-blocked"));
const BlockedPage = React.lazy(() => import("@/pages/blocked"));
import { getBlockedUntil, getGeoCache, setGeoCache, GEO_BYPASS_PATHS, GEO_CACHE_KEY } from "@/lib/appUtils";
import AppInstallBanner from "@/components/app-install-banner";
import { PushNotificationPrompt } from "@/components/push-notification-prompt";

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
  const A = getAdminPath();
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" aria-label="Chargement" />}>
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/docs/api" component={() => <ExternalDocsRedirect href={PUBLIC_API_DOCS_URL} />} />
      <Route path="/docs/hosted-page" component={() => <ExternalDocsRedirect href={PUBLIC_CHECKOUT_DOCS_URL} />} />
      <Route path="/docs/test-pay" component={TestPaymentPage} />
      <Route path="/docs/test-crypto" component={TestCryptoPage} />
      <Route path="/blocked" component={BlockedPage} />
      <Route path="/login">
        <BlockGuard><LoginPage /></BlockGuard>
      </Route>
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
      <Route path="/dashboard/direct-api" component={DirectApiPage} />
      <Route path="/dashboard/hosted-page" component={HostedPageDashboard} />
      <Route path="/dashboard/hosted-page/generate" component={HostedPageGenerate} />
      <Route path="/hpay/:id" component={HPayPage} />
      <Route path="/dashboard/settings" component={SettingsPage} />
      <Route path="/dashboard/auto-conversion" component={AutoConversionPage} />
      <Route path="/dashboard/updates" component={UpdatesPage} />
      <Route path="/dashboard/notifications" component={NotificationsPage} />
      <Route path="/pay/:slug" component={PaymentPage} />
      <Route path="/checkout/:transactionId" component={CheckoutPage} />
      <Route path="/admin-panel-verify" component={AdminPanelVerifyPage} />
      <Route path="/admin-login-otp" component={AdminLoginOtpPage} />
      <Route path={A} component={AdminDashboard} />
      <Route path={`${A}/users`} component={AdminUsers} />
      <Route path={`${A}/users/:id`} component={AdminUserDetail} />
      <Route path={`${A}/transactions`} component={AdminTransactions} />
      <Route path={`${A}/transactions/deposits`} component={AdminDeposits} />
      <Route path={`${A}/transactions/withdrawals`} component={AdminWithdrawals} />
      <Route path={`${A}/transactions/transfers`} component={AdminTransfers} />
      <Route path={`${A}/transactions/:id`} component={AdminTransactionDetail} />
      <Route path={`${A}/fees`} component={AdminFees} />
      <Route path={`${A}/fees/deposits`} component={AdminFeesDeposits} />
      <Route path={`${A}/fees/withdrawals`} component={AdminFeesWithdrawals} />
      <Route path={`${A}/fees/transfers`} component={AdminFeesTransfers} />
      <Route path={`${A}/countries`} component={AdminCountries} />
      <Route path={`${A}/links`} component={AdminLinks} />
      <Route path={`${A}/support`} component={AdminSupport} />
      <Route path={`${A}/logs`} component={AdminLogs} />
      <Route path={`${A}/settings`} component={AdminSettings} />
      <Route path={`${A}/settings/platform`} component={AdminSettingsPlatform} />
      <Route path={`${A}/settings/public-info`} component={AdminSettingsPublicInfo} />
      <Route path={`${A}/settings/maintenance`} component={AdminSettingsMaintenance} />
      <Route path={`${A}/settings/otp`} component={AdminSettingsOtp} />
      <Route path={`${A}/settings/limits`} component={AdminSettingsLimits} />
      <Route path={`${A}/settings/turnstile`} component={AdminSettingsTurnstile} />
      <Route path={`${A}/settings/pawapay`} component={AdminSettingsPawaPay} />
      <Route path={`${A}/withdrawal-numbers`} component={AdminWithdrawalNumbers} />
      <Route path={`${A}/global-messages`} component={AdminGlobalMessages} />
      <Route path={`${A}/kyc`} component={AdminKYC} />
      <Route path={`${A}/conversions`} component={AdminConversions} />
      <Route path={`${A}/pending-payouts`} component={AdminPendingPayouts} />
      <Route path={`${A}/afribapay`} component={AdminAfribaPay} />
      <Route path={`${A}/pixpay`} component={AdminPixPay} />
      <Route path={`${A}/email-campaigns`} component={AdminEmailCampaigns} />
      <Route path={`${A}/api-management`} component={AdminApiManagement} />
      <Route path={`${A}/merchants`} component={AdminMerchants} />
      <Route path={`${A}/blocked-ips`} component={AdminBlockedIps} />
      <Route path={`${A}/audit`} component={AdminAuditLogs} />
      <Route path={`${A}/session-debug`} component={AdminSessionDebug} />
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
    </Suspense>
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
    try {
      const saved = sessionStorage.getItem("impersonationBannerPos");
      if (saved) return JSON.parse(saved);
    } catch {
      sessionStorage.removeItem("impersonationBannerPos");
    }
    return { x: window.innerWidth - 80, y: 80 };
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
    window.location.href = `${getAdminPath()}/users`;
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

function AuthenticatedWatchers() {
  const [location] = useLocation();
  const adminPath = getAdminPath();
  const isAuthenticatedRoute =
    location === "/dashboard" ||
    location.startsWith("/dashboard/") ||
    location === adminPath ||
    location.startsWith(`${adminPath}/`);

  if (!isAuthenticatedRoute) return null;

  return (
    <>
      <GlobalSSEWatcher />
      <ImpersonationBanner />
      <PushNotificationPrompt />
    </>
  );
}

function ExternalDocsRedirect({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
      Redirection vers la documentation…
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
            <AuthenticatedWatchers />
            <AppInstallBanner />
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
