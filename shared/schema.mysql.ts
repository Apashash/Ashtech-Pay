/**
 * MySQL schema variant.
 *
 * This module intentionally has the same public names as schema.ts, but does
 * not import pg-core.  The small column factory below keeps the definitions
 * readable while still creating real Drizzle MySQL columns (rather than
 * SQL-string placeholders).  MySQL has no partial or expression indexes:
 * those constraints are therefore enforced by the service layer before an
 * insert (the affected columns are noted below).
 */
import { randomUUID } from "node:crypto";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  mysqlTable,
  varchar,
  text,
  int,
  boolean,
  decimal,
  timestamp,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

type AnyColumns = Record<string, any>;
const id = () => varchar("id", { length: 191 }).primaryKey().$defaultFn(() => randomUUID());
const columns = (names: string[], overrides: AnyColumns = {}): AnyColumns => {
  const result: AnyColumns = {};
  for (const name of names) result[name] = varchar(name.replace(/[A-Z]/g, m => `_${m.toLowerCase()}`), { length: 191 });
  return { ...result, ...overrides };
};
const common = (names: string[], overrides: AnyColumns = {}) => columns(names, overrides);
const dt = (name: string) => timestamp(name).defaultNow();
const money = (name: string, precision = 15, scale = 2) => decimal(name, { precision, scale });
const js = (name: string) => json(name);

export const users = mysqlTable("users", common([
  "id","username","email","password","fullName","phone","country","preferredCurrency","balance","isVerified",
  "kycStatus","isBanned","banReason","withdrawalBlocked","withdrawalBlockReason","role","lastLoginAt","lastSeenAt",
  "resetToken","resetTokenExpiry","apiKey","apiKeyHash","apiEnabled","apiWebhookSecret","registrationIp",
  "totpSecret","totpEnabled","izichangeAccountId","createdAt",
], {
  id: id(), username: text("username").notNull(), email: text("email").notNull(), password: text("password").notNull(),
  fullName: text("full_name").notNull(), balance: money("balance").default("0.00").notNull(),
  isVerified: boolean("is_verified").default(false), isBanned: boolean("is_banned").default(false),
  withdrawalBlocked: boolean("withdrawal_blocked").default(false), apiEnabled: boolean("api_enabled").default(false),
  totpEnabled: boolean("totp_enabled").default(false), createdAt: dt("created_at"),
}), (t) => ({
  usernameUnique: uniqueIndex("users_username_unique").on(t.username),
  emailUnique: uniqueIndex("users_email_unique").on(t.email),
  // PostgreSQL's lower(email)/lower(username) indexes are application-level
  // checks in MySQL; callers normalize these values before writing.
  phoneUnique: uniqueIndex("users_phone_unique").on(t.phone),
}));

export const transactions = mysqlTable("transactions", common([
  "id","userId","type","amount","currency","status","description","recipientId","recipientName","recipientPhone",
  "recipientCountry","operatorId","feeAmount","ashtechFeeAmount","totalAmount","paymentMethod","reference",
  "paymentLinkId","paymentIntentId","payerName","payerEmail","externalReference","notifyUrl","source","metadata",
  "createdAt","confirmedAt",
], {
  id: id(), amount: money("amount").notNull(), feeAmount: money("fee_amount"), ashtechFeeAmount: money("ashtech_fee_amount"),
  totalAmount: money("total_amount"), metadata: js("metadata"), createdAt: dt("created_at"), confirmedAt: timestamp("confirmed_at"),
}), (t) => ({
  userIdx: index("tx_user_id_idx").on(t.userId), statusIdx: index("tx_status_idx").on(t.status),
  createdIdx: index("tx_created_at_idx").on(t.createdAt), statusTypeIdx: index("tx_status_type_idx").on(t.status, t.type),
  // Partial API/reference and UUID-only PawaPay indexes are enforced in storage.
}));

export const paymentLinks = mysqlTable("payment_links", common([
  "id","userId","title","description","amount","currency","slug","isActive","isFixedAmount","imagePath","pdfPath",
  "hasPdfDelivery","redirectUrl","expiresAt","clickCount","allowedCountries","notifyUrl","createdAt",
], { id: id(), amount: money("amount").notNull(), isActive: boolean("is_active").default(true),
  isFixedAmount: boolean("is_fixed_amount").default(true), hasPdfDelivery: boolean("has_pdf_delivery").default(false),
  clickCount: int("click_count").default(0).notNull(), allowedCountries: js("allowed_countries"), expiresAt: timestamp("expires_at"), createdAt: dt("created_at"),
}), (t) => ({ userIdx: index("pl_user_id_idx").on(t.userId), slugUnique: uniqueIndex("payment_links_slug_unique").on(t.slug) }));

