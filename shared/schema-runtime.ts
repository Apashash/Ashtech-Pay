/**
 * Server-side schema selector.
 *
 * The PostgreSQL schema remains the default. Setting DB_DIALECT=mysql makes
 * server modules use the isolated MySQL table objects without making the
 * browser bundle import node:crypto or changing the existing PostgreSQL
 * schema used by migrations and rollback.
 */
import * as pg from "./schema";
import * as mysql from "./schema.mysql";

const active = process.env.DB_DIALECT?.toLowerCase() === "mysql" ? mysql : pg;

export const users = active.users as typeof pg.users;
export const transactions = active.transactions as typeof pg.transactions;
export const paymentLinks = active.paymentLinks as typeof pg.paymentLinks;
export const paymentIntents = active.paymentIntents as typeof pg.paymentIntents;
export const countries = active.countries as typeof pg.countries;
export const operators = active.operators as typeof pg.operators;
export const fees = active.fees as typeof pg.fees;
export const supportTickets = active.supportTickets as typeof pg.supportTickets;
export const ticketMessages = active.ticketMessages as typeof pg.ticketMessages;
export const adminLogs = active.adminLogs as typeof pg.adminLogs;
export const platformSettings = active.platformSettings as typeof pg.platformSettings;
export const withdrawalNumbers = active.withdrawalNumbers as typeof pg.withdrawalNumbers;
export const withdrawalNumberChanges = active.withdrawalNumberChanges as typeof pg.withdrawalNumberChanges;
export const auditLogs = active.auditLogs as typeof pg.auditLogs;
export const userNotifications = active.userNotifications as typeof pg.userNotifications;
export const pushSubscriptions = active.pushSubscriptions as typeof pg.pushSubscriptions;
export const globalMessages = active.globalMessages as typeof pg.globalMessages;
export const dismissedGlobalMessages = active.dismissedGlobalMessages as typeof pg.dismissedGlobalMessages;
export const kycSubmissions = active.kycSubmissions as typeof pg.kycSubmissions;
export const kycDocuments = active.kycDocuments as typeof pg.kycDocuments;
export const wallets = active.wallets as typeof pg.wallets;
export const conversionRequests = active.conversionRequests as typeof pg.conversionRequests;
export const autoConversionRules = active.autoConversionRules as typeof pg.autoConversionRules;
export const hostedPageConfigs = active.hostedPageConfigs as typeof pg.hostedPageConfigs;
export const hostedPageKeys = active.hostedPageKeys as typeof pg.hostedPageKeys;
export const hostedPaymentSessions = active.hostedPaymentSessions as typeof pg.hostedPaymentSessions;
export type HostedPageKey = pg.HostedPageKey;

// Validation schemas are dialect-neutral. Keeping their PostgreSQL-derived
// types avoids a union of two otherwise identical Zod object types in callers.
export const insertUserSchema = pg.insertUserSchema;
export const insertTransactionSchema = pg.insertTransactionSchema;
export const insertPaymentLinkSchema = pg.insertPaymentLinkSchema;
export const insertPaymentIntentSchema = pg.insertPaymentIntentSchema;
export const insertCountrySchema = pg.insertCountrySchema;
export const insertOperatorSchema = pg.insertOperatorSchema;
export const insertFeeSchema = pg.insertFeeSchema;
export const insertSupportTicketSchema = pg.insertSupportTicketSchema;
export const insertTicketMessageSchema = pg.insertTicketMessageSchema;
export const insertAdminLogSchema = pg.insertAdminLogSchema;
export const insertPlatformSettingSchema = pg.insertPlatformSettingSchema;
export const insertAuditLogSchema = pg.insertAuditLogSchema;
export const insertPushSubscriptionSchema = pg.insertPushSubscriptionSchema;
export const insertWithdrawalNumberSchema = pg.insertWithdrawalNumberSchema;
export const insertWithdrawalNumberChangeSchema = pg.insertWithdrawalNumberChangeSchema;
export const insertUserNotificationSchema = pg.insertUserNotificationSchema;
export const insertGlobalMessageSchema = pg.insertGlobalMessageSchema;
export const insertKycSubmissionSchema = pg.insertKycSubmissionSchema;
export const insertWalletSchema = pg.insertWalletSchema;
export const insertConversionRequestSchema = pg.insertConversionRequestSchema;
export const insertAutoConversionRuleSchema = pg.insertAutoConversionRuleSchema;
export const loginSchema = pg.loginSchema;
export const registerSchema = pg.registerSchema;
export const transferSchema = pg.transferSchema;
export const depositSchema = pg.depositSchema;
export const withdrawSchema = pg.withdrawSchema;
export const createPaymentLinkSchema = pg.createPaymentLinkSchema;
export const publicPaymentSchema = pg.publicPaymentSchema;
export const forgotPasswordSchema = pg.forgotPasswordSchema;
export const resetPasswordSchema = pg.resetPasswordSchema;

