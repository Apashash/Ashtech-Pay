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
  type InsertKycSubmission
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, or, like, count } from "drizzle-orm";

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
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: string, status: string): Promise<Transaction | undefined>;
  
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
    await db.delete(users).where(eq(users.id, id));
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
    await db.delete(operators).where(eq(operators.id, id));
  }

  // Admin: Fee operations
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
    return await db.select().from(supportTickets).where(eq(supportTickets.userId, userId));
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
    const [ticket] = await db.update(supportTickets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
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
    return await db.select().from(ticketMessages)
      .where(eq(ticketMessages.ticketId, ticketId))
      .orderBy(ticketMessages.createdAt);
  }

  async createTicketMessage(message: InsertTicketMessage): Promise<TicketMessage> {
    const [newMessage] = await db.insert(ticketMessages).values(message).returning();
    return newMessage;
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
      const [updated] = await db.update(platformSettings)
        .set({ value, description, updatedAt: new Date() })
        .where(eq(platformSettings.key, key))
        .returning();
      return updated;
    }
    const [newSetting] = await db.insert(platformSettings)
      .values({ key, value, description })
      .returning();
    return newSetting;
  }

  // Admin: Payment links
  async getAllPaymentLinks(): Promise<PaymentLink[]> {
    return await db.select().from(paymentLinks).orderBy(desc(paymentLinks.createdAt));
  }

  // Helper: Get date range for period filter
  private getDateRangeForPeriod(period: string): { start: Date; end: Date } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    switch (period) {
      case "last_year": {
        const start = new Date(now.getFullYear() - 1, 0, 1);
        const end = new Date(now.getFullYear(), 0, 1);
        return { start, end };
      }
      case "this_year": {
        const start = new Date(now.getFullYear(), 0, 1);
        return { start, end: tomorrow };
      }
      case "last_month": {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end };
      }
      case "this_month": {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end: tomorrow };
      }
      case "last_week": {
        const dayOfWeek = now.getDay();
        const startOfThisWeek = new Date(today);
        startOfThisWeek.setDate(today.getDate() - dayOfWeek);
        const startOfLastWeek = new Date(startOfThisWeek);
        startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
        return { start: startOfLastWeek, end: startOfThisWeek };
      }
      case "this_week": {
        const dayOfWeek = now.getDay();
        const start = new Date(today);
        start.setDate(today.getDate() - dayOfWeek);
        return { start, end: tomorrow };
      }
      case "yesterday": {
        const start = new Date(today);
        start.setDate(today.getDate() - 1);
        return { start, end: today };
      }
      case "today": {
        return { start: today, end: tomorrow };
      }
      default: // Default to this_month
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return { start, end: tomorrow };
    }
  }

  // Admin: Stats
  async getAdminStats(period: string = "this_month"): Promise<{
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
    depositCount: number;
    withdrawalCount: number;
    transferCount: number;
    paymentLinkCount: number;
    pendingDeposits: number;
    pendingWithdrawals: number;
    pendingTransfers: number;
  }> {
    const allUsers = await db.select().from(users);
    const allTransactions = await db.select().from(transactions);
    
    const { start, end } = this.getDateRangeForPeriod(period);
    
    // Filter transactions by period
    const filteredTransactions = allTransactions.filter(t => {
      if (!t.createdAt) return false;
      const txDate = new Date(t.createdAt);
      return txDate >= start && txDate < end;
    });
    
    // Total users is always all-time (not filtered)
    const totalUsers = allUsers.length;
    
    // Banned users within the period (users banned during this period)
    const bannedUsers = allUsers.filter(u => u.isBanned).length;
    
    const totalTransactions = filteredTransactions.length;
    const monthlyTransactions = filteredTransactions.length; // Same as totalTransactions for the period
    
    const rejectedTransactions = filteredTransactions.filter(t => t.status === "failed").length;
    const pendingTransactions = filteredTransactions.filter(t => t.status === "pending").length;
    
    const completedTransactions = filteredTransactions.filter(t => t.status === "completed");
    const deposits = completedTransactions.filter(t => t.type === "deposit");
    const withdrawals = completedTransactions.filter(t => t.type === "withdrawal");
    const transfers = completedTransactions.filter(t => t.type === "transfer_out");
    const paymentLinksTransactions = completedTransactions.filter(t => t.type === "payment_link");
    
    const totalDeposits = deposits.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalWithdrawals = withdrawals.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalVolume = filteredTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    // Calculate total revenue from fees (all completed transactions with fees)
    const depositFees = deposits.reduce((sum, t) => sum + parseFloat(t.feeAmount || "0"), 0);
    const withdrawalFees = withdrawals.reduce((sum, t) => sum + parseFloat(t.feeAmount || "0"), 0);
    const transferFees = transfers.reduce((sum, t) => sum + parseFloat(t.feeAmount || "0"), 0);
    const paymentLinkFees = paymentLinksTransactions.reduce((sum, t) => sum + parseFloat(t.feeAmount || "0"), 0);
    const totalRevenue = depositFees + withdrawalFees + transferFees + paymentLinkFees;
    
    // Counts by type (for the period)
    const depositCount = filteredTransactions.filter(t => t.type === "deposit").length;
    const withdrawalCount = filteredTransactions.filter(t => t.type === "withdrawal").length;
    const transferCount = filteredTransactions.filter(t => t.type === "transfer_out").length;
    const paymentLinkCount = filteredTransactions.filter(t => t.type === "payment_link").length;
    
    // Pending counts (all-time for notifications)
    const pendingDeposits = allTransactions.filter(t => t.type === "deposit" && t.status === "pending").length;
    const pendingWithdrawals = allTransactions.filter(t => t.type === "withdrawal" && t.status === "pending").length;
    const pendingTransfers = allTransactions.filter(t => t.type === "transfer_out" && t.status === "pending").length;
    
    return {
      totalUsers,
      totalTransactions,
      totalVolume: totalVolume.toFixed(2),
      monthlyTransactions,
      rejectedTransactions,
      pendingTransactions,
      bannedUsers,
      totalDeposits: totalDeposits.toFixed(2),
      totalWithdrawals: totalWithdrawals.toFixed(2),
      totalRevenue: totalRevenue.toFixed(2),
      depositCount,
      withdrawalCount,
      transferCount,
      paymentLinkCount,
      pendingDeposits,
      pendingWithdrawals,
      pendingTransfers,
    };
  }

  async getPendingNotifications(): Promise<Array<{
    id: string;
    type: string;
    amount: string;
    userName: string;
    createdAt: Date | null;
  }>> {
    const pendingTxs = await db
      .select({
        id: transactions.id,
        type: transactions.type,
        amount: transactions.amount,
        userId: transactions.userId,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(eq(transactions.status, "pending"))
      .orderBy(desc(transactions.createdAt))
      .limit(20);
    
    const result = await Promise.all(
      pendingTxs.map(async (tx) => {
        const user = await this.getUser(tx.userId);
        return {
          id: tx.id,
          type: tx.type,
          amount: tx.amount,
          userName: user?.fullName || "Utilisateur inconnu",
          createdAt: tx.createdAt,
        };
      })
    );
    
    return result;
  }

  // Withdrawal numbers
  async getWithdrawalNumbersByUserId(userId: string): Promise<WithdrawalNumber[]> {
    return await db
      .select()
      .from(withdrawalNumbers)
      .where(and(eq(withdrawalNumbers.userId, userId), eq(withdrawalNumbers.isActive, true)))
      .orderBy(desc(withdrawalNumbers.createdAt));
  }

  async getWithdrawalNumber(id: string): Promise<WithdrawalNumber | undefined> {
    const [number] = await db.select().from(withdrawalNumbers).where(eq(withdrawalNumbers.id, id));
    return number || undefined;
  }

  async createWithdrawalNumber(insertNumber: InsertWithdrawalNumber): Promise<WithdrawalNumber> {
    const [number] = await db.insert(withdrawalNumbers).values(insertNumber).returning();
    return number;
  }

  async updateWithdrawalNumber(id: string, updates: Partial<InsertWithdrawalNumber>): Promise<WithdrawalNumber | undefined> {
    const [number] = await db
      .update(withdrawalNumbers)
      .set(updates)
      .where(eq(withdrawalNumbers.id, id))
      .returning();
    return number || undefined;
  }

  async deleteWithdrawalNumber(id: string): Promise<void> {
    await db.update(withdrawalNumbers).set({ isActive: false }).where(eq(withdrawalNumbers.id, id));
  }

  async countUserWithdrawalNumbers(userId: string): Promise<number> {
    const numbers = await db
      .select()
      .from(withdrawalNumbers)
      .where(and(eq(withdrawalNumbers.userId, userId), eq(withdrawalNumbers.isActive, true)));
    return numbers.length;
  }

  // Withdrawal number change requests
  async createWithdrawalNumberChange(change: InsertWithdrawalNumberChange): Promise<WithdrawalNumberChange> {
    const [newChange] = await db.insert(withdrawalNumberChanges).values(change).returning();
    return newChange;
  }

  async getWithdrawalNumberChangesByUserId(userId: string): Promise<WithdrawalNumberChange[]> {
    return await db
      .select()
      .from(withdrawalNumberChanges)
      .where(eq(withdrawalNumberChanges.userId, userId))
      .orderBy(desc(withdrawalNumberChanges.createdAt));
  }

  async getPendingWithdrawalNumberChanges(): Promise<WithdrawalNumberChange[]> {
    return await db
      .select()
      .from(withdrawalNumberChanges)
      .where(eq(withdrawalNumberChanges.status, "pending"))
      .orderBy(desc(withdrawalNumberChanges.createdAt));
  }

  async getWithdrawalNumberChange(id: string): Promise<WithdrawalNumberChange | undefined> {
    const [change] = await db.select().from(withdrawalNumberChanges).where(eq(withdrawalNumberChanges.id, id));
    return change || undefined;
  }

  async approveWithdrawalNumberChange(id: string, adminId: string, note?: string): Promise<WithdrawalNumberChange | undefined> {
    const change = await this.getWithdrawalNumberChange(id);
    if (!change) return undefined;

    // Apply the change based on action type
    if (change.action === "add" && change.newPhoneNumber && change.newOperatorName) {
      await this.createWithdrawalNumber({
        userId: change.userId,
        phoneNumber: change.newPhoneNumber,
        operatorName: change.newOperatorName,
        label: change.newLabel,
        isActive: true,
      });
    } else if (change.action === "update" && change.withdrawalNumberId) {
      const updates: Partial<InsertWithdrawalNumber> = {};
      if (change.newPhoneNumber) updates.phoneNumber = change.newPhoneNumber;
      if (change.newOperatorName) updates.operatorName = change.newOperatorName;
      if (change.newLabel !== undefined) updates.label = change.newLabel;
      await this.updateWithdrawalNumber(change.withdrawalNumberId, updates);
    } else if (change.action === "delete" && change.withdrawalNumberId) {
      await this.deleteWithdrawalNumber(change.withdrawalNumberId);
    }

    const [updated] = await db
      .update(withdrawalNumberChanges)
      .set({ status: "approved", adminId, adminNote: note, processedAt: new Date() })
      .where(eq(withdrawalNumberChanges.id, id))
      .returning();
    return updated || undefined;
  }

  async rejectWithdrawalNumberChange(id: string, adminId: string, note?: string): Promise<WithdrawalNumberChange | undefined> {
    const [updated] = await db
      .update(withdrawalNumberChanges)
      .set({ status: "rejected", adminId, adminNote: note, processedAt: new Date() })
      .where(eq(withdrawalNumberChanges.id, id))
      .returning();
    return updated || undefined;
  }

  // User notifications
  async getUserNotifications(userId: string, limit: number = 50): Promise<UserNotification[]> {
    return await db
      .select()
      .from(userNotifications)
      .where(eq(userNotifications.userId, userId))
      .orderBy(desc(userNotifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(userNotifications)
      .where(and(
        eq(userNotifications.userId, userId),
        eq(userNotifications.isRead, false)
      ));
    return result?.count || 0;
  }

  async createUserNotification(notification: InsertUserNotification): Promise<UserNotification> {
    const [newNotification] = await db.insert(userNotifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationAsRead(id: string, userId: string): Promise<void> {
    await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(and(
        eq(userNotifications.id, id),
        eq(userNotifications.userId, userId)
      ));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(userNotifications)
      .set({ isRead: true })
      .where(eq(userNotifications.userId, userId));
  }

  async deleteUserNotification(id: string, userId: string): Promise<void> {
    await db
      .delete(userNotifications)
      .where(and(
        eq(userNotifications.id, id),
        eq(userNotifications.userId, userId)
      ));
  }

  // Global messages
  async getActiveGlobalMessages(): Promise<GlobalMessage[]> {
    const now = new Date();
    return await db
      .select()
      .from(globalMessages)
      .where(and(
        eq(globalMessages.isActive, true),
        or(
          sql`${globalMessages.expiresAt} IS NULL`,
          sql`${globalMessages.expiresAt} > ${now}`
        )
      ))
      .orderBy(desc(globalMessages.createdAt));
  }

  async getAllGlobalMessages(): Promise<GlobalMessage[]> {
    return await db
      .select()
      .from(globalMessages)
      .orderBy(desc(globalMessages.createdAt));
  }

  async createGlobalMessage(message: InsertGlobalMessage): Promise<GlobalMessage> {
    const [newMessage] = await db.insert(globalMessages).values(message).returning();
    return newMessage;
  }

  async updateGlobalMessage(id: string, updates: Partial<InsertGlobalMessage>): Promise<GlobalMessage | undefined> {
    const [updated] = await db
      .update(globalMessages)
      .set(updates)
      .where(eq(globalMessages.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteGlobalMessage(id: string): Promise<void> {
    await db.delete(globalMessages).where(eq(globalMessages.id, id));
  }

  async getActiveGlobalMessagesForUser(userId: string): Promise<GlobalMessage[]> {
    const dismissedIds = await this.getDismissedGlobalMessageIds(userId);
    const now = new Date();
    
    const messages = await db
      .select()
      .from(globalMessages)
      .where(and(
        eq(globalMessages.isActive, true),
        or(
          sql`${globalMessages.expiresAt} IS NULL`,
          sql`${globalMessages.expiresAt} > ${now}`
        )
      ))
      .orderBy(desc(globalMessages.createdAt));
    
    return messages.filter(msg => !dismissedIds.includes(msg.id));
  }

  async dismissGlobalMessage(userId: string, globalMessageId: string): Promise<void> {
    await db.insert(dismissedGlobalMessages).values({
      userId,
      globalMessageId,
    }).onConflictDoNothing();
  }

  async getDismissedGlobalMessageIds(userId: string): Promise<string[]> {
    const dismissed = await db
      .select({ globalMessageId: dismissedGlobalMessages.globalMessageId })
      .from(dismissedGlobalMessages)
      .where(eq(dismissedGlobalMessages.userId, userId));
    return dismissed.map(d => d.globalMessageId);
  }

  // KYC Submissions
  async getKycSubmissionByUserId(userId: string): Promise<KycSubmission | undefined> {
    const [submission] = await db
      .select()
      .from(kycSubmissions)
      .where(eq(kycSubmissions.userId, userId))
      .orderBy(desc(kycSubmissions.createdAt))
      .limit(1);
    return submission || undefined;
  }

  async getKycSubmissionById(id: string): Promise<KycSubmission | undefined> {
    const [submission] = await db
      .select()
      .from(kycSubmissions)
      .where(eq(kycSubmissions.id, id));
    return submission || undefined;
  }

  async createKycSubmission(submission: InsertKycSubmission): Promise<KycSubmission> {
    const [newSubmission] = await db
      .insert(kycSubmissions)
      .values(submission)
      .returning();
    
    // Update user's KYC status to pending
    await db
      .update(users)
      .set({ kycStatus: "pending" })
      .where(eq(users.id, submission.userId));
    
    return newSubmission;
  }

  async updateKycSubmission(id: string, updates: Partial<KycSubmission>): Promise<KycSubmission | undefined> {
    const [updated] = await db
      .update(kycSubmissions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(kycSubmissions.id, id))
      .returning();
    return updated || undefined;
  }

  async getAllKycSubmissions(status?: string): Promise<KycSubmission[]> {
    if (status) {
      return await db
        .select()
        .from(kycSubmissions)
        .where(eq(kycSubmissions.status, status))
        .orderBy(desc(kycSubmissions.createdAt));
    }
    return await db
      .select()
      .from(kycSubmissions)
      .orderBy(desc(kycSubmissions.createdAt));
  }

  async countKycByStatus(status: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(kycSubmissions)
      .where(eq(kycSubmissions.status, status));
    return result[0]?.count || 0;
  }

  async approveKycSubmission(id: string, reviewerId: string, note?: string): Promise<KycSubmission | undefined> {
    const submission = await this.getKycSubmissionById(id);
    if (!submission) return undefined;

    const [updated] = await db
      .update(kycSubmissions)
      .set({
        status: "approved",
        reviewerId,
        reviewNote: note,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(kycSubmissions.id, id))
      .returning();

    // Update user's KYC status and verification
    await db
      .update(users)
      .set({ 
        kycStatus: "verified",
        isVerified: true
      })
      .where(eq(users.id, submission.userId));

    return updated || undefined;
  }

  async rejectKycSubmission(id: string, reviewerId: string, note?: string): Promise<KycSubmission | undefined> {
    const submission = await this.getKycSubmissionById(id);
    if (!submission) return undefined;

    const [updated] = await db
      .update(kycSubmissions)
      .set({
        status: "rejected",
        reviewerId,
        reviewNote: note,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(kycSubmissions.id, id))
      .returning();

    // Update user's KYC status
    await db
      .update(users)
      .set({ kycStatus: "rejected" })
      .where(eq(users.id, submission.userId));

    return updated || undefined;
  }
}

export const storage = new DatabaseStorage();