export const paymentIntents = mysqlTable("payment_intents", common([
  "id","paymentLinkId","merchantId","payerName","payerEmail","payerPhone","payerCountry","amount","feeAmount","currency",
  "paymentMethod","operator","status","reference","createdAt",
], { id: id(), amount: money("amount").notNull(), feeAmount: money("fee_amount").default("0"),
  createdAt: dt("created_at"), reference: varchar("reference", { length: 191 }).notNull() }), (t) => ({
  referenceUnique: uniqueIndex("payment_intents_reference_unique").on(t.reference),
}));

export const countries = mysqlTable("countries", {
  id: id(), name: text("name").notNull(), code: text("code").notNull(),
  flag: text("flag").default("🌍").notNull(), dialCode: text("dial_code").default("+1").notNull(),
  currency: text("currency").default("XAF").notNull(), exchangeRate: decimal("exchange_rate", { precision: 15, scale: 4 }).default("1").notNull(),
  isActive: boolean("is_active").default(true), isActiveForRegistration: boolean("is_active_for_registration").default(true),
  isActiveForDeposit: boolean("is_active_for_deposit").default(true), isActiveForTransfer: boolean("is_active_for_transfer").default(true),
  isActiveForWithdrawal: boolean("is_active_for_withdrawal").default(true),
  minDeposit: money("min_deposit").default("100").notNull(), maxDeposit: money("max_deposit").default("5000000").notNull(),
  minWithdrawal: money("min_withdrawal").default("500").notNull(), maxWithdrawal: money("max_withdrawal").default("2000000").notNull(), createdAt: dt("created_at"),
}, t => ({ nameUnique: uniqueIndex("countries_name_unique").on(t.name), codeUnique: uniqueIndex("countries_code_unique").on(t.code) }));
export const operators = mysqlTable("operators", {
  id: id(), name: text("name").notNull(), type: text("type").notNull(), countryId: varchar("country_id", { length: 191 }).notNull().references(() => countries.id),
  gateway: text("gateway").default("soleapay").notNull(), paymentProvider: text("payment_provider").default("afribapay").notNull(),
  depositPaymentProvider: text("deposit_payment_provider"), afribapayOperatorCode: text("afribapay_operator_code"), pixpayServiceId: text("pixpay_service_id"),
  pixpayOperatorType: text("pixpay_operator_type").default("ussd"), pawapayProviderCode: text("pawapay_provider_code"),
  isActive: boolean("is_active").default(true), isInMaintenance: boolean("is_in_maintenance").default(false),
  dailyLimit: money("daily_limit").default("1000000").notNull(), logoUrl: text("logo_url"), createdAt: dt("created_at"),
});
export const fees = mysqlTable("fees", {
  id: id(), name: text("name").notNull(), transactionType: text("transaction_type").notNull(), feeType: text("fee_type").notNull(),
  feeValue: decimal("fee_value", { precision: 10, scale: 4 }).notNull(), afribapayFee: decimal("afribapay_fee", { precision: 10, scale: 4 }).default("0"),
  pixpayFee: decimal("pixpay_fee", { precision: 10, scale: 4 }).default("0"), pawapayFee: decimal("pawapay_fee", { precision: 10, scale: 4 }).default("0"),
  ashtechMargin: decimal("ashtech_margin", { precision: 10, scale: 4 }).default("0"), minFee: money("min_fee"), maxFee: money("max_fee"),
  countryId: varchar("country_id", { length: 191 }).references(() => countries.id), operatorId: varchar("operator_id", { length: 191 }).references(() => operators.id),
  isActive: boolean("is_active").default(true), createdAt: dt("created_at"),
});
export const supportTickets = mysqlTable("support_tickets", {
  id: id(), userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id), subject: text("subject").notNull(),
  status: text("status").default("open").notNull(), priority: text("priority").default("medium").notNull(),
  assignedTo: varchar("assigned_to", { length: 191 }).references(() => users.id), createdAt: dt("created_at"), updatedAt: dt("updated_at"),
});
export const ticketMessages = mysqlTable("ticket_messages", {
  id: id(), ticketId: varchar("ticket_id", { length: 191 }).notNull().references(() => supportTickets.id),
  senderId: varchar("sender_id", { length: 191 }).notNull().references(() => users.id), message: text("message").notNull(),
  isAdmin: boolean("is_admin").default(false), readByAdmin: boolean("read_by_admin").default(false), readByUser: boolean("read_by_user").default(false), createdAt: dt("created_at"),
});
export const adminLogs = mysqlTable("admin_logs", {
  id: id(), adminId: varchar("admin_id", { length: 191 }).notNull().references(() => users.id), action: text("action").notNull(),
  targetType: text("target_type"), targetId: varchar("target_id", { length: 191 }), details: text("details"), ipAddress: text("ip_address"), createdAt: dt("created_at"),
});
export const platformSettings = mysqlTable("platform_settings", {
  id: id(), key: text("key").notNull(), value: text("value").notNull(), description: text("description"), updatedAt: dt("updated_at"),
}, t => ({ keyUnique: uniqueIndex("platform_settings_key_unique").on(t.key) }));
export const withdrawalNumbers = mysqlTable("withdrawal_numbers", {
  id: id(), userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id), phoneNumber: text("phone_number").notNull(),
  operatorName: text("operator_name").notNull(), label: text("label"), isActive: boolean("is_active").default(true), createdAt: dt("created_at"),
});
export const withdrawalNumberChanges = mysqlTable("withdrawal_number_changes", {
  id: id(), userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id),
  withdrawalNumberId: varchar("withdrawal_number_id", { length: 191 }).references(() => withdrawalNumbers.id), action: text("action").notNull(),
  oldPhoneNumber: text("old_phone_number"), oldOperatorName: text("old_operator_name"), newPhoneNumber: text("new_phone_number"), newOperatorName: text("new_operator_name"),
  newLabel: text("new_label"), status: text("status").default("pending").notNull(), adminId: varchar("admin_id", { length: 191 }).references(() => users.id),
  adminNote: text("admin_note"), createdAt: dt("created_at"), processedAt: timestamp("processed_at"),
});
export const auditLogs = mysqlTable("audit_logs", {
  id: id(), userId: varchar("user_id", { length: 191 }), actorType: text("actor_type").default("user").notNull(), action: text("action").notNull(),
  targetType: text("target_type"), targetId: varchar("target_id", { length: 191 }), details: text("details"), ipAddress: text("ip_address"),
  userAgent: text("user_agent"), success: boolean("success").default(true), createdAt: dt("created_at"),
});
export const userNotifications = mysqlTable("user_notifications", {
  id: id(), userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id), type: text("type").notNull(),
  title: text("title").notNull(), message: text("message").notNull(), transactionId: varchar("transaction_id", { length: 191 }).references(() => transactions.id),
  isRead: boolean("is_read").default(false), createdAt: dt("created_at"),
});
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: id(), userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id), endpointHash: varchar("endpoint_hash", { length: 64 }).notNull(),
  endpoint: text("endpoint").notNull(), p256dh: text("p256dh").notNull(), auth: text("auth").notNull(), userAgent: text("user_agent"),
  createdAt: dt("created_at"), updatedAt: dt("updated_at"),
}, t => ({ endpointUnique: uniqueIndex("push_subscriptions_user_endpoint_unique").on(t.userId, t.endpointHash), userIdx: index("push_subscriptions_user_id_idx").on(t.userId) }));
export const globalMessages = mysqlTable("global_messages", {
  id: id(), adminId: varchar("admin_id", { length: 191 }).notNull().references(() => users.id), title: text("title").notNull(), message: text("message").notNull(),
  isActive: boolean("is_active").default(true), expiresAt: timestamp("expires_at"), createdAt: dt("created_at"),
});
export const dismissedGlobalMessages = mysqlTable("dismissed_global_messages", {
  id: id(), userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id),
  globalMessageId: varchar("global_message_id", { length: 191 }).notNull().references(() => globalMessages.id), createdAt: dt("created_at"),
});
export const kycSubmissions = mysqlTable("kyc_submissions", {
  id: id(), userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id), documentType: text("document_type").notNull(),
  documentNumber: text("document_number").notNull(), documentFrontPath: text("document_front_path").notNull(), documentBackPath: text("document_back_path").notNull(),
  selfiePath: text("selfie_path").notNull(), country: text("country"), city: text("city"), postalCode: text("postal_code"), latitude: text("latitude"), longitude: text("longitude"),
  businessType: text("business_type").notNull(), businessCategory: text("business_category").notNull(), businessDescription: text("business_description").notNull(),
  status: text("status").default("pending").notNull(), reviewerId: varchar("reviewer_id", { length: 191 }).references(() => users.id), reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"), createdAt: dt("created_at"), updatedAt: dt("updated_at"),
});
export const wallets = mysqlTable("wallets", {
  id: id(), userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id), currency: text("currency").notNull(),
  balance: money("balance").default("0.00").notNull(), updatedAt: dt("updated_at"),
}, t => ({ userCurrencyUnique: uniqueIndex("wallets_user_currency_unique").on(t.userId, t.currency) }));
export const conversionRequests = mysqlTable("conversion_requests", {
  id: id(), userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id), fromCurrency: text("from_currency").notNull(), toCurrency: text("to_currency").notNull(),
  fromAmount: money("from_amount").notNull(), toAmount: money("to_amount"), status: text("status").default("pending").notNull(), notes: text("notes"),
  executedAt: timestamp("executed_at"), executedById: varchar("executed_by_id", { length: 191 }), createdAt: dt("created_at"),
});
export const autoConversionRules = mysqlTable("auto_conversion_rules", {
  id: id(), userId: varchar("user_id", { length: 191 }).notNull().references(() => users.id), fromCurrency: text("from_currency").notNull(), toCurrency: text("to_currency").notNull(),
  isActive: boolean("is_active").default(true).notNull(), createdAt: dt("created_at"),
}, t => ({ userFromCurrencyUnique: uniqueIndex("auto_conversion_user_from_currency_unique").on(t.userId, t.fromCurrency) }));
export const hostedPageConfigs = mysqlTable("hosted_page_configs", {
  id: id(), userId: varchar("user_id", { length: 191 }).notNull().unique(), successUrl: text("success_url"), cancelUrl: text("cancel_url"), notifyUrl: text("notify_url"),
  pkLive: text("pk_live").unique(), skLive: text("sk_live").unique(), hpLive: text("hp_live").unique(), hpLiveHash: text("hp_live_hash").unique(), createdAt: dt("created_at"), updatedAt: dt("updated_at"),
});
export const hostedPaymentSessions = mysqlTable("hosted_payment_sessions", {
  id: text("id").primaryKey(), merchantId: varchar("merchant_id", { length: 191 }).notNull(), amount: money("amount").notNull(), currency: text("currency").notNull(),
  description: text("description"), status: text("status").default("pending").notNull(), transactionId: varchar("transaction_id", { length: 191 }), notifyUrl: text("notify_url"),
  createdAt: dt("created_at"), expiresAt: timestamp("expires_at"),
});

