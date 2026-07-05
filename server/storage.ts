import { encryptField, decryptField, hmacField } from "./fieldEncryption";

/**
 * Normalize a phone number before DB storage or lookup:
 * - Strips all leading + signs ("++" → "", "+237..." → "237...")
 * - Strips surrounding whitespace
 * - Returns undefined for empty/whitespace-only/plus-only inputs
 */
export function normalizePhone(phone: string | null | undefined): string | undefined {
  if (!phone) return undefined;
  const normalized = phone.trim().replace(/^\++/, "");
  return normalized.length > 0 ? normalized : undefined;
}
import { 
  users,
  transactions,
  paymentLinks,
  paymentIntents,
  countries,
  operators,
  fees,
  supportTickets,
  ticketMessages,
  adminLogs,
  auditLogs,
  platformSettings,
  withdrawalNumbers,
  withdrawalNumberChanges,
  userNotifications,
  globalMessages,
  dismissedGlobalMessages,
  kycSubmissions,
  type User, 
  type InsertUser, 
  type Transaction, 
  type InsertTransaction,
  type PaymentLink,
  type InsertPaymentLink,
  type PaymentIntent,
  type InsertPaymentIntent,
  type SupportedCurrency,
  type Country,
  type InsertCountry,
  type Operator,
  type InsertOperator,
  type Fee,
  type InsertFee,
  type SupportTicket,
  type InsertSupportTicket,
  type TicketMessage,
  type InsertTicketMessage,
  type AdminLog,
  type InsertAdminLog,
  type AuditLog,
  type InsertAuditLog,
  type PlatformSetting,
  type InsertPlatformSetting,
  type WithdrawalNumber,
  type InsertWithdrawalNumber,
  type WithdrawalNumberChange,
  type InsertWithdrawalNumberChange,
  type UserNotification,
  type InsertUserNotification,
  type GlobalMessage,
  type InsertGlobalMessage,
  ALL_FX_CURRENCIES,
  type KycSubmission,
  type InsertKycSubmission,
  wallets,
  type Wallet,
  conversionRequests,
  type ConversionRequest,
  type InsertConversionRequest,
  hostedPageConfigs,
  type HostedPageConfig,
  hostedPaymentSessions,
  type HostedPaymentSession,
  autoConversionRules,
  type AutoConversionRule,
  type InsertAutoConversionRule,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, like, ilike, count, inArray, gt, gte, lt, lte } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  searchUsersByEmail(query: string, limit?: number): Promise<User[]>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByEmailOrPhone(identifier: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  getUserByRegistrationIp(ip: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(id: string, amount: number): Promise<User | undefined>;
  refundToOriginalWallet(userId: string, txType: string, txCurrency: string, amount: number): Promise<void>;
  updateUserCurrency(id: string, currency: SupportedCurrency): Promise<User | undefined>;
  setResetToken(id: string, token: string, expiry: Date): Promise<User | undefined>;
  updatePassword(id: string, hashedPassword: string): Promise<User | undefined>;
  clearResetToken(id: string): Promise<User | undefined>;
  
  // Transaction operations
  getTransactionsByUserId(userId: string): Promise<Transaction[]>;
  getTransactionsByPaymentLinkId(paymentLinkId: string): Promise<Transaction[]>;
  getTransactionByPaymentIntentId(paymentIntentId: string): Promise<Transaction | undefined>;
  getTransactionById(id: string): Promise<Transaction | undefined>;
  getTransactionByReference(reference: string): Promise<Transaction | undefined>;
  getLastIncomingTransactionByCurrency(userId: string, currency: string): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: string, status: string): Promise<Transaction | undefined>;
  updateTransactionExternalReference(id: string, externalReference: string): Promise<Transaction | undefined>;
  getPendingDepositTransactions(): Promise<Transaction[]>;
  getPendingManualPayouts(): Promise<Transaction[]>;
  
  // Payment link operations
  getPaymentLinksByUserId(userId: string): Promise<PaymentLink[]>;
  getPaymentLinkById(id: string): Promise<PaymentLink | undefined>;
  getPaymentLinkBySlug(slug: string): Promise<PaymentLink | undefined>;
  createPaymentLink(paymentLink: InsertPaymentLink & { slug: string }): Promise<PaymentLink>;
  updatePaymentLink(id: string, updates: Partial<InsertPaymentLink>): Promise<PaymentLink | undefined>;
  deletePaymentLink(id: string): Promise<void>;
  incrementPaymentLinkClicks(slug: string): Promise<void>;
  
  // Payment intent operations
  createPaymentIntent(intent: InsertPaymentIntent): Promise<PaymentIntent>;
  getPaymentIntentsByMerchantId(merchantId: string): Promise<PaymentIntent[]>;
  getPaymentIntentsByLinkId(linkId: string): Promise<PaymentIntent[]>;
  getPaymentIntentByReference(reference: string): Promise<PaymentIntent | undefined>;
  getPaymentIntentById(id: string): Promise<PaymentIntent | undefined>;
  updatePaymentIntentStatus(id: string, status: string): Promise<PaymentIntent | undefined>;
  
  // Admin: User management
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  banUser(id: string, reason: string): Promise<User | undefined>;
  unbanUser(id: string): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  getUserByApiKey(apiKey: string): Promise<User | undefined>;
  setUserApiKey(userId: string, apiKey: string): Promise<User | undefined>;
  
  // Admin: Transaction management
  getAllTransactions(): Promise<Transaction[]>;
  getPendingPayoutTransactions(): Promise<Transaction[]>;
  countNewUsersInRange(start: Date, end: Date): Promise<number>;
  getAdminTransactionsPaginated(params: { limit: number; offset: number; type?: string; status?: string; search?: string }): Promise<{ data: Transaction[]; total: number }>;
  getAdminUsersPaginated(params: { limit: number; offset: number; search?: string; filter?: string }): Promise<{ data: User[]; total: number }>;
  getAdminLayoutStats(): Promise<{ pendingDeposits: number; pendingWithdrawals: number; pendingTransfers: number; pendingManualPayouts: number; kycPending: number; ticketUnread: number; conversionCount: number; withdrawalNumberCount: number; notifications: any[] }>;
  
  // Admin: Country operations
  getAllCountries(): Promise<Country[]>;
  getCountry(id: string): Promise<Country | undefined>;
  createCountry(country: InsertCountry): Promise<Country>;
  updateCountry(id: string, updates: Partial<InsertCountry>): Promise<Country | undefined>;
  deleteCountry(id: string): Promise<void>;
  
  // Admin: Operator operations
  getAllOperators(): Promise<Operator[]>;
  getOperatorsByCountry(countryId: string): Promise<Operator[]>;
  createOperator(operator: InsertOperator): Promise<Operator>;
  updateOperator(id: string, updates: Partial<InsertOperator>): Promise<Operator | undefined>;
  deleteOperator(id: string): Promise<void>;
  
  // Admin: Fee operations
  getAllFees(): Promise<Fee[]>;
  getFee(id: string): Promise<Fee | undefined>;
  getFeeForOperator(operatorId: string, transactionType: string): Promise<Fee | undefined>;
  resolveFee(transactionType: string, countryId?: string, operatorId?: string): Promise<Fee | undefined>;
  createFee(fee: InsertFee): Promise<Fee>;
  updateFee(id: string, updates: Partial<InsertFee>): Promise<Fee | undefined>;
  deleteFee(id: string): Promise<void>;
  
  // Transfer operations
  getActiveCountries(): Promise<Country[]>;
  getOperator(id: string): Promise<Operator | undefined>;
  
  // Admin: Support ticket operations
  getAllTickets(): Promise<SupportTicket[]>;
  getTicketsByUser(userId: string): Promise<SupportTicket[]>;
  getTicket(id: string): Promise<SupportTicket | undefined>;
  createTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  updateTicket(id: string, updates: Partial<SupportTicket>): Promise<SupportTicket | undefined>;
  deleteTicket(id: string): Promise<void>;
  deleteAllTickets(): Promise<void>;
  
  // Admin: Ticket messages
  getTicketMessages(ticketId: string): Promise<TicketMessage[]>;
  createTicketMessage(message: InsertTicketMessage): Promise<TicketMessage>;
  markTicketMessagesReadByUser(ticketId: string): Promise<void>;
  markTicketMessagesReadByAdmin(ticketId: string): Promise<void>;
  countUnreadUserMessagesForAdmin(): Promise<number>;
  updateUserLastSeen(userId: string): Promise<void>;
  
  // Admin: Logs
  createAdminLog(log: InsertAdminLog): Promise<AdminLog>;
  getAdminLogs(limit?: number): Promise<AdminLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(filters?: {
    userId?: string;
    action?: string;
    actorType?: string;
    success?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ logs: AuditLog[]; total: number }>;
  
  // Admin: Platform settings
  getAllSettings(): Promise<PlatformSetting[]>;
  getSetting(key: string): Promise<PlatformSetting | undefined>;
  upsertSetting(key: string, value: string, description?: string): Promise<PlatformSetting>;
  
  // Admin: Payment links
  getAllPaymentLinks(): Promise<PaymentLink[]>;
  
  // Admin: Stats
  getAdminStats(period?: string): Promise<{
    totalUsers: number;
    totalTransactions: number;
    totalVolume: string;
    monthlyTransactions: number;
    rejectedTransactions: number;
    pendingTransactions: number;
    bannedUsers: number;
    totalDeposits: string;
    totalWithdrawals: string;
    totalRevenue: string;
    depositFees: string;
    withdrawalFees: string;
    transferFees: string;
    paymentLinkFees: string;
    depositCount: number;
    withdrawalCount: number;
    transferCount: number;
    paymentLinkCount: number;
    pendingDeposits: number;
    pendingWithdrawals: number;
    pendingTransfers: number;
  }>;
  
  getPendingNotifications(): Promise<Array<{
    id: string;
    type: string;
    amount: string;
    userName: string;
    createdAt: Date | null;
  }>>;
  
  // Withdrawal numbers
  getWithdrawalNumbersByUserId(userId: string): Promise<WithdrawalNumber[]>;
  getWithdrawalNumber(id: string): Promise<WithdrawalNumber | undefined>;
  createWithdrawalNumber(number: InsertWithdrawalNumber): Promise<WithdrawalNumber>;
  updateWithdrawalNumber(id: string, updates: Partial<InsertWithdrawalNumber>): Promise<WithdrawalNumber | undefined>;
  deleteWithdrawalNumber(id: string): Promise<void>;
  countUserWithdrawalNumbers(userId: string): Promise<number>;
  
  // Withdrawal number change requests
  createWithdrawalNumberChange(change: InsertWithdrawalNumberChange): Promise<WithdrawalNumberChange>;
  getWithdrawalNumberChangesByUserId(userId: string): Promise<WithdrawalNumberChange[]>;
  getPendingWithdrawalNumberChanges(): Promise<WithdrawalNumberChange[]>;
  getWithdrawalNumberChange(id: string): Promise<WithdrawalNumberChange | undefined>;
  approveWithdrawalNumberChange(id: string, adminId: string, note?: string): Promise<WithdrawalNumberChange | undefined>;
  rejectWithdrawalNumberChange(id: string, adminId: string, note?: string): Promise<WithdrawalNumberChange | undefined>;
  
  // User notifications
  getUserNotifications(userId: string, limit?: number): Promise<UserNotification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createUserNotification(notification: InsertUserNotification): Promise<UserNotification>;
  markNotificationAsRead(id: string, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteUserNotification(id: string, userId: string): Promise<void>;
  deleteAllUserNotifications(userId: string): Promise<void>;
  
  // Global messages
  getActiveGlobalMessages(): Promise<GlobalMessage[]>;
  getActiveGlobalMessagesForUser(userId: string): Promise<GlobalMessage[]>;
  getAllGlobalMessages(): Promise<GlobalMessage[]>;
  createGlobalMessage(message: InsertGlobalMessage): Promise<GlobalMessage>;
  updateGlobalMessage(id: string, updates: Partial<InsertGlobalMessage>): Promise<GlobalMessage | undefined>;
  deleteGlobalMessage(id: string): Promise<void>;
  
  // Dismissed global messages
  dismissGlobalMessage(userId: string, globalMessageId: string): Promise<void>;
  getDismissedGlobalMessageIds(userId: string): Promise<string[]>;
  
  // KYC Submissions
  getKycSubmissionByUserId(userId: string): Promise<KycSubmission | undefined>;
  getKycSubmissionById(id: string): Promise<KycSubmission | undefined>;
  createKycSubmission(submission: InsertKycSubmission): Promise<KycSubmission>;
  updateKycSubmission(id: string, updates: Partial<KycSubmission>): Promise<KycSubmission | undefined>;
  getAllKycSubmissions(status?: string): Promise<KycSubmission[]>;
  countKycByStatus(status: string): Promise<number>;
  approveKycSubmission(id: string, reviewerId: string, note?: string): Promise<KycSubmission | undefined>;
  rejectKycSubmission(id: string, reviewerId: string, note?: string): Promise<KycSubmission | undefined>;

  // Multi-currency wallets
  getUserWallets(userId: string): Promise<Wallet[]>;
  getWalletsByUserIds(userIds: string[]): Promise<Wallet[]>;
  getWallet(userId: string, currency: string): Promise<Wallet | undefined>;
  upsertWallet(userId: string, currency: string, balanceDelta: number): Promise<Wallet>;
  setWalletBalance(userId: string, currency: string, newBalance: number): Promise<Wallet>;
  deleteWallet(walletId: string): Promise<void>;
  // Conversion requests
  createConversionRequest(data: InsertConversionRequest): Promise<ConversionRequest>;
  getConversionRequest(id: string): Promise<ConversionRequest | undefined>;
  getPendingConversionRequests(): Promise<(ConversionRequest & { userFullName: string; userEmail: string })[]>;
  getAllConversionRequests(): Promise<(ConversionRequest & { userFullName: string; userEmail: string })[]>;
  updateConversionRequest(id: string, data: Partial<ConversionRequest>): Promise<ConversionRequest>;
  countPendingConversions(): Promise<number>;

  // Auto-conversion rules
  getAutoConversionRules(userId: string): Promise<AutoConversionRule[]>;
  getAutoConversionRuleByCurrency(userId: string, fromCurrency: string): Promise<AutoConversionRule | undefined>;
  createAutoConversionRule(data: InsertAutoConversionRule): Promise<AutoConversionRule>;
  deleteAutoConversionRule(id: string, userId: string): Promise<void>;

  // Hosted Page
  getHostedPageConfig(userId: string): Promise<HostedPageConfig | undefined>;
  saveHostedPageConfig(userId: string, data: Partial<HostedPageConfig>): Promise<HostedPageConfig>;
  getUserByHpKey(hpLive: string): Promise<User | undefined>;
  createHostedPaymentSession(data: Omit<HostedPaymentSession, "createdAt">): Promise<HostedPaymentSession>;
  getHostedPaymentSession(id: string): Promise<HostedPaymentSession | undefined>;
  updateHostedPaymentSession(id: string, updates: Partial<HostedPaymentSession>): Promise<void>;
}

// ── Short-lived in-memory user cache ──────────────────────────────────────────
// Avoids a DB round-trip on every authenticated request (requireAuth + requireAdmin
// each call getUser). TTL: 20 seconds — short enough that role/ban changes propagate
// quickly, long enough to collapse the storm of calls per page load.
const userCache = new Map<string, { user: User; expiresAt: number }>();
const USER_CACHE_TTL_MS = 20_000;

function getCachedUser(id: string): User | undefined {
  const entry = userCache.get(id);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) { userCache.delete(id); return undefined; }
  return entry.user;
}

function setCachedUser(user: User): void {
  userCache.set(user.id, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
}

export function invalidateUserCache(id: string): void {
  userCache.delete(id);
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const cached = getCachedUser(id);
    if (cached) return cached;
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (user) setCachedUser(user);
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      sql`lower(${users.username}) = lower(${username.trim()})`
    );
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(ilike(users.email, email.trim()));
    return user || undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const normalized = normalizePhone(phone);
    if (!normalized) return undefined;
    const [user] = await db.select().from(users).where(eq(users.phone, normalized));
    return user || undefined;
  }

  async getUserByEmailOrPhone(identifier: string): Promise<User | undefined> {
    let user = await this.getUserByEmail(identifier);
    if (!user) {
      user = await this.getUserByPhone(identifier);
    }
    return user;
  }

  async getUserByRegistrationIp(ip: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.registrationIp, ip)).limit(1);
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Generate unique user ID: ASHTECH + 8 random digits (e.g. ASHTECH38023380)
    const generateId = () =>
      "ASHTECH" + Math.floor(10000000 + Math.random() * 90000000).toString();

    // Retry loop: handles DB unique-constraint collisions on the primary key
    for (let attempt = 0; attempt < 10; attempt++) {
      const id = generateId();
      try {
        const [user] = await db.insert(users).values({ ...insertUser, id }).returning();
        return user;
      } catch (err: any) {
        // 23505 = unique_violation — retry with a new ID
        if (err?.code === "23505" && err?.detail?.includes("(id)")) {
          continue;
        }
        throw err;
      }
    }
    throw new Error("Impossible de générer un ID unique après 10 tentatives.");
  }

  async updateUserBalance(id: string, amount: number): Promise<User | undefined> {
    invalidateUserCache(id);
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) return undefined;
    
    const currentBalance = parseFloat(user.balance || "0") || 0;
    const newBalance = currentBalance + amount;
    
    if (newBalance < 0) {
      throw new Error("Solde insuffisant");
    }
    
    const [updatedUser] = await db
      .update(users)
      .set({ balance: newBalance.toFixed(2) })
      .where(eq(users.id, id))
      .returning();
    
    if (updatedUser) setCachedUser(updatedUser);
    return updatedUser;
  }

  async refundToOriginalWallet(userId: string, txType: string, txCurrency: string, amount: number): Promise<void> {
    // Always refund to the exact wallet the transaction was debited from.
    // Use sameCfaFamily to handle cases where the wallet was stored under a generic code
    // (e.g. "XOF") while txCurrency is a country-specific variant (e.g. "XOFB") — both are 1:1 CFA.
    const { sameCfaFamily } = await import("./walletHelper");
    const user = await this.getUser(userId);
    const userPrimary = user?.preferredCurrency || "XAF";
    if (sameCfaFamily(txCurrency, userPrimary)) {
      await this.updateUserBalance(userId, amount);
    } else {
      await this.upsertWallet(userId, txCurrency, amount);
    }
  }

  async updateUserCurrency(id: string, currency: SupportedCurrency): Promise<User | undefined> {
    invalidateUserCache(id);
    const [updatedUser] = await db
      .update(users)
      .set({ preferredCurrency: currency })
      .where(eq(users.id, id))
      .returning();
    if (updatedUser) setCachedUser(updatedUser);
    return updatedUser || undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(
      and(eq(users.resetToken, token), gt(users.resetTokenExpiry, new Date()))
    );
    return user || undefined;
  }

  async setResetToken(id: string, token: string, expiry: Date): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ resetToken: token, resetTokenExpiry: expiry })
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser || undefined;
  }

  async updatePassword(id: string, hashedPassword: string): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser || undefined;
  }

  async clearResetToken(id: string): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ resetToken: null, resetTokenExpiry: null })
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser || undefined;
  }

  // Transaction operations
  async getTransactionsByUserId(userId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async getTransactionsByPaymentLinkId(paymentLinkId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.paymentLinkId, paymentLinkId))
      .orderBy(desc(transactions.createdAt));
  }

  async getTransactionByPaymentIntentId(paymentIntentId: string): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.paymentIntentId, paymentIntentId));
    return transaction || undefined;
  }

  async getTransactionById(id: string): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
    return transaction || undefined;
  }

  async getTransactionByReference(reference: string): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.reference, reference));
    return transaction || undefined;
  }

  async getLastIncomingTransactionByCurrency(userId: string, currency: string): Promise<Transaction | undefined> {
    const [transaction] = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.currency, currency),
          eq(transactions.status, "completed"),
          or(
            eq(transactions.type, "deposit"),
            eq(transactions.type, "payment_link"),
            eq(transactions.type, "transfer_in")
          )
        )
      )
      .orderBy(desc(transactions.createdAt))
      .limit(1);
    return transaction || undefined;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const reference = insertTransaction.reference || `TX-${Date.now()}`;
    const [transaction] = await db
      .insert(transactions)
      .values({
        ...insertTransaction,
        status: insertTransaction.status || "pending",
        reference,
      })
      .returning();
    return transaction;
  }

  async updateTransactionStatus(id: string, status: string): Promise<Transaction | undefined> {
    const updateData: Record<string, any> = { status };
    if (status === "completed") updateData.confirmedAt = new Date();
    const [transaction] = await db
      .update(transactions)
      .set(updateData)
      .where(eq(transactions.id, id))
      .returning();
    return transaction || undefined;
  }

  async updateTransactionExternalReference(id: string, externalReference: string): Promise<Transaction | undefined> {
    const [transaction] = await db
      .update(transactions)
      .set({ externalReference })
      .where(eq(transactions.id, id))
      .returning();
    return transaction || undefined;
  }

  // Payment link operations
  async getPaymentLinksByUserId(userId: string): Promise<PaymentLink[]> {
    return await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.userId, userId))
      .orderBy(desc(paymentLinks.createdAt));
  }

  async getPaymentLinkBySlug(slug: string): Promise<PaymentLink | undefined> {
    const [link] = await db.select().from(paymentLinks).where(eq(paymentLinks.slug, slug));
    return link || undefined;
  }

  async createPaymentLink(insertPaymentLink: InsertPaymentLink & { slug: string }): Promise<PaymentLink> {
    const { slug, ...rest } = insertPaymentLink;
    const [paymentLink] = await db
      .insert(paymentLinks)
      .values({
        ...rest,
        slug,
        isActive: true,
      })
      .returning();
    return paymentLink;
  }

  async getPaymentLinkById(id: string): Promise<PaymentLink | undefined> {
    const [link] = await db.select().from(paymentLinks).where(eq(paymentLinks.id, id));
    return link || undefined;
  }

  async updatePaymentLink(id: string, updates: Partial<InsertPaymentLink>): Promise<PaymentLink | undefined> {
    const [link] = await db
      .update(paymentLinks)
      .set(updates)
      .where(eq(paymentLinks.id, id))
      .returning();
    return link || undefined;
  }

  async deletePaymentLink(id: string): Promise<void> {
    await db.delete(paymentLinks).where(eq(paymentLinks.id, id));
  }

  async incrementPaymentLinkClicks(slug: string): Promise<void> {
    await db
      .update(paymentLinks)
      .set({ clickCount: sql`${paymentLinks.clickCount} + 1` })
      .where(eq(paymentLinks.slug, slug));
  }

  // Payment intent operations
  async createPaymentIntent(insertIntent: InsertPaymentIntent): Promise<PaymentIntent> {
    const [intent] = await db
      .insert(paymentIntents)
      .values(insertIntent)
      .returning();
    return intent;
  }

  async getPaymentIntentsByMerchantId(merchantId: string): Promise<PaymentIntent[]> {
    return await db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.merchantId, merchantId))
      .orderBy(desc(paymentIntents.createdAt));
  }

  async getPaymentIntentsByLinkId(linkId: string): Promise<PaymentIntent[]> {
    return await db
      .select()
      .from(paymentIntents)
      .where(eq(paymentIntents.paymentLinkId, linkId))
      .orderBy(desc(paymentIntents.createdAt));
  }

  async getPaymentIntentByReference(reference: string): Promise<PaymentIntent | undefined> {
    const [intent] = await db.select().from(paymentIntents).where(eq(paymentIntents.reference, reference));
    return intent || undefined;
  }

  async getPaymentIntentById(id: string): Promise<PaymentIntent | undefined> {
    const [intent] = await db.select().from(paymentIntents).where(eq(paymentIntents.id, id));
    return intent || undefined;
  }

  async getPaymentIntentsByIds(ids: string[]): Promise<Map<string, { payerPhone: string | null; payerName?: string | null }>> {
    if (ids.length === 0) return new Map();
    const results = await db
      .select({ id: paymentIntents.id, payerPhone: paymentIntents.payerPhone, payerName: paymentIntents.payerName })
      .from(paymentIntents)
      .where(inArray(paymentIntents.id, ids));
    const map = new Map<string, { payerPhone: string | null; payerName?: string | null }>();
    for (const r of results) map.set(r.id, { payerPhone: r.payerPhone ?? null, payerName: r.payerName ?? null });
    return map;
  }

  async updatePaymentIntentStatus(id: string, status: string): Promise<PaymentIntent | undefined> {
    const [intent] = await db
      .update(paymentIntents)
      .set({ status })
      .where(eq(paymentIntents.id, id))
      .returning();
    return intent || undefined;
  }

  async searchUsersByEmail(query: string, limit = 8): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(ilike(users.email, `%${query}%`))
      .orderBy(desc(users.createdAt))
      .limit(limit);
  }

  // Admin: User management
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    invalidateUserCache(id);
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    if (user) setCachedUser(user);
    return user || undefined;
  }

  async banUser(id: string, reason: string): Promise<User | undefined> {
    invalidateUserCache(id);
    const [user] = await db.update(users)
      .set({ isBanned: true, banReason: reason })
      .where(eq(users.id, id))
      .returning();
    if (user) setCachedUser(user);
    return user || undefined;
  }

  async unbanUser(id: string): Promise<User | undefined> {
    invalidateUserCache(id);
    const [user] = await db.update(users)
      .set({ isBanned: false, banReason: null })
      .where(eq(users.id, id))
      .returning();
    if (user) setCachedUser(user);
    return user || undefined;
  }

  async deleteUser(id: string): Promise<void> {
    invalidateUserCache(id);
    // Handle all foreign key relationships
    await db.delete(userNotifications).where(eq(userNotifications.userId, id));
    
    // Delete ticket messages by sender OR by tickets owned by user
    await db.delete(ticketMessages).where(eq(ticketMessages.senderId, id));
    await db.delete(ticketMessages).where(
      sql`ticket_id IN (SELECT id FROM support_tickets WHERE user_id = ${id})`
    );
    
    // Update tickets assigned to this user (set to null)
    await db.execute(sql`UPDATE support_tickets SET assigned_to = NULL WHERE assigned_to = ${id}`);
    await db.delete(supportTickets).where(eq(supportTickets.userId, id));
    
    // Update KYC reviewer references (set to null)
    await db.execute(sql`UPDATE kyc_submissions SET reviewer_id = NULL WHERE reviewer_id = ${id}`);
    await db.delete(kycSubmissions).where(eq(kycSubmissions.userId, id));
    
    // Delete dismissed global messages
    await db.execute(sql`DELETE FROM dismissed_global_messages WHERE user_id = ${id}`);
    
    // Update global messages admin reference (set to null) 
    await db.execute(sql`UPDATE global_messages SET admin_id = NULL WHERE admin_id = ${id}`);
    
    // Delete admin logs where this user was the admin actor (admin_id is NOT NULL — cannot set to null)
    await db.execute(sql`DELETE FROM admin_logs WHERE admin_id = ${id}`);
    
    // Handle withdrawal number changes (both user_id and admin_id)
    await db.execute(sql`UPDATE withdrawal_number_changes SET admin_id = NULL WHERE admin_id = ${id}`);
    await db.delete(withdrawalNumberChanges).where(
      sql`withdrawal_number_id IN (SELECT id FROM withdrawal_numbers WHERE user_id = ${id})`
    );
    await db.delete(withdrawalNumbers).where(eq(withdrawalNumbers.userId, id));
    
    await db.delete(paymentIntents).where(eq(paymentIntents.merchantId, id));
    await db.delete(transactions).where(eq(transactions.userId, id));
    await db.delete(paymentLinks).where(eq(paymentLinks.userId, id));
    await db.delete(conversionRequests).where(eq(conversionRequests.userId, id));
    await db.delete(wallets).where(eq(wallets.userId, id));
    // Clean up hosted payment tables (merchant_id / user_id references)
    await db.execute(sql`DELETE FROM hosted_payment_sessions WHERE merchant_id = ${id}`);
    await db.execute(sql`DELETE FROM hosted_page_configs WHERE user_id = ${id}`);
    // Clean up audit logs (nullable user_id, no FK — safe to leave or delete)
    await db.execute(sql`DELETE FROM audit_logs WHERE user_id = ${id}`);
    await db.delete(users).where(eq(users.id, id));
  }

  async getUserByApiKey(apiKey: string): Promise<User | undefined> {
    // Primary: look up by HMAC hash (api_key_hash) — constant-time, no cleartext in DB
    const hash = hmacField(apiKey);
    if (hash) {
      const [byHash] = await db.select().from(users).where(eq(users.apiKeyHash, hash));
      if (byHash) return byHash;
    }
    // Legacy fallback: plaintext api_key stored before encryption was introduced
    const [legacy] = await db.select().from(users).where(eq(users.apiKey, apiKey));
    return legacy || undefined;
  }

  async setUserApiKey(userId: string, apiKey: string): Promise<User | undefined> {
    const encryptedKey = encryptField(apiKey);
    const keyHash = hmacField(apiKey);
    const [user] = await db
      .update(users)
      .set({ apiKey: encryptedKey, ...(keyHash ? { apiKeyHash: keyHash } : {}) })
      .where(eq(users.id, userId))
      .returning();
    // Return with decrypted key for immediate display
    if (user) return { ...user, apiKey };
    return undefined;
  }

  async getPendingDepositTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions).where(
      and(
        eq(transactions.status, "pending"),
        inArray(transactions.type, ["deposit", "payment_link"])
      )
    ).orderBy(desc(transactions.createdAt));
  }

  async getPendingManualPayouts(): Promise<Transaction[]> {
    return await db.select().from(transactions).where(
      and(
        eq(transactions.status, "pending_manual"),
        inArray(transactions.type, ["withdrawal", "transfer_out"])
      )
    ).orderBy(desc(transactions.createdAt));
  }

  // Admin: Transaction management
  async getAllTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  // Targeted query: only pending/processing payouts — avoids loading ALL transactions on startup
  async getPendingPayoutTransactions(): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(
        and(
          or(eq(transactions.type, "withdrawal"), eq(transactions.type, "transfer_out")),
          or(eq(transactions.status, "pending"), eq(transactions.status, "processing"))
        )
      )
      .orderBy(desc(transactions.createdAt));
  }

  // Count users created within a date range — avoids loading ALL users in memory
  async countNewUsersInRange(start: Date, end: Date): Promise<number> {
    const result = await db
      .select({ cnt: count() })
      .from(users)
      .where(and(gte(users.createdAt, start), lte(users.createdAt, end)));
    return result[0]?.cnt ?? 0;
  }

  // Admin: Country operations
  async getAllCountries(): Promise<Country[]> {
    return await db.select().from(countries).orderBy(countries.name);
  }

  async getCountry(id: string): Promise<Country | undefined> {
    const [country] = await db.select().from(countries).where(eq(countries.id, id));
    return country || undefined;
  }

  async createCountry(country: InsertCountry): Promise<Country> {
    const [newCountry] = await db.insert(countries).values(country).returning();
    return newCountry;
  }

  async updateCountry(id: string, updates: Partial<InsertCountry>): Promise<Country | undefined> {
    const [country] = await db.update(countries).set(updates).where(eq(countries.id, id)).returning();
    return country || undefined;
  }

  async deleteCountry(id: string): Promise<void> {
    await db.delete(countries).where(eq(countries.id, id));
  }

  // Admin: Operator operations
  async getAllOperators(): Promise<Operator[]> {
    return await db.select().from(operators).orderBy(operators.name);
  }

  async getOperatorsByCountry(countryId: string): Promise<Operator[]> {
    return await db.select().from(operators).where(eq(operators.countryId, countryId));
  }

  async createOperator(operator: InsertOperator): Promise<Operator> {
    // Prevent duplicates: same name (case-insensitive) in same country
    const existing = await db
      .select()
      .from(operators)
      .where(eq(operators.countryId, operator.countryId));
    const duplicate = existing.find(
      (o) => o.name.trim().toLowerCase() === operator.name.trim().toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Un opérateur nommé "${duplicate.name}" existe déjà dans ce pays.`);
    }
    const [newOperator] = await db.insert(operators).values(operator).returning();
    return newOperator;
  }

  async updateOperator(id: string, updates: Partial<InsertOperator>): Promise<Operator | undefined> {
    const [operator] = await db.update(operators).set(updates).where(eq(operators.id, id)).returning();
    return operator || undefined;
  }

  async deleteOperator(id: string): Promise<void> {
    // First delete associated fees to avoid foreign key constraint violation
    await db.delete(fees).where(eq(fees.operatorId, id));
    // Then delete the operator
    await db.delete(operators).where(eq(operators.id, id));
  }

  // Admin: Fee operations
  async getFee(id: string): Promise<Fee | undefined> {
    const [fee] = await db.select().from(fees).where(eq(fees.id, id));
    return fee || undefined;
  }

  async getAllFees(): Promise<Fee[]> {
    return await db.select().from(fees).orderBy(desc(fees.createdAt));
  }

  async createFee(fee: InsertFee): Promise<Fee> {
    const [newFee] = await db.insert(fees).values(fee).returning();
    return newFee;
  }

  async updateFee(id: string, updates: Partial<InsertFee>): Promise<Fee | undefined> {
    const [fee] = await db.update(fees).set(updates).where(eq(fees.id, id)).returning();
    return fee || undefined;
  }

  async deleteFee(id: string): Promise<void> {
    await db.delete(fees).where(eq(fees.id, id));
  }
  
  async getFeeForOperator(operatorId: string, transactionType: string): Promise<Fee | undefined> {
    const [fee] = await db
      .select()
      .from(fees)
      .where(
        and(
          eq(fees.operatorId, operatorId),
          eq(fees.transactionType, transactionType),
          eq(fees.isActive, true)
        )
      );
    return fee || undefined;
  }

  async resolveFee(transactionType: string, countryId?: string, operatorId?: string): Promise<Fee | undefined> {
    // Priority: operator-specific > country-specific > global
    const activeFees = await db
      .select()
      .from(fees)
      .where(
        and(
          eq(fees.transactionType, transactionType),
          eq(fees.isActive, true)
        )
      );
    
    // Try to find operator-specific fee first
    if (operatorId) {
      const operatorFee = activeFees.find(f => f.operatorId === operatorId);
      if (operatorFee) return operatorFee;
    }
    
    // Then try country-specific fee
    if (countryId) {
      const countryFee = activeFees.find(f => f.countryId === countryId && !f.operatorId);
      if (countryFee) return countryFee;
    }
    
    // Fall back to global fee (no country, no operator)
    const globalFee = activeFees.find(f => !f.countryId && !f.operatorId);
    return globalFee;
  }
  
  async getActiveCountries(): Promise<Country[]> {
    return await db
      .select()
      .from(countries)
      .where(eq(countries.isActive, true))
      .orderBy(countries.name);
  }
  
  async getOperator(id: string): Promise<Operator | undefined> {
    const [operator] = await db.select().from(operators).where(eq(operators.id, id));
    return operator || undefined;
  }
  
  // Admin: Support ticket operations
  async getAllTickets(): Promise<SupportTicket[]> {
    return await db.select().from(supportTickets).orderBy(desc(supportTickets.createdAt));
  }

  async getTicketsByUser(userId: string): Promise<SupportTicket[]> {
    return await db.select().from(supportTickets).where(eq(supportTickets.userId, userId)).orderBy(desc(supportTickets.createdAt));
  }

  async getTicket(id: string): Promise<SupportTicket | undefined> {
    const [ticket] = await db.select().from(supportTickets).where(eq(supportTickets.id, id));
    return ticket || undefined;
  }

  async createTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const [newTicket] = await db.insert(supportTickets).values(ticket).returning();
    return newTicket;
  }

  async updateTicket(id: string, updates: Partial<SupportTicket>): Promise<SupportTicket | undefined> {
    const [ticket] = await db.update(supportTickets).set({ ...updates, updatedAt: new Date() }).where(eq(supportTickets.id, id)).returning();
    return ticket || undefined;
  }

  async deleteTicket(id: string): Promise<void> {
    await db.delete(ticketMessages).where(eq(ticketMessages.ticketId, id));
    await db.delete(supportTickets).where(eq(supportTickets.id, id));
  }

  async deleteAllTickets(): Promise<void> {
    await db.delete(ticketMessages);
    await db.delete(supportTickets);
  }
  
  // Admin: Ticket messages
  async getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
    return await db.select().from(ticketMessages).where(eq(ticketMessages.ticketId, ticketId)).orderBy(ticketMessages.createdAt);
  }

  async createTicketMessage(message: InsertTicketMessage): Promise<TicketMessage> {
    const [newMessage] = await db.insert(ticketMessages).values(message).returning();
    return newMessage;
  }

  async markTicketMessagesReadByUser(ticketId: string): Promise<void> {
    await db.update(ticketMessages)
      .set({ readByUser: true })
      .where(and(eq(ticketMessages.ticketId, ticketId), eq(ticketMessages.isAdmin, true)));
  }

  async markTicketMessagesReadByAdmin(ticketId: string): Promise<void> {
    await db.update(ticketMessages)
      .set({ readByAdmin: true })
      .where(and(eq(ticketMessages.ticketId, ticketId), eq(ticketMessages.isAdmin, false)));
  }

  async countUnreadUserMessagesForAdmin(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(ticketMessages)
      .where(and(eq(ticketMessages.isAdmin, false), eq(ticketMessages.readByAdmin, false)));
    return Number(result[0]?.count ?? 0);
  }

  async updateUserLastSeen(userId: string): Promise<void> {
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, userId));
    invalidateUserCache(userId);
  }

  // Admin: Logs
  async createAdminLog(log: InsertAdminLog): Promise<AdminLog> {
    const [newLog] = await db.insert(adminLogs).values(log).returning();
    return newLog;
  }

  async getAdminLogs(limit: number = 100): Promise<AdminLog[]> {
    return await db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(limit);
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  async getAuditLogs(filters: {
    userId?: string;
    action?: string;
    actorType?: string;
    success?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: AuditLog[]; total: number }> {
    const { userId, action, actorType, success, dateFrom, dateTo, limit = 50, offset = 0 } = filters;
    const conditions = [];
    if (userId)    conditions.push(eq(auditLogs.userId, userId));
    if (action)    conditions.push(eq(auditLogs.action, action));
    if (actorType) conditions.push(eq(auditLogs.actorType, actorType));
    if (success !== undefined) conditions.push(eq(auditLogs.success, success));
    if (dateFrom)  conditions.push(sql`${auditLogs.createdAt} >= ${dateFrom}`);
    if (dateTo)    conditions.push(sql`${auditLogs.createdAt} <= ${dateTo}`);

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [logs, countRows] = await Promise.all([
      db.select().from(auditLogs)
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(auditLogs).where(where),
    ]);

    return { logs, total: Number(countRows[0]?.count ?? 0) };
  }
  
  // Admin: Platform settings
  async getAllSettings(): Promise<PlatformSetting[]> {
    return await db.select().from(platformSettings);
  }

  async getSetting(key: string): Promise<PlatformSetting | undefined> {
    const [setting] = await db.select().from(platformSettings).where(eq(platformSettings.key, key));
    return setting || undefined;
  }

  async upsertSetting(key: string, value: string, description?: string): Promise<PlatformSetting> {
    const existing = await this.getSetting(key);
    if (existing) {
      const [updated] = await db.update(platformSettings).set({ value, description, updatedAt: new Date() }).where(eq(platformSettings.key, key)).returning();
      return updated;
    }
    const [inserted] = await db.insert(platformSettings).values({ key, value, description }).returning();
    return inserted;
  }
  
  // Admin: Payment links
  async getAllPaymentLinks(): Promise<PaymentLink[]> {
    return await db.select().from(paymentLinks).orderBy(desc(paymentLinks.createdAt));
  }
  
  // Admin: Stats
  async resetStats(): Promise<void> {
    await this.upsertSetting("stats_reset_at", new Date().toISOString(), "Date de réinitialisation des statistiques financières");
  }

  async getStatsByCountry(period: string = "this_month"): Promise<{ country: string; volume: number; count: number }[]> {
    const resetSetting = await this.getSetting("stats_reset_at");
    const resetAt: Date | null = resetSetting ? new Date(resetSetting.value) : null;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;

    switch (period) {
      case "today":      periodStart = todayStart; break;
      case "yesterday":  periodStart = new Date(todayStart.getTime() - 86400000); periodEnd = todayStart; break;
      case "this_week":  periodStart = new Date(todayStart.getTime() - (dayOfWeek - 1) * 86400000); break;
      case "last_week":  periodStart = new Date(todayStart.getTime() - dayOfWeek * 86400000 - 6 * 86400000); periodEnd = new Date(todayStart.getTime() - (dayOfWeek - 1) * 86400000); break;
      case "last_month": periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case "this_year":  periodStart = new Date(now.getFullYear(), 0, 1); break;
      case "last_year":  periodStart = new Date(now.getFullYear() - 1, 0, 1); periodEnd = new Date(now.getFullYear(), 0, 1); break;
      case "all":        periodStart = null; break;
      default:           periodStart = new Date(now.getFullYear(), now.getMonth(), 1); break;
    }

    // JOIN transactions with users in SQL — GROUP BY country — returns ~20 rows max
    const conditions: any[] = [
      eq(transactions.status, "completed"),
      inArray(transactions.type, ["deposit", "payment_link", "withdrawal", "transfer_out"]),
    ];
    if (periodStart) conditions.push(gte(transactions.createdAt, periodStart));
    if (periodEnd)   conditions.push(lt(transactions.createdAt, periodEnd));
    if (resetAt && !periodStart) conditions.push(gt(transactions.createdAt, resetAt));

    const rows = await db
      .select({
        country: sql<string>`COALESCE(NULLIF(${users.country}, ''), 'Inconnu')`,
        volume:  sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)`,
        cnt:     sql<string>`COUNT(*)`,
      })
      .from(transactions)
      .innerJoin(users, eq(transactions.userId, users.id))
      .where(and(...conditions))
      .groupBy(sql`COALESCE(NULLIF(${users.country}, ''), 'Inconnu')`)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(8);

    return rows.map(r => ({
      country: r.country,
      volume: parseFloat(r.volume),
      count: parseInt(r.cnt, 10),
    }));
  }

  async getStatsActivity(period: string = "this_month"): Promise<{ date: string; deposit: number; withdrawal: number; payment_link: number; transfer: number; depositVol: number; withdrawalVol: number; paymentLinkVol: number; transferVol: number }[]> {
    const [resetSetting, allSettings] = await Promise.all([
      this.getSetting("stats_reset_at"),
      this.getAllSettings(),
    ]);
    const resetAt: Date | null = resetSetting ? new Date(resetSetting.value) : null;

    const fxRates: Record<string, number> = {};
    allSettings.forEach((s: { key: string; value: string }) => {
      if (s.key.startsWith("fx_rate_")) {
        const code = s.key.replace("fx_rate_", "");
        const val = parseFloat(s.value);
        if (!isNaN(val) && val > 0) fxRates[code] = val;
      }
    });
    ALL_FX_CURRENCIES.forEach(c => { if (!fxRates[c.code]) fxRates[c.code] = c.defaultRate; });
    if (!fxRates["USDT"]) fxRates["USDT"] = fxRates["USD"] || 1.0;
    const CFA = new Set(["XAF","XAFC","XAFG","XOF","XOFC","XOFF","XOFN","XOFB","XOFT","XOFS","XOFM"]);
    const toXAF = (amount: number, currency: string): number => {
      if (!currency || CFA.has(currency)) return amount;
      const fromRate = fxRates[currency];
      if (!fromRate) return amount;
      return (amount / fromRate) * (fxRates["XAF"] || 585);
    };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;
    let useHourly = false;

    switch (period) {
      case "today":      periodStart = todayStart; useHourly = true; break;
      case "yesterday":  periodStart = new Date(todayStart.getTime() - 86400000); periodEnd = todayStart; useHourly = true; break;
      case "this_week":  periodStart = new Date(todayStart.getTime() - (dayOfWeek - 1) * 86400000); break;
      case "last_week":  periodStart = new Date(todayStart.getTime() - dayOfWeek * 86400000 - 6 * 86400000); periodEnd = new Date(todayStart.getTime() - (dayOfWeek - 1) * 86400000); break;
      case "last_month": periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case "this_year":  periodStart = new Date(now.getFullYear(), 0, 1); break;
      case "last_year":  periodStart = new Date(now.getFullYear() - 1, 0, 1); periodEnd = new Date(now.getFullYear(), 0, 1); break;
      case "all":        periodStart = new Date(todayStart.getTime() - 89 * 86400000); break;
      default:           periodStart = new Date(now.getFullYear(), now.getMonth(), 1); break;
    }

    const activityConditions: any[] = [eq(transactions.status, "completed")];
    if (periodStart) activityConditions.push(gte(transactions.createdAt, periodStart));
    if (periodEnd)   activityConditions.push(lt(transactions.createdAt, periodEnd));
    if (resetAt && !periodStart) activityConditions.push(gt(transactions.createdAt, resetAt));

    // Use SQL DATE_TRUNC to aggregate by bucket — returns ~30 rows max instead of thousands
    const truncExpr = useHourly
      ? sql<string>`TO_CHAR(DATE_TRUNC('hour', ${transactions.createdAt}), 'YYYY-MM-DD"T"HH24')`
      : sql<string>`TO_CHAR(DATE_TRUNC('day',  ${transactions.createdAt}), 'YYYY-MM-DD')`;

    const rows = await db
      .select({
        bucket:     truncExpr,
        type:       transactions.type,
        source:     transactions.source,
        totalAmt:   sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)`,
        cnt:        sql<string>`COUNT(*)`,
        currency:   transactions.currency,
      })
      .from(transactions)
      .where(and(...activityConditions))
      .groupBy(truncExpr, transactions.type, transactions.source, transactions.currency);

    // Build empty bucket scaffold, then fill from aggregated rows
    type Bucket = { date: string; deposit: number; withdrawal: number; payment_link: number; transfer: number; api_deposit: number; depositVol: number; withdrawalVol: number; paymentLinkVol: number; transferVol: number; apiDepositVol: number };
    const empty = (): Bucket => ({ date: "", deposit: 0, withdrawal: 0, payment_link: 0, transfer: 0, api_deposit: 0, depositVol: 0, withdrawalVol: 0, paymentLinkVol: 0, transferVol: 0, apiDepositVol: 0 });
    const buckets: Record<string, Bucket> = {};

    if (useHourly) {
      const start = periodStart!;
      const end = periodEnd || now;
      for (let h = new Date(start); h <= end; h = new Date(h.getTime() + 3600000)) {
        const key = h.toISOString().slice(0, 13);
        buckets[key] = { ...empty(), date: key };
      }
    } else {
      const start = periodStart || new Date(todayStart.getTime() - 29 * 86400000);
      const end = periodEnd || now;
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
        const key = d.toISOString().slice(0, 10);
        buckets[key] = { ...empty(), date: key };
      }
    }

    for (const row of rows) {
      const key = row.bucket;
      if (!buckets[key]) continue;
      const b = buckets[key];
      const vol = toXAF(parseFloat(row.totalAmt), row.currency || "XAF");
      const n   = parseInt(row.cnt, 10);
      if (row.type === "deposit" && row.source === "api") { b.api_deposit += n; b.apiDepositVol += vol; }
      else if (row.type === "deposit")      { b.deposit      += n; b.depositVol      += vol; }
      else if (row.type === "withdrawal")   { b.withdrawal   += n; b.withdrawalVol   += vol; }
      else if (row.type === "payment_link") { b.payment_link += n; b.paymentLinkVol  += vol; }
      else if (row.type === "transfer_out") { b.transfer     += n; b.transferVol     += vol; }
    }

    return Object.values(buckets);
  }

  async getAdminStats(period: string = "all"): Promise<any> {
    // ── Run settings + user counts in parallel ────────────────────────────────
    const [resetSetting, allSettings, usersCount, bannedCount, apiEnabledCount] = await Promise.all([
      this.getSetting("stats_reset_at"),
      this.getAllSettings(),
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(users).where(eq(users.isBanned, true)),
      db.select({ count: count() }).from(users).where(eq(users.apiEnabled, true)),
    ]);

    const resetAt: Date | null = resetSetting ? new Date(resetSetting.value) : null;

    // ── FX rates ──────────────────────────────────────────────────────────────
    const fxRates: Record<string, number> = {};
    allSettings.forEach((s: { key: string; value: string }) => {
      if (s.key.startsWith("fx_rate_")) {
        const code = s.key.replace("fx_rate_", "");
        const val = parseFloat(s.value);
        if (!isNaN(val) && val > 0) fxRates[code] = val;
      }
    });
    ALL_FX_CURRENCIES.forEach(c => { if (!fxRates[c.code]) fxRates[c.code] = c.defaultRate; });
    if (!fxRates["USDT"]) fxRates["USDT"] = fxRates["USD"] || 1.0;

    const CFA = new Set([
      "XAF", "XAFC", "XAFG",
      "XOF", "XOFC", "XOFF", "XOFN", "XOFB", "XOFT", "XOFS", "XOFM",
    ]);
    const toXAF = (amount: number, currency: string): number => {
      if (!currency || CFA.has(currency)) return amount;
      const fromRate = fxRates[currency];
      if (!fromRate) return amount;
      return (amount / fromRate) * (fxRates["XAF"] || 585);
    };

    // ── Period bounds ─────────────────────────────────────────────────────────
    const now = new Date();
    let periodStart: Date | null = null;
    let periodEnd: Date | null = null;
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    switch (period) {
      case "today":      periodStart = todayStart; break;
      case "yesterday":  periodStart = new Date(todayStart.getTime() - 86400000); periodEnd = todayStart; break;
      case "this_week":  periodStart = new Date(todayStart.getTime() - (dayOfWeek - 1) * 86400000); break;
      case "last_week":  periodStart = new Date(todayStart.getTime() - dayOfWeek * 86400000 - 6 * 86400000); periodEnd = new Date(todayStart.getTime() - (dayOfWeek - 1) * 86400000); break;
      case "this_month": periodStart = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case "last_month": periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); periodEnd = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case "this_year":  periodStart = new Date(now.getFullYear(), 0, 1); break;
      case "last_year":  periodStart = new Date(now.getFullYear() - 1, 0, 1); periodEnd = new Date(now.getFullYear(), 0, 1); break;
    }

    const txConditions: any[] = [];
    // resetAt only applies when no explicit period is selected (global "all-time" view).
    // When the admin picks a specific period (year/month/week/day), it takes full priority.
    if (resetAt && !periodStart) txConditions.push(gt(transactions.createdAt, resetAt));
    if (periodStart) txConditions.push(gte(transactions.createdAt, periodStart));
    if (periodEnd)   txConditions.push(lt(transactions.createdAt, periodEnd));
    const whereClause = txConditions.length > 0 ? and(...txConditions) : undefined;

    // ── Single SQL aggregation query — returns ~20 rows instead of thousands ──
    // Groups by (type, status, currency) so all math stays in PostgreSQL.
    //
    // Guard against production DBs that haven't run the migration adding
    // ashtech_fee_amount yet: we check the information_schema first and fall
    // back to a query without that column so the dashboard never goes blank.
    let hasAshtechFeeCol = true;
    try {
      const colCheck = await db.execute(sql`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'transactions'
          AND column_name = 'ashtech_fee_amount'
        LIMIT 1
      `);
      hasAshtechFeeCol = (colCheck.rows ?? colCheck).length > 0;
    } catch { hasAshtechFeeCol = false; }

    const agg = await (hasAshtechFeeCol
      ? db.select({
          type: transactions.type,
          status: transactions.status,
          currency: transactions.currency,
          totalAmount:      sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)`,
          totalFee:         sql<string>`COALESCE(SUM(${transactions.feeAmount}::numeric), 0)`,
          totalAshtechFee:  sql<string>`COALESCE(SUM(${transactions.ashtechFeeAmount}::numeric), 0)`,
          cnt:              sql<string>`COUNT(*)`,
        }).from(transactions).where(whereClause).groupBy(transactions.type, transactions.status, transactions.currency)
      : db.select({
          type: transactions.type,
          status: transactions.status,
          currency: transactions.currency,
          totalAmount:      sql<string>`COALESCE(SUM(${transactions.amount}::numeric), 0)`,
          totalFee:         sql<string>`COALESCE(SUM(${transactions.feeAmount}::numeric), 0)`,
          totalAshtechFee:  sql<string>`'0'`,
          cnt:              sql<string>`COUNT(*)`,
        }).from(transactions).where(whereClause).groupBy(transactions.type, transactions.status, transactions.currency)
    );

    // ── Reduce aggregated rows in JS (only ~20 rows, not thousands) ───────────
    let depositVol = 0, withdrawalVol = 0, transferVol = 0, linkVol = 0;
    let depositFees = 0, withdrawalFees = 0, transferFees = 0, paymentLinkFees = 0, conversionFees = 0;
    let depositCount = 0, withdrawalCount = 0, transferCount = 0, paymentLinkCount = 0;
    let totalTransactions = 0, rejectedTransactions = 0, pendingTransactions = 0;
    let pendingDeposits = 0, pendingWithdrawals = 0, pendingTransfers = 0;

    for (const row of agg) {
      const cur = row.currency || "XAF";
      const amt = toXAF(parseFloat(row.totalAmount), cur);
      const fee = toXAF(parseFloat(row.totalFee), cur);
      const ashtechFee = toXAF(parseFloat(row.totalAshtechFee), cur);
      const n   = parseInt(row.cnt, 10);
      totalTransactions += n;

      if (row.status === "failed")  rejectedTransactions += n;
      if (row.status === "pending") pendingTransactions  += n;

      if (row.status === "completed") {
        switch (row.type) {
          case "deposit":      depositVol    += amt; depositFees    += fee; depositCount    += n; break;
          case "withdrawal":   withdrawalVol += amt; withdrawalFees += fee; withdrawalCount += n; break;
          case "transfer_out": transferVol   += amt; transferFees   += fee; transferCount   += n; break;
          case "payment_link": linkVol       += amt; paymentLinkFees+= fee; paymentLinkCount+= n; break;
          // Pour les conversions, seule la marge Ashtech est du revenu réel.
          // On n'utilise JAMAIS feeAmount comme fallback — ce champ contient
          // la commission totale (Ashtech + fournisseur) et gonflerait les stats.
          // Les anciennes transactions sans ashtechFeeAmount contribuent 0.
          case "conversion":
            conversionFees += ashtechFee;
            break;
        }
      }

      // Pending counts by type
      if (["pending", "processing"].includes(row.status) && (row.type === "deposit" || row.type === "payment_link")) pendingDeposits += n;
      if (["pending", "pending_manual", "processing"].includes(row.status) && row.type === "withdrawal") pendingWithdrawals += n;
      if (["pending", "pending_manual", "processing"].includes(row.status) && (row.type === "transfer_out" || row.type === "transfer_in")) pendingTransfers += n;
    }

    const totalRevenue = depositFees + withdrawalFees + transferFees + paymentLinkFees + conversionFees;

    return {
      totalUsers: usersCount[0].count,
      apiEnabledUsers: apiEnabledCount[0].count,
      bannedUsers: bannedCount[0].count,
      statsResetAt: resetAt ? resetAt.toISOString() : null,
      totalTransactions,
      totalVolume: (depositVol + withdrawalVol + transferVol + linkVol).toFixed(2),
      monthlyTransactions: 0,
      rejectedTransactions,
      pendingTransactions,
      totalDeposits: depositVol.toFixed(2),
      totalWithdrawals: withdrawalVol.toFixed(2),
      totalCollected: (depositVol + linkVol).toFixed(2),
      totalWithdrawn: (withdrawalVol + transferVol).toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      depositFees: depositFees.toFixed(2),
      withdrawalFees: withdrawalFees.toFixed(2),
      transferFees: transferFees.toFixed(2),
      paymentLinkFees: paymentLinkFees.toFixed(2),
      conversionFees: conversionFees.toFixed(2),
      depositCount,
      withdrawalCount,
      transferCount,
      paymentLinkCount,
      pendingDeposits,
      pendingWithdrawals,
      pendingTransfers,
    };
  }
  
  async getPendingNotifications(): Promise<any[]> {
    return [];
  }

  async getUsersByIds(ids: string[]): Promise<Map<string, { id: string; fullName: string; email: string; username: string; phone: string | null; createdAt: Date | null }>> {
    if (ids.length === 0) return new Map();
    const result = await db.select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      username: users.username,
      phone: users.phone,
      createdAt: users.createdAt,
    }).from(users).where(inArray(users.id, ids));
    return new Map(result.map(u => [u.id, u]));
  }

  async getAdminTransactionsPaginated(params: { limit: number; offset: number; types?: string[]; type?: string; status?: string; search?: string; userId?: string }): Promise<{ data: Transaction[]; total: number }> {
    const { limit, offset, types, type, status, search, userId } = params;

    const conditions: any[] = [];
    if (userId) conditions.push(eq(transactions.userId, userId));
    if (types && types.length > 0) {
      conditions.push(inArray(transactions.type, types));
    } else if (type && type !== "all") {
      conditions.push(eq(transactions.type, type));
    }
    if (status && status !== "all") conditions.push(eq(transactions.status, status));
    if (search) {
      conditions.push(or(
        ilike(transactions.reference, `%${search}%`),
        ilike(transactions.externalReference, `%${search}%`),
        ilike(transactions.description, `%${search}%`),
      ));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(transactions).where(whereClause);
    const data = await db.select().from(transactions)
      .where(whereClause)
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  async getAdminUsersPaginated(params: { limit: number; offset: number; search?: string; filter?: string }): Promise<{ data: User[]; total: number }> {
    const { limit, offset, search, filter } = params;

    const conditions: any[] = [];
    if (search) {
      conditions.push(or(
        like(users.fullName, `%${search}%`),
        like(users.email, `%${search}%`),
        like(users.username, `%${search}%`),
        like(users.phone, `%${search}%`),
        like(users.country, `%${search}%`),
      ));
    }
    if (filter === "banned") {
      conditions.push(eq(users.isBanned, true));
    } else if (filter === "kyc_verified") {
      conditions.push(eq(users.kycStatus, "verified"));
    } else if (filter === "kyc_rejected") {
      conditions.push(eq(users.kycStatus, "rejected"));
    } else if (filter === "no_kyc") {
      conditions.push(or(
        eq(users.kycStatus, "not_submitted"),
        eq(users.kycStatus, "none"),
        eq(users.kycStatus, ""),
      ));
    } else if (filter === "pending_kyc") {
      conditions.push(eq(users.kycStatus, "pending"));
    // Filtres par rôle
    } else if (filter === "role_admin") {
      conditions.push(eq(users.role, "admin"));
    } else if (filter === "role_support") {
      conditions.push(eq(users.role, "support"));
    } else if (filter === "role_finance") {
      conditions.push(eq(users.role, "finance"));
    } else if (filter === "role_user") {
      conditions.push(eq(users.role, "user"));
    } else if (filter === "role_privileged") {
      conditions.push(inArray(users.role, ["admin", "support", "finance"]));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(users).where(whereClause);
    const data = await db.select().from(users)
      .where(whereClause)
      .orderBy(filter === "has_balance" ? desc(sql`CAST(${users.balance} AS DECIMAL)`) : desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  async getAdminLayoutStats(): Promise<{ pendingDeposits: number; pendingWithdrawals: number; pendingTransfers: number; pendingManualPayouts: number; kycPending: number; ticketUnread: number; conversionCount: number; withdrawalNumberCount: number; notifications: any[]; latestConversionAt: string | null }> {
    const [
      pendingDepositResult,
      pendingWithdrawalResult,
      pendingTransferResult,
      pendingManualResult,
      kycPendingResult,
      ticketUnreadResult,
      conversionResult,
      withdrawalNumberResult,
      latestConversionResult,
    ] = await Promise.all([
      db.select({ c: count() }).from(transactions).where(and(eq(transactions.status, "pending"), inArray(transactions.type, ["deposit", "payment_link"]))),
      db.select({ c: count() }).from(transactions).where(and(eq(transactions.status, "pending"), eq(transactions.type, "withdrawal"))),
      db.select({ c: count() }).from(transactions).where(and(eq(transactions.status, "pending"), inArray(transactions.type, ["transfer_out", "transfer_in"]))),
      db.select({ c: count() }).from(transactions).where(and(eq(transactions.status, "pending_manual"), inArray(transactions.type, ["withdrawal", "transfer_out"]))),
      this.countKycByStatus("pending"),
      this.countUnreadUserMessagesForAdmin(),
      this.countPendingConversions(),
      this.getPendingWithdrawalNumberChanges(),
      db.select({ createdAt: conversionRequests.createdAt }).from(conversionRequests).orderBy(desc(conversionRequests.createdAt)).limit(1),
    ]);

    const pendingTxs = await db.select({ id: transactions.id, type: transactions.type, amount: transactions.amount, userId: transactions.userId, createdAt: transactions.createdAt })
      .from(transactions)
      .where(eq(transactions.status, "pending"))
      .orderBy(desc(transactions.createdAt))
      .limit(20);

    const userIds = [...new Set(pendingTxs.map(t => t.userId))];
    const txUsers = userIds.length > 0
      ? await db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, userIds))
      : [];
    const userMap = new Map(txUsers.map(u => [u.id, u.fullName]));

    const notifications = pendingTxs.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      userName: userMap.get(t.userId) || "Utilisateur",
      createdAt: t.createdAt,
    }));

    const latestConversionAt = latestConversionResult[0]?.createdAt
      ? new Date(latestConversionResult[0].createdAt).toISOString()
      : null;

    return {
      pendingDeposits: pendingDepositResult[0].c,
      pendingWithdrawals: pendingWithdrawalResult[0].c,
      pendingTransfers: pendingTransferResult[0].c,
      pendingManualPayouts: pendingManualResult[0].c,
      kycPending: kycPendingResult,
      ticketUnread: ticketUnreadResult,
      conversionCount: conversionResult,
      withdrawalNumberCount: withdrawalNumberResult.length,
      notifications,
      latestConversionAt,
    };
  }
  
  // Withdrawal numbers
  async getWithdrawalNumbersByUserId(userId: string): Promise<WithdrawalNumber[]> {
    return await db.select().from(withdrawalNumbers).where(eq(withdrawalNumbers.userId, userId));
  }

  async getWithdrawalNumber(id: string): Promise<WithdrawalNumber | undefined> {
    const [number] = await db.select().from(withdrawalNumbers).where(eq(withdrawalNumbers.id, id));
    return number || undefined;
  }

  async createWithdrawalNumber(number: InsertWithdrawalNumber): Promise<WithdrawalNumber> {
    const [newNumber] = await db.insert(withdrawalNumbers).values(number).returning();
    return newNumber;
  }

  async updateWithdrawalNumber(id: string, updates: Partial<InsertWithdrawalNumber>): Promise<WithdrawalNumber | undefined> {
    const [updated] = await db.update(withdrawalNumbers).set(updates).where(eq(withdrawalNumbers.id, id)).returning();
    return updated || undefined;
  }

  async deleteWithdrawalNumber(id: string): Promise<void> {
    await db.delete(withdrawalNumbers).where(eq(withdrawalNumbers.id, id));
  }

  async countUserWithdrawalNumbers(userId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(withdrawalNumbers).where(eq(withdrawalNumbers.userId, userId));
    return result.count;
  }
  
  // Withdrawal number change requests
  async createWithdrawalNumberChange(change: InsertWithdrawalNumberChange): Promise<WithdrawalNumberChange> {
    const [newChange] = await db.insert(withdrawalNumberChanges).values(change).returning();
    return newChange;
  }

  async getWithdrawalNumberChangesByUserId(userId: string): Promise<WithdrawalNumberChange[]> {
    return await db.select().from(withdrawalNumberChanges).where(eq(withdrawalNumberChanges.userId, userId)).orderBy(desc(withdrawalNumberChanges.createdAt));
  }

  async getPendingWithdrawalNumberChanges(): Promise<WithdrawalNumberChange[]> {
    return await db.select().from(withdrawalNumberChanges).where(eq(withdrawalNumberChanges.status, "pending")).orderBy(desc(withdrawalNumberChanges.createdAt));
  }

  async getWithdrawalNumberChange(id: string): Promise<WithdrawalNumberChange | undefined> {
    const [change] = await db.select().from(withdrawalNumberChanges).where(eq(withdrawalNumberChanges.id, id));
    return change || undefined;
  }

  async approveWithdrawalNumberChange(id: string, adminId: string, note?: string): Promise<WithdrawalNumberChange | undefined> {
    const change = await this.getWithdrawalNumberChange(id);
    if (!change) return undefined;
    
    if (change.action === "add") {
      await this.createWithdrawalNumber({
        userId: change.userId,
        phoneNumber: change.newPhoneNumber!,
        operatorName: change.newOperatorName!,
        label: change.newLabel,
        isActive: true,
      });
    } else if (change.action === "update") {
      await this.updateWithdrawalNumber(change.withdrawalNumberId!, {
        phoneNumber: change.newPhoneNumber!,
        operatorName: change.newOperatorName!,
        label: change.newLabel,
      });
    } else if (change.action === "delete") {
      const numberToDelete = change.withdrawalNumberId;
      // Nullify the FK reference in ALL change records pointing to this number
      // (not just this one) to avoid FK constraint violation on deletion
      if (numberToDelete) {
        await db.update(withdrawalNumberChanges)
          .set({ withdrawalNumberId: null })
          .where(eq(withdrawalNumberChanges.withdrawalNumberId, numberToDelete));
        await this.deleteWithdrawalNumber(numberToDelete);
      }
    }
    
    const [updated] = await db.update(withdrawalNumberChanges)
      .set({ status: "approved", adminId, adminNote: note, processedAt: new Date() })
      .where(eq(withdrawalNumberChanges.id, id))
      .returning();
    return updated;
  }

  async rejectWithdrawalNumberChange(id: string, adminId: string, note?: string): Promise<WithdrawalNumberChange | undefined> {
    const [updated] = await db.update(withdrawalNumberChanges)
      .set({ status: "rejected", adminId, adminNote: note, processedAt: new Date() })
      .where(eq(withdrawalNumberChanges.id, id))
      .returning();
    return updated;
  }
  
  // User notifications
  async getUserNotifications(userId: string, limit: number = 20): Promise<UserNotification[]> {
    return await db.select().from(userNotifications).where(eq(userNotifications.userId, userId)).orderBy(desc(userNotifications.createdAt)).limit(limit);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(userNotifications).where(and(eq(userNotifications.userId, userId), eq(userNotifications.isRead, false)));
    return result.count;
  }

  async createUserNotification(notification: InsertUserNotification): Promise<UserNotification> {
    const [newNotif] = await db.insert(userNotifications).values(notification).returning();
    return newNotif;
  }

  async markNotificationAsRead(id: string, userId: string): Promise<void> {
    await db.update(userNotifications).set({ isRead: true }).where(and(eq(userNotifications.id, id), eq(userNotifications.userId, userId)));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(userNotifications).set({ isRead: true }).where(eq(userNotifications.userId, userId));
  }

  async deleteUserNotification(id: string, userId: string): Promise<void> {
    await db.delete(userNotifications).where(and(eq(userNotifications.id, id), eq(userNotifications.userId, userId)));
  }

  async deleteAllUserNotifications(userId: string): Promise<void> {
    await db.delete(userNotifications).where(eq(userNotifications.userId, userId));
  }
  
  // Global messages
  async getActiveGlobalMessages(): Promise<GlobalMessage[]> {
    return await db.select().from(globalMessages).where(eq(globalMessages.isActive, true));
  }

  async getActiveGlobalMessagesForUser(userId: string): Promise<GlobalMessage[]> {
    const dismissedIds = await this.getDismissedGlobalMessageIds(userId);
    const active = await this.getActiveGlobalMessages();
    return active.filter(m => !dismissedIds.includes(m.id));
  }

  async getAllGlobalMessages(): Promise<GlobalMessage[]> {
    return await db.select().from(globalMessages).orderBy(desc(globalMessages.createdAt));
  }

  async createGlobalMessage(message: InsertGlobalMessage): Promise<GlobalMessage> {
    const [newMessage] = await db.insert(globalMessages).values(message).returning();
    return newMessage;
  }

  async updateGlobalMessage(id: string, updates: Partial<InsertGlobalMessage>): Promise<GlobalMessage | undefined> {
    const [updated] = await db.update(globalMessages).set(updates).where(eq(globalMessages.id, id)).returning();
    return updated || undefined;
  }

  async deleteGlobalMessage(id: string): Promise<void> {
    await db.delete(dismissedGlobalMessages).where(eq(dismissedGlobalMessages.globalMessageId, id));
    await db.delete(globalMessages).where(eq(globalMessages.id, id));
  }
  
  // Dismissed global messages
  async dismissGlobalMessage(userId: string, globalMessageId: string): Promise<void> {
    await db.insert(dismissedGlobalMessages).values({ userId, globalMessageId });
  }

  async getDismissedGlobalMessageIds(userId: string): Promise<string[]> {
    const dismissed = await db.select().from(dismissedGlobalMessages).where(eq(dismissedGlobalMessages.userId, userId));
    return dismissed.map(d => d.globalMessageId);
  }
  
  // KYC Submissions
  async getKycSubmissionByUserId(userId: string): Promise<KycSubmission | undefined> {
    const [submission] = await db.select().from(kycSubmissions).where(eq(kycSubmissions.userId, userId));
    return submission || undefined;
  }

  async getKycSubmissionById(id: string): Promise<KycSubmission | undefined> {
    const [submission] = await db.select().from(kycSubmissions).where(eq(kycSubmissions.id, id));
    return submission || undefined;
  }

  async createKycSubmission(submission: InsertKycSubmission): Promise<KycSubmission> {
    const [newSubmission] = await db.insert(kycSubmissions).values(submission).returning();
    return newSubmission;
  }

  async updateKycSubmission(id: string, updates: Partial<KycSubmission>): Promise<KycSubmission | undefined> {
    const [updated] = await db.update(kycSubmissions).set({ ...updates, updatedAt: new Date() }).where(eq(kycSubmissions.id, id)).returning();
    return updated || undefined;
  }

  async getAllKycSubmissions(status?: string): Promise<KycSubmission[]> {
    let query = db.select().from(kycSubmissions).orderBy(desc(kycSubmissions.createdAt));
    if (status) {
      // @ts-ignore
      query = query.where(eq(kycSubmissions.status, status));
      return await query;
    }
    const results = await query;
    // Pending toujours en premier, puis par date décroissante
    const order: Record<string, number> = { pending: 0, approved: 1, rejected: 2 };
    return results.sort((a, b) => {
      const diff = (order[a.status] ?? 3) - (order[b.status] ?? 3);
      if (diff !== 0) return diff;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }

  async countKycByStatus(status: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(kycSubmissions).where(eq(kycSubmissions.status, status));
    return result.count;
  }

  async approveKycSubmission(id: string, reviewerId: string, note?: string): Promise<KycSubmission | undefined> {
    const submission = await this.getKycSubmissionById(id);
    if (!submission) return undefined;

    // Update user KYC status — wrapped in try/catch so we log the REAL error
    // (e.g. guard trigger blocking is_verified on pgBouncer) instead of a generic 500.
    try {
      await this.updateUser(submission.userId, { kycStatus: "verified", isVerified: true });
    } catch (userUpdateErr: any) {
      console.error("[KYC approve] updateUser failed:", userUpdateErr?.message || userUpdateErr);
      // Fallback: update only kycStatus (not is_verified) to avoid guard trigger
      await db.update(users).set({ kycStatus: "verified" }).where(eq(users.id, submission.userId));
    }

    // Try full update (with reviewer fields). Fall back to status-only if columns
    // don't exist yet on older production deployments.
    try {
      const [updated] = await db.update(kycSubmissions)
        .set({ status: "approved", reviewerId, reviewNote: note, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(kycSubmissions.id, id))
        .returning();
      return updated;
    } catch (e) {
      console.error("[KYC approve] Full update failed — falling back to status-only update:", e);
      const [updated] = await db.update(kycSubmissions)
        .set({ status: "approved" })
        .where(eq(kycSubmissions.id, id))
        .returning();
      return updated;
    }
  }

  async rejectKycSubmission(id: string, reviewerId: string, note?: string): Promise<KycSubmission | undefined> {
    const submission = await this.getKycSubmissionById(id);
    if (!submission) return undefined;

    await this.updateUser(submission.userId, { kycStatus: "rejected" });

    // Try full update. Fall back to status-only if columns don't exist yet.
    try {
      const [updated] = await db.update(kycSubmissions)
        .set({ status: "rejected", reviewerId, reviewNote: note, reviewedAt: new Date(), updatedAt: new Date() })
        .where(eq(kycSubmissions.id, id))
        .returning();
      return updated;
    } catch (e) {
      console.error("[KYC reject] Full update failed — falling back to status-only update:", e);
      const [updated] = await db.update(kycSubmissions)
        .set({ status: "rejected" })
        .where(eq(kycSubmissions.id, id))
        .returning();
      return updated;
    }
  }

  // ── Multi-currency wallets ──────────────────────────────────────────────────
  async getUserWallets(userId: string): Promise<Wallet[]> {
    return db.select().from(wallets).where(eq(wallets.userId, userId));
  }

  async getWalletsByUserIds(userIds: string[]): Promise<Wallet[]> {
    if (userIds.length === 0) return [];
    return db.select().from(wallets).where(inArray(wallets.userId, userIds));
  }

  async getWallet(userId: string, currency: string): Promise<Wallet | undefined> {
    const [w] = await db.select().from(wallets).where(and(eq(wallets.userId, userId), eq(wallets.currency, currency)));
    return w;
  }

  async upsertWallet(userId: string, currency: string, balanceDelta: number): Promise<Wallet> {
    // Atomic upsert: INSERT ... ON CONFLICT DO UPDATE using PostgreSQL raw SQL.
    // This prevents race conditions where two concurrent operations (e.g. deposit + conversion)
    // could both read "no wallet exists" and then create duplicates or silently lose balance.
    // GREATEST(0, ...) ensures balance never goes negative at the DB level.
    const result = await db.execute(sql`
      INSERT INTO wallets (id, user_id, currency, balance, updated_at)
      VALUES (gen_random_uuid(), ${userId}, ${currency}, GREATEST(0, ${balanceDelta}::numeric), NOW())
      ON CONFLICT (user_id, currency) DO UPDATE
        SET balance    = GREATEST(0, wallets.balance::numeric + ${balanceDelta}::numeric),
            updated_at = NOW()
      RETURNING *
    `);
    const row = result.rows[0] as any;
    return {
      id: row.id,
      userId: row.user_id,
      currency: row.currency,
      balance: row.balance,
      updatedAt: row.updated_at,
    };
  }

  async setWalletBalance(userId: string, currency: string, newBalance: number): Promise<Wallet> {
    const all = await db.select().from(wallets).where(and(eq(wallets.userId, userId), eq(wallets.currency, currency)));
    if (all.length > 1) {
      // Deduplicate: keep the first, delete the rest
      const [keep, ...duplicates] = all;
      for (const dup of duplicates) {
        await db.delete(wallets).where(eq(wallets.id, dup.id));
      }
      const [updated] = await db.update(wallets)
        .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
        .where(eq(wallets.id, keep.id))
        .returning();
      return updated;
    } else if (all.length === 1) {
      const [updated] = await db.update(wallets)
        .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
        .where(eq(wallets.id, all[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(wallets)
        .values({ userId, currency, balance: newBalance.toFixed(2) })
        .returning();
      return created;
    }
  }

  async deleteWallet(walletId: string): Promise<void> {
    await db.delete(wallets).where(eq(wallets.id, walletId));
  }

  // ── Conversion requests ─────────────────────────────────────────────────────

  async createConversionRequest(data: InsertConversionRequest): Promise<ConversionRequest> {
    const [created] = await db.insert(conversionRequests).values(data).returning();
    return created;
  }

  async getConversionRequest(id: string): Promise<ConversionRequest | undefined> {
    const [req] = await db.select().from(conversionRequests).where(eq(conversionRequests.id, id));
    return req;
  }

  private async _getConversionRequestsWithUser(whereClause?: any): Promise<(ConversionRequest & { userFullName: string; userEmail: string })[]> {
    const rows = await db
      .select({
        id: conversionRequests.id,
        userId: conversionRequests.userId,
        fromCurrency: conversionRequests.fromCurrency,
        toCurrency: conversionRequests.toCurrency,
        fromAmount: conversionRequests.fromAmount,
        toAmount: conversionRequests.toAmount,
        status: conversionRequests.status,
        notes: conversionRequests.notes,
        executedAt: conversionRequests.executedAt,
        executedById: conversionRequests.executedById,
        createdAt: conversionRequests.createdAt,
        userFullName: users.fullName,
        userEmail: users.email,
      })
      .from(conversionRequests)
      .innerJoin(users, eq(conversionRequests.userId, users.id))
      .where(whereClause)
      .orderBy(desc(conversionRequests.createdAt));
    return rows as (ConversionRequest & { userFullName: string; userEmail: string })[];
  }

  async getPendingConversionRequests(): Promise<(ConversionRequest & { userFullName: string; userEmail: string })[]> {
    return this._getConversionRequestsWithUser(eq(conversionRequests.status, "pending"));
  }

  async getAllConversionRequests(): Promise<(ConversionRequest & { userFullName: string; userEmail: string })[]> {
    return this._getConversionRequestsWithUser();
  }

  async updateConversionRequest(id: string, data: Partial<ConversionRequest>): Promise<ConversionRequest> {
    const [updated] = await db
      .update(conversionRequests)
      .set(data)
      .where(eq(conversionRequests.id, id))
      .returning();
    return updated;
  }

  async countPendingConversions(): Promise<number> {
    const [{ cnt }] = await db
      .select({ cnt: count() })
      .from(conversionRequests)
      .where(eq(conversionRequests.status, "pending"));
    return Number(cnt);
  }

  // ── Auto-conversion rules ───────────────────────────────────────────────────

  async getAutoConversionRules(userId: string): Promise<AutoConversionRule[]> {
    return db
      .select()
      .from(autoConversionRules)
      .where(and(eq(autoConversionRules.userId, userId), eq(autoConversionRules.isActive, true)))
      .orderBy(desc(autoConversionRules.createdAt));
  }

  async getAutoConversionRuleByCurrency(userId: string, fromCurrency: string): Promise<AutoConversionRule | undefined> {
    const [rule] = await db
      .select()
      .from(autoConversionRules)
      .where(and(
        eq(autoConversionRules.userId, userId),
        eq(autoConversionRules.fromCurrency, fromCurrency),
        eq(autoConversionRules.isActive, true),
      ));
    return rule;
  }

  async createAutoConversionRule(data: InsertAutoConversionRule): Promise<AutoConversionRule> {
    const [created] = await db.insert(autoConversionRules).values(data).returning();
    return created;
  }

  async deleteAutoConversionRule(id: string, userId: string): Promise<void> {
    await db
      .delete(autoConversionRules)
      .where(and(eq(autoConversionRules.id, id), eq(autoConversionRules.userId, userId)));
  }

  // Hosted Page — field-level encryption for sk_live, pk_live; HMAC hash for hp_live lookup
  private decryptHostedPageConfig(config: HostedPageConfig): HostedPageConfig {
    return {
      ...config,
      skLive: decryptField(config.skLive),
      pkLive: decryptField(config.pkLive),
      hpLive: decryptField(config.hpLive),
    };
  }

  async getHostedPageConfig(userId: string): Promise<HostedPageConfig | undefined> {
    const [config] = await db.select().from(hostedPageConfigs).where(eq(hostedPageConfigs.userId, userId));
    if (!config) return undefined;
    return this.decryptHostedPageConfig(config);
  }

  async saveHostedPageConfig(userId: string, data: Partial<HostedPageConfig>): Promise<HostedPageConfig> {
    const toStore: Partial<HostedPageConfig> = { ...data };
    // Encrypt sensitive key fields before persisting
    if (toStore.skLive !== undefined) toStore.skLive = encryptField(toStore.skLive);
    if (toStore.pkLive !== undefined) toStore.pkLive = encryptField(toStore.pkLive);
    if (toStore.hpLive !== undefined) {
      const plainHpLive = toStore.hpLive;
      toStore.hpLive = encryptField(plainHpLive);
      toStore.hpLiveHash = hmacField(plainHpLive) ?? undefined;
    }
    const existing = await db.select().from(hostedPageConfigs).where(eq(hostedPageConfigs.userId, userId));
    let raw: HostedPageConfig;
    if (existing.length > 0) {
      const [updated] = await db
        .update(hostedPageConfigs)
        .set({ ...toStore, updatedAt: new Date() })
        .where(eq(hostedPageConfigs.userId, userId))
        .returning();
      raw = updated;
    } else {
      const [created] = await db
        .insert(hostedPageConfigs)
        .values({ userId, ...toStore })
        .returning();
      raw = created;
    }
    return this.decryptHostedPageConfig(raw);
  }

  async getUserByHpKey(hpLive: string): Promise<User | undefined> {
    // Look up by HMAC hash (hp_live_hash column) — tolerates legacy plaintext rows too
    const hash = hmacField(hpLive);
    if (hash) {
      const [config] = await db.select().from(hostedPageConfigs).where(eq(hostedPageConfigs.hpLiveHash, hash));
      if (config) return this.getUser(config.userId);
    }
    // Legacy fallback: plaintext hp_live stored before encryption was introduced
    const [legacy] = await db.select().from(hostedPageConfigs).where(eq(hostedPageConfigs.hpLive, hpLive));
    if (legacy) return this.getUser(legacy.userId);
    return undefined;
  }

  async createHostedPaymentSession(data: Omit<HostedPaymentSession, "createdAt">): Promise<HostedPaymentSession> {
    const [session] = await db.insert(hostedPaymentSessions).values(data).returning();
    return session;
  }

  async getHostedPaymentSession(id: string): Promise<HostedPaymentSession | undefined> {
    const [session] = await db.select().from(hostedPaymentSessions).where(eq(hostedPaymentSessions.id, id));
    return session || undefined;
  }

  async updateHostedPaymentSession(id: string, updates: Partial<HostedPaymentSession>): Promise<void> {
    await db.update(hostedPaymentSessions).set(updates).where(eq(hostedPaymentSessions.id, id));
  }
}

export const storage = new DatabaseStorage();