export const ALL_FX_CURRENCIES = pg.ALL_FX_CURRENCIES;
export const SUPPORTED_CURRENCIES = pg.SUPPORTED_CURRENCIES;
export const COUNTRY_CURRENCIES = pg.COUNTRY_CURRENCIES;
export const EXCHANGE_RATES = pg.EXCHANGE_RATES;
export const CURRENCY_SYMBOLS = pg.CURRENCY_SYMBOLS;
export const PAYMENT_GATEWAYS = pg.PAYMENT_GATEWAYS;
export const PAYMENT_PROVIDERS = pg.PAYMENT_PROVIDERS;
export const SOLEAPAY_COUNTRIES = pg.SOLEAPAY_COUNTRIES;
export const MOBILE_OPERATORS = pg.MOBILE_OPERATORS;
export const CURRENCY_ZONE = pg.CURRENCY_ZONE;

export type User = pg.User;
export type InsertUser = pg.InsertUser;
export type Transaction = pg.Transaction;
export type InsertTransaction = pg.InsertTransaction;
export type PaymentLink = pg.PaymentLink;
export type InsertPaymentLink = pg.InsertPaymentLink;
export type PaymentIntent = pg.PaymentIntent;
export type InsertPaymentIntent = pg.InsertPaymentIntent;
export type Country = pg.Country;
export type InsertCountry = pg.InsertCountry;
export type Operator = pg.Operator;
export type InsertOperator = pg.InsertOperator;
export type Fee = pg.Fee;
export type InsertFee = pg.InsertFee;
export type SupportTicket = pg.SupportTicket;
export type InsertSupportTicket = pg.InsertSupportTicket;
export type TicketMessage = pg.TicketMessage;
export type InsertTicketMessage = pg.InsertTicketMessage;
export type AdminLog = pg.AdminLog;
export type InsertAdminLog = pg.InsertAdminLog;
export type PlatformSetting = pg.PlatformSetting;
export type InsertPlatformSetting = pg.InsertPlatformSetting;
export type WithdrawalNumber = pg.WithdrawalNumber;
export type InsertWithdrawalNumber = pg.InsertWithdrawalNumber;
export type WithdrawalNumberChange = pg.WithdrawalNumberChange;
export type InsertWithdrawalNumberChange = pg.InsertWithdrawalNumberChange;
export type AuditLog = pg.AuditLog;
export type InsertAuditLog = pg.InsertAuditLog;
export type PushSubscription = pg.PushSubscription;
export type InsertPushSubscription = pg.InsertPushSubscription;
export type UserNotification = pg.UserNotification;
export type InsertUserNotification = pg.InsertUserNotification;
export type GlobalMessage = pg.GlobalMessage;
export type InsertGlobalMessage = pg.InsertGlobalMessage;
export type KycSubmission = pg.KycSubmission;
export type InsertKycSubmission = pg.InsertKycSubmission;
export type Wallet = pg.Wallet;
export type ConversionRequest = pg.ConversionRequest;
export type InsertConversionRequest = pg.InsertConversionRequest;
export type AutoConversionRule = pg.AutoConversionRule;
export type InsertAutoConversionRule = pg.InsertAutoConversionRule;
export type HostedPageConfig = pg.HostedPageConfig;
export type HostedPaymentSession = pg.HostedPaymentSession;
export type SupportedCurrency = pg.SupportedCurrency;
export type FxCurrency = pg.FxCurrency;