// Public constants are shared business policy, not database-specific policy.
export {
  SUPPORTED_CURRENCIES, COUNTRY_CURRENCIES, EXCHANGE_RATES, ALL_FX_CURRENCIES, CURRENCY_SYMBOLS,
  PAYMENT_GATEWAYS, PAYMENT_PROVIDERS, SOLEAPAY_COUNTRIES, MOBILE_OPERATORS, CURRENCY_ZONE,
  KYC_DOCUMENT_TYPES, BUSINESS_CATEGORIES,
} from "./schema";
export type { SupportedCurrency, FxCurrency } from "./schema";

// Keep the insert-schema API compatible.  Tables above are deliberately
// structurally typed as Drizzle tables, so drizzle-zod can infer their fields.
const insert = (table: any) => createInsertSchema(table);
export const insertUserSchema = insert(users);
export const insertTransactionSchema = insert(transactions);
export const insertPaymentLinkSchema = insert(paymentLinks);
export const insertPaymentIntentSchema = insert(paymentIntents);
export const insertCountrySchema = insert(countries);
export const insertOperatorSchema = insert(operators);
export const insertFeeSchema = insert(fees);
export const insertSupportTicketSchema = insert(supportTickets);
export const insertTicketMessageSchema = insert(ticketMessages);
export const insertAdminLogSchema = insert(adminLogs);
export const insertPlatformSettingSchema = insert(platformSettings);
export const insertAuditLogSchema = insert(auditLogs);
export const insertPushSubscriptionSchema = insert(pushSubscriptions);
export const insertWithdrawalNumberSchema = insert(withdrawalNumbers);
export const insertWithdrawalNumberChangeSchema = insert(withdrawalNumberChanges);
export const insertUserNotificationSchema = insert(userNotifications);
export const insertGlobalMessageSchema = insert(globalMessages);
export const insertKycSubmissionSchema = insert(kycSubmissions);
export const insertWalletSchema = insert(wallets);
export const insertConversionRequestSchema = insert(conversionRequests);
export const insertAutoConversionRuleSchema = insert(autoConversionRules);
export const loginSchema = z.object({ identifier: z.string().min(1), password: z.string().min(8) });
export const registerSchema = insertUserSchema;
export const transferSchema = z.object({ recipientUsername: z.string(), amount: z.string(), description: z.string().optional() });
export const depositSchema = z.object({ amount: z.string(), paymentMethod: z.enum(["mobile_money", "crypto"]) });
export const withdrawSchema = z.object({ amount: z.string(), paymentMethod: z.enum(["mobile_money", "bank_transfer"]), accountDetails: z.string(), countryId: z.string(), operatorId: z.string() });
export const createPaymentLinkSchema = z.object({ title: z.string(), amount: z.string().optional(), isFixedAmount: z.boolean().default(true) });
export const publicPaymentSchema = z.object({ fullName: z.string(), email: z.string().email(), country: z.string(), phone: z.string(), amount: z.string().optional(), paymentMethod: z.enum(["mobile_money", "card", "paypal"]), operator: z.string().optional() });
export const forgotPasswordSchema = z.object({ identifier: z.string().min(1) });
export const resetPasswordSchema = z.object({ token: z.string(), password: z.string().min(8), confirmPassword: z.string().min(8) });

