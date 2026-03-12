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
  type KycSubmission,
  type InsertKycSubmission,
  wallets,
  type Wallet,
  conversionRequests,
  type ConversionRequest,
  type InsertConversionRequest,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, like, count, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByEmailOrPhone(identifier: string): Promise<User | undefined>;
  getUserByResetToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(id: string, amount: number): Promise<User | undefined>;
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
  
  // Admin: Transaction management
  getAllTransactions(): Promise<Transaction[]>;
  getAdminTransactionsPaginated(params: { limit: number; offset: number; type?: string; status?: string; search?: string }): Promise<{ data: Transaction[]; total: number }>;
  getAdminUsersPaginated(params: { limit: number; offset: number; search?: string }): Promise<{ data: User[]; total: number }>;
  getAdminLayoutStats(): Promise<{ pendingDeposits: number; pendingWithdrawals: number; pendingTransfers: number; kycPending: number; ticketUnread: number; conversionCount: number; withdrawalNumberCount: number; notifications: any[] }>;
  
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
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user || undefined;
  }

  async getUserByEmailOrPhone(identifier: string): Promise<User | undefined> {
    let user = await this.getUserByEmail(identifier);
    if (!user) {
      user = await this.getUserByPhone(identifier);
    }
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserBalance(id: string, amount: number): Promise<User | undefined> {
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
    
    return updatedUser;
  }

  async updateUserCurrency(id: string, currency: SupportedCurrency): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({ preferredCurrency: currency })
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser || undefined;
  }

  async getUserByResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.resetToken, token));
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
    const [transaction] = await db
      .update(transactions)
      .set({ status })
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

  async updatePaymentIntentStatus(id: string, status: string): Promise<PaymentIntent | undefined> {
    const [intent] = await db
      .update(paymentIntents)
      .set({ status })
      .where(eq(paymentIntents.id, id))
      .returning();
    return intent || undefined;
  }

  // Admin: User management
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async banUser(id: string, reason: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ isBanned: true, banReason: reason })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async unbanUser(id: string): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set({ isBanned: false, banReason: null })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<void> {
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
    
    // Update admin logs - set admin_id to null instead of delete
    await db.execute(sql`UPDATE admin_logs SET admin_id = NULL WHERE admin_id = ${id}`);
    
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
    await db.delete(users).where(eq(users.id, id));
  }

  async getPendingDepositTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions).where(
      and(
        eq(transactions.status, "pending"),
        inArray(transactions.type, ["deposit", "payment_link"])
      )
    ).orderBy(desc(transactions.createdAt));
  }

  // Admin: Transaction management
  async getAllTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions).orderBy(desc(transactions.createdAt));
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
  }

  // Admin: Logs
  async createAdminLog(log: InsertAdminLog): Promise<AdminLog> {
    const [newLog] = await db.insert(adminLogs).values(log).returning();
    return newLog;
  }

  async getAdminLogs(limit: number = 100): Promise<AdminLog[]> {
    return await db.select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(limit);
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

  async getStatsByCountry(): Promise<{ country: string; volume: number; count: number }[]> {
    const resetSetting = await this.getSetting("stats_reset_at");
    const resetAt: Date | null = resetSetting ? new Date(resetSetting.value) : null;

    const allUsers = await db.select({ id: users.id, country: users.country }).from(users);
    const userCountryMap = new Map(allUsers.map(u => [u.id, u.country || "Inconnu"]));

    const allTx = await db.select().from(transactions);
    const filtered = allTx.filter(t =>
      t.status === "completed" &&
      (t.type === "deposit" || t.type === "payment_link" || t.type === "withdrawal" || t.type === "transfer_out") &&
      (!resetAt || (t.createdAt && new Date(t.createdAt) > resetAt))
    );

    const byCountry: Record<string, { volume: number; count: number }> = {};
    for (const tx of filtered) {
      const country = userCountryMap.get(tx.userId) || "Inconnu";
      if (!byCountry[country]) byCountry[country] = { volume: 0, count: 0 };
      byCountry[country].volume += parseFloat(tx.amount);
      byCountry[country].count += 1;
    }

    return Object.entries(byCountry)
      .map(([country, data]) => ({ country, volume: data.volume, count: data.count }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
  }

  async getStatsActivity(): Promise<{ date: string; total: number; completed: number; failed: number; volume: number }[]> {
    const resetSetting = await this.getSetting("stats_reset_at");
    const resetAt: Date | null = resetSetting ? new Date(resetSetting.value) : null;

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

    const allTx = await db.select().from(transactions);
    const filtered = allTx.filter(t => {
      if (!t.createdAt) return false;
      const d = new Date(t.createdAt);
      if (d < thirtyDaysAgo) return false;
      if (resetAt && d <= resetAt) return false;
      return true;
    });

    const byDay: Record<string, { date: string; total: number; completed: number; failed: number; volume: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = { date: key, total: 0, completed: 0, failed: 0, volume: 0 };
    }

    for (const tx of filtered) {
      const key = new Date(tx.createdAt!).toISOString().slice(0, 10);
      if (byDay[key]) {
        byDay[key].total += 1;
        if (tx.status === "completed") { byDay[key].completed += 1; byDay[key].volume += parseFloat(tx.amount); }
        if (tx.status === "failed") byDay[key].failed += 1;
      }
    }

    return Object.values(byDay);
  }

  async getAdminStats(period: string = "all"): Promise<any> {
    const resetSetting = await this.getSetting("stats_reset_at");
    const resetAt: Date | null = resetSetting ? new Date(resetSetting.value) : null;

    const [usersCount] = await db.select({ count: count() }).from(users);
    const [bannedCount] = await db.select({ count: count() }).from(users).where(eq(users.isBanned, true));
    
    // Get all transactions — filter by resetAt in memory
    const rawAllTx = await db.select().from(transactions);
    const allTx = resetAt ? rawAllTx.filter(t => t.createdAt && new Date(t.createdAt) > resetAt) : rawAllTx;
    const completedTx = allTx.filter(t => t.status === "completed");
    
    const deposits = completedTx.filter(t => t.type === "deposit");
    const withdrawals = completedTx.filter(t => t.type === "withdrawal");
    const transfers = completedTx.filter(t => t.type === "transfer_out");
    const links = completedTx.filter(t => t.type === "payment_link");
    const conversions = completedTx.filter(t => t.type === "conversion");
    
    const depositVol = deposits.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const withdrawalVol = withdrawals.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const transferVol = transfers.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const linkVol = links.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    // For deposits: feeAmount = Ashtech margin (ashtechFeeAmount, ~2% of gross)
    const depositFees = deposits.reduce((sum, t) => sum + parseFloat(t.feeAmount || "0"), 0);
    
    // For withdrawals/transfers: feeAmount = max(percentage%, minPayoutCharge) = Ashtech revenue
    const withdrawalFees = withdrawals.reduce((sum, t) => sum + parseFloat(t.feeAmount || "0"), 0);
    const transferFees = transfers.reduce((sum, t) => sum + parseFloat(t.feeAmount || "0"), 0);
    
    // For payment links: feeAmount = Ashtech margin (ashtechFeeAmount, ~2% of gross)
    const paymentLinkFees = links.reduce((sum, t) => sum + parseFloat(t.feeAmount || "0"), 0);
    
    // For conversions: feeAmount = conversion fee (default 6% of amount)
    const conversionFees = conversions.reduce((sum, t) => sum + parseFloat(t.feeAmount || "0"), 0);

    const totalRevenue = depositFees + withdrawalFees + transferFees + paymentLinkFees + conversionFees;
    
    return {
      totalUsers: usersCount.count,
      totalTransactions: allTx.length,
      totalVolume: (depositVol + withdrawalVol + transferVol + linkVol).toFixed(2),
      monthlyTransactions: 0,
      rejectedTransactions: allTx.filter(t => t.status === "failed").length,
      pendingTransactions: allTx.filter(t => t.status === "pending").length,
      bannedUsers: bannedCount.count,
      statsResetAt: resetAt ? resetAt.toISOString() : null,
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
      depositCount: deposits.length,
      withdrawalCount: withdrawals.length,
      transferCount: transfers.length,
      paymentLinkCount: links.length,
      pendingDeposits: allTx.filter(t => t.status === "pending" && (t.type === "deposit" || t.type === "payment_link")).length,
      pendingWithdrawals: allTx.filter(t => t.status === "pending" && t.type === "withdrawal").length,
      pendingTransfers: allTx.filter(t => t.status === "pending" && (t.type === "transfer_out" || t.type === "transfer_in")).length,
    };
  }
  
  async getPendingNotifications(): Promise<any[]> {
    return [];
  }

  async getUsersByIds(ids: string[]): Promise<Map<string, { id: string; fullName: string; email: string; username: string }>> {
    if (ids.length === 0) return new Map();
    const result = await db.select({ id: users.id, fullName: users.fullName, email: users.email, username: users.username })
      .from(users)
      .where(inArray(users.id, ids));
    return new Map(result.map(u => [u.id, u]));
  }

  async getAdminTransactionsPaginated(params: { limit: number; offset: number; types?: string[]; type?: string; status?: string; search?: string }): Promise<{ data: Transaction[]; total: number }> {
    const { limit, offset, types, type, status } = params;

    const conditions: any[] = [];
    if (types && types.length > 0) {
      conditions.push(inArray(transactions.type, types));
    } else if (type && type !== "all") {
      conditions.push(eq(transactions.type, type));
    }
    if (status && status !== "all") conditions.push(eq(transactions.status, status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(transactions).where(whereClause);
    const data = await db.select().from(transactions)
      .where(whereClause)
      .orderBy(desc(transactions.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  async getAdminUsersPaginated(params: { limit: number; offset: number; search?: string }): Promise<{ data: User[]; total: number }> {
    const { limit, offset, search } = params;

    const conditions: any[] = [];
    if (search) {
      conditions.push(or(
        like(users.fullName, `%${search}%`),
        like(users.email, `%${search}%`),
        like(users.username, `%${search}%`),
      ));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await db.select({ total: count() }).from(users).where(whereClause);
    const data = await db.select().from(users)
      .where(whereClause)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return { data, total };
  }

  async getAdminLayoutStats(): Promise<{ pendingDeposits: number; pendingWithdrawals: number; pendingTransfers: number; kycPending: number; ticketUnread: number; conversionCount: number; withdrawalNumberCount: number; notifications: any[]; latestConversionAt: string | null }> {
    const [
      pendingDepositResult,
      pendingWithdrawalResult,
      pendingTransferResult,
      kycPendingResult,
      ticketUnreadResult,
      conversionResult,
      withdrawalNumberResult,
      latestConversionResult,
    ] = await Promise.all([
      db.select({ c: count() }).from(transactions).where(and(eq(transactions.status, "pending"), inArray(transactions.type, ["deposit", "payment_link"]))),
      db.select({ c: count() }).from(transactions).where(and(eq(transactions.status, "pending"), eq(transactions.type, "withdrawal"))),
      db.select({ c: count() }).from(transactions).where(and(eq(transactions.status, "pending"), inArray(transactions.type, ["transfer_out", "transfer_in"]))),
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
      // Nullify the FK reference first to avoid constraint violation on deletion
      await db.update(withdrawalNumberChanges)
        .set({ withdrawalNumberId: null })
        .where(eq(withdrawalNumberChanges.id, id));
      if (numberToDelete) {
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
    }
    return await query;
  }

  async countKycByStatus(status: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(kycSubmissions).where(eq(kycSubmissions.status, status));
    return result.count;
  }

  async approveKycSubmission(id: string, reviewerId: string, note?: string): Promise<KycSubmission | undefined> {
    const submission = await this.getKycSubmissionById(id);
    if (!submission) return undefined;
    
    await this.updateUser(submission.userId, { kycStatus: "verified", isVerified: true });
    
    const [updated] = await db.update(kycSubmissions)
      .set({ status: "approved", reviewerId, reviewNote: note, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(kycSubmissions.id, id))
      .returning();
    return updated;
  }

  async rejectKycSubmission(id: string, reviewerId: string, note?: string): Promise<KycSubmission | undefined> {
    const submission = await this.getKycSubmissionById(id);
    if (!submission) return undefined;
    
    await this.updateUser(submission.userId, { kycStatus: "rejected" });
    
    const [updated] = await db.update(kycSubmissions)
      .set({ status: "rejected", reviewerId, reviewNote: note, reviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(kycSubmissions.id, id))
      .returning();
    return updated;
  }

  // ── Multi-currency wallets ──────────────────────────────────────────────────
  async getUserWallets(userId: string): Promise<Wallet[]> {
    return db.select().from(wallets).where(eq(wallets.userId, userId));
  }

  async getWallet(userId: string, currency: string): Promise<Wallet | undefined> {
    const [w] = await db.select().from(wallets).where(and(eq(wallets.userId, userId), eq(wallets.currency, currency)));
    return w;
  }

  async upsertWallet(userId: string, currency: string, balanceDelta: number): Promise<Wallet> {
    const existing = await this.getWallet(userId, currency);
    if (existing) {
      const newBalance = Math.max(0, parseFloat(existing.balance) + balanceDelta);
      const [updated] = await db.update(wallets)
        .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
        .where(and(eq(wallets.userId, userId), eq(wallets.currency, currency)))
        .returning();
      return updated;
    } else {
      const initialBalance = Math.max(0, balanceDelta);
      const [created] = await db.insert(wallets)
        .values({ userId, currency, balance: initialBalance.toFixed(2) })
        .returning();
      return created;
    }
  }

  async setWalletBalance(userId: string, currency: string, newBalance: number): Promise<Wallet> {
    const existing = await this.getWallet(userId, currency);
    if (existing) {
      const [updated] = await db.update(wallets)
        .set({ balance: newBalance.toFixed(2), updatedAt: new Date() })
        .where(and(eq(wallets.userId, userId), eq(wallets.currency, currency)))
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
}

export const storage = new DatabaseStorage();
