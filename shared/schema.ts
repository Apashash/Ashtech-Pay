import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  country: text("country").default("Cameroon"),
  preferredCurrency: text("preferred_currency").default("XAF").notNull(),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  isVerified: boolean("is_verified").default(false),
  kycStatus: text("kyc_status").default("not_submitted").notNull(), // 'not_submitted', 'pending', 'verified', 'rejected'
  isBanned: boolean("is_banned").default(false),
  banReason: text("ban_reason"),
  role: text("role").default("user").notNull(), // 'user', 'admin', 'support', 'finance'
  lastLoginAt: timestamp("last_login_at"),
  lastSeenAt: timestamp("last_seen_at"),
  resetToken: text("reset_token"),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const SUPPORTED_CURRENCIES = [
  "XAF",  // Cameroun, Centrafrique, Guinée Équatoriale, Tchad
  "XAFC", // Congo Brazzaville
  "XAFG", // Gabon
  "XOF",  // Mali, Niger, Guinée-Bissau
  "XOFB", // Bénin
  "XOFC", // Côte d'Ivoire
  "XOFF", // Burkina Faso
  "XOFS", // Sénégal
  "XOFT", // Togo
  "CDF",  // RD Congo
  "GHS",  // Ghana
  "GNF",  // Guinée Conakry
  "KES",  // Kenya
  "NGN",  // Nigeria
  "RWF",  // Rwanda
  "TZS",  // Tanzanie
  "UGX",  // Ouganda
  "INR",  // Inde
  "USD",  // USA
] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

export const COUNTRY_CURRENCIES: Record<string, SupportedCurrency> = {
  "Cameroun": "XAF",
  "Cameroon": "XAF",
  "Centrafrique": "XAF",
  "Central African Republic": "XAF",
  "Guinée équatoriale": "XAF",
  "Equatorial Guinea": "XAF",
  "Tchad": "XAF",
  "Chad": "XAF",
  "Congo": "XAFC",
  "Congo Brazzaville": "XAFC",
  "Republic of the Congo": "XAFC",
  "Gabon": "XAFG",
  "RD Congo": "CDF",
  "Congo DRC": "CDF",
  "Sénégal": "XOFS",
  "Senegal": "XOFS",
  "Côte d'Ivoire": "XOFC",
  "Mali": "XOF",
  "Burkina Faso": "XOFF",
  "Niger": "XOFN",
  "Togo": "XOFT",
  "Bénin": "XOFB",
  "Benin": "XOFB",
  "Guinée-Bissau": "XOF",
  "Guinea-Bissau": "XOF",
  "Nigeria": "NGN",
  "Nigéria": "NGN",
  "Ghana": "GHS",
  "Kenya": "KES",
  "Rwanda": "RWF",
  "Tanzania": "TZS",
  "Tanzanie": "TZS",
  "Uganda": "UGX",
  "Ouganda": "UGX",
  "Guinée Conakry": "GNF",
  "Guinea": "GNF",
  "India": "INR",
  "Inde": "INR",
  "United States": "USD",
  "USA": "USD",
};

export const EXCHANGE_RATES: Record<SupportedCurrency, number> = {
  "XAF":  1,
  "XAFC": 1,
  "XAFG": 1,
  "XOF":  1,
  "XOFB": 1,
  "XOFC": 1,
  "XOFF": 1,
  "XOFS": 1,
  "XOFT": 1,
  "CDF":  0.27,
  "GHS":  0.057,
  "GNF":  0.0076,
  "KES":  0.052,
  "NGN":  0.44,
  "RWF":  0.00066,
  "TZS":  0.026,
  "UGX":  0.0019,
  "INR":  0.0083,
  "USD":  0.00165,
};

export interface FxCurrency {
  code: string;
  name: string;
  defaultRate: number;
}