export type User = typeof users.$inferSelect; export type InsertUser = z.infer<typeof insertUserSchema>;
export type Transaction = typeof transactions.$inferSelect; export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type PaymentLink = typeof paymentLinks.$inferSelect; export type InsertPaymentLink = z.infer<typeof insertPaymentLinkSchema>;
export type PaymentIntent = typeof paymentIntents.$inferSelect; export type InsertPaymentIntent = z.infer<typeof insertPaymentIntentSchema>;
export type Country = typeof countries.$inferSelect; export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type Operator = typeof operators.$inferSelect; export type InsertOperator = z.infer<typeof insertOperatorSchema>;
export type Fee = typeof fees.$inferSelect; export type InsertFee = z.infer<typeof insertFeeSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect; export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type TicketMessage = typeof ticketMessages.$inferSelect; export type InsertTicketMessage = z.infer<typeof insertTicketMessageSchema>;
export type AdminLog = typeof adminLogs.$inferSelect; export type InsertAdminLog = z.infer<typeof insertAdminLogSchema>;
export type PlatformSetting = typeof platformSettings.$inferSelect; export type InsertPlatformSetting = z.infer<typeof insertPlatformSettingSchema>;
export type WithdrawalNumber = typeof withdrawalNumbers.$inferSelect; export type InsertWithdrawalNumber = z.infer<typeof insertWithdrawalNumberSchema>;
export type WithdrawalNumberChange = typeof withdrawalNumberChanges.$inferSelect; export type InsertWithdrawalNumberChange = z.infer<typeof insertWithdrawalNumberChangeSchema>;
export type AuditLog = typeof auditLogs.$inferSelect; export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect; export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type UserNotification = typeof userNotifications.$inferSelect; export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;
export type GlobalMessage = typeof globalMessages.$inferSelect; export type InsertGlobalMessage = z.infer<typeof insertGlobalMessageSchema>;
export type KycSubmission = typeof kycSubmissions.$inferSelect; export type InsertKycSubmission = z.infer<typeof insertKycSubmissionSchema>;
export type ConversionRequest = typeof conversionRequests.$inferSelect; export type InsertConversionRequest = z.infer<typeof insertConversionRequestSchema>;
export type AutoConversionRule = typeof autoConversionRules.$inferSelect; export type InsertAutoConversionRule = z.infer<typeof insertAutoConversionRuleSchema>;
export type Wallet = typeof wallets.$inferSelect; export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type HostedPageConfig = typeof hostedPageConfigs.$inferSelect; export type HostedPaymentSession = typeof hostedPaymentSessions.$inferSelect;