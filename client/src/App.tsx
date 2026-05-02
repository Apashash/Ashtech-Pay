import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/lib/language";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
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
import KYCPage from "@/pages/dashboard/kyc";
import KYCVerifiedPage from "@/pages/dashboard/kyc-verified";
import SupportPage from "@/pages/dashboard/support";
import ApiKeysPage from "@/pages/dashboard/api-keys";
import DeveloperPage from "@/pages/dashboard/developer";
import HostedPageDashboard from "@/pages/dashboard/hosted-page";
import HostedPageDocs from "@/pages/dashboard/hosted-page-docs";
import HPayPage from "@/pages/hpay";
import SettingsPage from "@/pages/dashboard/settings";
import PaymentPage from "@/pages/payment";
import CheckoutPage from "@/pages/checkout";
import NotFound from "@/pages/not-found";
import AdminDashboard from "@/pages/admin/index";
import AdminUsers from "@/pages/admin/users";
import AdminTransactions from "@/pages/admin/transactions";
import AdminFees from "@/pages/admin/fees";
import AdminCountries from "@/pages/admin/countries";
import AdminLinks from "@/pages/admin/links";
import AdminSupport from "@/pages/admin/support";
import AdminLogs from "@/pages/admin/logs";
import AdminSettings from "@/pages/admin/settings";
import AdminSettingsPlatform from "@/pages/admin/settings/platform";
import AdminSettingsPublicInfo from "@/pages/admin/settings/public-info";
import AdminSettingsRates from "@/pages/admin/settings/rates";
import AdminSettingsMaintenance from "@/pages/admin/settings/maintenance";
import AdminSettingsLimits from "@/pages/admin/settings/limits";
import AdminWithdrawalNumbers from "@/pages/admin/withdrawal-numbers";
import AdminDeposits from "@/pages/admin/transactions/deposits";
import AdminWithdrawals from "@/pages/admin/transactions/withdrawals";
import AdminTransfers from "@/pages/admin/transactions/transfers";
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
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import LegalPage from "@/pages/legal";
import AboutPage from "@/pages/about";
import CareersPage from "@/pages/careers";
import BlogPage from "@/pages/blog";
import HelpPage from "@/pages/help";
import ContactPage from "@/pages/contact";
import FAQPage from "@/pages/faq";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/docs/api" component={() => <DeveloperPage publicMode />} />
      <Route path="/docs/hosted-page" component={() => <HostedPageDocs publicMode />} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
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
      <Route path="/dashboard/kyc" component={KYCPage} />
      <Route path="/dashboard/kyc-verified" component={KYCVerifiedPage} />
      <Route path="/dashboard/support" component={SupportPage} />
      <Route path="/dashboard/api-keys" component={ApiKeysPage} />
      <Route path="/dashboard/developer" component={DeveloperPage} />
      <Route path="/dashboard/hosted-page/docs" component={HostedPageDocs} />
      <Route path="/dashboard/hosted-page" component={HostedPageDashboard} />
      <Route path="/hpay/:id" component={HPayPage} />
      <Route path="/dashboard/settings" component={SettingsPage} />
      <Route path="/pay/:slug" component={PaymentPage} />
      <Route path="/checkout/:transactionId" component={CheckoutPage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/transactions" component={AdminTransactions} />
      <Route path="/admin/transactions/deposits" component={AdminDeposits} />
      <Route path="/admin/transactions/withdrawals" component={AdminWithdrawals} />
      <Route path="/admin/transactions/transfers" component={AdminTransfers} />
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
      <Route path="/admin/settings/rates" component={AdminSettingsRates} />
      <Route path="/admin/settings/maintenance" component={AdminSettingsMaintenance} />
      <Route path="/admin/settings/limits" component={AdminSettingsLimits} />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