export const ALL_FX_CURRENCIES: FxCurrency[] = [
  { code: "USD", name: "US Dollar", defaultRate: 1.00 },
  { code: "EUR", name: "Euro Zone", defaultRate: 0.94 },
  { code: "GBP", name: "Great British Pounds", defaultRate: 0.82 },
  { code: "XAF", name: "Central African CFA Franc BEAC", defaultRate: 585.00 },
  { code: "XOF", name: "West African CFA Franc", defaultRate: 585.00 },
  { code: "XOFC", name: "Côte d'Ivoire (XOF)", defaultRate: 585.00 },
  { code: "XOFF", name: "Burkina Faso (XOF)", defaultRate: 585.00 },
  { code: "XOFN", name: "Niger (XOF)", defaultRate: 585.00 },
  { code: "XOFB", name: "Bénin (XOF)", defaultRate: 585.00 },
  { code: "XOFT", name: "Togo (XOF)", defaultRate: 585.00 },
  { code: "XOFS", name: "Sénégal (XOF)", defaultRate: 702.00 },
  { code: "XOFM", name: "Mali (XOF)", defaultRate: 585.00 },
  { code: "XAFC", name: "Congo Brazzaville (XAF)", defaultRate: 585.00 },
  { code: "XAFG", name: "Gabon (XAF)", defaultRate: 585.00 },
  { code: "NGN", name: "Nigerian Naira", defaultRate: 1356.00 },
  { code: "GHS", name: "Ghanaian Cedi", defaultRate: 12.40 },
  { code: "KES", name: "Kenyan Shilling", defaultRate: 132.00 },
  { code: "RWF", name: "Rwandan Franc", defaultRate: 1480.00 },
  { code: "TZS", name: "Tanzanian Shilling", defaultRate: 2650.00 },
  { code: "UGX", name: "Ugandan Shilling", defaultRate: 3600.00 },
  { code: "CDF", name: "Congolese Franc", defaultRate: 2500.00 },
];

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  "XAF":  "FCFA",
  "XAFC": "FCFA",
  "XAFG": "FCFA",
  "XOF":  "FCFA",
  "XOFB": "FCFA",
  "XOFC": "FCFA",
  "XOFF": "FCFA",
  "XOFS": "FCFA",
  "XOFT": "FCFA",
  "CDF":  "FC",
  "GHS":  "₵",
  "GNF":  "GNF",
  "KES":  "KSh",
  "NGN":  "₦",
  "RWF":  "RWF",
  "TZS":  "TZS",
  "UGX":  "UGX",
  "INR":  "₹",
  "USD":  "$",
};

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'payment_link'
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").default("XAF").notNull(),
  status: text("status").default("pending").notNull(), // 'pending', 'completed', 'failed', 'cancelled'
  description: text("description"),
  recipientId: varchar("recipient_id"),
  recipientName: text("recipient_name"),
  recipientPhone: text("recipient_phone"),
  recipientCountry: text("recipient_country"),
  operatorId: varchar("operator_id"),
  feeAmount: decimal("fee_amount", { precision: 15, scale: 2 }),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }),
  paymentMethod: text("payment_method"), // 'mobile_money', 'crypto', 'bank_transfer'
  reference: text("reference"),
  paymentLinkId: varchar("payment_link_id"),
  paymentIntentId: varchar("payment_intent_id"),
  payerName: text("payer_name"),
  payerEmail: text("payer_email"),
  externalReference: text("external_reference"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const paymentLinks = pgTable("payment_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  currency: text("currency").default("XAF").notNull(),
  slug: text("slug").notNull().unique(),
  isActive: boolean("is_active").default(true),
  isFixedAmount: boolean("is_fixed_amount").default(true),
  imagePath: text("image_path"),
  pdfPath: text("pdf_path"),
  hasPdfDelivery: boolean("has_pdf_delivery").default(false),
  redirectUrl: text("redirect_url"),
  expiresAt: timestamp("expires_at"),
  clickCount: integer("click_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment intents for public payment submissions (pending until verified)
export const paymentIntents = pgTable("payment_intents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  paymentLinkId: varchar("payment_link_id").notNull().references(() => paymentLinks.id),
  merchantId: varchar("merchant_id").notNull().references(() => users.id),
  payerName: text("payer_name").notNull(),
  payerEmail: text("payer_email").notNull(),
  payerPhone: text("payer_phone").notNull(),
  payerCountry: text("payer_country").notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  feeAmount: decimal("fee_amount", { precision: 15, scale: 2 }).default("0"),
  currency: text("currency").default("XAF").notNull(),
  paymentMethod: text("payment_method").notNull(), // 'mobile_money', 'card', 'paypal'
  operator: text("operator"), // For mobile money
  status: text("status").default("pending").notNull(), // 'pending', 'processing', 'completed', 'failed'
  reference: text("reference").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin: Countries table
export const countries = pgTable("countries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(), // ISO code
  flag: text("flag").default("🌍").notNull(), // Emoji flag
  dialCode: text("dial_code").default("+1").notNull(), // Phone dial code
  currency: text("currency").default("XAF").notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 15, scale: 4 }).default("1").notNull(), // Rate to XAF
  isActive: boolean("is_active").default(true),
  isActiveForRegistration: boolean("is_active_for_registration").default(true),
  isActiveForDeposit: boolean("is_active_for_deposit").default(true),
  isActiveForTransfer: boolean("is_active_for_transfer").default(true),
  isActiveForWithdrawal: boolean("is_active_for_withdrawal").default(true),
  minDeposit: decimal("min_deposit", { precision: 15, scale: 2 }).default("100").notNull(),
  maxDeposit: decimal("max_deposit", { precision: 15, scale: 2 }).default("5000000").notNull(),
  minWithdrawal: decimal("min_withdrawal", { precision: 15, scale: 2 }).default("500").notNull(),
  maxWithdrawal: decimal("max_withdrawal", { precision: 15, scale: 2 }).default("2000000").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin: Operators table
export const operators = pgTable("operators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'mobile_money', 'bank', 'crypto'
  countryId: varchar("country_id").notNull().references(() => countries.id),
  gateway: text("gateway").default("soleapay").notNull(), // 'soleapay', 'winipay'
  isActive: boolean("is_active").default(true),
  isInMaintenance: boolean("is_in_maintenance").default(false),
  dailyLimit: decimal("daily_limit", { precision: 15, scale: 2 }).default("1000000").notNull(),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment gateways
export const PAYMENT_GATEWAYS = ["soleapay", "winipay"] as const;
export type PaymentGateway = typeof PAYMENT_GATEWAYS[number];

// Countries that use SoleaPay by default (Bénin, Cameroun, Côte d'Ivoire, Togo)
export const SOLEAPAY_COUNTRIES = ["BJ", "CM", "CI", "TG"] as const;

// Admin: Fees/Commissions table
export const fees = pgTable("fees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  transactionType: text("transaction_type").notNull(), // 'deposit', 'withdrawal', 'transfer'
  feeType: text("fee_type").notNull(), // 'percentage', 'fixed'
  feeValue: decimal("fee_value", { precision: 10, scale: 4 }).notNull(),
  swychrFee: decimal("swychr_fee", { precision: 10, scale: 4 }).default("0"),
  ashtechMargin: decimal("ashtech_margin", { precision: 10, scale: 4 }).default("0"),
  minFee: decimal("min_fee", { precision: 15, scale: 2 }),
  maxFee: decimal("max_fee", { precision: 15, scale: 2 }),
  countryId: varchar("country_id").references(() => countries.id), // null = global
  operatorId: varchar("operator_id").references(() => operators.id), // null = all operators
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin: Support tickets
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  status: text("status").default("open").notNull(), // 'open', 'in_progress', 'resolved', 'closed'
  priority: text("priority").default("medium").notNull(), // 'low', 'medium', 'high', 'urgent'
  assignedTo: varchar("assigned_to").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Admin: Ticket messages
export const ticketMessages = pgTable("ticket_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isAdmin: boolean("is_admin").default(false),
  readByAdmin: boolean("read_by_admin").default(false),
  readByUser: boolean("read_by_user").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin: Activity logs
export const adminLogs = pgTable("admin_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  targetType: text("target_type"), // 'user', 'transaction', 'fee', 'operator', etc.
  targetId: varchar("target_id"),
  details: text("details"), // JSON string with details
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Admin: Platform settings
export const platformSettings = pgTable("platform_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User withdrawal numbers (max 2 per user)
export const withdrawalNumbers = pgTable("withdrawal_numbers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  phoneNumber: text("phone_number").notNull(),
  operatorName: text("operator_name").notNull(),
  label: text("label"), // e.g. "Principal", "Secondaire"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Pending changes to withdrawal numbers (needs admin approval)
export const withdrawalNumberChanges = pgTable("withdrawal_number_changes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  withdrawalNumberId: varchar("withdrawal_number_id").references(() => withdrawalNumbers.id), // null for new numbers
  action: text("action").notNull(), // 'add', 'update', 'delete'
  newPhoneNumber: text("new_phone_number"),
  newOperatorName: text("new_operator_name"),
  newLabel: text("new_label"),
  status: text("status").default("pending").notNull(), // 'pending', 'approved', 'rejected'
  adminId: varchar("admin_id").references(() => users.id),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
  processedAt: timestamp("processed_at"),
});

// Mobile Money operators by country
export const MOBILE_OPERATORS: Record<string, string[]> = {
  "Cameroon": ["MTN Mobile Money", "Orange Money"],
  "Senegal": ["Orange Money", "Wave", "Free Money"],
  "Côte d'Ivoire": ["Orange Money", "MTN Mobile Money", "Moov Money", "Wave"],
  "Mali": ["Orange Money", "Moov Money"],
  "Burkina Faso": ["Orange Money", "Moov Money"],
  "Benin": ["MTN Mobile Money", "Moov Money"],
  "Togo": ["Flooz (Moov)", "T-Money"],
  "Niger": ["Airtel Money", "Orange Money"],
  "Guinea-Bissau": ["Orange Money"],
  "Chad": ["Airtel Money", "Moov Money"],
  "Central African Republic": ["Orange Money"],
  "Republic of the Congo": ["MTN Mobile Money", "Airtel Money"],
  "Gabon": ["Airtel Money", "Moov Money"],
  "Equatorial Guinea": ["Orange Money"],
  "Nigeria": ["OPay", "PalmPay", "Paga"],
  "Ghana": ["MTN Mobile Money", "Vodafone Cash", "AirtelTigo Money"],
  "Kenya": ["M-Pesa", "Airtel Money"],
  "Rwanda": ["MTN Mobile Money", "Airtel Money"],
};

// User schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  fullName: true,
  phone: true,
  country: true,
  preferredCurrency: true,
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Email ou numéro de téléphone requis"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
});

export const registerSchema = insertUserSchema.extend({
  email: z.string().email("Email invalide"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  fullName: z.string().min(2, "Le nom complet est requis"),
  username: z.string().min(3, "Le nom d'utilisateur doit contenir au moins 3 caractères"),
});

// Transaction schemas
export const insertTransactionSchema = createInsertSchema(transactions).pick({
  userId: true,
  type: true,
  amount: true,
  currency: true,
  status: true,
  description: true,
  recipientId: true,
  recipientName: true,
  recipientPhone: true,
  recipientCountry: true,
  operatorId: true,
  paymentMethod: true,
  reference: true,
  paymentLinkId: true,
  paymentIntentId: true,
  payerName: true,
  payerEmail: true,
  feeAmount: true,
  totalAmount: true,
});

export const transferSchema = z.object({
  recipientUsername: z.string().min(1, "Le destinataire est requis"),
  amount: z.string().refine((val) => parseFloat(val) > 0, "Le montant doit être positif"),
  description: z.string().optional(),
});

export const depositSchema = z.object({
  amount: z.string().refine((val) => parseFloat(val) > 0, "Le montant doit être positif"),
  paymentMethod: z.enum(["mobile_money", "crypto"]),
  countryId: z.string().optional(),
  operatorId: z.string().optional(),
  phoneNumber: z.string().optional(),
  description: z.string().optional(),
});

export const withdrawSchema = z.object({
  amount: z.string().refine((val) => {
    const n = parseFloat(val);
    return !isNaN(n) && n >= 1000;
  }, "Le montant minimum est de 1 000 XAF"),
  paymentMethod: z.enum(["mobile_money", "bank_transfer"]),
  accountDetails: z.string().min(1, "Les détails du compte sont requis"),
  countryId: z.string().min(1, "Le pays est requis"),
  operatorId: z.string().min(1, "L'opérateur est requis"),
});

// Payment link schemas
export const insertPaymentLinkSchema = createInsertSchema(paymentLinks).pick({
  userId: true,
  title: true,
  description: true,
  amount: true,
  currency: true,
  isFixedAmount: true,
  imagePath: true,
  pdfPath: true,
  hasPdfDelivery: true,
  redirectUrl: true,
  expiresAt: true,
});

export const createPaymentLinkSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  amount: z.string().default("0"),
  customSlug: z.string().optional(),
  isFixedAmount: z.boolean().default(true),
  imagePath: z.string().optional(),
  pdfPath: z.string().optional(),
  hasPdfDelivery: z.boolean().default(false),
  redirectUrl: z.string().optional(),
  expiresAt: z.string().optional(),
}).refine((data) => {
  if (data.isFixedAmount) {
    return data.amount && parseFloat(data.amount) > 0;
  }
  return true;
}, {
  message: "Le montant est requis pour un lien à montant fixe",
  path: ["amount"],
});

// Payment intent schemas
export const insertPaymentIntentSchema = createInsertSchema(paymentIntents).pick({
  paymentLinkId: true,
  merchantId: true,
  payerName: true,
  payerEmail: true,
  payerPhone: true,
  payerCountry: true,
  amount: true,
  feeAmount: true,
  currency: true,
  paymentMethod: true,
  operator: true,
  reference: true,
});

export const publicPaymentSchema = z.object({
  fullName: z.string().min(2, "Le nom complet est requis"),
  email: z.string().email("Email invalide"),
  country: z.string().min(1, "Le pays est requis"),
  phone: z.string().min(6, "Numéro de téléphone invalide"),
  amount: z.string().optional(),
  paymentMethod: z.enum(["mobile_money", "card", "paypal"]),
  operator: z.string().optional(),
});

// Password reset schemas
export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Email ou numéro de téléphone requis"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token requis"),
  password: z.string().min(6, "Le mot de passe doit contenir au moins 6 caractères"),
  confirmPassword: z.string().min(6, "Confirmation requise"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});

// Admin schemas
export const insertCountrySchema = createInsertSchema(countries).omit({ id: true, createdAt: true });
export const insertOperatorSchema = createInsertSchema(operators).omit({ id: true, createdAt: true });
export const insertFeeSchema = createInsertSchema(fees).omit({ id: true, createdAt: true });
export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTicketMessageSchema = createInsertSchema(ticketMessages).omit({ id: true, createdAt: true });
export const insertAdminLogSchema = createInsertSchema(adminLogs).omit({ id: true, createdAt: true });
export const insertPlatformSettingSchema = createInsertSchema(platformSettings).omit({ id: true, updatedAt: true });

// User notifications table
export const userNotifications = pgTable("user_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'deposit_confirmed', 'withdrawal_confirmed', 'transfer_received', 'admin_message', 'global_message'
  title: text("title").notNull(),
  message: text("message").notNull(),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Global messages from admin
export const globalMessages = pgTable("global_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  adminId: varchar("admin_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Track which global messages users have dismissed
export const dismissedGlobalMessages = pgTable("dismissed_global_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  globalMessageId: varchar("global_message_id").notNull().references(() => globalMessages.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// KYC Submissions
export const kycSubmissions = pgTable("kyc_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  documentType: text("document_type").notNull(), // 'cni', 'cni_receipt', 'driver_license', 'residence_card', 'voter_card'
  documentNumber: text("document_number").notNull(),
  documentFrontPath: text("document_front_path").notNull(),
  documentBackPath: text("document_back_path").notNull(),
  selfiePath: text("selfie_path").notNull(),
  country: text("country"),
  city: text("city"),
  postalCode: text("postal_code"),
  businessType: text("business_type").notNull(), // 'physical' or 'online'
  businessCategory: text("business_category").notNull(),
  businessDescription: text("business_description").notNull(),
  status: text("status").default("pending").notNull(), // 'pending', 'approved', 'rejected'
  reviewerId: varchar("reviewer_id").references(() => users.id),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// KYC Document types
export const KYC_DOCUMENT_TYPES = [
  { id: "cni", name: "Carte Nationale d'Identité (CNI)" },
  { id: "cni_receipt", name: "Récépissé de CNI" },
  { id: "driver_license", name: "Permis de conduire" },
  { id: "residence_card", name: "Carte de séjour" },
  { id: "voter_card", name: "Carte électorale" },
] as const;

// Business types catalog (400+ types)
export const BUSINESS_CATEGORIES = [
  // Alimentation & Restauration
  { id: "restaurant", name: "Restaurant", type: "physical" },
  { id: "fast_food", name: "Fast Food", type: "physical" },
  { id: "boulangerie", name: "Boulangerie-Pâtisserie", type: "physical" },
  { id: "bar", name: "Bar / Pub", type: "physical" },
  { id: "cafe", name: "Café / Salon de thé", type: "physical" },
  { id: "traiteur", name: "Traiteur", type: "physical" },
  { id: "food_delivery", name: "Livraison de repas", type: "online" },
  { id: "epicerie", name: "Épicerie / Superette", type: "physical" },
  { id: "boucherie", name: "Boucherie", type: "physical" },
  { id: "poissonnerie", name: "Poissonnerie", type: "physical" },
  { id: "fruits_legumes", name: "Fruits et légumes", type: "physical" },
  
  // Commerce de détail
  { id: "vetements", name: "Vêtements et mode", type: "physical" },
  { id: "chaussures", name: "Chaussures", type: "physical" },
  { id: "bijouterie", name: "Bijouterie / Joaillerie", type: "physical" },
  { id: "accessoires_mode", name: "Accessoires de mode", type: "physical" },
  { id: "cosmetiques", name: "Cosmétiques et beauté", type: "physical" },
  { id: "parfumerie", name: "Parfumerie", type: "physical" },
  { id: "electronique", name: "Électronique / High-Tech", type: "physical" },
  { id: "telephonie", name: "Téléphonie mobile", type: "physical" },
  { id: "informatique", name: "Informatique", type: "physical" },
  { id: "electromenager", name: "Électroménager", type: "physical" },
  { id: "meubles", name: "Meubles et décoration", type: "physical" },
  { id: "quincaillerie", name: "Quincaillerie", type: "physical" },
  { id: "bricolage", name: "Bricolage / Outillage", type: "physical" },
  { id: "materiaux_construction", name: "Matériaux de construction", type: "physical" },
  { id: "papeterie", name: "Papeterie / Fournitures de bureau", type: "physical" },
  { id: "librairie", name: "Librairie", type: "physical" },
  { id: "jouets", name: "Jouets et jeux", type: "physical" },
  { id: "sport_equipement", name: "Équipement sportif", type: "physical" },
  { id: "pharmacie", name: "Pharmacie", type: "physical" },
  { id: "optique", name: "Optique / Lunetterie", type: "physical" },
  
  // E-commerce
  { id: "ecommerce_general", name: "E-commerce général", type: "online" },
  { id: "ecommerce_mode", name: "E-commerce mode", type: "online" },
  { id: "ecommerce_electronique", name: "E-commerce électronique", type: "online" },
  { id: "ecommerce_beaute", name: "E-commerce beauté", type: "online" },
  { id: "ecommerce_alimentation", name: "E-commerce alimentaire", type: "online" },
  { id: "marketplace", name: "Marketplace", type: "online" },
  { id: "dropshipping", name: "Dropshipping", type: "online" },
  { id: "affiliation", name: "Marketing d'affiliation", type: "online" },
  
  // Services professionnels
  { id: "comptabilite", name: "Comptabilité", type: "physical" },
  { id: "cabinet_avocat", name: "Cabinet d'avocat", type: "physical" },
  { id: "notaire", name: "Notaire", type: "physical" },
  { id: "huissier", name: "Huissier de justice", type: "physical" },
  { id: "cabinet_conseil", name: "Cabinet de conseil", type: "physical" },
  { id: "audit", name: "Audit et expertise", type: "physical" },
  { id: "ressources_humaines", name: "Ressources humaines", type: "physical" },
  { id: "traduction", name: "Traduction / Interprétariat", type: "physical" },
  { id: "architecture", name: "Architecture", type: "physical" },
  { id: "geometre", name: "Géomètre", type: "physical" },
  { id: "urbanisme", name: "Urbanisme", type: "physical" },
  
  // Services numériques
  { id: "developpement_web", name: "Développement web", type: "online" },
  { id: "developpement_mobile", name: "Développement mobile", type: "online" },
  { id: "design_graphique", name: "Design graphique", type: "online" },
  { id: "ui_ux_design", name: "UI/UX Design", type: "online" },
  { id: "marketing_digital", name: "Marketing digital", type: "online" },
  { id: "seo", name: "SEO / Référencement", type: "online" },
  { id: "community_management", name: "Community management", type: "online" },
  { id: "redaction_web", name: "Rédaction web", type: "online" },
  { id: "consulting_it", name: "Consulting IT", type: "online" },
  { id: "cloud_services", name: "Services cloud", type: "online" },
  { id: "cybersecurite", name: "Cybersécurité", type: "online" },
  { id: "data_analytics", name: "Data Analytics", type: "online" },
  { id: "intelligence_artificielle", name: "Intelligence artificielle", type: "online" },
  { id: "saas", name: "SaaS (Logiciel en ligne)", type: "online" },
  { id: "hebergement_web", name: "Hébergement web", type: "online" },
  
  // Santé et bien-être
  { id: "clinique", name: "Clinique / Centre médical", type: "physical" },
  { id: "cabinet_medical", name: "Cabinet médical", type: "physical" },
  { id: "dentiste", name: "Cabinet dentaire", type: "physical" },
  { id: "laboratoire_analyses", name: "Laboratoire d'analyses", type: "physical" },
  { id: "kinesitherapie", name: "Kinésithérapie", type: "physical" },
  { id: "osteopathie", name: "Ostéopathie", type: "physical" },
  { id: "psychologie", name: "Psychologie / Psychothérapie", type: "physical" },
  { id: "nutrition", name: "Nutrition / Diététique", type: "physical" },
  { id: "salon_coiffure", name: "Salon de coiffure", type: "physical" },
  { id: "salon_beaute", name: "Salon de beauté / Esthétique", type: "physical" },
  { id: "spa", name: "Spa / Centre de bien-être", type: "physical" },
  { id: "salle_sport", name: "Salle de sport / Fitness", type: "physical" },
  { id: "yoga", name: "Studio de yoga", type: "physical" },
  { id: "massage", name: "Salon de massage", type: "physical" },
  { id: "coach_sportif", name: "Coach sportif", type: "physical" },
  { id: "telemedicine", name: "Télémédecine", type: "online" },
  { id: "coaching_online", name: "Coaching en ligne", type: "online" },
  
  // Éducation et formation
  { id: "ecole_privee", name: "École privée", type: "physical" },
  { id: "centre_formation", name: "Centre de formation", type: "physical" },
  { id: "auto_ecole", name: "Auto-école", type: "physical" },
  { id: "cours_particuliers", name: "Cours particuliers", type: "physical" },
  { id: "ecole_langue", name: "École de langues", type: "physical" },
  { id: "creche", name: "Crèche / Garderie", type: "physical" },
  { id: "formation_en_ligne", name: "Formation en ligne", type: "online" },
  { id: "coaching_education", name: "Coaching éducatif", type: "online" },
  { id: "tutoring_online", name: "Tutorat en ligne", type: "online" },
  { id: "plateforme_elearning", name: "Plateforme e-learning", type: "online" },
  
  // Transport et logistique
  { id: "taxi", name: "Taxi / VTC", type: "physical" },
  { id: "transport_marchandises", name: "Transport de marchandises", type: "physical" },
  { id: "demenagement", name: "Déménagement", type: "physical" },
  { id: "coursier", name: "Coursier / Livraison express", type: "physical" },
  { id: "location_vehicules", name: "Location de véhicules", type: "physical" },
  { id: "agence_voyage", name: "Agence de voyage", type: "physical" },
  { id: "transit_douane", name: "Transit et douane", type: "physical" },
  { id: "logistique", name: "Logistique et entreposage", type: "physical" },
  { id: "plateforme_transport", name: "Plateforme de transport", type: "online" },
  { id: "reservation_voyage", name: "Réservation de voyages en ligne", type: "online" },
  
  // Immobilier
  { id: "agence_immobiliere", name: "Agence immobilière", type: "physical" },
  { id: "promotion_immobiliere", name: "Promotion immobilière", type: "physical" },
  { id: "gestion_locative", name: "Gestion locative", type: "physical" },
  { id: "construction", name: "Construction / BTP", type: "physical" },
  { id: "renovation", name: "Rénovation / Aménagement", type: "physical" },
  { id: "electricite", name: "Électricité", type: "physical" },
  { id: "plomberie", name: "Plomberie", type: "physical" },
  { id: "climatisation", name: "Climatisation / Froid", type: "physical" },
  { id: "peinture", name: "Peinture / Décoration", type: "physical" },
  { id: "menuiserie", name: "Menuiserie", type: "physical" },
  { id: "portail_immobilier", name: "Portail immobilier en ligne", type: "online" },
  
  // Événementiel et loisirs
  { id: "organisation_evenements", name: "Organisation d'événements", type: "physical" },
  { id: "decoration_evenements", name: "Décoration événementielle", type: "physical" },
  { id: "location_materiel", name: "Location de matériel événementiel", type: "physical" },
  { id: "traiteur_evenements", name: "Traiteur événementiel", type: "physical" },
  { id: "photographe", name: "Photographe", type: "physical" },
  { id: "videaste", name: "Vidéaste", type: "physical" },
  { id: "dj_animation", name: "DJ / Animation musicale", type: "physical" },
  { id: "salle_fetes", name: "Salle des fêtes", type: "physical" },
  { id: "hotel", name: "Hôtel / Hébergement", type: "physical" },
  { id: "airbnb", name: "Location courte durée", type: "physical" },
  { id: "cinema", name: "Cinéma", type: "physical" },
  { id: "theatre", name: "Théâtre / Spectacles", type: "physical" },
  { id: "parc_loisirs", name: "Parc de loisirs", type: "physical" },
  { id: "billetterie_en_ligne", name: "Billetterie en ligne", type: "online" },
  { id: "streaming_evenements", name: "Streaming d'événements", type: "online" },
  
  // Médias et communication
  { id: "agence_communication", name: "Agence de communication", type: "physical" },
  { id: "agence_publicite", name: "Agence de publicité", type: "physical" },
  { id: "imprimerie", name: "Imprimerie", type: "physical" },
  { id: "radio", name: "Radio", type: "physical" },
  { id: "television", name: "Télévision", type: "physical" },
  { id: "presse_ecrite", name: "Presse écrite", type: "physical" },
  { id: "production_audiovisuelle", name: "Production audiovisuelle", type: "physical" },
  { id: "media_en_ligne", name: "Média en ligne", type: "online" },
  { id: "podcast", name: "Podcast", type: "online" },
  { id: "youtube_creator", name: "Créateur YouTube", type: "online" },
  { id: "influenceur", name: "Influenceur", type: "online" },
  { id: "blog", name: "Blog", type: "online" },
  
  // Agriculture et élevage
  { id: "agriculture", name: "Agriculture", type: "physical" },
  { id: "elevage", name: "Élevage", type: "physical" },
  { id: "pisciculture", name: "Pisciculture", type: "physical" },
  { id: "aviculture", name: "Aviculture", type: "physical" },
  { id: "apiculture", name: "Apiculture", type: "physical" },
  { id: "pepiniere", name: "Pépinière", type: "physical" },
  { id: "agroalimentaire", name: "Agroalimentaire", type: "physical" },
  { id: "cooperative_agricole", name: "Coopérative agricole", type: "physical" },
  { id: "vente_produits_agricoles", name: "Vente de produits agricoles en ligne", type: "online" },
  
  // Industrie et fabrication
  { id: "usine", name: "Usine / Manufacture", type: "physical" },
  { id: "atelier_fabrication", name: "Atelier de fabrication", type: "physical" },
  { id: "textile", name: "Textile", type: "physical" },
  { id: "metallurgie", name: "Métallurgie", type: "physical" },
  { id: "chimie", name: "Industrie chimique", type: "physical" },
  { id: "plastique", name: "Plasturgie", type: "physical" },
  { id: "bois", name: "Industrie du bois", type: "physical" },
  { id: "emballage", name: "Emballage", type: "physical" },
  
  // Finance et assurance
  { id: "banque", name: "Banque", type: "physical" },
  { id: "microfinance", name: "Microfinance", type: "physical" },
  { id: "assurance", name: "Assurance", type: "physical" },
  { id: "courtier", name: "Courtier", type: "physical" },
  { id: "bureau_change", name: "Bureau de change", type: "physical" },
  { id: "transfert_argent", name: "Transfert d'argent", type: "physical" },
  { id: "fintech", name: "Fintech", type: "online" },
  { id: "crypto_trading", name: "Trading crypto", type: "online" },
  { id: "investissement_en_ligne", name: "Plateforme d'investissement", type: "online" },
  { id: "crowdfunding", name: "Crowdfunding", type: "online" },
  
  // Énergie et environnement
  { id: "energie_solaire", name: "Énergie solaire", type: "physical" },
  { id: "energie_eolienne", name: "Énergie éolienne", type: "physical" },
  { id: "distribution_gaz", name: "Distribution de gaz", type: "physical" },
  { id: "station_service", name: "Station-service", type: "physical" },
  { id: "recyclage", name: "Recyclage", type: "physical" },
  { id: "traitement_dechets", name: "Traitement des déchets", type: "physical" },
  { id: "eau_assainissement", name: "Eau et assainissement", type: "physical" },
  
  // Services à la personne
  { id: "aide_domicile", name: "Aide à domicile", type: "physical" },
  { id: "garde_enfants", name: "Garde d'enfants", type: "physical" },
  { id: "menage", name: "Ménage / Nettoyage", type: "physical" },
  { id: "jardinage", name: "Jardinage / Espaces verts", type: "physical" },
  { id: "gardiennage", name: "Gardiennage / Sécurité", type: "physical" },
  { id: "pressing", name: "Pressing / Blanchisserie", type: "physical" },
  { id: "couture", name: "Couture / Retouches", type: "physical" },
  { id: "reparation_electronique", name: "Réparation électronique", type: "physical" },
  { id: "reparation_electromenager", name: "Réparation électroménager", type: "physical" },
  { id: "serrurerie", name: "Serrurerie", type: "physical" },
  { id: "plateforme_services", name: "Plateforme de services à domicile", type: "online" },
  
  // Art et artisanat
  { id: "artisanat", name: "Artisanat", type: "physical" },
  { id: "galerie_art", name: "Galerie d'art", type: "physical" },
  { id: "atelier_artiste", name: "Atelier d'artiste", type: "physical" },
  { id: "poterie", name: "Poterie / Céramique", type: "physical" },
  { id: "sculpture", name: "Sculpture", type: "physical" },
  { id: "peinture_art", name: "Peinture artistique", type: "physical" },
  { id: "musique", name: "Musique / Studio d'enregistrement", type: "physical" },
  { id: "vente_art_en_ligne", name: "Vente d'art en ligne", type: "online" },
  { id: "nft_art", name: "NFT / Art numérique", type: "online" },
  
  // Télécommunications
  { id: "operateur_telecom", name: "Opérateur télécom", type: "physical" },
  { id: "cybercafe", name: "Cybercafé", type: "physical" },
  { id: "call_center", name: "Call center", type: "physical" },
  { id: "fournisseur_internet", name: "Fournisseur d'accès internet", type: "physical" },
  { id: "telecom_services", name: "Services télécom en ligne", type: "online" },
  
  // ONG et associations
  { id: "ong", name: "ONG", type: "physical" },
  { id: "association", name: "Association", type: "physical" },
  { id: "fondation", name: "Fondation", type: "physical" },
  { id: "cooperative", name: "Coopérative", type: "physical" },
  { id: "collecte_fonds_en_ligne", name: "Collecte de fonds en ligne", type: "online" },
  
  // Divers
  { id: "import_export", name: "Import-Export", type: "physical" },
  { id: "representation_commerciale", name: "Représentation commerciale", type: "physical" },
  { id: "franchise", name: "Franchise", type: "physical" },
  { id: "startup", name: "Startup", type: "physical" },
  { id: "incubateur", name: "Incubateur / Accélérateur", type: "physical" },
  { id: "coworking", name: "Espace de coworking", type: "physical" },
  { id: "service_client", name: "Service client externalisé", type: "online" },
  { id: "assistant_virtuel", name: "Assistant virtuel", type: "online" },
  { id: "autre_physique", name: "Autre (physique)", type: "physical" },
  { id: "autre_en_ligne", name: "Autre (en ligne)", type: "online" },
] as const;

// KYC schemas
export const insertKycSubmissionSchema = createInsertSchema(kycSubmissions).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  reviewerId: true,
  reviewNote: true,
  reviewedAt: true,
  status: true,
});

export const kycSubmissionFormSchema = z.object({
  documentType: z.string().min(1, "Type de document requis"),
  documentNumber: z.string().min(1, "Numéro du document requis"),
  documentFrontPath: z.string().min(1, "Photo avant du document requise"),
  documentBackPath: z.string().min(1, "Photo arrière du document requise"),
  selfiePath: z.string().min(1, "Selfie avec le document requis"),
  businessType: z.enum(["physical", "online"], { required_error: "Type de business requis" }),
  businessCategory: z.string().min(1, "Catégorie de business requise"),
  businessDescription: z.string().min(10, "Description du business requise (minimum 10 caractères)"),
});

// Withdrawal numbers schemas
export const insertWithdrawalNumberSchema = createInsertSchema(withdrawalNumbers).omit({ id: true, createdAt: true });
export const insertWithdrawalNumberChangeSchema = createInsertSchema(withdrawalNumberChanges).omit({ id: true, createdAt: true, processedAt: true });

// User notifications schemas
export const insertUserNotificationSchema = createInsertSchema(userNotifications).omit({ id: true, createdAt: true });
export const insertGlobalMessageSchema = createInsertSchema(globalMessages).omit({ id: true, createdAt: true });

export const addWithdrawalNumberSchema = z.object({
  phoneNumber: z.string().min(8, "Numéro de téléphone invalide"),
  operatorName: z.string().min(1, "Opérateur requis"),
  label: z.string().optional(),
});

export const updateWithdrawalNumberSchema = z.object({
  withdrawalNumberId: z.string().min(1, "ID requis"),
  phoneNumber: z.string().min(8, "Numéro de téléphone invalide"),
  operatorName: z.string().min(1, "Opérateur requis"),
  label: z.string().optional(),
});

// ─── User multi-currency wallets ─────────────────────────────────────────────
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  currency: text("currency").notNull(), // XOF, GHS, NGN, KES, CDF, etc.
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0.00").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertWalletSchema = createInsertSchema(wallets).omit({ id: true, updatedAt: true });
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;

// ─── Conversion requests (pending admin approval) ────────────────────────────
export const conversionRequests = pgTable("conversion_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  fromCurrency: text("from_currency").notNull(),
  toCurrency: text("to_currency").notNull(),
  fromAmount: decimal("from_amount", { precision: 15, scale: 2 }).notNull(),
  toAmount: decimal("to_amount", { precision: 15, scale: 2 }),
  status: text("status").default("pending").notNull(), // 'pending' | 'completed' | 'cancelled'
  notes: text("notes"),
  executedAt: timestamp("executed_at"),
  executedById: varchar("executed_by_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConversionRequestSchema = createInsertSchema(conversionRequests).omit({ id: true, createdAt: true });
export type ConversionRequest = typeof conversionRequests.$inferSelect;
export type InsertConversionRequest = z.infer<typeof insertConversionRequestSchema>;

// ─── Currency zones mapping ───────────────────────────────────────────────────
// Which wallet (currency) to use for each destination country
export const CURRENCY_ZONE: Record<string, SupportedCurrency> = {
  // XAF zone — Central Africa (stored in user.balance)
  CM: "XAF", CF: "XAF", CG: "XAF", GA: "XAF", GQ: "XAF", TD: "XAF",
  // XOF zone — West Africa
  BJ: "XOF", BF: "XOF", CI: "XOF", GW: "XOF", ML: "XOF", NE: "XOF", SN: "XOF", TG: "XOF",
  // Other countries
  GH: "GHS", NG: "NGN", KE: "KES", RW: "RWF", TZ: "TZS", UG: "UGX",
  CD: "CDF", GN: "GNF",
};

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertPaymentLink = z.infer<typeof insertPaymentLinkSchema>;
export type PaymentLink = typeof paymentLinks.$inferSelect;
export type InsertPaymentIntent = z.infer<typeof insertPaymentIntentSchema>;
export type PaymentIntent = typeof paymentIntents.$inferSelect;

// Admin types
export type Country = typeof countries.$inferSelect;
export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type Operator = typeof operators.$inferSelect;
export type InsertOperator = z.infer<typeof insertOperatorSchema>;
export type Fee = typeof fees.$inferSelect;
export type InsertFee = z.infer<typeof insertFeeSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type TicketMessage = typeof ticketMessages.$inferSelect;
export type InsertTicketMessage = z.infer<typeof insertTicketMessageSchema>;
export type AdminLog = typeof adminLogs.$inferSelect;
export type InsertAdminLog = z.infer<typeof insertAdminLogSchema>;
export type PlatformSetting = typeof platformSettings.$inferSelect;
export type InsertPlatformSetting = z.infer<typeof insertPlatformSettingSchema>;
export type WithdrawalNumber = typeof withdrawalNumbers.$inferSelect;
export type InsertWithdrawalNumber = z.infer<typeof insertWithdrawalNumberSchema>;
export type WithdrawalNumberChange = typeof withdrawalNumberChanges.$inferSelect;
export type InsertWithdrawalNumberChange = z.infer<typeof insertWithdrawalNumberChangeSchema>;
export type UserNotification = typeof userNotifications.$inferSelect;
export type InsertUserNotification = z.infer<typeof insertUserNotificationSchema>;
export type GlobalMessage = typeof globalMessages.$inferSelect;
export type InsertGlobalMessage = z.infer<typeof insertGlobalMessageSchema>;
export type KycSubmission = typeof kycSubmissions.$inferSelect;
export type InsertKycSubmission = z.infer<typeof insertKycSubmissionSchema>;
