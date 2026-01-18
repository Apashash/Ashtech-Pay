import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import DashboardHome from "@/pages/dashboard/index";
import TransactionsPage from "@/pages/dashboard/transactions";
import PaymentLinksPage from "@/pages/dashboard/links";
import DepositPage from "@/pages/dashboard/deposit";
import WithdrawPage from "@/pages/dashboard/withdraw";
import WithdrawalNumbersPage from "@/pages/dashboard/withdrawal-numbers";
import TransferPage from "@/pages/dashboard/transfer";
import SendMoneyPage from "@/pages/dashboard/send";
import KYCPage from "@/pages/dashboard/kyc";
import KYCVerifiedPage from "@/pages/dashboard/kyc-verified";
import SupportPage from "@/pages/dashboard/support";
import ApiKeysPage from "@/pages/dashboard/api-keys";
import SettingsPage from "@/pages/dashboard/settings";
import PaymentPage from "@/pages/payment";
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
import AdminWithdrawalNumbers from "@/pages/admin/withdrawal-numbers";
import AdminDeposits from "@/pages/admin/transactions/deposits";
import AdminWithdrawals from "@/pages/admin/transactions/withdrawals";
import AdminTransfers from "@/pages/admin/transactions/transfers";
import AdminFeesDeposits from "@/pages/admin/fees/deposits";
import AdminFeesWithdrawals from "@/pages/admin/fees/withdrawals";
import AdminFeesTransfers from "@/pages/admin/fees/transfers";
import AdminGlobalMessages from "@/pages/admin/global-messages";
import AdminKYC from "@/pages/admin/kyc";
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
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/dashboard" component={DashboardHome} />
      <Route path="/dashboard/transactions" component={TransactionsPage} />
      <Route path="/dashboard/links" component={PaymentLinksPage} />
      <Route path="/dashboard/deposit" component={DepositPage} />
      <Route path="/dashboard/withdraw" component={WithdrawPage} />
      <Route path="/dashboard/withdrawal-numbers" component={WithdrawalNumbersPage} />
      <Route path="/dashboard/transfer" component={TransferPage} />
      <Route path="/dashboard/send" component={SendMoneyPage} />
      <Route path="/dashboard/kyc" component={KYCPage} />
      <Route path="/dashboard/kyc-verified" component={KYCVerifiedPage} />
      <Route path="/dashboard/support" component={SupportPage} />
      <Route path="/dashboard/api-keys" component={ApiKeysPage} />
      <Route path="/dashboard/settings" component={SettingsPage} />
      <Route path="/pay/:slug" component={PaymentPage} />
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
      <Route path="/admin/withdrawal-numbers" component={AdminWithdrawalNumbers} />
      <Route path="/admin/global-messages" component={AdminGlobalMessages} />
      <Route path="/admin/kyc" component={AdminKYC} />
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
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
