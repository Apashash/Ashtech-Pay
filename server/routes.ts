import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  loginSchema, 
  registerSchema, 
  transferSchema, 
  depositSchema, 
  withdrawSchema, 
  createPaymentLinkSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  COUNTRY_CURRENCIES,
  SUPPORTED_CURRENCIES,
  CURRENCY_ZONE,
  CURRENCY_SYMBOLS,
  EXCHANGE_RATES,
  ALL_FX_CURRENCIES,
  type SupportedCurrency
} from "@shared/schema";
import crypto from "crypto";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import bcrypt from "bcrypt";
import multer from "multer";
import path from "path";
import fs from "fs";
import { uploadToSupabase, getSignedImageUrl, downloadFromSupabase } from "./supabase";
import { createSwychrPaymentLink, checkSwychrPaymentStatus, computeSwychrFees, fetchPaymentLinkDetails, ASHTECH_MARGIN } from "./swychr";
import { initiateAfribaPayin, initiateAfribaPayOtp, initiateAfribaPayout, checkAfribaPayStatus, computeAfribaPayFees, fetchAfribaPayCountries, parseAfribaPayWebhook, AFRIBAPAY_DEFAULT_MARGIN, isAfribaPayOtpRequired, getAfribaPayOtpInfo, confirmAfribaPayOtp } from "./afribapay";
import { initiatePixPayUssd, initiatePixPayOtp, initiatePixPayWave, initiatePixPayPayout, checkPixPayStatus, computePixPayFees, parsePixPayWebhook, PIXPAY_CURRENCY_MAP, PIXPAY_SUPPORTED_COUNTRIES, detectPixPayFlowType, getPixPayServiceId, PIXPAY_OTP_USSD_CODES } from "./pixpay";
import { addPendingPayment, removePendingPayment } from "./paymentPoller";
import { loadFxRates, convertFromXAF, convertToXAF, convertCurrency, creditUserWallet, cleanupEmptyWallets } from "./walletHelper";
import { createSwychrPayout, formatInternationalPhone, detectMethodFromPhone, fiatToPusd, pusdToFiatRate, getConversionRate, convertFiatToPusd, getPayoutToken, COUNTRY_CURRENCY } from "./swychrPayout";
import { addPendingPayout, removePendingPayout } from "./payoutPoller";
import { addSSEClient, removeSSEClient, setActiveTicket, isUserOnline, getOnlineUserIds, getAdminViewingTicket, getUserViewingTicket, notifyUser, notifyAdmins, broadcastOnlineStatus } from "./sse";
import {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendKycApprovedEmail,
  sendWithdrawalApprovedEmail,
  sendWithdrawalNumberApprovedEmail,
  sendAccountDeletedEmail,
} from "./email";

// ─── AfribaPay: country → ISO currency (authoritative, from AfribaPay API) ───
// Used to always send the correct ISO currency code regardless of DB value.
const AFRIBAPAY_ISO_CURRENCY: Record<string, string> = {
  BF: "XOF", BJ: "XOF", CD: "CDF", CF: "XAF", CG: "XAF",
  CI: "XOF", CM: "XAF", GA: "XAF", GM: "GMD", GN: "GNF",
  GW: "XOF", ML: "XOF", NE: "XOF", NG: "NGN", RW: "RWF",
  SN: "XOF", TD: "XAF", TG: "XOF", KE: "KES", TZ: "TZS",
  UG: "UGX", GH: "GHS",
};

// ─── AfribaPay: operator name → AfribaPay operator code ──────────────────────
// Fallback if afribapayOperatorCode is not set in DB.
const AFRIBAPAY_OPERATOR_CODE_MAP: Record<string, string> = {
  orange: "orange", mtn: "mtn", moov: "moov", wave: "wave",
  airtel: "airtel", free: "free", emoney: "emoney",
  ligdicash: "wligdicash", tmoney: "tmoney", celtiis: "celtiis",
  coris: "coris", mpesa: "mpesa", vodacom: "vodacom",
  afrimoney: "afrimoney", amanata: "amanata", nita: "nita",
  zamani: "zamani",
};

/** Resolve the AfribaPay operator code from the DB record or operator name. */
function resolveAfribaPayOperatorCode(operatorRecord: any, operatorName: string): string {
  if (operatorRecord?.afribapayOperatorCode) return operatorRecord.afribapayOperatorCode;
  const raw = operatorName.toLowerCase()
    .replace(/\s+money\b.*/i, "")
    .replace(/\s+/g, "")
    .trim();
  return AFRIBAPAY_OPERATOR_CODE_MAP[raw] || raw;
}

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: fileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Type de fichier non autorisé"));
    }
  },
});

const SessionStore = MemoryStore(session);

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

// Token-based auth store (for when cookies don't work in iframes)
const authTokens = new Map<string, { userId: string; expiresAt: Date }>();

function generateAuthToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function storeAuthToken(userId: string): string {
  const token = generateAuthToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  authTokens.set(token, { userId, expiresAt });
  return token;
}

function getUserIdFromToken(token: string): string | null {
  const data = authTokens.get(token);
  if (!data) return null;
  if (data.expiresAt < new Date()) {
    authTokens.delete(token);
    return null;
  }
  return data.userId;
}

function removeAuthToken(token: string): void {
  authTokens.delete(token);
}

// Extended request to include userId from token
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

// Middleware to extract userId from either session or Bearer token
function extractUserId(req: Request, _res: Response, next: NextFunction) {
  // First check session
  if (req.session?.userId) {
    req.userId = req.session.userId;
    return next();
  }
  
  // Then check Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const userId = getUserIdFromToken(token);
    if (userId) {
      req.userId = userId;
    }
  }
  next();
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    console.log("Auth failed - No userId. Session ID:", req.sessionID, "Cookies:", req.headers.cookie ? "present" : "none", "Auth header:", req.headers.authorization ? "present" : "none");
    return res.status(401).json({ message: "Non autorisé" });
  }
  next();
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ message: "Non autorisé" });
  }
  const user = await storage.getUser(req.userId);
  if (!user || !["admin", "support", "finance"].includes(user.role)) {
    return res.status(403).json({ message: "Accès refusé - Droits admin requis" });
  }
  next();
}

function generateSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate ASHPAY transaction reference
function generateTransactionReference(type: string): string {
  const prefix = "ASHPAY";
  const typeCode = type.toUpperCase().substring(0, 3); // DEP, WIT, TRA, PAY
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${typeCode}-${timestamp}-${random}`;
}

// loadFxRates, convertFromXAF, convertToXAF, creditUserWallet, cleanupEmptyWallets
// are imported from ./walletHelper

/**
 * Maps an operator name + country code to the exact payment_method ID
 * expected by the AccountPE /create_transaction endpoint.
 * Source: GET /payout_methods per country (verified 2026-03).
 */
function resolvePaymentMethod(operatorName: string, countryCode: string): string {
  const op = operatorName.toUpperCase();
  const cc = countryCode.toUpperCase();

  if (op.includes("MTN"))      return "MTN";
  if (op.includes("ORANGE"))   return "Orange";
  if (op.includes("MOOV") || op.includes("FLOOZ")) return "Moov";
  if (op.includes("WAVE"))     return "Wave";
  if (op.includes("TMONEY"))   return "Tmoney";
  if (op.includes("FREE"))     return "Free";
  if (op.includes("VODAFONE") || op.includes("TELECEL")) return cc === "GH" ? "Vodafone" : "Telecel";
  if (op.includes("TIGO"))     return "TIGO PESA";
  if (op.includes("HALO"))     return "HALO PESA";
  if (op.includes("EZY"))      return "EZY PESA";
  if (op.includes("TTCL"))     return "TTCL";
  if (op.includes("AFRIMONEY"))return "AFRIMONEY";
  if (op.includes("OPAY"))     return "OPay";
  if (op.includes("PALMPAY"))  return "PalmPay";
  if (op.includes("PAGA"))     return "Paga";

  // AIRTEL — exact case varies by country per AccountPE payout_methods API
  if (op.includes("AIRTEL")) {
    // UG, KE, TZ, CD use uppercase "AIRTEL" (verified via payout_methods API)
    if (["UG", "KE", "TZ", "CD"].includes(cc)) return "AIRTEL";
    return "Airtel"; // NE, GA, CG, RW, GH use "Airtel"
  }

  // MPESA / M-PESA — exact case varies by country
  if (op.includes("MPESA") || op.includes("M-PESA")) {
    if (cc === "CD") return "Mpesa"; // DRC uses "Mpesa"
    return "MPESA"; // KE, TZ use "MPESA"
  }

  // Nigeria — only bank transfer is supported
  if (cc === "NG") return "All Banks Transfer";

  return "mobile_money";
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── OTP context cache (keyed by transaction ref, expires after 15 min) ───────
const otpContextCache = new Map<string, {
  operator: string;
  country: string;
  phone: string;
  amount: number;
  currency: string;
  afribaTransactionId: string;
  expiresAt: number;
  otpType?: "api" | "ussd";
}>();

setInterval(() => {
  const now = Date.now();
  for (const [key, ctx] of otpContextCache.entries()) {
    if (ctx.expiresAt < now) otpContextCache.delete(key);
  }
}, 5 * 60 * 1000); // Clean expired entries every 5 min

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Serve uploaded files statically
  const express = await import("express");
  app.use("/uploads", express.default.static(uploadsDir));

  // Trust proxy (Replit uses reverse proxy in all environments)
  app.set("trust proxy", 1);

  // CORS middleware for development - enable credentials
  const allowedOrigins = [
    process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null,
    process.env.REPL_SLUG ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : null,
    'http://localhost:5000',
    'https://localhost:5000',
  ].filter(Boolean);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Always use the specific origin for credentials to work
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Session middleware
  // Always use secure cookies with sameSite: none for Replit's HTTPS proxy environment
  app.use(
    session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      store: new SessionStore({
        checkPeriod: 86400000,
      }),
      proxy: true,
      cookie: {
        secure: true,
        httpOnly: true,
        sameSite: "none",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );
  
  console.log("Session configured - Secure: true, SameSite: none (for Replit HTTPS proxy)");

  // Middleware to extract userId from either session or Bearer token
  app.use(async (req, res, next) => {
    // First check session
    let userId = req.session?.userId;
    
    // Then check Bearer token
    const authHeader = req.headers.authorization;
    if (!userId && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      userId = getUserIdFromToken(token);
    }

    if (userId) {
      const user = await storage.getUser(userId);
      if (user?.isBanned) {
        console.log(`Banned user ${userId} attempted access. Reason: ${user.banReason}`);
        // Clear session and token if banned
        if (req.session) {
          req.session.userId = undefined;
        }
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          removeAuthToken(token);
        }
        return res.status(403).json({ 
          message: user.banReason || "Votre compte a été banni par l'administrateur.",
          banned: true 
        });
      }
      req.userId = userId;
    }
    next();
  });

  // File upload endpoint using local storage
  app.post("/api/uploads/local", requireAuth, upload.single("file"), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Aucun fichier fourni" });
      }
      const filePath = `/uploads/${req.file.filename}`;
      res.json({ 
        success: true,
        objectPath: filePath,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
    } catch (error) {
      console.error("Local upload error:", error);
      res.status(500).json({ message: "Erreur lors de l'upload" });
    }
  });

  // Image proxy - streams image bytes through server to prevent cached signed URL expiry
  app.get("/api/image-proxy", async (req, res) => {
    try {
      const storagePath = req.query.path as string;
      if (!storagePath) return res.status(400).send("Path required");

      const result = await downloadFromSupabase(storagePath);
      if (!result) return res.status(404).send("Image not found");

      const buffer = Buffer.from(await result.data.arrayBuffer());
      res.setHeader("Content-Type", result.contentType);
      // Use ETag for efficient revalidation
      const etag = `"${storagePath.replace(/[^a-zA-Z0-9]/g, '')}-${buffer.length}"`;
      res.setHeader("ETag", etag);
      
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Length", buffer.length);
      res.end(buffer);
    } catch (error) {
      console.error("Image proxy error:", error);
      res.status(500).send("Erreur serveur");
    }
  });

  // Direct file upload endpoint - uses Supabase Storage for persistence
  app.post("/api/uploads/file", requireAuth, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier fourni" });
      }

      const folder = (req.query.folder as string) || "payment-links";
      const allowedFolders = ["payment-links", "kyc"];
      const safeFolder = allowedFolders.includes(folder) ? folder : "payment-links";

      // Try Supabase Storage first for persistent storage
      const fileBuffer = fs.readFileSync(req.file.path);
      const supabaseResult = await uploadToSupabase(
        fileBuffer,
        req.file.originalname,
        req.file.mimetype,
        safeFolder
      );

      if (supabaseResult) {
        // Delete local file after successful Supabase upload
        fs.unlinkSync(req.file.path);
        
        res.json({ 
          success: true,
          objectPath: supabaseResult.path,
          url: supabaseResult.url,
          filename: req.file.originalname,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        });
      } else {
        // Fallback to local storage
        const filePath = `/uploads/${req.file.filename}`;
        res.json({ 
          success: true,
          objectPath: filePath,
          url: filePath,
          filename: req.file.filename,
          originalName: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype
        });
      }
    } catch (error) {
      console.error("File upload error:", error);
      res.status(500).json({ error: "Erreur lors de l'upload" });
    }
  });

  // Auth routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);

      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Cet email est déjà utilisé" });
      }

      const existingUsername = await storage.getUserByUsername(data.username);
      if (existingUsername) {
        return res.status(400).json({ message: "Ce nom d'utilisateur est déjà pris" });
      }

      const hashedPassword = await hashPassword(data.password);
      
      // Fixed: For Togo, the preferred currency must be XOFT per Swychr docs
      let preferredCurrency = COUNTRY_CURRENCIES[data.country || "Cameroon"] || "XAF";
      if (data.country === "Togo") {
        preferredCurrency = "XOFT";
      }

      const user = await storage.createUser({
        ...data,
        password: hashedPassword,
        preferredCurrency,
      });

      // Send welcome email asynchronously (non-blocking)
      if (user.email) {
        sendWelcomeEmail(user.email, user.fullName || user.username).catch(() => {});
      }

      // Generate auth token for token-based auth (works in iframes where cookies fail)
      const authToken = storeAuthToken(user.id);
      
      req.session.userId = user.id;

      // Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          // Even if session fails, we have the token
        }
        const { password: _, ...safeUser } = user;
        res.json({ user: safeUser, token: authToken });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Register error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      const user = await storage.getUserByEmailOrPhone(data.identifier);
      if (!user) {
        return res.status(401).json({ message: "Email/téléphone ou mot de passe incorrect" });
      }

      const isValidPassword = await verifyPassword(data.password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Email/téléphone ou mot de passe incorrect" });
      }

      if (user.isBanned) {
        return res.status(403).json({ 
          message: user.banReason || "Votre compte a été banni par l'administrateur." 
        });
      }

      // Generate auth token for token-based auth (works in iframes where cookies fail)
      const authToken = storeAuthToken(user.id);
      
      req.session.userId = user.id;

      // Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          // Even if session fails, we have the token
        }
        const { password: _, ...safeUser } = user;
        res.json({ user: safeUser, token: authToken });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    // Remove the Bearer token if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      removeAuthToken(token);
    }
    
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Erreur lors de la déconnexion" });
      }
      res.json({ message: "Déconnecté" });
    });
  });

  // Forgot password
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const data = forgotPasswordSchema.parse(req.body);
      
      const user = await storage.getUserByEmailOrPhone(data.identifier);
      if (!user) {
        return res.status(404).json({ message: "Aucun compte trouvé avec cet email ou téléphone" });
      }
      
      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 60 * 60 * 1000);
      
      await storage.setResetToken(user.id, resetToken, expiry);

      // Send reset email if user has an email address
      if (user.email) {
        sendPasswordResetEmail(user.email, user.fullName || user.username, resetToken).catch(() => {});
      }
      
      res.json({ 
        message: "Un lien de réinitialisation a été envoyé à votre adresse email."
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Reset password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const data = resetPasswordSchema.parse(req.body);
      
      const user = await storage.getUserByResetToken(data.token);
      if (!user) {
        return res.status(400).json({ message: "Lien de réinitialisation invalide ou expiré" });
      }
      
      if (user.resetTokenExpiry && new Date(user.resetTokenExpiry) < new Date()) {
        await storage.clearResetToken(user.id);
        return res.status(400).json({ message: "Lien de réinitialisation expiré" });
      }
      
      const hashedPassword = await hashPassword(data.password);
      await storage.updatePassword(user.id, hashedPassword);
      await storage.clearResetToken(user.id);
      
      res.json({ message: "Mot de passe réinitialisé avec succès" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User routes
  app.get("/api/user", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.userId!);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get user statistics
  app.get("/api/user/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const transactions = await storage.getTransactionsByUserId(userId);
      const paymentLinks = await storage.getPaymentLinksByUserId(userId);
      
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const completedTransactions = transactions.filter(t => t.status === "completed");
      
      const totalReceived = completedTransactions
        .filter(t => t.type === "deposit" || t.type === "transfer_in" || t.type === "payment_link")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const totalSent = completedTransactions
        .filter(t => t.type === "withdrawal" || t.type === "transfer_out")
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      const monthlyTransactions = transactions.filter(t => 
        t.createdAt && new Date(t.createdAt) >= startOfMonth
      );
      
      const totalClicks = paymentLinks.reduce((sum, link) => sum + (link.clickCount || 0), 0);
      
      const linkPayments = completedTransactions.filter(t => t.type === "payment_link");
      const totalCollected = linkPayments.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      res.json({
        totalReceived: totalReceived.toFixed(2),
        totalSent: totalSent.toFixed(2),
        totalTransactions: transactions.length,
        monthlyTransactions: monthlyTransactions.length,
        pendingTransactions: transactions.filter(t => t.status === "pending").length,
        totalClicks,
        linkPayments: linkPayments.length,
        totalCollected: totalCollected.toFixed(2),
        activeLinks: paymentLinks.filter(l => l.isActive).length,
      });
    } catch (error) {
      console.error("Get user stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Combined dashboard endpoint — returns all data needed for dashboard in one request
  app.get("/api/dashboard", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const [user, transactions, paymentLinks, extraWallets, notifications] = await Promise.all([
        storage.getUser(userId),
        storage.getTransactionsByUserId(userId),
        storage.getPaymentLinksByUserId(userId),
        storage.getUserWallets(userId),
        storage.getUserNotifications(userId, 20),
      ]);

      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      // Build wallets list
      const primaryCurrency = (user.preferredCurrency || "XAF") as SupportedCurrency;
      const wallets = [
        { currency: primaryCurrency, balance: user.balance, symbol: CURRENCY_SYMBOLS[primaryCurrency] || primaryCurrency },
        ...extraWallets
          .filter(w => w.currency !== primaryCurrency)
          .map(w => ({ currency: w.currency, balance: w.balance, symbol: CURRENCY_SYMBOLS[w.currency as SupportedCurrency] || w.currency })),
      ];

      // Compute stats inline
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const completed = transactions.filter(t => t.status === "completed");
      const totalReceived = completed.filter(t => ["deposit","transfer_in","payment_link"].includes(t.type)).reduce((s,t)=>s+parseFloat(t.amount),0);
      const totalSent = completed.filter(t => ["withdrawal","transfer_out"].includes(t.type)).reduce((s,t)=>s+parseFloat(t.amount),0);
      const linkPayments = completed.filter(t => t.type === "payment_link");
      const stats = {
        totalReceived: totalReceived.toFixed(2),
        totalSent: totalSent.toFixed(2),
        totalTransactions: transactions.length,
        monthlyTransactions: transactions.filter(t => t.createdAt && new Date(t.createdAt) >= startOfMonth).length,
        pendingTransactions: transactions.filter(t => t.status === "pending").length,
        totalClicks: paymentLinks.reduce((s,l) => s + (l.clickCount||0), 0),
        linkPayments: linkPayments.length,
        totalCollected: linkPayments.reduce((s,t)=>s+parseFloat(t.amount),0).toFixed(2),
        activeLinks: paymentLinks.filter(l=>l.isActive).length,
      };

      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser, transactions, paymentLinks, wallets, stats, notifications });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Update user currency preference
  app.patch("/api/user/currency", requireAuth, async (req, res) => {
    try {
      const { currency } = req.body;
      if (!SUPPORTED_CURRENCIES.includes(currency)) {
        return res.status(400).json({ message: "Devise non supportée" });
      }
      
      const user = await storage.updateUserCurrency(req.userId!, currency as SupportedCurrency);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Update currency error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Update user profile
  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const { fullName, email, phone, country } = req.body;
      const userId = req.userId!;
      
      // Validate email uniqueness if changed
      if (email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Cet email est déjà utilisé" });
        }
      }
      
      const user = await storage.updateUser(userId, { fullName, email, phone, country });
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Delete own account
  app.delete("/api/user/account", requireAuth, async (req, res) => {
    try {
      const { username } = req.body;
      const userId = req.userId!;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      if (user.username !== username) {
        return res.status(400).json({ message: "Le nom d'utilisateur ne correspond pas" });
      }
      
      // Send confirmation email before deleting (async, non-blocking)
      if (user.email) {
        sendAccountDeletedEmail(user.email, user.fullName || user.username).catch(() => {});
      }

      await storage.deleteUser(userId);
      
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
      });
      
      res.json({ message: "Compte supprimé avec succès" });
    } catch (error) {
      console.error("Delete account error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ─── API Key routes ─────────────────────────────────────────────────────────
  app.get("/api/user/api-key", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      let user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      // Auto-generate key on first access
      if (!user.apiKey) {
        const { randomBytes } = await import("crypto");
        const key = `ak_${randomBytes(24).toString("hex")}`;
        user = (await storage.setUserApiKey(userId, key)) || user;
      }

      res.json({ apiKey: user.apiKey });
    } catch (error) {
      console.error("Get API key error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/user/api-key/regenerate", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { randomBytes } = await import("crypto");
      const key = `ak_${randomBytes(24).toString("hex")}`;
      const user = await storage.setUserApiKey(userId, key);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });
      res.json({ apiKey: user.apiKey });
    } catch (error) {
      console.error("Regenerate API key error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Transaction routes
  app.get("/api/transactions", requireAuth, async (req, res) => {
    try {
      const transactions = await storage.getTransactionsByUserId(req.userId!);
      res.json(transactions);
    } catch (error) {
      console.error("Get transactions error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get transaction details by ID
  app.get("/api/transactions/:id", requireAuth, async (req, res) => {
    try {
      const transaction = await storage.getTransactionById(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction non trouvée" });
      }
      
      // Ensure user owns this transaction
      if (transaction.userId !== req.userId) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      
      // Get additional context based on transaction type
      let additionalInfo: any = {};
      
      if (transaction.paymentLinkId) {
        const paymentLink = await storage.getPaymentLinkById(transaction.paymentLinkId);
        additionalInfo.paymentLink = paymentLink ? { title: paymentLink.title, slug: paymentLink.slug } : null;
      }
      
      if (transaction.paymentIntentId) {
        const paymentIntent = await storage.getPaymentIntentById(transaction.paymentIntentId);
        additionalInfo.paymentIntent = paymentIntent ? { payerCountry: paymentIntent.payerCountry, payerPhone: paymentIntent.payerPhone } : null;
      }
      
      if (transaction.recipientId) {
        const recipient = await storage.getUser(transaction.recipientId);
        additionalInfo.recipient = recipient ? { fullName: recipient.fullName, username: recipient.username } : null;
      }
      
      res.json({ ...transaction, ...additionalInfo });
    } catch (error) {
      console.error("Get transaction error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Search transaction by reference
  app.get("/api/transactions/reference/:reference", requireAuth, async (req, res) => {
    try {
      const transaction = await storage.getTransactionByReference(req.params.reference);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction non trouvée" });
      }
      
      // Ensure user owns this transaction
      if (transaction.userId !== req.userId) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      
      res.json(transaction);
    } catch (error) {
      console.error("Get transaction by reference error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public endpoint to check transaction status (for payment page polling)
  app.get("/api/transactions/status/:reference", async (req, res) => {
    try {
      const transaction = await storage.getTransactionByReference(req.params.reference);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction non trouvée", status: "not_found" });
      }
      res.json({ status: transaction.status, reference: transaction.reference });
    } catch (error) {
      console.error("Get transaction status error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User-initiated cancel of a pending deposit
  app.post("/api/transactions/cancel/:reference", requireAuth, async (req, res) => {
    try {
      const transaction = await storage.getTransactionByReference(req.params.reference);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction non trouvée" });
      }
      if (transaction.userId !== req.userId) {
        return res.status(403).json({ message: "Accès refusé" });
      }
      if (transaction.status !== "pending") {
        return res.json({ success: true, status: transaction.status });
      }
      await storage.updateTransactionStatus(transaction.id, "failed");
      removePendingPayment(req.params.reference);
      console.log(`[Cancel] Transaction ${req.params.reference} cancelled by user ${req.userId}`);
      res.json({ success: true, status: "failed" });
    } catch (error) {
      console.error("Cancel transaction error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get transfer configuration (countries, operators, fees)
  app.get("/api/transfers/config", requireAuth, async (req, res) => {
    try {
      const transactionType = (req.query.type as string) || "transfer";
      const countries = await storage.getActiveCountries();
      const allOperators = await storage.getAllOperators();
      const allFees = await storage.getAllFees();
      
      // Build config with operators per country and their fees
      const config = countries.map(country => {
        const countryOperators = allOperators
          .filter(op => op.countryId === country.id && op.isActive && !op.isInMaintenance)
          .map(op => {
            // Find operator-specific fee first
            let operatorFee = allFees.find(
              f => f.operatorId === op.id && f.transactionType === transactionType && f.isActive
            );
            // If no operator-specific, try country-level fee
            if (!operatorFee) {
              operatorFee = allFees.find(
                f => !f.operatorId && f.countryId === country.id && f.transactionType === transactionType && f.isActive
              );
            }
            // If no country-level, try global fee
            if (!operatorFee) {
              operatorFee = allFees.find(
                f => !f.operatorId && !f.countryId && f.transactionType === transactionType && f.isActive
              );
            }
            const provider = (op as any).paymentProvider || "swychr";
            const afribaRate = operatorFee ? parseFloat((operatorFee as any).afribapayFee || "0") : 0;
            const pixpayRate = operatorFee ? parseFloat((operatorFee as any).pixpayFee || "0") : 0;
            const marginRate = operatorFee ? parseFloat((operatorFee as any).ashtechMargin || "0") : 0;
            let feePercentage = 0;
            if (provider === "afribapay") {
              feePercentage = afribaRate + marginRate;
            } else if (provider === "pixpay") {
              feePercentage = pixpayRate + marginRate;
            } else {
              const swychrRate = operatorFee ? parseFloat((operatorFee as any).swychrFee || "0") : 0;
              feePercentage = (swychrRate + marginRate) > 0 ? (swychrRate + marginRate) : (operatorFee?.feeType === "percentage" ? parseFloat(operatorFee.feeValue) : 0);
            }
            return {
              id: op.id,
              name: op.name,
              type: op.type,
              gateway: (op as any).gateway || "soleapay",
              paymentProvider: provider,
              feePercentage,
              feeFixed: operatorFee?.feeType === "fixed" ? parseFloat(operatorFee.feeValue) : 0,
              afribapayFee: afribaRate,
              pixpayFee: pixpayRate,
              ashtechMargin: marginRate,
              minFee: operatorFee?.minFee ? parseFloat(operatorFee.minFee) : null,
              maxFee: operatorFee?.maxFee ? parseFloat(operatorFee.maxFee) : null,
            };
          });
        
        return {
          id: country.id,
          name: country.name,
          code: country.code,
          currency: country.currency,
          operators: countryOperators,
        };
      });
      
      res.json(config);
    } catch (error) {
      console.error("Get transfer config error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });
  
  // Calculate transfer fee preview
  app.post("/api/transfers/calculate-fee", requireAuth, async (req, res) => {
    try {
      const { operatorId, amount } = req.body;
      
      if (!operatorId || !amount) {
        return res.status(400).json({ message: "Opérateur et montant requis" });
      }
      
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }
      
      const operator = await storage.getOperator(operatorId);
      if (!operator) {
        return res.status(404).json({ message: "Opérateur non trouvé" });
      }

      const provider = ((operator as any).paymentProvider || "swychr") as string;
      const fee = await storage.resolveFee("transfer", (operator as any).countryId, operatorId);
      let feeAmount = 0;
      let feePercentage = 0;
      
      if (fee) {
        const marginRate = fee.ashtechMargin ? parseFloat(fee.ashtechMargin.toString()) : 0;
        let providerRate = 0;
        if (provider === "afribapay") {
          providerRate = fee.afribapayFee ? parseFloat((fee as any).afribapayFee.toString()) : 0;
        } else if (provider === "pixpay") {
          providerRate = fee.pixpayFee ? parseFloat((fee as any).pixpayFee.toString()) : 0;
        } else {
          providerRate = fee.swychrFee ? parseFloat(fee.swychrFee.toString()) : 0;
        }
        const totalRate = providerRate + marginRate;

        if (fee.feeType === "percentage" || totalRate > 0) {
          feePercentage = totalRate > 0 ? totalRate : parseFloat(fee.feeValue.toString());
          feeAmount = (parsedAmount * feePercentage) / 100;
        } else {
          feeAmount = parseFloat(fee.feeValue.toString());
        }

        const minCharge = fee.minFee ? parseFloat(fee.minFee.toString()) : 0;
        if (provider === "swychr" && feeAmount < minCharge) {
          feeAmount = minCharge;
        }

        if (fee.maxFee && feeAmount > parseFloat(fee.maxFee.toString())) {
          feeAmount = parseFloat(fee.maxFee.toString());
        }
      }
      
      const totalAmount = parsedAmount + feeAmount;
      
      res.json({
        amount: parsedAmount,
        feeAmount,
        feePercentage,
        totalAmount,
        minFee: (provider === "swychr" && fee?.minFee) ? parseFloat(fee.minFee.toString()) : null,
        maxFee: fee?.maxFee ? parseFloat(fee.maxFee.toString()) : null,
      });
    } catch (error) {
      console.error("Calculate fee error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Send money externally (with operator and fees)
  app.post("/api/transfers/send", requireAuth, async (req, res) => {
    try {
      const { recipientName, recipientPhone, countryId, operatorId, amount, description, sourceCurrency } = req.body;

      if (!recipientName || !recipientPhone || !countryId || !operatorId || !amount) {
        return res.status(400).json({ message: "Tous les champs sont requis" });
      }

      const senderId = req.userId!;
      const parsedAmount = parseFloat(amount);

      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }

      const sender = await storage.getUser(senderId);
      if (!sender) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      const txCurrency = sourceCurrency || sender.preferredCurrency || "XAF";
      const fxRates = await loadFxRates();
      const minTransferSetting = await storage.getSetting("min_transfer");
      const minTransferXAF = minTransferSetting ? parseFloat(minTransferSetting.value) : 2650;
      const minTransfer = Math.ceil(convertFromXAF(minTransferXAF, txCurrency, fxRates));
      if (parsedAmount < minTransfer) {
        return res.status(400).json({ message: `Le montant minimum de transfert est de ${minTransfer.toLocaleString()} ${txCurrency}` });
      }

      const operator = await storage.getOperator(operatorId);
      if (!operator) {
        return res.status(404).json({ message: "Opérateur non trouvé" });
      }

      const country = await storage.getCountry(countryId);
      if (!country) {
        return res.status(404).json({ message: "Pays non trouvé" });
      }

      if (sourceCurrency && sourceCurrency !== country.currency) {
        return res.status(403).json({ message: `Transaction non autorisée — Le compte sélectionné est en ${sourceCurrency} mais ${country.name} utilise ${country.currency}` });
      }

      const transferProvider = ((operator as any).paymentProvider || "swychr") as string;

      const fee = await storage.resolveFee("transfer", countryId, operatorId);
      let feeAmount = 0;
      let ashtechFeeAmount = 0;

      if (fee) {
        const marginRate = fee.ashtechMargin ? parseFloat(fee.ashtechMargin.toString()) : 0;

        let providerRate = 0;
        if (transferProvider === "afribapay") {
          providerRate = fee.afribapayFee ? parseFloat((fee as any).afribapayFee.toString()) : 0;
        } else if (transferProvider === "pixpay") {
          providerRate = fee.pixpayFee ? parseFloat((fee as any).pixpayFee.toString()) : 0;
        } else {
          providerRate = fee.swychrFee ? parseFloat(fee.swychrFee.toString()) : 0;
        }
        const totalRate = providerRate + marginRate;
        const minCharge = fee.minFee ? parseFloat(fee.minFee.toString()) : 0;

        let calculatedFee = 0;
        if (fee.feeType === "percentage" || totalRate > 0) {
          const rateToUse = totalRate > 0 ? totalRate : parseFloat(fee.feeValue.toString());
          calculatedFee = (parsedAmount * rateToUse) / 100;
          ashtechFeeAmount = totalRate > 0 ? (parsedAmount * marginRate) / 100 : calculatedFee;
        } else {
          calculatedFee = parseFloat(fee.feeValue.toString());
          ashtechFeeAmount = calculatedFee;
        }

        if (transferProvider === "swychr" && calculatedFee < minCharge) {
          calculatedFee = minCharge;
          ashtechFeeAmount = 100;
        }

        if (fee.maxFee && calculatedFee > parseFloat(fee.maxFee.toString())) {
          calculatedFee = parseFloat(fee.maxFee.toString());
        }

        feeAmount = calculatedFee;
      }

      // Transfer rule: user pays parsedAmount (total), fees deducted internally, net sent to recipient
      const creditedAmount = parsedAmount - feeAmount;
      const totalAmount = parsedAmount;

      // Determine if debiting primary wallet or secondary wallet
      const isPrimaryTransfer = (txCurrency === (sender.preferredCurrency || "XAF"));

      // Check balance in the correct wallet
      if (isPrimaryTransfer) {
        if (parseFloat(sender.balance) < totalAmount) {
          return res.status(400).json({
            message: `Solde insuffisant. Vous avez besoin de ${totalAmount.toFixed(2)} ${txCurrency}`,
          });
        }
      } else {
        const wallet = await storage.getWallet(senderId, txCurrency);
        if (!wallet || parseFloat(wallet.balance) < totalAmount) {
          return res.status(400).json({
            message: `Solde insuffisant dans votre compte ${txCurrency}. Besoin de ${totalAmount.toFixed(2)} ${txCurrency}`,
          });
        }
      }

      // Debit the correct wallet immediately
      console.log(`[Transfer] Sender=${senderId}, Amount=${parsedAmount}, Fee=${feeAmount}, Net=${creditedAmount} (${txCurrency})`);
      if (isPrimaryTransfer) {
        await storage.updateUserBalance(senderId, -totalAmount);
      } else {
        await storage.upsertWallet(senderId, txCurrency, -totalAmount);
        await cleanupEmptyWallets(senderId);
      }

      // Create pending transaction
      const reference = generateTransactionReference("transfer_out");
      const transaction = await storage.createTransaction({
        userId: senderId,
        type: "transfer_out",
        amount: creditedAmount.toFixed(2),
        currency: txCurrency,
        status: "pending",
        description: description || `Envoi à ${recipientName}`,
        recipientName,
        recipientPhone,
        recipientCountry: country.name,
        operatorId,
        feeAmount: ashtechFeeAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        paymentMethod: operator.type,
        reference,
      });

      console.log(`[Transfer] Created transfer ${reference} for ${creditedAmount} net to ${recipientName} — calling AccountPE immediately`);

      let transferCountryCode = "CM";
      if (country?.code) transferCountryCode = country.code;

      console.log(`[Transfer] Payout Data: Country=${transferCountryCode}, Amount=${creditedAmount}, Operator=${operator.name}`);

      try {
        const operatorName = (operator.name || "").toUpperCase();
        const countryCode = transferCountryCode.toUpperCase();

        let payoutResult: { success: boolean; transaction_id?: string; message?: string };

        if (transferProvider === "afribapay") {
          const afribapayOperatorCode = resolveAfribaPayOperatorCode(operator, operatorName);
          const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[countryCode] || txCurrency;
          console.log(`[Transfer] AfribaPay | country=${countryCode} | currency=${afribapayCurrency} | operator=${afribapayOperatorCode}`);
          const callbackUrl = `${process.env.APP_URL || ""}/api/afribapay/webhook`;

          let localPhone = recipientPhone.replace(/\s/g, "");
          if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
          const phonePrefixes: Record<string, string> = {
            CM: "237", SN: "221", CI: "225", BF: "226", ML: "223",
            GN: "224", BJ: "229", TG: "228", NE: "227", CD: "243",
            CG: "242", CF: "236", TD: "235", GA: "241", GQ: "240",
          };
          const pfx = phonePrefixes[countryCode];
          if (pfx && localPhone.startsWith(pfx)) localPhone = localPhone.slice(pfx.length);

          const afribaResult = await initiateAfribaPayout({
            operator: afribapayOperatorCode,
            country: countryCode,
            phone_number: localPhone,
            amount: creditedAmount,
            currency: afribapayCurrency,
            order_id: reference,
            reference_id: reference,
            notify_url: callbackUrl,
          });
          if (afribaResult.success && afribaResult.transaction_id) {
            await storage.updateTransactionExternalReference(transaction.id, afribaResult.transaction_id);
          }
          payoutResult = afribaResult;

        } else if (transferProvider === "pixpay") {
          const cashInServiceId = getPixPayServiceId(operator?.name || "", countryCode, "cash_in");
          if (!cashInServiceId) {
            console.error(`[Transfer] PixPay: no cash_in service_id for ${operator?.name} in ${countryCode}`);
            await storage.updateTransactionStatus(transaction.id, "failed");
            if (isPrimaryTransfer) {
              await storage.updateUserBalance(senderId, totalAmount);
            } else {
              await storage.upsertWallet(senderId, txCurrency, totalAmount);
            }
            return res.status(400).json({
              message: `Envoi PixPay non supporté pour cet opérateur (${operator?.name}) dans ce pays`,
            });
          }
          console.log(`[Transfer] PixPay | country=${countryCode} | service_id=${cashInServiceId} | operator=${operator?.name}`);
          const pixpayIpnUrl = `${process.env.APP_URL || ""}/api/pixpay/webhook`;
          const pixpayResult = await initiatePixPayPayout({
            serviceId: String(cashInServiceId),
            amount: creditedAmount,
            phone: recipientPhone.replace(/\s/g, ""),
            countryCode,
            orderId: reference,
            ipnUrl: pixpayIpnUrl,
            customData: reference,
          });
          if (pixpayResult.success && pixpayResult.transactionId) {
            await storage.updateTransactionExternalReference(transaction.id, pixpayResult.transactionId);
          }
          payoutResult = {
            success: pixpayResult.success,
            transaction_id: pixpayResult.transactionId,
            message: pixpayResult.message,
          };

        } else {
          const finalPaymentMethod = resolvePaymentMethod(operatorName, countryCode);
          payoutResult = await createSwychrPayout({
            country_code:     transferCountryCode,
            beneficiary_name: recipientName,
            mobile_no:        formatInternationalPhone(recipientPhone, transferCountryCode),
            amount:           creditedAmount,
            transaction_id:   reference,
            payment_method:   finalPaymentMethod as any,
            remarks:          `Ashtech Pay - ${reference}`,
          });
        }

        if (payoutResult.success) {
          console.log(`[Transfer] Payout submitted OK: ${reference} (ext: ${payoutResult.transaction_id})`);
          addPendingPayout({
            transactionId: transaction.id,
            reference:     payoutResult.transaction_id || reference,
            userId:        senderId,
            amount:        creditedAmount.toFixed(2),
            totalDebited:  totalAmount.toFixed(2),
            provider:      transferProvider as "swychr" | "afribapay" | "pixpay",
            countryCode:   transferCountryCode.toUpperCase(),
          });
        } else {
          const errMsg = (payoutResult.message || "").toLowerCase();
          const requiresManualReview =
            errMsg.includes("forbidden") ||
            errMsg.includes("whitelist") ||
            errMsg.includes("insuffi") ||
            errMsg.includes("solde") ||
            errMsg.includes("balance");
          if (requiresManualReview) {
            console.log(`[Transfer] Pending manual review for ${reference} (${transferProvider}): ${payoutResult.message}`);
            await storage.updateTransactionStatus(transaction.id, "pending_manual");
            await storage.createUserNotification({
              userId: senderId,
              type: "transfer_pending",
              title: "Transfert en attente",
              message: `Votre transfert de ${parsedAmount.toLocaleString()} ${txCurrency} vers ${recipientName} est en cours de traitement et sera envoyé dès validation par l'équipe Ashtech Pay.`,
              transactionId: transaction.id,
              isRead: false,
            });
          } else {
            console.error(`[Transfer] Payout failed for ${reference} (${transferProvider}): ${payoutResult.message}`);
            await storage.updateTransactionStatus(transaction.id, "failed");
            if (isPrimaryTransfer) {
              await storage.updateUserBalance(senderId, totalAmount);
            } else {
              await storage.upsertWallet(senderId, txCurrency, totalAmount);
            }
            return res.status(400).json({
              message: `Le transfert a échoué: ${payoutResult.message}`,
            });
          }
        }
      } catch (payoutErr: any) {
        console.error(`[Transfer] Payout error for ${reference}:`, payoutErr.message);
      }

      res.json({
        message: "Votre transfert est en cours de traitement",
        transaction,
        feeAmount: feeAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
      });
    } catch (error) {
      console.error("Send transfer error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Transfer between Ashtech Pay accounts (by email or username)
  app.post("/api/transfers/internal", requireAuth, async (req, res) => {
    try {
      const { recipientIdentifier, amount, description, sourceCurrency } = req.body;
      const senderId = req.userId!;
      const amountNum = parseFloat(amount);

      if (!recipientIdentifier || !recipientIdentifier.trim()) {
        return res.status(400).json({ message: "Identifiant du destinataire requis" });
      }
      if (!amountNum || amountNum <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }

      const sender = await storage.getUser(senderId);
      if (!sender) return res.status(404).json({ message: "Utilisateur non trouvé" });

      // Lookup recipient by email, phone or username
      const identifier = recipientIdentifier.trim();
      let recipient = await storage.getUserByEmail(identifier);
      if (!recipient) {
        recipient = await storage.getUserByPhone(identifier);
      }
      if (!recipient) {
        recipient = await storage.getUserByUsername(identifier);
      }
      if (!recipient) {
        return res.status(404).json({ message: "Aucun compte Ashtech Pay trouvé avec cet identifiant" });
      }
      if (recipient.id === senderId) {
        return res.status(400).json({ message: "Vous ne pouvez pas vous envoyer de l'argent à vous-même" });
      }

      const currency = sourceCurrency || sender.preferredCurrency || "XAF";
      const senderPrimary = sender.preferredCurrency || "XAF";
      const recipientPrimary = recipient.preferredCurrency || "XAF";

      // Check balance before any debit
      if (currency === senderPrimary) {
        if (parseFloat(sender.balance) < amountNum) {
          return res.status(400).json({ message: "Solde insuffisant" });
        }
      } else {
        const wallet = await storage.getWallet(senderId, currency);
        if (!wallet || parseFloat(wallet.balance) < amountNum) {
          return res.status(400).json({ message: "Solde insuffisant dans ce portefeuille" });
        }
      }

      const transferRef = generateTransactionReference("transfer_out");

      // Create transaction records BEFORE moving money
      const transactionOut = await storage.createTransaction({
        userId: senderId,
        type: "transfer_out",
        amount: amountNum.toFixed(2),
        currency,
        status: "completed",
        description: description || `Transfert à ${recipient.fullName}`,
        recipientId: recipient.id,
        recipientName: recipient.fullName,
        reference: transferRef,
        feeAmount: "0.00",
        totalAmount: amountNum.toFixed(2),
      });

      const transactionIn = await storage.createTransaction({
        userId: recipient.id,
        type: "transfer_in",
        amount: amountNum.toFixed(2),
        currency,
        status: "completed",
        description: `Reçu de ${sender.fullName}`,
        recipientId: senderId,
        reference: transferRef,
        feeAmount: "0.00",
        totalAmount: amountNum.toFixed(2),
      });

      // Move money only after both transactions are created
      if (currency === senderPrimary) {
        await storage.updateUserBalance(senderId, -amountNum);
      } else {
        await storage.upsertWallet(senderId, currency, -amountNum);
      }
      if (currency === recipientPrimary) {
        await storage.updateUserBalance(recipient.id, amountNum);
      } else {
        await storage.upsertWallet(recipient.id, currency, amountNum);
      }

      await storage.createUserNotification({
        userId: recipient.id,
        type: "transfer_received",
        title: "Argent reçu",
        message: `Vous avez reçu ${amountNum.toFixed(2)} ${currency} de ${sender.fullName}.`,
        transactionId: transactionIn.id,
        isRead: false,
      });

      res.json({ message: "Transfert réussi", transaction: transactionOut, recipientName: recipient.fullName });
    } catch (error) {
      console.error("Internal transfer error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Deposit money (creates pending deposit - needs admin confirmation to credit account)
  app.post("/api/deposits", requireAuth, async (req, res) => {
    try {
      const data = depositSchema.parse(req.body);
      const userId = req.userId!;
      const amount = parseFloat(data.amount);

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      // Get operator + country details (single fetch, used throughout)
      let operatorName = "Mobile Money";
      let countryCode = "CM";
      let countryCurrency = "XAF";
      let operatorRecord: Awaited<ReturnType<typeof storage.getOperator>> | null = null;
      if (data.operatorId) {
        operatorRecord = await storage.getOperator(data.operatorId);
        if (operatorRecord) operatorName = operatorRecord.name;
      }
      if (data.countryId) {
        const country = await storage.getCountry(data.countryId);
        if (country) {
          countryCode = country.code;
          countryCurrency = country.currency || "XAF";
        }
      }

      // Determine payment provider BEFORE fee calculation
      const paymentProvider = (operatorRecord as any)?.paymentProvider || "swychr";
      console.log(`[Deposit] operatorId=${data.operatorId} | name=${operatorName} | DB provider=${(operatorRecord as any)?.paymentProvider || "null"} | resolved=${paymentProvider} | afribapayCode=${(operatorRecord as any)?.afribapayOperatorCode || "null"}`);

      // Resolve fees from DB (includes afribapayFee + ashtechMargin)
      const resolvedFeeRecord = (data.operatorId || data.countryId)
        ? await storage.resolveFee("deposit", data.countryId, data.operatorId)
        : null;
      const ashtechMarginPct = (resolvedFeeRecord as any)?.ashtechMargin != null
        ? parseFloat((resolvedFeeRecord as any).ashtechMargin)
        : ASHTECH_MARGIN;

      // Calculate fees using the CORRECT provider's rates
      const totalAmount = amount;
      let creditedAmount: number;
      let ashtechFeeAmount: number;
      if (paymentProvider === "afribapay") {
        const afribapayFeeRate = (resolvedFeeRecord as any)?.afribapayFee
          ? parseFloat((resolvedFeeRecord as any).afribapayFee)
          : 3.0;
        const af = computeAfribaPayFees(totalAmount, afribapayFeeRate, ashtechMarginPct);
        creditedAmount = af.creditedAmount;
        ashtechFeeAmount = af.ashtechFeeAmount;
      } else if (paymentProvider === "pixpay") {
        const pixpayFeeRate = (resolvedFeeRecord as any)?.pixpayFee
          ? parseFloat((resolvedFeeRecord as any).pixpayFee)
          : 3.0;
        const pf = computePixPayFees(totalAmount, pixpayFeeRate, ashtechMarginPct);
        creditedAmount = pf.creditedAmount;
        ashtechFeeAmount = pf.ashtechFeeAmount;
      } else {
        const sf = computeSwychrFees(amount, countryCode, ashtechMarginPct);
        creditedAmount = sf.creditedAmount;
        ashtechFeeAmount = sf.ashtechFeeAmount;
      }

      const depositRef = generateTransactionReference("deposit");

      // ─── PixPay OTP pre-check — must happen BEFORE creating the transaction ──
      // Orange CI/SN/ML/BF require the user to dial a USSD code to get an OTP
      // that must be included in the API call. If it's missing, return 400 early
      // so no failed transaction is created unnecessarily.
      if (paymentProvider === "pixpay" && data.paymentMethod === "mobile_money") {
        const earlyPxOpType = detectPixPayFlowType(operatorName, countryCode);
        if (earlyPxOpType === "otp" && !(data as any).pixpayOtp) {
          const ussdCode = PIXPAY_OTP_USSD_CODES[countryCode.toUpperCase()] || "#144*82#";
          return res.status(400).json({
            otpRequired: true,
            gateway: "pixpay",
            ussdCode,
            message: `Composez ${ussdCode} sur votre téléphone pour obtenir votre code OTP, puis saisissez-le.`,
          });
        }
      }

      // Create pending transaction with provider-correct amounts
      const transaction = await storage.createTransaction({
        userId,
        type: "deposit",
        amount: creditedAmount.toString(),
        currency: countryCurrency,
        status: "pending",
        description: `Recharge via ${data.paymentMethod === "mobile_money" ? "Mobile Money" : "Crypto"}`,
        paymentMethod: data.paymentMethod,
        reference: depositRef,
        operatorId: data.operatorId,
        feeAmount: ashtechFeeAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        recipientPhone: data.phoneNumber || null,
      });

      // Call payment gateway for mobile money deposits
      if (data.paymentMethod === "mobile_money" && data.phoneNumber) {
        try {
          // paymentProvider already determined above

          if (paymentProvider === "afribapay") {
            // ─── AfribaPay Payin ──────────────────────────────────────────────
            const afribapayOperatorCode = resolveAfribaPayOperatorCode(operatorRecord, operatorName);
            // Always use AfribaPay ISO currency (overrides DB value to avoid XOFC/XOFS/XAF mismatch)
            const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[countryCode.toUpperCase()] || countryCurrency;
            console.log(`[Deposit] AfribaPay | country=${countryCode} | currency=${afribapayCurrency} | operator=${afribapayOperatorCode}`);
            const callbackUrl = `${process.env.APP_URL || ""}/api/afribapay/webhook`;

            // Use already-resolved fee record from outer scope
            const afribapayFeeRate = (resolvedFeeRecord as any)?.afribapayFee
              ? parseFloat((resolvedFeeRecord as any).afribapayFee.toString())
              : 3.0;
            const afribaFees = computeAfribaPayFees(totalAmount, afribapayFeeRate, ashtechMarginPct);

            // Strip country prefix from phone number (AfribaPay wants local number)
            let localPhone = data.phoneNumber.replace(/\s/g, "");
            if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
            const prefixes: Record<string, string> = {
              CM: "237", SN: "221", CI: "225", BF: "226", ML: "223",
              GN: "224", BJ: "229", TG: "228", NE: "227", CD: "243",
              CG: "242", CF: "236", TD: "235", GA: "241", GQ: "240",
              MG: "261", RW: "250", KE: "254", TZ: "255", UG: "256",
              GH: "233", NG: "234",
            };
            const prefix = prefixes[countryCode.toUpperCase()];
            if (prefix && localPhone.startsWith(prefix)) {
              localPhone = localPhone.slice(prefix.length);
            }

            // Build return/cancel URLs for Wave (redirect-based operators)
            const appBaseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

            // ── Check OTP requirement BEFORE calling payin ────────────────────
            // For OTP operators (Orange CI/SN/BF/GN, LigdiCash BF), AfribaPay rejects
            // /v1/pay/payin with "This operation requires an OTP code." so we must call
            // /v1/pay/otp WITHOUT otp_code first to initiate, then confirm with code.
            const otpInfo = await getAfribaPayOtpInfo(countryCode, afribapayOperatorCode);

            if (otpInfo.required) {
              if (otpInfo.type === "api") {
                // ── API OTP: AfribaPay sends the code by SMS via /v1/pay/otp ──
                const otpInitResult = await initiateAfribaPayOtp({
                  operator: afribapayOperatorCode,
                  country: countryCode,
                  phone_number: localPhone,
                  amount: totalAmount,
                  currency: afribapayCurrency,
                  order_id: depositRef,
                  reference_id: depositRef,
                  notify_url: callbackUrl,
                });

                if (!otpInitResult.success) {
                  await storage.updateTransactionStatus(transaction.id, "failed");
                  return res.status(400).json({ message: otpInitResult.message || "Impossible d'envoyer le code OTP" });
                }
              }
              // ── USSD OTP: user dials the code themselves — no initiation call needed ──
              // Just store context so confirm-otp can process it later

              // Store OTP context for the confirm-otp endpoint
              otpContextCache.set(depositRef, {
                operator: afribapayOperatorCode,
                country: countryCode,
                phone: localPhone,
                amount: totalAmount,
                currency: afribapayCurrency,
                afribaTransactionId: depositRef,
                expiresAt: Date.now() + 15 * 60 * 1000, // 15 min
                otpType: otpInfo.type,
              });

              const otpMessage = otpInfo.type === "ussd"
                ? `Composez ${otpInfo.ussdCode} sur votre téléphone pour obtenir votre code OTP, puis saisissez-le ci-dessous.`
                : "Entrez le code OTP que vous allez recevoir par SMS sur votre téléphone.";

              return res.json({
                transaction,
                gateway: "afribapay",
                otpRequired: true,
                otpType: otpInfo.type,
                ussdCode: otpInfo.ussdCode,
                status: "otp_required",
                message: otpMessage,
                feeDetails: {
                  grossAmount: totalAmount,
                  feeAmount: afribaFees.totalFeeAmount,
                  creditedAmount: afribaFees.creditedAmount,
                  afribapayFee: afribaFees.afribapayFeeAmount,
                  ashtechFee: afribaFees.ashtechFeeAmount,
                }
              });
            }

            // ── Non-OTP: regular payin (USSD or Wave redirect) ────────────────
            const afribaResponse = await initiateAfribaPayin({
              operator: afribapayOperatorCode,
              country: countryCode,
              phone_number: localPhone,
              amount: totalAmount,
              currency: afribapayCurrency,
              order_id: depositRef,
              reference_id: depositRef,
              notify_url: callbackUrl,
              return_url: `${appBaseUrl}/dashboard/deposit?ref=${depositRef}&status=success`,
              cancel_url: `${appBaseUrl}/dashboard/deposit?ref=${depositRef}&status=cancelled`,
            });

            if (afribaResponse.success) {
              // Update transaction with AfribaPay reference
              const extRef = afribaResponse.transaction_id || depositRef;
              await storage.updateTransactionExternalReference(transaction.id, extRef);
              addPendingPayment({
                transactionId: transaction.id,
                reference: depositRef,
                externalReference: extRef,
                attempts: 0,
                userId: user.id,
                type: "deposit",
                amount: afribaFees.creditedAmount.toString(),
                provider: "afribapay",
              });

              // Wave/wallet: AfribaPay returns a provider_link the user must open
              if (afribaResponse.provider_link) {
                console.log(`[AfribaPay Payin] Wave link for ${depositRef}: ${afribaResponse.provider_link}`);
                res.json({
                  transaction,
                  gateway: "afribapay",
                  waveUrl: afribaResponse.provider_link,
                  otpRequired: false,
                  status: "pending_wave",
                  message: "Cliquez sur le bouton pour finaliser votre paiement sur Wave.",
                  feeDetails: {
                    grossAmount: totalAmount,
                    feeAmount: afribaFees.totalFeeAmount,
                    creditedAmount: afribaFees.creditedAmount,
                    afribapayFee: afribaFees.afribapayFeeAmount,
                    ashtechFee: afribaFees.ashtechFeeAmount,
                  }
                });
                return;
              }

              res.json({
                transaction,
                gateway: "afribapay",
                otpRequired: false,
                status: "pending_ussd",
                message: "Appuyez sur votre téléphone pour valider le paiement USSD.",
                feeDetails: {
                  grossAmount: totalAmount,
                  feeAmount: afribaFees.totalFeeAmount,
                  creditedAmount: afribaFees.creditedAmount,
                  afribapayFee: afribaFees.afribapayFeeAmount,
                  ashtechFee: afribaFees.ashtechFeeAmount,
                }
              });
            } else {
              await storage.updateTransactionStatus(transaction.id, "failed");
              res.status(400).json({ message: afribaResponse.message || "Échec de l'initiation du paiement AfribaPay" });
            }

          } else if (paymentProvider === "pixpay") {
            // ─── PixPay Payin (USSD / OTP / Wave) ────────────────────────────
            const pixpayAutoServiceId = getPixPayServiceId((operatorRecord as any)?.name || "", countryCode, "cash_out");
            if (!pixpayAutoServiceId) {
              await storage.updateTransactionStatus(transaction.id, "failed");
              return res.status(400).json({ message: "Opérateur non supporté par PixPay pour ce pays. Contactez l'administrateur." });
            }

            const pixpayOpType: string = detectPixPayFlowType((operatorRecord as any)?.name || "", countryCode);
            const ipnUrl = `${process.env.APP_URL || ""}/api/pixpay/webhook`;
            const pixpayFeeRate = (resolvedFeeRecord as any)?.pixpayFee
              ? parseFloat((resolvedFeeRecord as any).pixpayFee.toString()) : 3.0;
            const pxFees = computePixPayFees(totalAmount, pixpayFeeRate, ashtechMarginPct);
            const cleanPhone = data.phoneNumber.replace(/\s/g, "");

            console.log(`[Deposit] PixPay type=${pixpayOpType} | country=${countryCode} | service_id=${pixpayAutoServiceId} (auto)`);

            const baseParams = {
              serviceId: String(pixpayAutoServiceId),
              amount: totalAmount,
              phone: cleanPhone,
              countryCode,
              orderId: depositRef,
              ipnUrl,
              customData: depositRef,
            };

            let pixpayResponse;

            if (pixpayOpType === "otp") {
              // Orange CI/SN/ML/BF — user must provide OTP obtained by dialing USSD code
              // The OTP pre-check above should have caught missing OTP before transaction creation.
              // This is a safety net only — we do NOT fail the transaction here.
              const omOtp = data.pixpayOtp as string | undefined;
              if (!omOtp) {
                const ussdCode = PIXPAY_OTP_USSD_CODES[countryCode.toUpperCase()] || "#144*82#";
                return res.status(400).json({
                  otpRequired: true,
                  gateway: "pixpay",
                  ussdCode,
                  message: `Composez ${ussdCode} sur votre téléphone pour obtenir votre code OTP, puis saisissez-le.`,
                });
              }
              pixpayResponse = await initiatePixPayOtp({ ...baseParams, omOtp });

            } else if (pixpayOpType === "wave") {
              // Wave CI / Wave SN — returns Wave payment URL
              const appBase = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
              pixpayResponse = await initiatePixPayWave({
                ...baseParams,
                redirectUrl: `${appBase}/dashboard/deposit?ref=${depositRef}&status=success`,
                redirectErrorUrl: `${appBase}/dashboard/deposit?ref=${depositRef}&status=cancelled`,
              });

            } else {
              // USSD push (default, most operators)
              pixpayResponse = await initiatePixPayUssd(baseParams);
            }

            if (pixpayResponse.success) {
              const extRef = pixpayResponse.transactionId || depositRef;
              await storage.updateTransactionExternalReference(transaction.id, extRef);
              addPendingPayment({
                transactionId: transaction.id,
                reference: depositRef,
                externalReference: extRef,
                attempts: 0,
                userId: user.id,
                type: "deposit",
                amount: pxFees.creditedAmount.toString(),
                provider: "pixpay",
                countryCode,
              });

              // Wave → return redirect URL to frontend
              if (pixpayOpType === "wave" && pixpayResponse.waveUrl) {
                res.json({
                  transaction,
                  gateway: "pixpay",
                  otpRequired: false,
                  waveUrl: pixpayResponse.waveUrl,
                  status: "pending_wave",
                  message: "Cliquez sur le bouton pour finaliser votre paiement via Wave.",
                  feeDetails: {
                    grossAmount: totalAmount,
                    feeAmount: pxFees.totalFeeAmount,
                    creditedAmount: pxFees.creditedAmount,
                    pixpayFee: pxFees.pixpayFeeAmount,
                    ashtechFee: pxFees.ashtechFeeAmount,
                  },
                });
                return;
              }

              res.json({
                transaction,
                gateway: "pixpay",
                otpRequired: false,
                status: pixpayOpType === "otp" ? "pending_otp_confirmed" : "pending_ussd",
                message: pixpayOpType === "otp"
                  ? "Code OTP validé. Votre paiement est en cours de traitement."
                  : "Validez le paiement USSD sur votre téléphone.",
                feeDetails: {
                  grossAmount: totalAmount,
                  feeAmount: pxFees.totalFeeAmount,
                  creditedAmount: pxFees.creditedAmount,
                  pixpayFee: pxFees.pixpayFeeAmount,
                  ashtechFee: pxFees.ashtechFeeAmount,
                },
              });
            } else {
              await storage.updateTransactionStatus(transaction.id, "failed");
              res.status(400).json({ message: pixpayResponse.message || "Échec de l'initiation du paiement PixPay" });
            }

          } else {
            // ─── Swychr Payin (default) ───────────────────────────────────────
            console.log(`[Deposit] Using Swychr for ${operatorName} in ${countryCode}`);
            const callbackUrl = `${process.env.APP_URL || ""}/api/swychr/webhook`;
            const swychrResponse = await createSwychrPaymentLink({
              country_code: countryCode,
              name: user.fullName || user.username,
              email: user.email || `${user.phone}@ashtech.pay`,
              mobile: data.phoneNumber.replace(/\s/g, ""),
              grossAmount: totalAmount,
              currency: countryCurrency,
              transaction_id: depositRef,
              description: `Dépôt Ashtech Pay - ${depositRef}`,
              callback_url: callbackUrl,
            });

            if (swychrResponse.success && swychrResponse.data?.payment_link) {
              addPendingPayment({
                transactionId: transaction.id,
                reference: depositRef,
                externalReference: depositRef,
                attempts: 0,
                userId: user.id,
                type: "deposit",
                amount: creditedAmount.toString(),
              });

              res.json({
                transaction,
                checkoutUrl: swychrResponse.data.payment_link,
                gateway: "swychr",
                message: "Veuillez compléter le paiement sur la page sécurisée",
                feeDetails: {
                  grossAmount: totalAmount,
                  feeAmount: (totalAmount - creditedAmount),
                  creditedAmount
                }
              });
            } else {
              await storage.updateTransactionStatus(transaction.id, "failed");
              res.status(400).json({ message: swychrResponse.message || "Échec de l'initiation du paiement" });
            }
          }
        } catch (gatewayError) {
          console.error("Payment gateway API error:", gatewayError);
          res.json({ 
            transaction, 
            message: "Dépôt en attente de confirmation",
            feeDetails: {
              grossAmount: totalAmount,
              feeAmount: (totalAmount - creditedAmount),
              creditedAmount
            }
          });
        }
      } else {
        res.json({ 
          transaction, 
          message: "Dépôt en attente de confirmation",
          feeDetails: {
            grossAmount: totalAmount,
            feeAmount: (totalAmount - creditedAmount),
            creditedAmount
          }
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Deposit error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Withdraw money
  app.post("/api/withdrawals", requireAuth, async (req, res) => {
    try {
      const data = withdrawSchema.parse(req.body);
      const userId = req.userId!;
      const amount = parseFloat(data.amount);

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }

      const userCurrency = user.preferredCurrency || "XAF";
      const fxRates = await loadFxRates();

      const minWithdrawalSetting = await storage.getSetting("min_withdrawal");
      const minWithdrawalXAF = minWithdrawalSetting ? parseFloat(minWithdrawalSetting.value) : 2650;
      const minWithdrawal = Math.ceil(convertFromXAF(minWithdrawalXAF, userCurrency, fxRates));
      const maxWithdrawalSetting = await storage.getSetting("max_withdrawal");
      const maxWithdrawalXAF = maxWithdrawalSetting ? parseFloat(maxWithdrawalSetting.value) : 5000000;
      const maxWithdrawal = Math.floor(convertFromXAF(maxWithdrawalXAF, userCurrency, fxRates));

      if (amount < minWithdrawal) {
        return res.status(400).json({ message: `Le montant minimum de retrait est de ${minWithdrawal.toLocaleString()} ${userCurrency}` });
      }
      if (amount > maxWithdrawal) {
        return res.status(400).json({ message: `Le montant maximum de retrait est de ${maxWithdrawal.toLocaleString()} ${userCurrency}` });
      }

      // Resolve country info for currency and country code
      const withdrawalCountry = await storage.getCountry(data.countryId);
      const withdrawalCurrency = withdrawalCountry?.currency || userCurrency;
      const withdrawalCountryCode = withdrawalCountry?.code || "CM";

      // Fetch operator early to determine provider before fee calculation
      const withdrawalOperator = await storage.getOperator(data.operatorId);
      const withdrawalProvider = (withdrawalOperator?.paymentProvider || "swychr") as string;

      // Calculate fee using fee resolution — provider-aware
      const fee = await storage.resolveFee("withdrawal", data.countryId, data.operatorId);
      let feeAmount = 0;
      let ashtechFeeAmount = 0;
      if (fee) {
        const marginRate = fee.ashtechMargin ? parseFloat(fee.ashtechMargin.toString()) : 0;

        let providerRate = 0;
        if (withdrawalProvider === "afribapay") {
          providerRate = fee.afribapayFee ? parseFloat(fee.afribapayFee.toString()) : 0;
        } else if (withdrawalProvider === "pixpay") {
          providerRate = fee.pixpayFee ? parseFloat(fee.pixpayFee.toString()) : 0;
        } else {
          providerRate = fee.swychrFee ? parseFloat(fee.swychrFee.toString()) : 0;
        }
        const totalRate = providerRate + marginRate;
        const minCharge = fee.minFee ? parseFloat(fee.minFee.toString()) : 0;

        let calculatedFee = 0;
        if (fee.feeType === "percentage" || totalRate > 0) {
          const rateToUse = totalRate > 0 ? totalRate : parseFloat(fee.feeValue.toString());
          calculatedFee = (amount * rateToUse) / 100;
          
          if (totalRate > 0) {
            ashtechFeeAmount = (amount * marginRate) / 100;
          } else {
            ashtechFeeAmount = calculatedFee;
          }
        } else {
          calculatedFee = parseFloat(fee.feeValue.toString());
          ashtechFeeAmount = calculatedFee;
        }

        // Rule: minFee only applies to Swychr — AfribaPay/PixPay use exact configured rate
        if (withdrawalProvider === "swychr" && calculatedFee < minCharge) {
          calculatedFee = minCharge;
          ashtechFeeAmount = 100;
        }

        if (fee.maxFee && calculatedFee > parseFloat(fee.maxFee.toString())) {
          calculatedFee = parseFloat(fee.maxFee.toString());
        }
        
        feeAmount = calculatedFee;
      }
      const creditedAmount = amount - feeAmount;
      const totalAmount = amount;

      // Check primary wallet balance BEFORE any deduction
      if (parseFloat(user.balance) < amount) {
        return res.status(400).json({ message: `Solde insuffisant dans votre compte principal (${amount.toFixed(0)} ${userCurrency} requis)` });
      }

      // Debit primary wallet
      await storage.updateUserBalance(userId, -amount);

      console.log(`[Withdrawal] User=${userId}, RequestedAmount=${amount}, Fee=${feeAmount}, NetToUser=${creditedAmount} (${withdrawalCurrency})`);

      const withdrawalRef = generateTransactionReference("withdrawal");
      const transaction = await storage.createTransaction({
        userId,
        type: "withdrawal",
        amount: creditedAmount.toFixed(2),
        currency: withdrawalCurrency,
        status: "pending",
        description: `Retrait vers ${data.accountDetails}`,
        paymentMethod: data.paymentMethod,
        reference: withdrawalRef,
        feeAmount: ashtechFeeAmount.toFixed(2),
        totalAmount: amount.toFixed(2),
        recipientName: user.fullName || user.username || "Client",
        recipientPhone: data.accountDetails,
        recipientCountry: withdrawalCountryCode,
        operatorId: data.operatorId ? String(data.operatorId) : undefined,
      });

      console.log(`[Withdrawal] Created withdrawal ${withdrawalRef} for ${creditedAmount} — calling payout gateway`);

      // Call payout API immediately — choose provider based on operator config
      try {
        const operator = withdrawalOperator;
        const operatorName = (operator?.name || "").toUpperCase();
        const countryCode = withdrawalCountryCode.toUpperCase();
        const paymentProvider = withdrawalProvider;

        let payoutResult: { success: boolean; transaction_id?: string; message?: string };

        if (paymentProvider === "afribapay") {
          // ─── AfribaPay Payout ────────────────────────────────────────────────
          const afribapayOperatorCode = resolveAfribaPayOperatorCode(operator, operatorName);
          const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[countryCode.toUpperCase()] || withdrawalCurrency;
          console.log(`[Withdrawal] AfribaPay | country=${countryCode} | currency=${afribapayCurrency} | operator=${afribapayOperatorCode}`);
          const callbackUrl = `${process.env.APP_URL || ""}/api/afribapay/webhook`;

          // Strip country prefix from phone
          let localPhone = data.accountDetails.replace(/\s/g, "");
          if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
          const phonePrefixes: Record<string, string> = {
            CM: "237", SN: "221", CI: "225", BF: "226", ML: "223",
            GN: "224", BJ: "229", TG: "228", NE: "227", CD: "243",
            CG: "242", CF: "236", TD: "235", GA: "241", GQ: "240",
            MG: "261", RW: "250", KE: "254", TZ: "255", UG: "256",
            GH: "233", NG: "234",
          };
          const pfx = phonePrefixes[countryCode];
          if (pfx && localPhone.startsWith(pfx)) localPhone = localPhone.slice(pfx.length);

          const afribaResult = await initiateAfribaPayout({
            operator: afribapayOperatorCode,
            country: countryCode,
            phone_number: localPhone,
            amount: creditedAmount,
            currency: afribapayCurrency,
            order_id: withdrawalRef,
            reference_id: withdrawalRef,
            notify_url: callbackUrl,
          });
          if (afribaResult.success && afribaResult.transaction_id) {
            await storage.updateTransactionExternalReference(transaction.id, afribaResult.transaction_id);
          }
          payoutResult = afribaResult;

        } else if (paymentProvider === "pixpay") {
          // ─── PixPay Payout ──────────────────────────────────────────────────
          const cashOutServiceId = getPixPayServiceId(operator?.name || "", countryCode, "cash_in");
          if (!cashOutServiceId) {
            console.error(`[Withdrawal] PixPay: no cash_in service_id for ${operator?.name} in ${countryCode}`);
            await storage.updateTransactionStatus(transaction.id, "failed");
            await storage.updateUserBalance(userId, totalAmount);
            return res.status(400).json({
              message: `Retrait PixPay non supporté pour cet opérateur (${operator?.name}) dans ce pays`,
            });
          }
          console.log(`[Withdrawal] PixPay | country=${countryCode} | service_id=${cashOutServiceId} | operator=${operator?.name}`);
          const pixpayPayoutIpnUrl = `${process.env.APP_URL || ""}/api/pixpay/webhook`;
          const pixpayResult = await initiatePixPayPayout({
            serviceId: String(cashOutServiceId),
            amount: creditedAmount,
            phone: data.accountDetails.replace(/\s/g, ""),
            countryCode,
            orderId: withdrawalRef,
            ipnUrl: pixpayPayoutIpnUrl,
            customData: withdrawalRef,
          });
          if (pixpayResult.success && pixpayResult.transactionId) {
            await storage.updateTransactionExternalReference(transaction.id, pixpayResult.transactionId);
          }
          payoutResult = {
            success: pixpayResult.success,
            transaction_id: pixpayResult.transactionId,
            message: pixpayResult.message,
          };

        } else {
          // ─── Swychr Payout (default) ─────────────────────────────────────────
          console.log(`[Withdrawal] Using Swychr for ${operatorName} in ${countryCode}`);
          const finalPaymentMethod = resolvePaymentMethod(operatorName, countryCode);
          const swychrResult = await createSwychrPayout({
            country_code:     withdrawalCountryCode,
            beneficiary_name: user.fullName || user.username || "Client",
            mobile_no:        formatInternationalPhone(data.accountDetails, withdrawalCountryCode),
            amount:           creditedAmount,
            transaction_id:   withdrawalRef,
            payment_method:   finalPaymentMethod as any,
            remarks:          `Ashtech Pay - ${withdrawalRef}`,
          });
          payoutResult = swychrResult;
        }

        if (payoutResult.success) {
          console.log(`[Withdrawal] Payout submitted OK: ${withdrawalRef} (ext: ${payoutResult.transaction_id})`);
          const pollerRef = paymentProvider === "afribapay"
            ? withdrawalRef
            : paymentProvider === "pixpay"
              ? (payoutResult.transaction_id || withdrawalRef)
              : (payoutResult.transaction_id || withdrawalRef);
          addPendingPayout({
            transactionId: transaction.id,
            reference:     pollerRef,
            userId,
            amount:        data.amount,
            totalDebited:  totalAmount.toFixed(2),
            provider:      paymentProvider as "swychr" | "afribapay" | "pixpay",
            countryCode,
          });
        } else {
          const errMsg = (payoutResult.message || "").toLowerCase();
          const requiresManualReview =
            errMsg.includes("forbidden") ||
            errMsg.includes("whitelist") ||
            errMsg.includes("insuffi") ||
            errMsg.includes("solde") ||
            errMsg.includes("balance");
          if (requiresManualReview) {
            console.log(`[Withdrawal] Pending manual review for ${withdrawalRef} (${paymentProvider}): ${payoutResult.message}`);
            await storage.updateTransactionStatus(transaction.id, "pending_manual");
            await storage.createUserNotification({
              userId,
              type: "withdrawal_pending",
              title: "Retrait en attente",
              message: `Votre retrait de ${amount.toLocaleString()} ${withdrawalCurrency} est en cours de traitement. Il sera envoyé sur votre mobile dès validation par l'équipe Ashtech Pay.`,
              transactionId: transaction.id,
              isRead: false,
            });
          } else {
            console.error(`[Withdrawal] Payout failed for ${withdrawalRef} (${paymentProvider}): ${payoutResult.message}`);
            await storage.updateTransactionStatus(transaction.id, "failed");
            await storage.updateUserBalance(userId, totalAmount);
            return res.status(400).json({
              message: `Le retrait a échoué: ${payoutResult.message}`,
            });
          }
        }
      } catch (payoutErr: any) {
        console.error(`[Withdrawal] Payout error for ${withdrawalRef}:`, payoutErr.message);
      }

      res.json({ 
        transaction,
        feeDetails: {
          requestedAmount: amount,
          feeAmount,
          totalDebited: totalAmount
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Withdrawal error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Fee calculation endpoint
  app.post("/api/fees/calculate", requireAuth, async (req, res) => {
    try {
      const { transactionType, amount, countryId, operatorId } = req.body;
      const numAmount = parseFloat(amount) || 0;
      
      if (numAmount <= 0) {
        return res.json({ feeAmount: 0, netAmount: 0, totalAmount: 0, feePercentage: 0 });
      }

      const fee = await storage.resolveFee(transactionType, countryId, operatorId);
      let feeAmount = 0;
      let feePercentage = 0;
      
      if (fee) {
        const swychrRate = fee.swychrFee ? parseFloat(fee.swychrFee.toString()) : 0;
        const marginRate = fee.ashtechMargin ? parseFloat(fee.ashtechMargin.toString()) : 0;
        const totalRate = swychrRate + marginRate;
        const minCharge = fee.minFee ? parseFloat(fee.minFee.toString()) : 0;

        if (fee.feeType === "percentage" || totalRate > 0) {
          feePercentage = totalRate > 0 ? totalRate : parseFloat(fee.feeValue.toString());
          feeAmount = (numAmount * feePercentage) / 100;
        } else {
          feeAmount = parseFloat(fee.feeValue.toString());
        }

        // Apply Min Charge Rule
        if (feeAmount < minCharge) {
          feeAmount = minCharge;
        }

        if (fee.maxFee && feeAmount > parseFloat(fee.maxFee.toString())) {
          feeAmount = parseFloat(fee.maxFee.toString());
        }
      }

      // For deposits: user pays 'amount', net = amount - fee
      // For withdrawals: user pays 'amount', net = amount - fee
      const netAmount = numAmount - feeAmount;
      const totalAmount = numAmount;

      res.json({
        feeAmount: Math.round(feeAmount * 100) / 100,
        netAmount: Math.round(netAmount * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        feePercentage,
        feeType: fee?.feeType || "none",
        feeName: fee?.name || null,
      });
    } catch (error) {
      console.error("Fee calculation error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ── Multi-currency wallets ─────────────────────────────────────────────────

  // GET /api/wallets — list all user wallets (XAF from user.balance + others from wallets table)
  app.get("/api/wallets", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const extraWallets = await storage.getUserWallets(userId);

      // Primary wallet uses the user's preferred currency (not hardcoded XAF)
      const primaryCurrency = (user.preferredCurrency || "XAF") as SupportedCurrency;
      const primaryWallet = {
        currency: primaryCurrency,
        balance: user.balance,
        symbol: CURRENCY_SYMBOLS[primaryCurrency] || primaryCurrency,
      };

      // Extra wallets: exclude the primary currency to avoid duplicates
      const result = [
        primaryWallet,
        ...extraWallets
          .filter(w => w.currency !== primaryCurrency)
          .map(w => ({
            currency: w.currency,
            balance: w.balance,
            symbol: CURRENCY_SYMBOLS[w.currency as SupportedCurrency] || w.currency,
          })),
      ];

      res.json(result);
    } catch (error) {
      console.error("Get wallets error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/wallets/convert — submit a conversion request (saved as pending, admin executes it)
  app.post("/api/wallets/convert", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { fromCurrency, toCurrency, amount } = req.body;

      if (!fromCurrency || !toCurrency || !amount) {
        return res.status(400).json({ message: "fromCurrency, toCurrency et amount sont requis" });
      }
      if (fromCurrency === toCurrency) {
        return res.status(400).json({ message: "Les deux devises doivent être différentes" });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const userPrimary = user.preferredCurrency || "XAF";

      // Check source balance
      let sourceBalance: number;
      if (fromCurrency === userPrimary) {
        sourceBalance = parseFloat(user.balance);
      } else {
        const w = await storage.getWallet(userId, fromCurrency);
        sourceBalance = w ? parseFloat(w.balance) : 0;
      }
      if (sourceBalance < parsedAmount) {
        return res.status(400).json({ message: `Solde insuffisant en ${fromCurrency} (disponible: ${sourceBalance.toFixed(2)})` });
      }

      // Determine which provider funded the source wallet (from last deposit/payment_link transaction)
      let conversionProvider = "swychr";
      const lastIncomingTx = await storage.getLastIncomingTransactionByCurrency(userId, fromCurrency);
      if (lastIncomingTx?.operatorId) {
        const txOperator = await storage.getOperator(lastIncomingTx.operatorId).catch(() => null);
        if (txOperator) conversionProvider = (txOperator as any).paymentProvider || "swychr";
      }

      // Use provider-specific conversion fee configured by admin
      const feeKey = conversionProvider === "pixpay"
        ? "conversion_fee_percent_pixpay"
        : conversionProvider === "afribapay"
          ? "conversion_fee_percent_afribapay"
          : "conversion_fee_percent_swychr";
      const conversionFeePercentSetting = await storage.getSetting(feeKey);
      // Fallback to legacy key if provider-specific not set
      const fallbackSetting = await storage.getSetting("conversion_fee_percent");
      const conversionFeePercent = conversionFeePercentSetting
        ? parseFloat(conversionFeePercentSetting.value)
        : fallbackSetting ? parseFloat(fallbackSetting.value) : 6;
      console.log(`[Conversion] fromCurrency=${fromCurrency} provider=${conversionProvider} feeKey=${feeKey} fee=${conversionFeePercent}%`);
      const totalFeeAmount = (parsedAmount * conversionFeePercent) / 100;

      // Ashtech margin for conversion is strictly 2% as per user request
      const ashtechMarginPercent = 2;
      const ashtechFeeAmount = (parsedAmount * ashtechMarginPercent) / 100;

      const amountAfterFee = parsedAmount - totalFeeAmount;

      // Use admin "Devises & Taux de change" rates for conversion
      const convFxRates = await loadFxRates();
      const amountInXAF = convertToXAF(amountAfterFee, fromCurrency, convFxRates);
      const receivedAmount = convertFromXAF(amountInXAF, toCurrency, convFxRates);

      // Record transaction BEFORE moving money
      const transaction = await storage.createTransaction({
        userId,
        type: "conversion",
        amount: parsedAmount.toFixed(2),
        currency: fromCurrency,
        status: "completed",
        description: `Conversion ${parsedAmount.toFixed(2)} ${fromCurrency} → ${receivedAmount.toFixed(2)} ${toCurrency} (Frais: ${conversionFeePercent}%)`,
        reference: generateTransactionReference("CONV"),
        feeAmount: ashtechFeeAmount.toFixed(2),
        totalAmount: parsedAmount.toFixed(2),
      });

      // Debit source and credit target after transaction is created
      if (fromCurrency === userPrimary) {
        await storage.updateUserBalance(userId, -parsedAmount);
      } else {
        await storage.upsertWallet(userId, fromCurrency, -parsedAmount);
      }
      if (toCurrency === userPrimary) {
        await storage.updateUserBalance(userId, receivedAmount);
      } else {
        await storage.upsertWallet(userId, toCurrency, receivedAmount);
      }
      await cleanupEmptyWallets(userId);

      // Save as a completed conversion request for admin record (manual Swychr sync)
      await storage.createConversionRequest({
        userId,
        fromCurrency,
        toCurrency,
        fromAmount: parsedAmount.toFixed(2),
        toAmount: receivedAmount.toFixed(2),
        status: "completed",
        notes: `Conversion automatique sur Ashtech Pay. À synchroniser manuellement sur Swychr. Frais: ${totalFeeAmount.toFixed(2)} ${fromCurrency} (${conversionFeePercent}%)`,
        executedAt: new Date(),
        executedById: userId,
      });

      // Notify user
      await storage.createUserNotification({
        userId,
        title: "Conversion effectuée",
        message: `Votre conversion de ${parsedAmount.toFixed(2)} ${fromCurrency} → ${receivedAmount.toFixed(2)} ${toCurrency} a été effectuée. Frais appliqués: ${totalFeeAmount.toFixed(2)} ${fromCurrency}.`,
        transactionId: transaction.id,
        type: "success",
      });

      return res.json({
        success: true,
        fromAmount: parsedAmount,
        fromCurrency,
        toAmount: receivedAmount,
        toCurrency,
        feeAmount: totalFeeAmount,
        message: `Conversion effectuée avec succès sur votre compte Ashtech Pay.`,
      });
    } catch (error) {
      console.error("Convert wallet error:", error);
      res.status(500).json({ message: "Erreur serveur lors de la conversion" });
    }
  });

  // Admin: Convert a user's balance between currencies
  app.post("/api/admin/users/:id/convert", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userId = req.params.id;
      const { fromCurrency, toCurrency, amount } = req.body;
      if (!fromCurrency || !toCurrency || !amount) {
        return res.status(400).json({ message: "fromCurrency, toCurrency et amount sont requis" });
      }
      if (fromCurrency === toCurrency) {
        return res.status(400).json({ message: "Les deux devises doivent être différentes" });
      }
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }

      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const primaryCurrency = user.preferredCurrency || "XAF";

      // Check & verify source balance
      let sourceBalance: number;
      if (fromCurrency === primaryCurrency) {
        sourceBalance = parseFloat(user.balance);
      } else {
        const w = await storage.getWallet(userId, fromCurrency);
        sourceBalance = w ? parseFloat(w.balance) : 0;
      }
      if (sourceBalance < parsedAmount) {
        return res.status(400).json({ message: `Solde insuffisant en ${fromCurrency} (disponible: ${sourceBalance.toFixed(2)})` });
      }

      // Apply same conversion fee as user-facing flow
      const conversionFeePercentSetting = await storage.getSetting("conversion_fee_percent");
      const conversionFeePercent = conversionFeePercentSetting ? parseFloat(conversionFeePercentSetting.value) : 6;
      const feeAmount = (parsedAmount * conversionFeePercent) / 100;
      const adminAshtechFeeAmount = (parsedAmount * 2) / 100;
      const amountAfterFee = parsedAmount - feeAmount;

      const convFxRates = await loadFxRates();
      const amountInXAF = convertToXAF(amountAfterFee, fromCurrency, convFxRates);
      const receivedAmount = convertFromXAF(amountInXAF, toCurrency, convFxRates);

      // Record transaction BEFORE moving money
      const transaction = await storage.createTransaction({
        userId,
        type: "conversion",
        amount: parsedAmount.toFixed(2),
        currency: fromCurrency,
        status: "completed",
        description: `Conversion admin: ${parsedAmount.toFixed(2)} ${fromCurrency} → ${receivedAmount.toFixed(2)} ${toCurrency} (Frais: ${conversionFeePercent}%)`,
        reference: generateTransactionReference("CONV"),
        feeAmount: adminAshtechFeeAmount.toFixed(2),
        totalAmount: parsedAmount.toFixed(2),
      });

      // Debit source and credit target after transaction is created
      if (fromCurrency === primaryCurrency) {
        await storage.updateUserBalance(userId, -parsedAmount);
      } else {
        await storage.upsertWallet(userId, fromCurrency, -parsedAmount);
      }
      if (toCurrency === primaryCurrency) {
        await storage.updateUserBalance(userId, receivedAmount);
      } else {
        await storage.upsertWallet(userId, toCurrency, receivedAmount);
      }
      await cleanupEmptyWallets(userId);

      await storage.createConversionRequest({
        userId,
        fromCurrency,
        toCurrency,
        fromAmount: parsedAmount.toFixed(2),
        toAmount: receivedAmount.toFixed(2),
        status: "completed",
        notes: `Conversion exécutée par admin. Frais: ${feeAmount.toFixed(2)} ${fromCurrency} (${conversionFeePercent}%)`,
        executedAt: new Date(),
        executedById: req.userId!,
      });

      await storage.createUserNotification({
        userId,
        title: "Conversion effectuée par l'admin",
        message: `Une conversion a été effectuée sur votre compte : ${parsedAmount.toFixed(2)} ${fromCurrency} → ${receivedAmount.toFixed(2)} ${toCurrency}. Frais: ${feeAmount.toFixed(2)} ${fromCurrency}.`,
        transactionId: transaction.id,
        type: "success",
      });

      return res.json({
        success: true,
        fromAmount: parsedAmount,
        fromCurrency,
        toAmount: receivedAmount,
        toCurrency,
        feeAmount,
        conversionFeePercent,
        message: `Conversion effectuée avec succès.`,
      });
    } catch (error) {
      console.error("Admin convert error:", error);
      res.status(500).json({ message: "Erreur serveur lors de la conversion" });
    }
  });

  // Public settings
  app.get("/api/settings/:key", async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      res.json(setting || { value: "" });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: settings
  app.get("/api/admin/settings/:key", requireAuth, requireAdmin, async (req, res) => {
    try {
      const setting = await storage.getSetting(req.params.key);
      res.json(setting || { value: "" });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { key, value, description } = req.body;
      const setting = await storage.upsertSetting(key, value, description);
      res.json(setting);
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // GET /api/admin/conversion-requests — list all conversion requests
  app.get("/api/admin/conversion-requests", requireAuth, requireAdmin, async (req, res) => {
    try {
      const filter = req.query.status as string | undefined;
      let requests;
      if (filter === "pending") {
        requests = await storage.getPendingConversionRequests();
      } else {
        requests = await storage.getAllConversionRequests();
      }
      res.json(requests);
    } catch (error) {
      console.error("Admin get conversion requests error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // GET /api/admin/conversion-requests/count — pending count for sidebar badge
  app.get("/api/admin/conversion-requests/count", requireAuth, requireAdmin, async (req, res) => {
    try {
      const count = await storage.countPendingConversions();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/admin/conversion-requests/:id/execute — execute a pending conversion
  app.post("/api/admin/conversion-requests/:id/execute", requireAuth, requireAdmin, async (req, res) => {
    try {
      const adminId = req.userId!;
      const { id } = req.params;
      const request = await storage.getConversionRequest(id);
      if (!request) return res.status(404).json({ message: "Demande non trouvée" });
      if (request.status !== "pending") return res.status(400).json({ message: `Statut invalide: ${request.status}` });

      const fromAmount = parseFloat(request.fromAmount);

      // Get real Swychr rate — no fallback, must succeed
      const convResult = await getConversionRate(request.fromCurrency, request.toCurrency, fromAmount);
      if (!convResult.success || convResult.targetAmount === undefined) {
        return res.status(400).json({
          message: `Solde Swychr insuffisant pour exécuter cette conversion. Rechargez le compte Swychr avant de réessayer. (${convResult.message || "taux indisponible"})`,
        });
      }
      const receivedAmount = convResult.targetAmount;

      // Credit target wallet
      if (request.toCurrency === "XAF") {
        await storage.updateUserBalance(request.userId, receivedAmount);
      } else {
        // Ensure target wallet exists
        await storage.upsertWallet(request.userId, request.toCurrency, receivedAmount);
      }

      // Update request
      await storage.updateConversionRequest(id, {
        status: "completed",
        toAmount: receivedAmount.toFixed(2),
        executedAt: new Date(),
        executedById: adminId,
      });

      // Record transaction
      await storage.createTransaction({
        userId: request.userId,
        type: "conversion",
        amount: fromAmount.toFixed(2),
        currency: request.fromCurrency,
        status: "completed",
        description: `Conversion ${fromAmount.toFixed(2)} ${request.fromCurrency} → ${receivedAmount.toFixed(2)} ${request.toCurrency}`,
        reference: `conv_${id}`,
        feeAmount: "0",
        totalAmount: fromAmount.toFixed(2),
      });

      // Notify user
      await storage.createUserNotification({
        userId: request.userId,
        title: "Conversion effectuée",
        message: `Votre conversion de ${fromAmount.toFixed(2)} ${request.fromCurrency} → ${receivedAmount.toFixed(2)} ${request.toCurrency} a été effectuée avec succès.`,
        type: "success",
      });

      res.json({
        success: true,
        fromAmount,
        fromCurrency: request.fromCurrency,
        toAmount: receivedAmount,
        toCurrency: request.toCurrency,
        message: `Conversion exécutée : ${fromAmount.toFixed(2)} ${request.fromCurrency} → ${receivedAmount.toFixed(2)} ${request.toCurrency}`,
      });
    } catch (error) {
      console.error("Admin execute conversion error:", error);
      res.status(500).json({ message: "Erreur serveur lors de l'exécution" });
    }
  });

  // POST /api/admin/conversion-requests/:id/cancel — cancel & refund
  app.post("/api/admin/conversion-requests/:id/cancel", requireAuth, requireAdmin, async (req, res) => {
    try {
      const adminId = req.userId!;
      const { id } = req.params;
      const { reason } = req.body;
      const request = await storage.getConversionRequest(id);
      if (!request) return res.status(404).json({ message: "Demande non trouvée" });
      if (request.status !== "pending") return res.status(400).json({ message: `Statut invalide: ${request.status}` });

      const fromAmount = parseFloat(request.fromAmount);

      // Refund source wallet
      if (request.fromCurrency === "XAF") {
        await storage.updateUserBalance(request.userId, fromAmount);
      } else {
        await storage.upsertWallet(request.userId, request.fromCurrency, fromAmount);
      }

      // Update request
      await storage.updateConversionRequest(id, {
        status: "cancelled",
        notes: reason || "Annulé par l'administration",
        executedAt: new Date(),
        executedById: adminId,
      });

      // Notify user
      await storage.createUserNotification({
        userId: request.userId,
        title: "Conversion annulée",
        message: `Votre demande de conversion de ${fromAmount.toFixed(2)} ${request.fromCurrency} → ${request.toCurrency} a été annulée. Le montant a été remboursé sur votre compte.`,
        type: "warning",
      });

      res.json({ success: true, message: "Demande annulée et remboursée" });
    } catch (error) {
      console.error("Admin cancel conversion error:", error);
      res.status(500).json({ message: "Erreur serveur lors de l'annulation" });
    }
  });

  // POST /api/wallets/create — open a new empty wallet for a currency
  app.post("/api/wallets/create", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { currency } = req.body;
      const validCurrencyCodes = new Set(ALL_FX_CURRENCIES.map((c: { code: string }) => c.code));
      if (!currency || !validCurrencyCodes.has(currency)) {
        return res.status(400).json({ message: "Devise non supportée" });
      }
      const walletUser = await storage.getUser(userId);
      const primaryCurr = walletUser?.preferredCurrency || "XAF";
      if (currency === primaryCurr) {
        return res.status(400).json({ message: `Le compte ${primaryCurr} est votre compte principal` });
      }
      const existing = await storage.getWallet(userId, currency);
      if (existing) {
        return res.status(400).json({ message: `Un compte ${currency} existe déjà` });
      }
      const wallet = await storage.setWalletBalance(userId, currency, 0);
      res.json({ success: true, wallet });
    } catch (error) {
      console.error("Create wallet error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // DELETE /api/wallets/:currency — désactiver un wallet secondaire (la somme est perdue)
  app.delete('/api/wallets/:currency', requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const { currency } = req.params;
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
      const primaryCurr = user.preferredCurrency || 'XAF';
      if (currency === primaryCurr) {
        return res.status(400).json({ message: 'Impossible de désactiver le compte principal' });
      }
      const wallet = await storage.getWallet(userId, currency);
      if (!wallet) return res.status(404).json({ message: 'Compte non trouvé' });
      await storage.deleteWallet(wallet.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete wallet error:', error);
      res.status(500).json({ message: 'Erreur serveur' });
    }
  });

  // POST /api/wallets/convert-preview — preview conversion rate (no actual conversion, no Swychr balance needed)
  app.post("/api/wallets/convert-preview", requireAuth, async (req, res) => {
    try {
      const { fromCurrency, toCurrency, amount } = req.body;
      const parsedAmount = parseFloat(amount || "0");
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }

      const convResult = await getConversionRate(fromCurrency, toCurrency, parsedAmount);
      if (!convResult.success || convResult.targetAmount === undefined) {
        return res.status(400).json({ message: `Taux non disponible: ${convResult.message}` });
      }

      res.json({
        fromAmount: parsedAmount,
        fromCurrency,
        toAmount: convResult.targetAmount,
        toCurrency,
        rate: convResult.rate,
      });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Withdrawal numbers routes (user can register max 2 numbers)
  app.get("/api/withdrawal-numbers", requireAuth, async (req, res) => {
    try {
      const numbers = await storage.getWithdrawalNumbersByUserId(req.userId!);
      res.json(numbers);
    } catch (error) {
      console.error("Get withdrawal numbers error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/withdrawal-numbers", requireAuth, async (req, res) => {
    try {
      const { phoneNumber, operatorName, label } = req.body;
      const userId = req.userId!;

      if (!phoneNumber || phoneNumber.length < 8) {
        return res.status(400).json({ message: "Numéro de téléphone invalide (min 8 caractères)" });
      }
      if (!operatorName || operatorName.length < 1) {
        return res.status(400).json({ message: "Opérateur requis" });
      }

      // Check limit of 2 numbers per user
      const count = await storage.countUserWithdrawalNumbers(userId);
      if (count >= 2) {
        return res.status(400).json({ message: "Vous pouvez enregistrer maximum 2 numéros de retrait" });
      }

      // Check for duplicate phone number
      const existingNumbers = await storage.getWithdrawalNumbersByUserId(userId);
      if (existingNumbers.some(n => n.phoneNumber === phoneNumber)) {
        return res.status(400).json({ message: "Ce numéro est déjà enregistré" });
      }

      const number = await storage.createWithdrawalNumber({
        userId,
        phoneNumber,
        operatorName,
        label: label || null,
        isActive: true,
      });

      res.json(number);
    } catch (error) {
      console.error("Create withdrawal number error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Request modification of a withdrawal number (needs admin approval)
  app.post("/api/withdrawal-numbers/:id/request-change", requireAuth, async (req, res) => {
    try {
      const numberId = req.params.id;
      const userId = req.userId!;
      const { phoneNumber, operatorName, label } = req.body;

      // Validate input
      if (!phoneNumber || phoneNumber.length < 8) {
        return res.status(400).json({ message: "Numéro de téléphone invalide (min 8 caractères)" });
      }
      if (!operatorName || operatorName.length < 1) {
        return res.status(400).json({ message: "Opérateur requis" });
      }

      const existingNumber = await storage.getWithdrawalNumber(numberId);
      if (!existingNumber || existingNumber.userId !== userId) {
        return res.status(404).json({ message: "Numéro de retrait non trouvé" });
      }

      // Check for pending requests on this number
      const pendingChanges = await storage.getWithdrawalNumberChangesByUserId(userId);
      const hasPendingChange = pendingChanges.some(
        c => c.withdrawalNumberId === numberId && c.status === "pending"
      );
      if (hasPendingChange) {
        return res.status(400).json({ message: "Une demande de modification est déjà en attente pour ce numéro" });
      }

      // Create change request
      const changeRequest = await storage.createWithdrawalNumberChange({
        userId,
        withdrawalNumberId: numberId,
        action: "update",
        newPhoneNumber: phoneNumber,
        newOperatorName: operatorName,
        newLabel: label,
        status: "pending",
      });

      res.json({ 
        changeRequest, 
        message: "Demande de modification envoyée. Un administrateur doit approuver le changement." 
      });
    } catch (error) {
      console.error("Request change error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Request deletion of a withdrawal number (needs admin approval)
  app.post("/api/withdrawal-numbers/:id/request-delete", requireAuth, async (req, res) => {
    try {
      const numberId = req.params.id;
      const userId = req.userId!;

      const existingNumber = await storage.getWithdrawalNumber(numberId);
      if (!existingNumber || existingNumber.userId !== userId) {
        return res.status(404).json({ message: "Numéro de retrait non trouvé" });
      }

      // Check for pending requests on this number
      const pendingChanges = await storage.getWithdrawalNumberChangesByUserId(userId);
      const hasPendingChange = pendingChanges.some(
        c => c.withdrawalNumberId === numberId && c.status === "pending"
      );
      if (hasPendingChange) {
        return res.status(400).json({ message: "Une demande est déjà en attente pour ce numéro" });
      }

      // Create delete request
      const changeRequest = await storage.createWithdrawalNumberChange({
        userId,
        withdrawalNumberId: numberId,
        action: "delete",
        status: "pending",
      });

      res.json({ 
        changeRequest, 
        message: "Demande de suppression envoyée. Un administrateur doit approuver." 
      });
    } catch (error) {
      console.error("Request delete error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get user's pending change requests
  app.get("/api/withdrawal-number-changes", requireAuth, async (req, res) => {
    try {
      const changes = await storage.getWithdrawalNumberChangesByUserId(req.userId!);
      res.json(changes);
    } catch (error) {
      console.error("Get change requests error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Payment link routes
  app.get("/api/payment-links", requireAuth, async (req, res) => {
    try {
      const paymentLinks = await storage.getPaymentLinksByUserId(req.userId!);
      res.json(paymentLinks);
    } catch (error) {
      console.error("Get payment links error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/payment-links/:id", requireAuth, async (req, res) => {
    try {
      const link = await storage.getPaymentLinkById(req.params.id);
      if (!link) return res.status(404).json({ message: "Lien introuvable" });
      if (link.userId !== req.userId!) return res.status(403).json({ message: "Non autorisé" });
      res.json(link);
    } catch (error) {
      console.error("Get payment link by id error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/payment-links", requireAuth, async (req, res) => {
    try {
      const data = createPaymentLinkSchema.parse(req.body);
      const userId = req.userId!;

      // Use custom slug if provided, otherwise generate one
      let slug = data.customSlug?.trim() || generateSlug();
      
      // Check if slug is already taken
      const existingLink = await storage.getPaymentLinkBySlug(slug);
      if (existingLink) {
        if (data.customSlug) {
          return res.status(400).json({ message: "Cette URL personnalisée est déjà utilisée" });
        }
        // Generate a new slug if auto-generated one is taken
        while (await storage.getPaymentLinkBySlug(slug)) {
          slug = generateSlug();
        }
      }

      const paymentLink = await storage.createPaymentLink({
        userId,
        title: data.title,
        description: data.description || null,
        amount: data.isFixedAmount ? data.amount : "0",
        currency: "XAF",
        slug,
        isFixedAmount: data.isFixedAmount,
        imagePath: data.imagePath || null,
        pdfPath: data.pdfPath || null,
        hasPdfDelivery: data.hasPdfDelivery || false,
        redirectUrl: data.redirectUrl || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        allowedCountries: (data.allowedCountries && data.allowedCountries.length > 0) ? data.allowedCountries : null,
      });

      res.json(paymentLink);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Create payment link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Update payment link (edit or deactivate)
  app.patch("/api/payment-links/:id", requireAuth, async (req, res) => {
    try {
      const linkId = req.params.id;
      const userId = req.userId!;

      const existingLink = await storage.getPaymentLinkById(linkId);
      if (!existingLink) {
        return res.status(404).json({ message: "Lien de paiement non trouvé" });
      }
      if (existingLink.userId !== userId) {
        return res.status(403).json({ message: "Non autorisé" });
      }

      const updates = { ...req.body };
      
      // Handle slug update - check uniqueness if slug is being changed
      if (updates.customSlug !== undefined) {
        let newSlug = updates.customSlug?.trim() || "";
        if (newSlug) {
          // User provided a custom slug, check if it's different and unique
          if (newSlug !== existingLink.slug) {
            const existingSlug = await storage.getPaymentLinkBySlug(newSlug);
            if (existingSlug && existingSlug.id !== linkId) {
              return res.status(400).json({ message: "Ce slug est déjà utilisé" });
            }
            updates.slug = newSlug;
          }
        } else {
          // Empty slug - generate a new unique one
          updates.slug = generateSlug();
        }
        delete updates.customSlug;
      }

      // Handle amount based on isFixedAmount
      if (updates.isFixedAmount !== undefined) {
        if (!updates.isFixedAmount) {
          updates.amount = "0";
        }
      }

      const updatedLink = await storage.updatePaymentLink(linkId, updates);
      res.json(updatedLink);
    } catch (error) {
      console.error("Update payment link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Delete payment link
  app.delete("/api/payment-links/:id", requireAuth, async (req, res) => {
    try {
      const linkId = req.params.id;
      const userId = req.userId!;

      const existingLink = await storage.getPaymentLinkById(linkId);
      if (!existingLink) {
        return res.status(404).json({ message: "Lien de paiement non trouvé" });
      }
      if (existingLink.userId !== userId) {
        return res.status(403).json({ message: "Non autorisé" });
      }

      // Check if link has associated payment intents
      const intents = await storage.getPaymentIntentsByLinkId(linkId);
      if (intents.length > 0) {
        return res.status(400).json({ 
          message: "Ce lien a des paiements associés. Désactivez-le plutôt que de le supprimer." 
        });
      }

      await storage.deletePaymentLink(linkId);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete payment link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public contact info route
  app.get("/api/contact-info", async (_req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const contactEmail = settings.find(s => s.key === "contact_email")?.value || "";
      const contactWhatsapp = settings.find(s => s.key === "contact_whatsapp")?.value || "";
      const contactTelegram = settings.find(s => s.key === "contact_telegram")?.value || "";
      
      res.json({
        email: contactEmail,
        whatsapp: contactWhatsapp,
        telegram: contactTelegram
      });
    } catch (error) {
      console.error("Get contact info error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/public/fees", async (_req, res) => {
    try {
      const fees = await storage.getAllFees();
      res.json(fees.filter(f => f.isActive));
    } catch (error) {
      console.error("Public get fees error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/public/limits", async (_req, res) => {
    try {
      const allSettings = await storage.getAllSettings();
      const get = (key: string, def: number) => {
        const s = allSettings.find(s => s.key === key);
        return s ? parseFloat(s.value) : def;
      };
      res.json({
        minTransfer: get("min_transfer", 2650),
        maxTransfer: get("max_transfer", 5000000),
        minWithdrawal: get("min_withdrawal", 2650),
        maxWithdrawal: get("max_withdrawal", 5000000),
      });
    } catch (error) {
      console.error("Public get limits error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public countries route for registration/login
  app.get("/api/public/countries", async (_req, res) => {
    try {
      const allCountries = await storage.getAllCountries();
      const activeCountries = allCountries
        .filter(c => c.isActive)
        .map(c => ({
          id: c.id,
          name: c.name,
          code: c.code,
          flag: c.flag,
          dialCode: c.dialCode,
          currency: c.currency
        }));
      res.json(activeCountries);
    } catch (error) {
      console.error("Public get countries error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public exchange rates route — returns all fx_rate_XXX as units per 1 USD
  app.get("/api/public/exchange-rates", async (_req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const rates: Record<string, number> = {};

      settings.forEach(s => {
        if (s.key.startsWith("fx_rate_")) {
          const code = s.key.replace("fx_rate_", "");
          const val = parseFloat(s.value);
          if (!isNaN(val) && val > 0) rates[code] = val;
        }
      });

      // Fallback defaults if not in DB yet
      ALL_FX_CURRENCIES.forEach(c => {
        if (!rates[c.code]) rates[c.code] = c.defaultRate;
      });

      res.json(rates);
    } catch (error) {
      console.error("Get exchange rates error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public support contact info route
  app.get("/api/public/support-contact", async (_req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const supportEmail = settings.find(s => s.key === "support_email")?.value || "support@ashtechpay.com";
      const supportPhone = settings.find(s => s.key === "support_phone")?.value || "+237 6XX XXX XXX";
      
      res.json({
        email: supportEmail,
        phone: supportPhone,
      });
    } catch (error) {
      console.error("Get support contact error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/public/fee-settings", async (_req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const conversionFeePercent = parseFloat(settings.find(s => s.key === "conversion_fee_percent")?.value || "6");
      const depositFeePercent = parseFloat(settings.find(s => s.key === "deposit_fee_percent")?.value || "0");
      const paymentLinkFeePercent = parseFloat(settings.find(s => s.key === "payment_link_fee_percent")?.value || "2");
      const conversionFeePercentSwychr = parseFloat(settings.find(s => s.key === "conversion_fee_percent_swychr")?.value || String(conversionFeePercent));
      const conversionFeePercentPixpay = parseFloat(settings.find(s => s.key === "conversion_fee_percent_pixpay")?.value || String(conversionFeePercent));
      const conversionFeePercentAfribapay = parseFloat(settings.find(s => s.key === "conversion_fee_percent_afribapay")?.value || String(conversionFeePercent));
      res.json({
        conversionFeePercent,
        conversionFeePercentSwychr,
        conversionFeePercentPixpay,
        conversionFeePercentAfribapay,
        depositFeePercent,
        paymentLinkFeePercent,
      });
    } catch (error) {
      console.error("Get fee settings error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public deposit config for payment links (uses deposit fees)
  app.get("/api/public/deposit-config", async (_req, res) => {
    try {
      const countries = await storage.getActiveCountries();
      const allOperators = await storage.getAllOperators();
      const allFees = await storage.getAllFees();
      
      const config = countries.map(country => {
        const countryOperators = allOperators
          .filter(op => op.countryId === country.id && op.isActive && !op.isInMaintenance)
          .map(op => {
            let operatorFee = allFees.find(
              f => f.operatorId === op.id && f.transactionType === "deposit" && f.isActive
            );
            if (!operatorFee) {
              operatorFee = allFees.find(
                f => !f.operatorId && f.countryId === country.id && f.transactionType === "deposit" && f.isActive
              );
            }
            if (!operatorFee) {
              operatorFee = allFees.find(
                f => !f.operatorId && !f.countryId && f.transactionType === "deposit" && f.isActive
              );
            }
            const provider = (op as any).paymentProvider || "swychr";
            const afribaRate = operatorFee ? parseFloat((operatorFee as any).afribapayFee || "0") : 0;
            const pixpayRate = operatorFee ? parseFloat((operatorFee as any).pixpayFee || "0") : 0;
            const marginRate = operatorFee ? parseFloat((operatorFee as any).ashtechMargin || "0") : 0;
            let feePercentage = 0;
            if (provider === "afribapay") {
              feePercentage = afribaRate + marginRate;
            } else if (provider === "pixpay") {
              feePercentage = pixpayRate + marginRate;
            } else {
              feePercentage = operatorFee?.feeType === "percentage" ? parseFloat(operatorFee.feeValue) : 0;
            }
            const pxFlowType = provider === "pixpay"
              ? detectPixPayFlowType((op as any).name || "", country.code)
              : "ussd";
            const otpUssdCode = pxFlowType === "otp"
              ? (PIXPAY_OTP_USSD_CODES[country.code?.toUpperCase()] || "#144*82#")
              : null;
            return {
              id: op.id,
              name: op.name,
              gateway: provider,
              paymentProvider: provider,
              pixpayOperatorType: pxFlowType,
              otpUssdCode,
              feePercentage,
              feeFixed: operatorFee?.feeType === "fixed" ? parseFloat(operatorFee.feeValue) : 0,
              afribapayFee: afribaRate,
              pixpayFee: pixpayRate,
              ashtechMargin: marginRate,
            };
          });
        return {
          id: country.id,
          name: country.name,
          code: country.code,
          flag: country.flag,
          currency: country.currency,
          exchangeRate: parseFloat(country.exchangeRate as string) || 1,
          operators: countryOperators,
        };
      });
      
      // Load fx rates from DB (units per 1 USD) with fallback to defaults
      const allSettings = await storage.getAllSettings();
      const exchangeRates: Record<string, number> = {};
      allSettings.forEach(s => {
        if (s.key.startsWith("fx_rate_")) {
          const code = s.key.replace("fx_rate_", "");
          const val = parseFloat(s.value);
          if (!isNaN(val) && val > 0) exchangeRates[code] = val;
        }
      });
      ALL_FX_CURRENCIES.forEach(c => {
        if (!exchangeRates[c.code]) exchangeRates[c.code] = c.defaultRate;
      });

      res.json({ countries: config, exchangeRates });
    } catch (error) {
      console.error("Get public deposit config error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public withdrawal operators config (for withdrawal number registration)
  app.get("/api/public/withdrawal-operators", async (_req, res) => {
    try {
      const countries = await storage.getActiveCountries();
      const allOperators = await storage.getAllOperators();
      const allFees = await storage.getAllFees();
      
      const config = countries.map(country => {
        // Get operators with withdrawal fees configured
        const countryOperators = allOperators
          .filter(op => op.countryId === country.id && op.isActive && !op.isInMaintenance)
          .filter(op => {
            // Check if this operator has a withdrawal fee
            const hasOperatorFee = allFees.some(
              f => f.operatorId === op.id && f.transactionType === "withdrawal" && f.isActive
            );
            const hasCountryFee = allFees.some(
              f => !f.operatorId && f.countryId === country.id && f.transactionType === "withdrawal" && f.isActive
            );
            const hasGlobalFee = allFees.some(
              f => !f.operatorId && !f.countryId && f.transactionType === "withdrawal" && f.isActive
            );
            return hasOperatorFee || hasCountryFee || hasGlobalFee;
          })
          .map(op => ({
            id: op.id,
            name: op.name,
          }));
        
        return {
          id: country.id,
          name: country.name,
          code: country.code,
          flag: country.flag,
          currency: country.currency,
          operators: countryOperators,
        };
      });
      
      res.json(config);
    } catch (error) {
      console.error("Get public withdrawal operators error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Public payment link route
  app.get("/api/payment-links/public/:slug", async (req, res) => {
    try {
      const link = await storage.getPaymentLinkBySlug(req.params.slug);
      if (!link || !link.isActive) {
        return res.status(404).json({ message: "Lien de paiement non trouvé ou inactif" });
      }
      
      const user = await storage.getUser(link.userId);
      if (user?.isBanned) {
        return res.status(403).json({ message: "Ce lien de paiement est suspendu." });
      }
      
      // Increment clicks
      await storage.incrementPaymentLinkClicks(link.slug);
      
      res.json({
        link: {
          id: link.id,
          title: link.title,
          description: link.description,
          amount: link.amount,
          currency: link.currency,
          isFixedAmount: link.isFixedAmount,
          imagePath: link.imagePath,
          hasPdfDelivery: link.hasPdfDelivery,
          allowedCountries: link.allowedCountries || null,
        },
        merchant: {
          fullName: user?.fullName,
          isVerified: user?.isVerified,
        }
      });
    } catch (error) {
      console.error("Get public payment link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/payment-links/:slug/download-pdf/:reference", async (req, res) => {
    try {
      const { slug, reference } = req.params;
      
      const paymentLink = await storage.getPaymentLinkBySlug(slug);
      if (!paymentLink) {
        return res.status(404).json({ message: "Lien de paiement non trouvé" });
      }
      
      if (!paymentLink.pdfPath || !paymentLink.hasPdfDelivery) {
        return res.status(404).json({ message: "Aucun PDF disponible pour ce lien" });
      }
      
      const intent = await storage.getPaymentIntentByReference(reference);
      if (!intent) {
        return res.status(404).json({ message: "Référence de paiement introuvable" });
      }
      
      if (intent.paymentLinkId !== paymentLink.id) {
        return res.status(403).json({ message: "Cette référence ne correspond pas à ce lien" });
      }
      
      if (intent.status !== "completed") {
        return res.status(403).json({ message: "Le paiement doit être confirmé pour télécharger le PDF" });
      }
      
      res.json({ pdfPath: paymentLink.pdfPath });
    } catch (error) {
      console.error("Download PDF error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Pay via payment link - PUBLIC endpoint, creates pending payment intent
  app.post("/api/payment-links/:slug/pay", async (req, res) => {
    try {
      const { slug } = req.params;
      const { fullName, email, country, phone, amount: providedAmount, currency: providedCurrency, paymentMethod, operator } = req.body;
      
      const link = await storage.getPaymentLinkBySlug(slug);
      if (!link || !link.isActive) {
        return res.status(404).json({ message: "Lien de paiement non trouvé ou inactif" });
      }

      const merchant = await storage.getUser(link.userId);
      if (merchant?.isBanned) {
        return res.status(403).json({ message: "Ce lien de paiement est suspendu car le compte du marchand est inactif." });
      }

      // Validate required fields
      if (!fullName || !email || !country || !phone || !paymentMethod) {
        return res.status(400).json({ message: "Tous les champs requis doivent être remplis" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Email invalide" });
      }

      // Validate payment method
      if (!["mobile_money", "card", "paypal"].includes(paymentMethod)) {
        return res.status(400).json({ message: "Méthode de paiement invalide" });
      }

      // Card and PayPal not yet available
      if (paymentMethod === "card" || paymentMethod === "paypal") {
        return res.status(400).json({ message: "Cette méthode de paiement n'est pas encore disponible" });
      }

      // For Mobile Money, operator is required
      if (paymentMethod === "mobile_money" && !operator) {
        return res.status(400).json({ message: "Veuillez sélectionner un opérateur Mobile Money" });
      }

      const paymentLink = await storage.getPaymentLinkBySlug(req.params.slug);
      if (!paymentLink) {
        return res.status(404).json({ message: "Lien de paiement non trouvé" });
      }

      if (!paymentLink.isActive) {
        return res.status(400).json({ message: "Ce lien de paiement n'est plus actif" });
      }

      // Check expiration
      if (paymentLink.expiresAt && new Date(paymentLink.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Ce lien de paiement a expiré" });
      }

      // Get country and operator IDs for fee calculation
      const allCountries = await storage.getAllCountries();
      const countryData = allCountries.find((c: { id: string; code: string; name: string }) => c.id === country || c.code === country || c.name === country);
      const countryId = countryData?.id || undefined;
      const paymentCountryCode = countryData?.code || "CM";
      const paymentCurrency = countryData?.currency || providedCurrency || paymentLink.currency || "XAF";

      // The amount provided by the frontend is in providedCurrency (or paymentCurrency)
      const numAmount = parseFloat(providedAmount || "0");
      if (numAmount <= 0) {
        return res.status(400).json({ message: "Le montant doit être positif" });
      }

      // We need to calculate what the merchant gets in THEIR link currency
      const fxRates = await loadFxRates();
      const amountInLinkCurrency = convertCurrency(numAmount, paymentCurrency, paymentLink.currency, fxRates);

      // Fetch operator early to determine payment provider before fee calculation
      let resolvedOperatorId: string | undefined = undefined;
      let operatorName = "Mobile Money";
      let operatorRecord: any = null;
      if (operator && countryId) {
        const operatorsList = await storage.getOperatorsByCountry(countryId);
        operatorRecord = operatorsList.find((o: any) => o.name === operator || o.id === operator);
        resolvedOperatorId = operatorRecord?.id || undefined;
        operatorName = operatorRecord?.name || operator;
      }

      // Determine provider BEFORE fee calculation
      const paymentProvider = operatorRecord?.paymentProvider || "swychr";
      console.log(`[PaymentLink] operatorId=${resolvedOperatorId} | name=${operatorName} | provider=${paymentProvider}`);

      // Resolve fees from DB (includes afribapayFee + ashtechMargin)
      const fee = await storage.resolveFee("deposit", countryId, resolvedOperatorId);
      const ashtechMarginPct = (fee as any)?.ashtechMargin != null
        ? parseFloat((fee as any).ashtechMargin)
        : ASHTECH_MARGIN;

      // Compute fees using the CORRECT provider's rates
      let netAmount: string;
      let totalFeeAmount: string;
      let ashtechFeeAmountStr: string;
      const totalAmount = numAmount.toFixed(2);

      if (paymentProvider === "afribapay") {
        const afribapayFeeRate = (fee as any)?.afribapayFee
          ? parseFloat((fee as any).afribapayFee.toString()) : 3.0;
        const af = computeAfribaPayFees(numAmount, afribapayFeeRate, ashtechMarginPct);
        netAmount = af.creditedAmount.toFixed(2);
        totalFeeAmount = af.totalFeeAmount.toFixed(2);
        ashtechFeeAmountStr = af.ashtechFeeAmount.toFixed(2);
        console.log(`[PaymentLink] AfribaPay fees: rate=${afribapayFeeRate}%+margin=${ashtechMarginPct}% → totalFee=${af.totalFeeAmount}, ashtechFee=${af.ashtechFeeAmount}, credited=${af.creditedAmount}`);
      } else if (paymentProvider === "pixpay") {
        const pixpayFeeRate = (fee as any)?.pixpayFee
          ? parseFloat((fee as any).pixpayFee.toString()) : 3.0;
        const pf = computePixPayFees(numAmount, pixpayFeeRate, ashtechMarginPct);
        netAmount = pf.creditedAmount.toFixed(2);
        totalFeeAmount = pf.totalFeeAmount.toFixed(2);
        ashtechFeeAmountStr = pf.ashtechFeeAmount.toFixed(2);
        console.log(`[PaymentLink] PixPay fees: rate=${pixpayFeeRate}%+margin=${ashtechMarginPct}% → totalFee=${pf.totalFeeAmount}, ashtechFee=${pf.ashtechFeeAmount}, credited=${pf.creditedAmount}`);
      } else {
        const sf = computeSwychrFees(numAmount, paymentCountryCode, ashtechMarginPct);
        netAmount = sf.creditedAmount.toFixed(2);
        totalFeeAmount = sf.totalFeeAmount.toFixed(2);
        ashtechFeeAmountStr = sf.ashtechFeeAmount.toFixed(2);
        console.log(`[PaymentLink] Swychr fees: margin=${ashtechMarginPct}% → totalFee=${sf.totalFeeAmount}, ashtechFee=${sf.ashtechFeeAmount}, credited=${sf.creditedAmount}`);
      }

      // Generate unique ASHPAY reference
      const reference = generateTransactionReference("payment_link");

      // ─── PixPay OTP pre-check — must happen BEFORE creating the payment intent ─
      // Orange CI/SN/ML/BF require the user to provide an OTP obtained via USSD.
      // Return 400 early so no orphaned payment intent/transaction is created.
      if (paymentProvider === "pixpay" && paymentMethod === "mobile_money") {
        const earlyPxOpType = detectPixPayFlowType(operatorName, paymentCountryCode);
        if (earlyPxOpType === "otp" && !req.body?.pixpayOtp) {
          const ussdCode = PIXPAY_OTP_USSD_CODES[paymentCountryCode.toUpperCase()] || "#144*82#";
          return res.status(400).json({
            otpRequired: true,
            gateway: "pixpay",
            ussdCode,
            message: `Composez ${ussdCode} sur votre téléphone pour obtenir votre code OTP, puis saisissez-le.`,
          });
        }
      }

      // Create payment intent — amount & currency in payer's currency so wallet crediting is correct
      const countryDisplay = countryData ? `${countryData.flag || ''} ${countryData.name}`.trim() : country;
      const intent = await storage.createPaymentIntent({
        paymentLinkId: paymentLink.id,
        merchantId: paymentLink.userId,
        payerName: fullName,
        payerEmail: email,
        payerPhone: phone,
        payerCountry: countryDisplay,
        amount: netAmount,
        feeAmount: totalFeeAmount,
        currency: paymentCurrency,
        paymentMethod,
        operator: operator || null,
        reference,
      });

      // Create pending transaction for the merchant to track in history
      // feeAmount = Ashtech margin only (consistent with deposit/withdrawal/transfer)
      await storage.createTransaction({
        userId: paymentLink.userId,
        type: "payment_link",
        amount: netAmount,
        totalAmount: totalAmount,
        feeAmount: ashtechFeeAmountStr,
        currency: paymentCurrency,
        status: "pending",
        description: `Paiement en attente de ${fullName} (${email}) via ${paymentLink.title}`,
        paymentMethod,
        reference,
        paymentLinkId: paymentLink.id,
        paymentIntentId: intent.id,
        payerName: fullName,
        payerEmail: email,
        recipientCountry: countryDisplay,
        operatorId: resolvedOperatorId || null,
      });

      // paymentProvider, operatorRecord, operatorName already resolved above (before fee calc)

      // Call payment gateway for Mobile Money payments
      if (paymentMethod === "mobile_money") {
        try {
          // ─── AfribaPay branch ─────────────────────────────────────────────
          if (paymentProvider === "afribapay") {
            const afribapayFeeRate = (fee as any)?.afribapayFee
              ? parseFloat((fee as any).afribapayFee.toString()) : 3.0;
            const afribaMarginPct = ashtechMarginPct;
            const afribaFees = computeAfribaPayFees(numAmount, afribapayFeeRate, afribaMarginPct);
            const afribapayOperatorCode = resolveAfribaPayOperatorCode(operatorRecord, operatorName);
            // Always use AfribaPay ISO currency (overrides paymentCurrency which may be a Swychr code)
            const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[paymentCountryCode.toUpperCase()] || paymentCurrency;
            console.log(`[PaymentLink] AfribaPay | country=${paymentCountryCode} | currency=${afribapayCurrency} | operator=${afribapayOperatorCode}`);
            const callbackUrl = `${process.env.APP_URL || ""}/api/afribapay/webhook`;
            // Strip country dialing prefix (AfribaPay needs local number without prefix)
            const prefixMap: Record<string, string> = {
              CM: "237", SN: "221", CI: "225", BF: "226", ML: "223",
              GN: "224", BJ: "229", TG: "228", NE: "227", CD: "243",
              CG: "242", CF: "236", TD: "235", GA: "241", GQ: "240",
              MG: "261", RW: "250", KE: "254", TZ: "255", UG: "256",
              GH: "233", NG: "234",
            };
            let localPhone = phone.replace(/\s/g, "");
            if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
            const dialPrefix = prefixMap[paymentCountryCode.toUpperCase()];
            if (dialPrefix && localPhone.startsWith(dialPrefix)) {
              localPhone = localPhone.slice(dialPrefix.length);
            }
            // Build return/cancel URLs for Wave
            const linkAppBase = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

            // ── Check OTP requirement BEFORE calling payin ────────────────────
            const otpInfo = await getAfribaPayOtpInfo(paymentCountryCode, afribapayOperatorCode);

            if (otpInfo.required) {
              if (otpInfo.type === "api") {
                // ── API OTP: AfribaPay sends the code by SMS via /v1/pay/otp ──
                const otpInitResult = await initiateAfribaPayOtp({
                  operator: afribapayOperatorCode,
                  country: paymentCountryCode,
                  phone_number: localPhone,
                  amount: numAmount,
                  currency: afribapayCurrency,
                  order_id: reference,
                  reference_id: reference,
                  notify_url: callbackUrl,
                });

                if (!otpInitResult.success) {
                  await storage.updatePaymentIntentStatus(intent.id, "failed");
                  return res.status(400).json({ message: otpInitResult.message || "Impossible d'envoyer le code OTP" });
                }
              }
              // ── USSD OTP: user dials the code themselves — no initiation call needed ──

              // Store OTP context for confirm-otp endpoint
              otpContextCache.set(reference, {
                operator: afribapayOperatorCode,
                country: paymentCountryCode,
                phone: localPhone,
                amount: numAmount,
                currency: afribapayCurrency,
                afribaTransactionId: reference,
                expiresAt: Date.now() + 15 * 60 * 1000,
                otpType: otpInfo.type,
              });

              const otpMessage = otpInfo.type === "ussd"
                ? `Composez ${otpInfo.ussdCode} sur votre téléphone pour obtenir votre code OTP, puis saisissez-le ci-dessous.`
                : "Entrez le code OTP que vous allez recevoir par SMS sur votre téléphone.";

              return res.json({
                message: otpMessage,
                reference: intent.reference,
                gateway: "afribapay",
                otpRequired: true,
                otpType: otpInfo.type,
                ussdCode: otpInfo.ussdCode,
                redirectUrl: paymentLink.redirectUrl || null,
                amount: numAmount,
                feeAmount: afribaFees.totalFeeAmount,
                totalAmount: numAmount,
              });
            }

            // ── Non-OTP: regular payin (USSD or Wave redirect) ────────────────
            const afribaResponse = await initiateAfribaPayin({
              operator: afribapayOperatorCode,
              country: paymentCountryCode,
              phone_number: localPhone,
              amount: numAmount,
              currency: afribapayCurrency,
              order_id: reference,
              reference_id: reference,
              notify_url: callbackUrl,
              return_url: `${linkAppBase}/pay/${paymentLink.slug}?ref=${reference}&status=success`,
              cancel_url: `${linkAppBase}/pay/${paymentLink.slug}?ref=${reference}&status=cancelled`,
            });
            if (afribaResponse.success) {
              const linkTransaction = await storage.getTransactionByReference(reference);
              if (linkTransaction) {
                const extRef = afribaResponse.transaction_id || reference;
                await storage.updateTransactionExternalReference(linkTransaction.id, extRef);
                addPendingPayment({
                  transactionId: linkTransaction.id,
                  reference,
                  externalReference: extRef,
                  attempts: 0,
                  userId: paymentLink.userId,
                  type: "payment_link",
                  amount: afribaFees.creditedAmount.toFixed(2),
                  provider: "afribapay",
                  paymentIntentId: intent.id,
                  payerName: fullName,
                });
              }

              // Wave/wallet: AfribaPay returns a provider_link the user must open
              if (afribaResponse.provider_link) {
                console.log(`[AfribaPay PaymentLink] Wave link for ${reference}: ${afribaResponse.provider_link}`);
                return res.json({
                  message: "Cliquez sur le bouton pour finaliser votre paiement sur Wave.",
                  reference: intent.reference,
                  gateway: "afribapay",
                  waveUrl: afribaResponse.provider_link,
                  otpRequired: false,
                  redirectUrl: paymentLink.redirectUrl || null,
                  amount: numAmount,
                  feeAmount: afribaFees.totalFeeAmount,
                  totalAmount: numAmount,
                });
              }

              return res.json({
                message: "Veuillez confirmer le paiement sur votre téléphone via USSD.",
                reference: intent.reference,
                gateway: "afribapay",
                otpRequired: false,
                redirectUrl: paymentLink.redirectUrl || null,
                amount: numAmount,
                feeAmount: afribaFees.totalFeeAmount,
                totalAmount: numAmount,
              });
            } else {
              await storage.updatePaymentIntentStatus(intent.id, "failed");
              const failedTx = await storage.getTransactionByReference(reference);
              if (failedTx) await storage.updateTransactionStatus(failedTx.id, "failed");
              return res.status(400).json({ message: afribaResponse.message || "Échec AfribaPay" });
            }
          }

          // ─── PixPay branch (USSD / OTP / Wave) ────────────────────────────
          if (paymentProvider === "pixpay") {
            const pxAutoServiceId = getPixPayServiceId((operatorRecord as any)?.name || "", paymentCountryCode, "cash_out");
            if (!pxAutoServiceId) {
              await storage.updatePaymentIntentStatus(intent.id, "failed");
              const failedTxPx = await storage.getTransactionByReference(reference);
              if (failedTxPx) await storage.updateTransactionStatus(failedTxPx.id, "failed");
              return res.status(400).json({ message: "Opérateur non supporté par PixPay pour ce pays." });
            }

            const pxOpType: string = detectPixPayFlowType((operatorRecord as any)?.name || "", paymentCountryCode);
            const pixpayFeeRate = (fee as any)?.pixpayFee
              ? parseFloat((fee as any).pixpayFee.toString()) : 3.0;
            const pxFees = computePixPayFees(numAmount, pixpayFeeRate, ashtechMarginPct);
            const pxIpnUrl = `${process.env.APP_URL || ""}/api/pixpay/webhook`;
            const cleanPxPhone = phone.replace(/\s/g, "");

            console.log(`[PaymentLink] PixPay type=${pxOpType} | country=${paymentCountryCode} | service_id=${pxAutoServiceId} (auto)`);

            const pxBaseParams = {
              serviceId: String(pxAutoServiceId),
              amount: numAmount,
              phone: cleanPxPhone,
              countryCode: paymentCountryCode,
              orderId: reference,
              ipnUrl: pxIpnUrl,
              customData: reference,
            };

            let pxResponse;

            if (pxOpType === "otp") {
              // Orange CI/SN/ML/BF — user must provide OTP obtained by dialing USSD code
              // The OTP pre-check above should have caught missing OTP before payment intent creation.
              // This is a safety net only — we do NOT fail the payment intent/transaction here.
              const omOtp = req.body?.pixpayOtp as string | undefined;
              if (!omOtp) {
                const ussdCode = PIXPAY_OTP_USSD_CODES[paymentCountryCode.toUpperCase()] || "#144*82#";
                return res.status(400).json({
                  otpRequired: true,
                  gateway: "pixpay",
                  ussdCode,
                  message: `Composez ${ussdCode} sur votre téléphone pour obtenir votre code OTP, puis saisissez-le.`,
                });
              }
              pxResponse = await initiatePixPayOtp({ ...pxBaseParams, omOtp });

            } else if (pxOpType === "wave") {
              const appBase = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
              pxResponse = await initiatePixPayWave({
                ...pxBaseParams,
                redirectUrl: paymentLink.redirectUrl || `${appBase}/pay/${paymentLink.slug}?ref=${reference}&status=success`,
                redirectErrorUrl: `${appBase}/pay/${paymentLink.slug}?ref=${reference}&status=cancelled`,
              });

            } else {
              pxResponse = await initiatePixPayUssd(pxBaseParams);
            }

            if (pxResponse.success) {
              const pxLinkTx = await storage.getTransactionByReference(reference);
              if (pxLinkTx) {
                const pxExtRef = pxResponse.transactionId || reference;
                await storage.updateTransactionExternalReference(pxLinkTx.id, pxExtRef);
                addPendingPayment({
                  transactionId: pxLinkTx.id,
                  reference,
                  externalReference: pxExtRef,
                  attempts: 0,
                  userId: paymentLink.userId,
                  type: "payment_link",
                  amount: pxFees.creditedAmount.toFixed(2),
                  provider: "pixpay",
                  paymentIntentId: intent.id,
                  payerName: fullName,
                  countryCode: paymentCountryCode,
                });
              }

              if (pxOpType === "wave" && pxResponse.waveUrl) {
                return res.json({
                  message: "Cliquez sur le bouton pour finaliser votre paiement via Wave.",
                  reference: intent.reference,
                  gateway: "pixpay",
                  waveUrl: pxResponse.waveUrl,
                  status: "pending_wave",
                  amount: numAmount,
                  feeAmount: pxFees.totalFeeAmount,
                  totalAmount: numAmount,
                });
              }

              return res.json({
                message: pxOpType === "otp"
                  ? "Code OTP validé. Paiement en cours de traitement."
                  : "Validez le paiement USSD sur votre téléphone.",
                reference: intent.reference,
                gateway: "pixpay",
                otpRequired: false,
                status: pxOpType === "otp" ? "pending_otp_confirmed" : "pending_ussd",
                redirectUrl: paymentLink.redirectUrl || null,
                amount: numAmount,
                feeAmount: pxFees.totalFeeAmount,
                totalAmount: numAmount,
              });

            } else {
              await storage.updatePaymentIntentStatus(intent.id, "failed");
              const failedTxPx2 = await storage.getTransactionByReference(reference);
              if (failedTxPx2) await storage.updateTransactionStatus(failedTxPx2.id, "failed");
              return res.status(400).json({ message: pxResponse.message || "Échec PixPay" });
            }
          }

          // ─── Swychr branch ────────────────────────────────────────────────
          console.log(`[PaymentLink] Using Swychr for ${operatorName} in ${paymentCountryCode}`);
          const callbackUrl = `${process.env.APP_URL || ""}/api/swychr/webhook`;
          const swychrResponse = await createSwychrPaymentLink({
            country_code: paymentCountryCode,
            name: fullName,
            email: email || `${phone}@ashtech.pay`,
            mobile: phone.replace(/\s/g, ""),
            grossAmount: numAmount,
            currency: paymentCurrency,
            transaction_id: reference,
            description: `Paiement ${paymentLink.title} - ${reference}`,
            callback_url: callbackUrl,
          });

          if (swychrResponse.success && swychrResponse.data?.payment_link) {
            const linkTransaction = await storage.getTransactionByReference(reference);
            if (linkTransaction) {
              addPendingPayment({
                transactionId: linkTransaction.id,
                reference: reference,
                externalReference: reference,
                attempts: 0,
                userId: paymentLink.userId,
                type: "payment_link",
                amount: netAmount,
                paymentIntentId: intent.id,
                payerName: fullName,
              });
            }

            res.json({ 
              message: "Veuillez compléter le paiement sur la page sécurisée.",
              reference: intent.reference,
              checkoutUrl: swychrResponse.data.payment_link,
              gateway: "swychr",
              redirectUrl: paymentLink.redirectUrl || null,
              amount: numAmount,
              feeAmount: parseFloat(totalFeeAmount),
              totalAmount: parseFloat(totalAmount),
            });
          } else {
            await storage.updatePaymentIntentStatus(intent.id, "failed");
            const failedTransaction = await storage.getTransactionByReference(reference);
            if (failedTransaction) {
              await storage.updateTransactionStatus(failedTransaction.id, "failed");
            }
            res.status(400).json({ message: swychrResponse.message || "Échec de l'initiation du paiement" });
          }
        } catch (gatewayError) {
          console.error("Gateway API error:", gatewayError);
          await storage.updatePaymentIntentStatus(intent.id, "failed");
          const failedTransaction = await storage.getTransactionByReference(reference);
          if (failedTransaction) {
            await storage.updateTransactionStatus(failedTransaction.id, "failed");
          }
          res.status(500).json({ message: "Erreur lors de l'initiation du paiement. Veuillez réessayer." });
        }
      } else {
        res.json({ 
          message: "Paiement initié avec succès.",
          reference: intent.reference,
          redirectUrl: paymentLink.redirectUrl || null,
          amount: numAmount,
          feeAmount: parseFloat(totalFeeAmount),
          totalAmount: parseFloat(totalAmount),
        });
      }
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Pay via link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get payment intents for current user (merchant)
  app.get("/api/payment-intents", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const intents = await storage.getPaymentIntentsByMerchantId(userId);
      res.json(intents);
    } catch (error) {
      console.error("Get payment intents error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get payment intents for a specific link
  app.get("/api/payment-links/:id/intents", requireAuth, async (req, res) => {
    try {
      const intents = await storage.getPaymentIntentsByLinkId(req.params.id);
      res.json(intents);
    } catch (error) {
      console.error("Get payment intents for link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Get analytics for a specific payment link
  app.get("/api/payment-links/:id/analytics", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      const paymentLink = await storage.getPaymentLinkById(req.params.id);
      
      if (!paymentLink) {
        return res.status(404).json({ message: "Lien de paiement non trouvé" });
      }
      
      // Verify ownership
      if (paymentLink.userId !== userId) {
        return res.status(403).json({ message: "Accès non autorisé" });
      }
      
      // Get all transactions for this link
      const transactions = await storage.getTransactionsByPaymentLinkId(paymentLink.id);
      
      // Calculate analytics
      const completedTransactions = transactions.filter(t => t.status === "completed");
      const pendingTransactions = transactions.filter(t => t.status === "pending");
      const failedTransactions = transactions.filter(t => t.status === "failed");
      
      const totalCollected = completedTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      const totalPending = pendingTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
      
      res.json({
        paymentLink,
        analytics: {
          totalTransactions: transactions.length,
          completedCount: completedTransactions.length,
          pendingCount: pendingTransactions.length,
          failedCount: failedTransactions.length,
          totalCollected: totalCollected.toFixed(2),
          totalPending: totalPending.toFixed(2),
          clickCount: paymentLink.clickCount,
          conversionRate: paymentLink.clickCount > 0 
            ? ((completedTransactions.length / paymentLink.clickCount) * 100).toFixed(1)
            : "0",
        },
        transactions,
      });
    } catch (error) {
      console.error("Get payment link analytics error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Complete a payment (simulate webhook from payment gateway)
  app.post("/api/payment-intents/:reference/complete", async (req, res) => {
    try {
      const intent = await storage.getPaymentIntentByReference(req.params.reference);
      if (!intent) {
        return res.status(404).json({ message: "Paiement non trouvé" });
      }

      if (intent.status === "completed") {
        return res.status(400).json({ message: "Ce paiement a déjà été traité" });
      }

      if (intent.status === "failed") {
        return res.status(400).json({ message: "Ce paiement a échoué" });
      }

      // Update intent status to completed first
      const updatedIntent = await storage.updatePaymentIntentStatus(intent.id, "completed");
      if (!updatedIntent) {
        return res.status(500).json({ message: "Erreur lors de la mise à jour du statut" });
      }

      // Credit the merchant's wallet using admin exchange rates
      const intentAmount = parseFloat(intent.amount);
      const intentCurrency = intent.currency || "XAF";
      await creditUserWallet(intent.merchantId, intentAmount, intentCurrency);

      // Update existing transaction to completed status
      const existingTx = await storage.getTransactionByPaymentIntentId(intent.id);
      if (existingTx) {
        await storage.updateTransactionStatus(existingTx.id, "completed");
      }

      res.json({ 
        message: "Paiement confirmé et crédité avec succès",
        amount: intentAmount.toFixed(2),
        currency: intentCurrency,
        originalAmount: intent.amount,
        originalCurrency: intent.currency
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      console.error("Complete payment error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ============= ADMIN ROUTES =============

  // Admin: Get dashboard stats
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const period = (req.query.period as string) || "this_month";
      const validPeriods = ["last_year", "this_year", "last_month", "this_month", "last_week", "this_week", "yesterday", "today"];
      const validPeriod = validPeriods.includes(period) ? period : "this_month";
      const stats = await storage.getAdminStats(validPeriod);
      res.json(stats);
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Volume par pays
  app.get("/api/admin/stats/by-country", requireAdmin, async (req, res) => {
    try {
      const result = await storage.getStatsByCountry();
      res.json(result);
    } catch (error) {
      console.error("Stats by country error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Activité récente (30 derniers jours)
  app.get("/api/admin/stats/activity", requireAdmin, async (req, res) => {
    try {
      const result = await storage.getStatsActivity();
      res.json(result);
    } catch (error) {
      console.error("Stats activity error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Reset stats (store current timestamp as reset baseline)
  app.post("/api/admin/reset-stats", requireAdmin, async (req, res) => {
    try {
      await storage.resetStats();
      res.json({ message: "Statistiques réinitialisées avec succès" });
    } catch (error) {
      console.error("Reset stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Combined layout stats (replaces 7 separate polling requests)
  app.get("/api/admin/layout-stats", requireAdmin, async (req, res) => {
    try {
      const stats = await (storage as any).getAdminLayoutStats();
      res.json(stats);
    } catch (error) {
      console.error("Admin layout stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get pending notifications
  app.get("/api/admin/notifications", requireAdmin, async (req, res) => {
    try {
      const notifications = await storage.getPendingNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Admin notifications error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Fix user currencies based on country
  app.post("/api/admin/fix-currencies", requireAdmin, async (req, res) => {
    try {
      const COUNTRY_CURRENCIES: Record<string, string> = {
        "Cameroun": "XAF",
        "Sénégal": "XOF",
        "Côte d'Ivoire": "XOF",
        "Togo": "XOF",
        "Bénin": "XOF",
        "Burkina Faso": "XOF",
        "Mali": "XOF",
        "Niger": "XOF",
        "Gabon": "XAF",
        "Congo Brazzaville": "XAF",
        "Tchad": "XAF",
        "République Centrafricaine": "XAF",
        "Guinée Équatoriale": "XAF",
        "Nigeria": "NGN",
        "Ghana": "GHS",
        "Kenya": "KES",
        "Ouganda": "UGX",
        "Rwanda": "RWF",
        "Tanzanie": "TZS",
        "RDC": "CDF",
        "RD Congo": "CDF",
        "Congo Kinshasa": "CDF",
        "Congo": "XAF",
        "Benin": "XOF",
        "Ivory Coast": "XOF",
        "Burkina": "XOF"
      };

      const usersResult = await storage.getAllUsers();
      let updatedCount = 0;

      for (const user of usersResult) {
        const country = user.country?.trim();
        if (country && COUNTRY_CURRENCIES[country]) {
          const localCurrency = COUNTRY_CURRENCIES[country];
          if (user.preferredCurrency !== localCurrency) {
            await storage.updateUserCurrency(user.id, localCurrency as any);
            // Also notify the user about the currency synchronization
            try {
              const notificationData = {
                userId: user.id,
                type: "admin_message" as const,
                title: "Devise synchronisée",
                message: `Votre devise principale a été synchronisée avec votre devise locale (${localCurrency}).`,
                isRead: false
              };

              const storageAny = storage as any;
              if (typeof storageAny.createUserNotification === 'function') {
                await storageAny.createUserNotification(notificationData);
              } else if (typeof storageAny.createNotification === 'function') {
                await storageAny.createNotification(notificationData);
              }
            } catch (e) {
              console.warn("Could not send notification to user", user.id);
            }
            updatedCount++;
          }
        }
      }

      res.json({ message: `Mise à jour de ${updatedCount} utilisateurs terminée.`, count: updatedCount });
    } catch (error: any) {
      console.error("Fix currencies error:", error);
      res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const search = (req.query.search as string) || "";
      const offset = (page - 1) * limit;

      const { data, total } = await storage.getAdminUsersPaginated({ limit, offset, search: search || undefined });

      // Batch-fetch all secondary wallets for these users in one query
      const fxRates = await loadFxRates();
      const userIds = data.map(u => u.id);
      const allWallets = userIds.length > 0 ? await storage.getWalletsByUserIds(userIds) : [];

      // Group wallets by userId
      const walletsByUser = new Map<string, { currency: string; balance: string }[]>();
      for (const w of allWallets) {
        if (!walletsByUser.has(w.userId)) walletsByUser.set(w.userId, []);
        walletsByUser.get(w.userId)!.push({ currency: w.currency, balance: w.balance });
      }

      const safeUsers = data.map(({ password, ...u }) => {
        const primaryCurrency = u.preferredCurrency || "XAF";
        const primaryXAF = convertToXAF(parseFloat(u.balance) || 0, primaryCurrency, fxRates);
        const secondaryWallets = (walletsByUser.get(u.id) || []).filter(w => w.currency !== primaryCurrency);
        const secondaryXAF = secondaryWallets.reduce((sum, w) => sum + convertToXAF(parseFloat(w.balance) || 0, w.currency, fxRates), 0);
        return { ...u, totalBalanceXAF: Math.round(primaryXAF + secondaryXAF) };
      });

      res.json({ data: safeUsers, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (error) {
      console.error("Admin get users error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Manual Fiat to PUSD conversion
  app.post("/api/admin/convert-fiat-to-pusd", requireAdmin, async (req, res) => {
    try {
      const { countryCode, amount } = req.body;
      if (!countryCode || !amount) {
        return res.status(400).json({ message: "Pays et montant requis" });
      }

      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ message: "Montant invalide" });
      }

      const currencyCode = COUNTRY_CURRENCY[countryCode.toUpperCase()] || countryCode.toUpperCase();
      const token = await getPayoutToken();
      const success = await convertFiatToPusd(token, currencyCode, parsedAmount);

      if (!success) {
        return res.status(400).json({ message: "La conversion a échoué. Vérifiez votre solde Fiat sur AccountPE." });
      }

      res.json({ message: "Conversion Fiat vers pUSD réussie" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  });

  // Admin: Update user balance
  app.patch("/api/admin/users/:id/balance", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { amount, currency, type } = req.body; // type: 'set' or 'add'
      const userId = req.params.id;
      
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum)) return res.status(400).json({ message: "Montant invalide" });

      const isPrimary = currency === (user.preferredCurrency || "XAF");
      if (isPrimary) {
        if (type === "set") {
          const updated = await storage.updateUser(userId, { balance: amountNum.toFixed(2) });
          if (!updated) return res.status(500).json({ message: "Mise à jour échouée" });
          const safeUser = (({ password: _pw, ...rest }) => rest)(updated as any);
          res.json({ success: true, user: safeUser });
        } else {
          const updated = await storage.updateUserBalance(userId, amountNum);
          const safeUser = (({ password: _pw, ...rest }) => rest)(updated as any);
          res.json({ success: true, user: safeUser });
        }
      } else {
        if (type === "set") {
          const wallet = await storage.setWalletBalance(userId, currency, amountNum);
          res.json({ success: true, wallet });
        } else {
          const wallet = await storage.upsertWallet(userId, currency, amountNum);
          res.json({ success: true, wallet });
        }
      }
    } catch (error) {
      console.error("Update balance error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get all wallets for a user
  app.get("/api/admin/users/:id/wallets", requireAuth, requireAdmin, async (req, res) => {
    try {
      const wallets = await storage.getUserWallets(req.params.id);
      res.json(wallets);
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Update user
  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      // Special handling for balance update to ensure it's treated as decimal
      if (updates.balance !== undefined) {
        updates.balance = parseFloat(updates.balance).toFixed(2);
      }

      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      const { password, ...safeUser } = user;
      
      // Log admin action
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_user",
        targetType: "user",
        targetId: id,
        details: JSON.stringify(updates),
        ipAddress: req.ip || null,
      });
      
      res.json(safeUser);
    } catch (error) {
      console.error("Admin update user error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Ban user
  app.post("/api/admin/users/:id/ban", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const user = await storage.banUser(id, reason || "Violation des conditions d'utilisation");
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "ban_user",
        targetType: "user",
        targetId: id,
        details: JSON.stringify({ reason }),
        ipAddress: req.ip || null,
      });
      
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Admin ban user error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Unban user
  app.post("/api/admin/users/:id/unban", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.unbanUser(id);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "unban_user",
        targetType: "user",
        targetId: id,
        ipAddress: req.ip || null,
      });
      
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Admin unban user error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Delete user
  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "Utilisateur non trouvé" });
      }
      
      await storage.deleteUser(id);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_user",
        targetType: "user",
        targetId: id,
        details: JSON.stringify({ username: user.username, email: user.email }),
        ipAddress: req.ip || null,
      });
      
      res.json({ message: "Utilisateur supprimé avec succès" });
    } catch (error) {
      console.error("Admin delete user error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get all transactions with user info
  app.get("/api/admin/transactions", requireAdmin, async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
      const type = (req.query.type as string) || "all";
      const status = (req.query.status as string) || "all";
      const offset = (page - 1) * limit;

      const typeList = type !== "all" ? type.split(",").map(t => t.trim()).filter(Boolean) : [];
      const { data: txList, total } = await (storage as any).getAdminTransactionsPaginated({
        limit, offset,
        types: typeList.length > 0 ? typeList : undefined,
        status: status !== "all" ? status : undefined,
      });

      // Batch user lookup — one query for all unique user IDs (no N+1)
      const userIds = [...new Set(txList.map(tx => tx.userId))];
      const userMap = await (storage as any).getUsersByIds(userIds);

      // Batch paymentIntent lookup for payment_link transactions to get payer phone
      const intentIds = txList
        .filter(tx => tx.paymentIntentId)
        .map(tx => tx.paymentIntentId as string);
      const intentMap = await (storage as any).getPaymentIntentsByIds(intentIds);

      const enriched = txList.map(tx => {
        const u = userMap.get(tx.userId);
        const intent = tx.paymentIntentId ? intentMap.get(tx.paymentIntentId) : null;
        return {
          ...tx,
          user: u ? { fullName: u.fullName, email: u.email, username: u.username } : null,
          payerPhone: intent?.payerPhone ?? null,
        };
      });

      res.json({ data: enriched, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (error) {
      console.error("Admin get transactions error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get transaction details by ID
  app.get("/api/admin/transactions/:id/details", requireAdmin, async (req, res) => {
    try {
      const transaction = await storage.getTransactionById(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction non trouvée" });
      }
      
      // Get user info
      const user = await storage.getUser(transaction.userId);
      
      // Get additional context
      let paymentLink = null;
      let paymentIntent = null;
      let recipient = null;
      let operator = null;
      
      if (transaction.paymentLinkId) {
        paymentLink = await storage.getPaymentLinkById(transaction.paymentLinkId);
      }
      
      if (transaction.paymentIntentId) {
        paymentIntent = await storage.getPaymentIntentById(transaction.paymentIntentId);
      }
      
      if (transaction.recipientId) {
        const recipientUser = await storage.getUser(transaction.recipientId);
        recipient = recipientUser ? { 
          fullName: recipientUser.fullName, 
          email: recipientUser.email,
          username: recipientUser.username,
          country: recipientUser.country
        } : null;
      }

      if (transaction.operatorId) {
        const operatorData = await storage.getOperator(transaction.operatorId);
        operator = operatorData ? { 
          id: operatorData.id,
          name: operatorData.name,
          type: operatorData.type,
          paymentProvider: operatorData.paymentProvider
        } : null;
      }
      
      res.json({
        ...transaction,
        user: user ? { 
          fullName: user.fullName, 
          email: user.email, 
          username: user.username,
          country: user.country,
          phone: user.phone
        } : null,
        paymentLink: paymentLink ? { title: paymentLink.title, slug: paymentLink.slug } : null,
        paymentIntent,
        recipient,
        operator,
      });
    } catch (error) {
      console.error("Admin get transaction details error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Search transaction by reference
  app.get("/api/admin/transactions/reference/:reference", requireAdmin, async (req, res) => {
    try {
      const transaction = await storage.getTransactionByReference(req.params.reference);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction non trouvée" });
      }
      
      const user = await storage.getUser(transaction.userId);
      res.json({
        ...transaction,
        user: user ? { fullName: user.fullName, email: user.email, username: user.username } : null,
      });
    } catch (error) {
      console.error("Admin get transaction by reference error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Update transaction status
  app.patch("/api/admin/transactions/:id", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, forceComplete } = req.body;
      
      // Get the current transaction to check previous status
      const existingTx = await storage.getTransactionById(id);
      if (!existingTx) {
        return res.status(404).json({ message: "Transaction non trouvée" });
      }
      
      // Prevent double-crediting: only credit if moving from pending to completed
      const wasNotCompleted = existingTx.status !== "completed";
      const isNowCompleted = status === "completed";
      
      const transaction = await storage.updateTransactionStatus(id, status);
      if (!transaction) {
        return res.status(404).json({ message: "Erreur lors de la mise à jour" });
      }
      
      // Credit user wallet when transaction is approved (payment_link type)
      // Uses admin "Devises & Taux de change" rates; auto-creates wallet if currency not found
      if (wasNotCompleted && isNowCompleted && transaction.type === "payment_link") {
        const txAmount = parseFloat(transaction.amount);
        const txCurrency = transaction.currency || "XAF";
        await creditUserWallet(transaction.userId, txAmount, txCurrency);

        // Also update the payment intent status if exists
        if (transaction.paymentIntentId) {
          await storage.updatePaymentIntentStatus(transaction.paymentIntentId, "completed");
        }
      }

      // For deposits, credit the right wallet and create notification
      // Uses admin "Devises & Taux de change" rates; auto-creates wallet if currency not found
      if (wasNotCompleted && isNowCompleted && transaction.type === "deposit") {
        const txAmount = parseFloat(transaction.amount);
        const txCurrency = transaction.currency || "XAF";
        await creditUserWallet(transaction.userId, txAmount, txCurrency);

        // Create notification for user
        await storage.createUserNotification({
          userId: transaction.userId,
          type: "deposit_confirmed",
          title: "Dépôt confirmé",
          message: `Votre dépôt de ${transaction.amount} ${txCurrency} a été confirmé et crédité sur votre compte.`,
          transactionId: transaction.id,
          isRead: false,
        });
      }
      
      // For withdrawals/transfer_out: trigger AccountPE payout when admin approves (unless forceComplete=true)
      if (wasNotCompleted && isNowCompleted && (transaction.type === "withdrawal" || transaction.type === "transfer_out") && !forceComplete) {
        try {
          let countryCode = "CM";
          if (transaction.recipientCountry) {
            const rc = transaction.recipientCountry.trim();
            if (rc.length === 2) {
              // Already a country code (e.g. "CM")
              countryCode = rc.toUpperCase();
            } else {
              // Country name — look up code
              const countries = await storage.getAllCountries();
              const c = countries.find(c => c.name.toLowerCase() === rc.toLowerCase());
              if (c?.code) countryCode = c.code;
            }
          }

          const txAmount = parseFloat(transaction.amount);
          const payoutRef = transaction.reference || generateTransactionReference("payout");

          const operatorId = transaction.operatorId;
          const operator = operatorId ? await storage.getOperator(operatorId) : null;
          const operatorName = (operator?.name || "").toUpperCase();
          let finalPaymentMethod = resolvePaymentMethod(operatorName, countryCode);

          // Fallback when operator is not found: try phone prefix detection, then bank transfer
          if (!operator) {
            if (transaction.paymentMethod === "bank_transfer") {
              finalPaymentMethod = countryCode === "NG" ? "All Banks Transfer" : "bank_transfer";
            } else {
              const detected = detectMethodFromPhone(transaction.recipientPhone || "", countryCode);
              if (detected) {
                console.log(`[Admin] Operator not found — detected method from phone prefix: ${detected}`);
                finalPaymentMethod = detected;
              }
            }
          }

          console.log(`[Admin] Payout params: country=${countryCode}, operatorId=${operatorId}, operatorName=${operatorName}, resolved_method=${finalPaymentMethod}, txPaymentMethod=${transaction.paymentMethod}`);

          const payoutResult = await createSwychrPayout({
            country_code:     countryCode,
            beneficiary_name: transaction.recipientName || transaction.userId,
            mobile_no:        formatInternationalPhone(
              transaction.recipientPhone || "",
              countryCode
            ),
            amount:           txAmount,
            transaction_id:   payoutRef,
            payment_method:   finalPaymentMethod as any,
            remarks:          `Ashtech Pay - ${payoutRef}`,
          });

          if (payoutResult.success) {
            console.log(`[Admin] Payout submitted OK for ${payoutRef} (ext: ${payoutResult.transaction_id})`);
            const extTxId = payoutResult.transaction_id || payoutRef;
            addPendingPayout({
              transactionId: transaction.id,
              reference:     extTxId,
              userId:        transaction.userId,
              amount:        transaction.amount,
              totalDebited:  transaction.totalAmount || transaction.amount,
              provider:      ((operator as any)?.paymentProvider || "swychr") as "swychr" | "afribapay" | "pixpay",
              countryCode:   countryCode,
            });
            // Send withdrawal approved email
            const txUser = await storage.getUser(transaction.userId).catch(() => null);
            if (txUser?.email) {
              sendWithdrawalApprovedEmail(
                txUser.email,
                txUser.fullName || txUser.username,
                transaction.amount,
                transaction.currency || "XAF",
                transaction.reference || undefined
              ).catch(() => {});
            }
            await storage.createUserNotification({
              userId:        transaction.userId,
              type:          "withdrawal_confirmed",
              title:         transaction.type === "withdrawal" ? "Retrait approuvé" : "Transfert approuvé",
              message:       `Votre ${transaction.type === "withdrawal" ? "retrait" : "transfert"} de ${transaction.amount} ${transaction.currency} a été validé.`,
              transactionId: transaction.id,
              isRead:        false,
            });
          } else {
            console.error(`[Admin] Payout failed for ${payoutRef}: ${payoutResult.message}`);
            await storage.updateTransactionStatus(id, "pending");
            const msg = (payoutResult.message || "").toLowerCase();
            const isInsufficientBalance = msg.includes("insuffi") || msg.includes("solde") || msg.includes("balance");
            if (isInsufficientBalance) {
              return res.status(400).json({
                message: `Solde insuffisant sur le wallet Swychr. Connectez-vous à Swychr, effectuez la conversion/recharge nécessaire, puis réessayez.`,
              });
            }
            return res.status(400).json({
              message: `Paiement AccountPE échoué: ${payoutResult.message}`,
            });
          }
        } catch (payoutErr: any) {
          console.error("[Admin] Payout error:", payoutErr.message);
          await storage.updateTransactionStatus(id, "pending");
          return res.status(500).json({ message: `Erreur lors du paiement: ${payoutErr.message}` });
        }
      }
      
      // Manual confirm (forceComplete=true): send notification without Swychr
      if (wasNotCompleted && isNowCompleted && (transaction.type === "withdrawal" || transaction.type === "transfer_out") && forceComplete) {
        const txUser = await storage.getUser(transaction.userId).catch(() => null);
        if (txUser?.email) {
          sendWithdrawalApprovedEmail(
            txUser.email,
            txUser.fullName || txUser.username,
            transaction.amount,
            transaction.currency || "XAF",
            transaction.reference || undefined
          ).catch(() => {});
        }
        await storage.createUserNotification({
          userId:        transaction.userId,
          type:          "withdrawal_confirmed",
          title:         transaction.type === "withdrawal" ? "Retrait approuvé" : "Transfert approuvé",
          message:       `Votre ${transaction.type === "withdrawal" ? "retrait" : "transfert"} de ${transaction.amount} ${transaction.currency} a été validé manuellement.`,
          transactionId: transaction.id,
          isRead:        false,
        });
      }

      // Refund user when transfer_out or withdrawal is rejected (only if previously pending)
      const wasNotRejected = existingTx.status !== "failed" && existingTx.status !== "cancelled";
      const isNowRejected = status === "failed" || status === "cancelled";
      
      if (wasNotRejected && isNowRejected && (transaction.type === "transfer_out" || transaction.type === "withdrawal")) {
        // Refund total amount (amount + fee)
        const refundAmount = transaction.totalAmount 
          ? parseFloat(transaction.totalAmount) 
          : parseFloat(transaction.amount);
        await storage.updateUserBalance(transaction.userId, refundAmount);

        if (transaction.type === "withdrawal") {
          await storage.createUserNotification({
            userId:        transaction.userId,
            type:          "withdrawal_failed",
            title:         "Retrait annulé",
            message:       `Votre retrait de ${transaction.amount} ${transaction.currency || "XAF"} a été annulé. Le montant de ${refundAmount.toFixed(0)} ${transaction.currency || "XAF"} a été recrédité.`,
            transactionId: transaction.id,
            isRead:        false,
          });
        }
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_transaction",
        targetType: "transaction",
        targetId: id,
        details: JSON.stringify({ status, balanceUpdated: wasNotCompleted && isNowCompleted }),
        ipAddress: req.ip || null,
      });
      
      res.json(transaction);
    } catch (error) {
      console.error("Admin update transaction error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Countries CRUD
  app.get("/api/admin/countries", requireAdmin, async (req, res) => {
    try {
      const countries = await storage.getAllCountries();
      res.json(countries);
    } catch (error) {
      console.error("Admin get countries error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/admin/countries", requireAdmin, async (req, res) => {
    try {
      console.log("Creating country with data:", JSON.stringify(req.body));
      const country = await storage.createCountry(req.body);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "create_country",
        targetType: "country",
        targetId: country.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(country);
    } catch (error: any) {
      console.error("Admin create country error:", error);
      res.status(500).json({ message: error.message || "Erreur serveur" });
    }
  });

  app.patch("/api/admin/countries/:id", requireAdmin, async (req, res) => {
    try {
      const country = await storage.updateCountry(req.params.id, req.body);
      if (!country) {
        return res.status(404).json({ message: "Pays non trouvé" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_country",
        targetType: "country",
        targetId: req.params.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(country);
    } catch (error) {
      console.error("Admin update country error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.delete("/api/admin/countries/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteCountry(req.params.id);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_country",
        targetType: "country",
        targetId: req.params.id,
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete country error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Toggle all operators for a country
  app.post("/api/admin/countries/:id/toggle-operators", requireAdmin, async (req, res) => {
    try {
      const { isActive } = req.body;
      const operators = await storage.getOperatorsByCountry(req.params.id);
      
      for (const op of operators) {
        await storage.updateOperator(op.id, { isActive });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: isActive ? "activate_all_operators" : "deactivate_all_operators",
        targetType: "country",
        targetId: req.params.id,
        details: JSON.stringify({ operatorCount: operators.length }),
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true, count: operators.length });
    } catch (error) {
      console.error("Admin toggle operators error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Operators CRUD
  app.get("/api/admin/operators", requireAdmin, async (req, res) => {
    try {
      const operators = await storage.getAllOperators();
      res.json(operators);
    } catch (error) {
      console.error("Admin get operators error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/admin/operators", requireAdmin, async (req, res) => {
    try {
      const operator = await storage.createOperator(req.body);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "create_operator",
        targetType: "operator",
        targetId: operator.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(operator);
    } catch (error) {
      console.error("Admin create operator error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.patch("/api/admin/operators/:id", requireAdmin, async (req, res) => {
    try {
      const operator = await storage.updateOperator(req.params.id, req.body);
      if (!operator) {
        return res.status(404).json({ message: "Opérateur non trouvé" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_operator",
        targetType: "operator",
        targetId: req.params.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(operator);
    } catch (error) {
      console.error("Admin update operator error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.delete("/api/admin/operators/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteOperator(req.params.id);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_operator",
        targetType: "operator",
        targetId: req.params.id,
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete operator error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Copier tous les frais retrait → envoi (transfer)
  app.post("/api/admin/fees/sync-withdrawals-to-transfers", requireAdmin, async (req, res) => {
    try {
      const allFees = await storage.getAllFees();
      const withdrawalFees = allFees.filter(f => f.transactionType === 'withdrawal');
      let synced = 0;
      let created = 0;

      for (const wFee of withdrawalFees) {
        let tFee: typeof allFees[number] | undefined;
        if (wFee.operatorId) {
          tFee = allFees.find(f => f.operatorId === wFee.operatorId && f.transactionType === 'transfer');
        } else if (wFee.countryId) {
          tFee = allFees.find(f => f.countryId === wFee.countryId && !f.operatorId && f.transactionType === 'transfer');
        } else {
          tFee = allFees.find(f => !f.operatorId && !f.countryId && f.transactionType === 'transfer');
        }

        const syncValues = {
          feeValue: wFee.feeValue,
          ashtechMargin: wFee.ashtechMargin,
          afribapayFee: wFee.afribapayFee,
          pixpayFee: wFee.pixpayFee,
          swychrFee: wFee.swychrFee,
          minFee: wFee.minFee,
          isActive: wFee.isActive,
        };

        if (tFee) {
          await storage.updateFee(tFee.id, syncValues);
          synced++;
        } else {
          const newName = wFee.name.replace(/retrait/gi, 'Envoi').replace(/withdrawal/gi, 'Transfer');
          await storage.createFee({
            ...syncValues,
            name: newName !== wFee.name ? newName : `Envoi - ${wFee.name}`,
            feeType: wFee.feeType,
            transactionType: 'transfer',
            operatorId: wFee.operatorId || null,
            countryId: wFee.countryId || null,
          } as any);
          created++;
        }
      }

      await storage.createAdminLog({
        adminId: req.userId!,
        action: "sync_fees_withdrawal_to_transfer",
        targetType: "fee",
        targetId: null,
        details: JSON.stringify({ synced, created }),
        ipAddress: req.ip || null,
      });

      res.json({ success: true, synced, created });
    } catch (error) {
      console.error("Sync withdrawal to transfer fees error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Fees CRUD
  app.get("/api/admin/fees", requireAdmin, async (req, res) => {
    try {
      const fees = await storage.getAllFees();
      res.json(fees);
    } catch (error) {
      console.error("Admin get fees error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/admin/fees", requireAdmin, async (req, res) => {
    try {
      const fee = await storage.createFee(req.body);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "create_fee",
        targetType: "fee",
        targetId: fee.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(fee);
    } catch (error) {
      console.error("Admin create fee error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.patch("/api/admin/fees/:id", requireAdmin, async (req, res) => {
    try {
      const { ashtechMargin, feeValue, isActive, minFee } = req.body;
      const fee = await storage.getFee(req.params.id);
      if (!fee) {
        return res.status(404).json({ message: "Frais non trouvé" });
      }

      const updates: any = {
        ashtechMargin,
        feeValue,
        isActive,
        minFee
      };

      const updatedFee = await storage.updateFee(req.params.id, updates);

      // Synchroniser l'autre type (transfer <-> withdrawal) pour le même opérateur ou pays
      if (fee.transactionType === 'transfer' || fee.transactionType === 'withdrawal') {
        const otherType = fee.transactionType === 'transfer' ? 'withdrawal' : 'transfer';
        const allFees = await storage.getAllFees();
        let otherFee: typeof allFees[number] | undefined;
        if (fee.operatorId) {
          otherFee = allFees.find(f => f.operatorId === fee.operatorId && f.transactionType === otherType);
        } else if (fee.countryId) {
          otherFee = allFees.find(f => f.countryId === fee.countryId && !f.operatorId && f.transactionType === otherType);
        }
        if (otherFee) {
          await storage.updateFee(otherFee.id, {
            ashtechMargin: updates.ashtechMargin,
            feeValue: updates.feeValue,
            isActive: updates.isActive,
            minFee: updates.minFee
          });
        }
      }

      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_fee",
        targetType: "fee",
        targetId: req.params.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });

      res.json(updatedFee);
    } catch (error) {
      console.error("Admin update fee error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.delete("/api/admin/fees/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteFee(req.params.id);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_fee",
        targetType: "fee",
        targetId: req.params.id,
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete fee error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Support ticket stats
  app.get("/api/admin/tickets/stats", requireAdmin, async (req, res) => {
    try {
      const tickets = await storage.getAllTickets();
      const openCount = tickets.filter(t => t.status === "open" || t.status === "in_progress").length;
      res.json({ openCount, totalCount: tickets.length });
    } catch (error) {
      console.error("Admin ticket stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Support tickets
  app.get("/api/admin/tickets", requireAdmin, async (req, res) => {
    try {
      const tickets = await storage.getAllTickets();
      res.json(tickets);
    } catch (error) {
      console.error("Admin get tickets error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.get("/api/admin/tickets/:id", requireAdmin, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }
      const messages = await storage.getTicketMessages(req.params.id);
      const user = await storage.getUser(ticket.userId);
      res.json({ 
        ticket, 
        messages,
        user: user ? { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone, lastSeenAt: user.lastSeenAt } : null,
        userOnline: isUserOnline(ticket.userId),
      });
    } catch (error) {
      console.error("Admin get ticket error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Delete all tickets
  app.delete("/api/admin/tickets", requireAdmin, async (req, res) => {
    try {
      await storage.deleteAllTickets();
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_all_tickets",
        targetType: "ticket",
        targetId: null,
        details: null,
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete all tickets error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Delete ticket
  app.delete("/api/admin/tickets/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteTicket(req.params.id);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_ticket",
        targetType: "ticket",
        targetId: req.params.id,
        details: null,
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Admin delete ticket error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.patch("/api/admin/tickets/:id", requireAdmin, async (req, res) => {
    try {
      const ticket = await storage.updateTicket(req.params.id, req.body);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_ticket",
        targetType: "ticket",
        targetId: req.params.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(ticket);
    } catch (error) {
      console.error("Admin update ticket error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/admin/tickets/:id/messages", requireAdmin, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket non trouvé" });

      const isUserViewing = getUserViewingTicket(ticket.userId, req.params.id);
      const message = await storage.createTicketMessage({
        ticketId: req.params.id,
        senderId: req.userId!,
        message: req.body.message,
        isAdmin: true,
        readByAdmin: true,
        readByUser: isUserViewing,
      });

      // Update ticket updatedAt
      await storage.updateTicket(req.params.id, { status: ticket.status === "open" ? "in_progress" : ticket.status });

      // Push new message via SSE to user
      notifyUser(ticket.userId, "new_message", {
        ticketId: req.params.id,
        message,
      });

      // Create notification for user
      await storage.createUserNotification({
        userId: ticket.userId,
        type: "admin_message",
        title: "Nouveau message du support",
        message: `Réponse à votre ticket : ${ticket.subject}`,
        transactionId: null,
        isRead: false,
      });

      res.json(message);
    } catch (error) {
      console.error("Admin create ticket message error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Create support ticket
  app.post("/api/tickets", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.createTicket({
        userId: req.userId!,
        subject: req.body.subject,
        priority: req.body.priority || "medium",
      });
      
      if (req.body.message) {
        await storage.createTicketMessage({
          ticketId: ticket.id,
          senderId: req.userId!,
          message: req.body.message,
          isAdmin: false,
        });
      }
      
      res.json(ticket);
    } catch (error) {
      console.error("Create ticket error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Get ticket stats (unread count based on open tickets with admin responses)
  app.get("/api/tickets/stats", requireAuth, async (req, res) => {
    try {
      const tickets = await storage.getTicketsByUser(req.userId!);
      let unreadCount = 0;
      for (const ticket of tickets) {
        if (ticket.status === "open" || ticket.status === "in_progress") {
          const messages = await storage.getTicketMessages(ticket.id);
          const lastMessage = messages[messages.length - 1];
          if (lastMessage && lastMessage.isAdmin) {
            unreadCount++;
          }
        }
      }
      res.json({ unreadCount, totalCount: tickets.length });
    } catch (error) {
      console.error("Get ticket stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Get own tickets
  app.get("/api/tickets", requireAuth, async (req, res) => {
    try {
      const tickets = await storage.getTicketsByUser(req.userId!);
      res.json(tickets);
    } catch (error) {
      console.error("Get user tickets error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Get ticket messages
  app.get("/api/tickets/:id/messages", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket || ticket.userId !== req.userId) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }
      const messages = await storage.getTicketMessages(req.params.id);
      // Check if any admin is currently online
      const adminsOnline = getOnlineUserIds().length > 1; // simplification: if more than 1 user online, admin might be
      res.json({ ticket, messages, adminsOnline });
    } catch (error) {
      console.error("Get ticket messages error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Add message to ticket
  app.post("/api/tickets/:id/messages", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket || ticket.userId !== req.userId) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }

      const isAdminViewing = getAdminViewingTicket(req.params.id);
      const message = await storage.createTicketMessage({
        ticketId: req.params.id,
        senderId: req.userId!,
        message: req.body.message,
        isAdmin: false,
        readByUser: true,
        readByAdmin: isAdminViewing,
      });
      
      // Reopen ticket if closed
      if (ticket.status === "closed" || ticket.status === "resolved") {
        await storage.updateTicket(req.params.id, { status: "open" });
      }

      // Push new message via SSE to admins
      notifyAdmins("new_message", {
        ticketId: req.params.id,
        message,
        userFullName: (await storage.getUser(req.userId!))?.fullName || "Utilisateur",
        subject: ticket.subject,
      });
      
      res.json(message);
    } catch (error) {
      console.error("Create ticket message error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Close own ticket
  app.post("/api/tickets/:id/close", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket || ticket.userId !== req.userId) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }
      
      const updatedTicket = await storage.updateTicket(req.params.id, { status: "closed" });
      res.json(updatedTicket);
    } catch (error) {
      console.error("Close ticket error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ─── Real-time SSE ────────────────────────────────────────────────────────

  // User SSE connection
  app.get("/api/sse", requireAuth, async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const user = await storage.getUser(req.userId!);
    const isAdmin = user?.role === "admin" || user?.role === "support";
    const connId = addSSEClient(req.userId!, !!isAdmin, res);

    // Update last seen
    await storage.updateUserLastSeen(req.userId!);

    // Broadcast updated online list to all
    broadcastOnlineStatus();

    // Ping every 25s to keep connection alive
    const pingInterval = setInterval(() => {
      try { res.write(":ping\n\n"); } catch {}
    }, 25000);

    req.on("close", async () => {
      clearInterval(pingInterval);
      removeSSEClient(connId);
      await storage.updateUserLastSeen(req.userId!);
      broadcastOnlineStatus();
    });
  });

  // User: Mark ticket messages as read (user side)
  app.post("/api/tickets/:id/read", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket || ticket.userId !== req.userId) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }
      await storage.markTicketMessagesReadByUser(req.params.id);
      // Notify admin that user read the messages
      notifyAdmins("messages_read", { ticketId: req.params.id, by: "user" });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Mark ticket messages as read (admin side)
  app.post("/api/admin/tickets/:id/read", requireAdmin, async (req, res) => {
    try {
      await storage.markTicketMessagesReadByAdmin(req.params.id);
      const ticket = await storage.getTicket(req.params.id);
      if (ticket) {
        notifyUser(ticket.userId, "messages_read", { ticketId: req.params.id, by: "admin" });
      }
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Send typing indicator
  app.post("/api/tickets/:id/typing", requireAuth, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket || ticket.userId !== req.userId) {
        return res.status(404).json({ message: "Ticket non trouvé" });
      }
      const { isTyping } = req.body;
      notifyAdmins("typing", { ticketId: req.params.id, from: "user", isTyping: !!isTyping });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Send typing indicator
  app.post("/api/admin/tickets/:id/typing", requireAdmin, async (req, res) => {
    try {
      const ticket = await storage.getTicket(req.params.id);
      if (!ticket) return res.status(404).json({ message: "Ticket non trouvé" });
      const { isTyping } = req.body;
      notifyUser(ticket.userId, "typing", { ticketId: req.params.id, from: "admin", isTyping: !!isTyping });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Set active ticket for SSE client (for online-in-ticket tracking)
  app.post("/api/sse/active-ticket", requireAuth, async (req, res) => {
    // This is handled client-side via the SSE connection id; here we just acknowledge
    res.json({ ok: true });
  });

  // Get online status
  app.get("/api/online-status", requireAuth, async (_req, res) => {
    res.json({ onlineIds: getOnlineUserIds() });
  });

  // Admin: Unread ticket messages count
  app.get("/api/admin/tickets/unread-count", requireAdmin, async (_req, res) => {
    try {
      const count = await storage.countUnreadUserMessagesForAdmin();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Activity logs
  app.get("/api/admin/logs", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAdminLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Admin get logs error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Platform settings
  app.get("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      res.json(settings);
    } catch (error) {
      console.error("Admin get settings error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.post("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const { key, value, description } = req.body;
      
      if (!key || value === undefined) {
        return res.status(400).json({ message: "Clé et valeur requises" });
      }
      
      const setting = await storage.upsertSetting(key, String(value), description || undefined);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_setting",
        targetType: "setting",
        targetId: key,
        details: JSON.stringify({ value }),
        ipAddress: req.ip || null,
      });
      
      res.json(setting);
    } catch (error) {
      console.error("Admin update setting error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Bulk save all settings
  app.post("/api/admin/settings/bulk", requireAdmin, async (req, res) => {
    try {
      const { settings } = req.body;
      
      if (!settings || typeof settings !== "object") {
        return res.status(400).json({ message: "Paramètres invalides" });
      }
      
      const results = [];
      for (const [key, value] of Object.entries(settings)) {
        if (key && value !== undefined) {
          const setting = await storage.upsertSetting(key, String(value));
          results.push(setting);
        }
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_settings_bulk",
        targetType: "setting",
        targetId: "all",
        details: JSON.stringify({ count: results.length }),
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true, count: results.length });
    } catch (error) {
      console.error("Admin bulk update settings error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get all payment links
  app.get("/api/admin/payment-links", requireAdmin, async (req, res) => {
    try {
      const links = await storage.getAllPaymentLinks();
      const linksWithUsers = await Promise.all(
        links.map(async (link) => {
          const user = await storage.getUser(link.userId);
          return {
            ...link,
            user: user ? {
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              phone: user.phone,
            } : null,
          };
        })
      );
      res.json(linksWithUsers);
    } catch (error) {
      console.error("Admin get payment links error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Update payment link
  app.patch("/api/admin/payment-links/:id", requireAdmin, async (req, res) => {
    try {
      const link = await storage.updatePaymentLink(req.params.id, req.body);
      if (!link) {
        return res.status(404).json({ message: "Lien non trouvé" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_payment_link",
        targetType: "payment_link",
        targetId: req.params.id,
        details: JSON.stringify(req.body),
        ipAddress: req.ip || null,
      });
      
      res.json(link);
    } catch (error) {
      console.error("Admin update payment link error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Count pending withdrawal number changes (for sidebar badge)
  app.get("/api/admin/withdrawal-number-changes/count", requireAdmin, async (req, res) => {
    try {
      const changes = await storage.getPendingWithdrawalNumberChanges();
      res.json({ count: changes.length });
    } catch (error) {
      console.error("Admin withdrawal number changes count error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get pending withdrawal number changes
  app.get("/api/admin/withdrawal-number-changes", requireAdmin, async (req, res) => {
    try {
      const changes = await storage.getPendingWithdrawalNumberChanges();
      const changesWithDetails = await Promise.all(
        changes.map(async (change) => {
          const user = await storage.getUser(change.userId);
          const existingNumber = change.withdrawalNumberId 
            ? await storage.getWithdrawalNumber(change.withdrawalNumberId)
            : null;
          return {
            ...change,
            user: user ? {
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              phone: user.phone,
            } : null,
            existingNumber,
          };
        })
      );
      res.json(changesWithDetails);
    } catch (error) {
      console.error("Admin get withdrawal changes error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Approve withdrawal number change
  app.post("/api/admin/withdrawal-number-changes/:id/approve", requireAdmin, async (req, res) => {
    try {
      const { note } = req.body;
      const change = await storage.approveWithdrawalNumberChange(
        req.params.id, 
        req.userId!, 
        note
      );
      
      if (!change) {
        return res.status(404).json({ message: "Demande non trouvée" });
      }

      // Send withdrawal number approved email
      const wnUser = await storage.getUser(change.userId).catch(() => null);
      if (wnUser?.email) {
        const wNumbers = await storage.getWithdrawalNumbersByUserId(change.userId).catch(() => []);
        const wn = wNumbers.find((n: any) => n.id === change.withdrawalNumberId);
        sendWithdrawalNumberApprovedEmail(
          wnUser.email,
          wnUser.fullName || wnUser.username,
          wn?.phoneNumber || change.newPhoneNumber || "",
          wn?.operatorName || change.newOperatorName || undefined
        ).catch(() => {});
      }

      await storage.createAdminLog({
        adminId: req.userId!,
        action: "approve_withdrawal_number_change",
        targetType: "withdrawal_number_change",
        targetId: req.params.id,
        details: JSON.stringify({ note }),
        ipAddress: req.ip || null,
      });
      
      res.json({ change, message: "Changement approuvé" });
    } catch (error) {
      console.error("Admin approve change error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Reject withdrawal number change
  app.post("/api/admin/withdrawal-number-changes/:id/reject", requireAdmin, async (req, res) => {
    try {
      const { note } = req.body;
      const change = await storage.rejectWithdrawalNumberChange(
        req.params.id, 
        req.userId!, 
        note
      );
      
      if (!change) {
        return res.status(404).json({ message: "Demande non trouvée" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "reject_withdrawal_number_change",
        targetType: "withdrawal_number_change",
        targetId: req.params.id,
        details: JSON.stringify({ note }),
        ipAddress: req.ip || null,
      });
      
      res.json({ change, message: "Changement rejeté" });
    } catch (error) {
      console.error("Admin reject change error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ============= ADMIN: PENDING MANUAL PAYOUTS =============

  // GET /api/admin/pending-payouts — list all pending_manual withdrawals & transfers
  app.get("/api/admin/pending-payouts", requireAdmin, async (_req, res) => {
    try {
      const txs = await storage.getPendingManualPayouts();
      const enriched = await Promise.all(txs.map(async (t) => {
        const user = await storage.getUser(t.userId).catch(() => null);
        const operator = t.operatorId ? await storage.getOperator(t.operatorId).catch(() => null) : null;
        return {
          ...t,
          userFullName: (user as any)?.fullName || (user as any)?.username || "Inconnu",
          userEmail: (user as any)?.email || "",
          operatorName: (operator as any)?.name || null,
          originalProvider: (operator as any)?.paymentProvider || "swychr",
        };
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Admin pending-payouts error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/admin/pending-payouts/:id/execute — execute with chosen provider
  app.post("/api/admin/pending-payouts/:id/execute", requireAdmin, async (req, res) => {
    try {
      const { provider } = req.body as { provider: "swychr" | "afribapay" | "pixpay" };
      if (!provider || !["swychr","afribapay","pixpay"].includes(provider)) {
        return res.status(400).json({ message: "provider invalide (swychr|afribapay|pixpay)" });
      }

      const tx = await storage.getTransactionById(req.params.id);
      if (!tx || tx.status !== "pending_manual") {
        return res.status(404).json({ message: "Transaction non trouvée ou statut incorrect" });
      }
      if (!["withdrawal","transfer_out"].includes(tx.type)) {
        return res.status(400).json({ message: "Type de transaction non supporté" });
      }

      const txUser = await storage.getUser(tx.userId);
      if (!txUser) return res.status(404).json({ message: "Utilisateur non trouvé" });

      const operator = tx.operatorId ? await storage.getOperator(tx.operatorId).catch(() => null) : null;
      // recipientCountry may be a code ("CM") for withdrawals or a name ("Cameroun") for transfers
      // If longer than 2 chars, try to resolve the code from the operator's country
      let countryCode = (tx.recipientCountry || "CM").toUpperCase();
      if (countryCode.length > 2 && operator?.countryId) {
        const opCountry = await storage.getCountry(operator.countryId).catch(() => null);
        if (opCountry?.code) countryCode = opCountry.code.toUpperCase();
      }
      const phone = tx.recipientPhone || "";
      const creditedAmount = parseFloat(tx.amount);
      const totalAmount = parseFloat(tx.totalAmount || tx.amount);
      const recipientName = tx.recipientName || txUser.fullName || txUser.username || "Client";
      const txRef = tx.reference || "";

      let payoutResult: { success: boolean; transaction_id?: string; transactionId?: string; message?: string };

      if (provider === "afribapay") {
        const operatorName = (operator?.name || "").toUpperCase();
        const afribapayOperatorCode = resolveAfribaPayOperatorCode(operator, operatorName);
        const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[countryCode] || tx.currency || "XAF";
        let localPhone = phone.replace(/\s/g, "");
        if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
        const phonePrefixes: Record<string, string> = {
          CM:"237",SN:"221",CI:"225",BF:"226",ML:"223",GN:"224",BJ:"229",TG:"228",NE:"227",
          CD:"243",CG:"242",CF:"236",TD:"235",GA:"241",GQ:"240",MG:"261",RW:"250",KE:"254",TZ:"255",UG:"256",GH:"233",NG:"234",
        };
        const pfx = phonePrefixes[countryCode];
        if (pfx && localPhone.startsWith(pfx)) localPhone = localPhone.slice(pfx.length);
        const callbackUrl = `${process.env.APP_URL || ""}/api/afribapay/webhook`;
        const result = await initiateAfribaPayout({
          operator: afribapayOperatorCode,
          country: countryCode,
          phone_number: localPhone,
          amount: creditedAmount,
          currency: afribapayCurrency,
          order_id: txRef,
          reference_id: txRef,
          notify_url: callbackUrl,
        });
        if (result.success && result.transaction_id) {
          await storage.updateTransactionExternalReference(tx.id, result.transaction_id);
        }
        payoutResult = result;

      } else if (provider === "pixpay") {
        const serviceId = getPixPayServiceId(operator?.name || "", countryCode, "cash_in");
        if (!serviceId) {
          return res.status(400).json({ message: `PixPay non supporté pour cet opérateur (${operator?.name}) dans ${countryCode}` });
        }
        const pixpayIpnUrl = `${process.env.APP_URL || ""}/api/pixpay/webhook`;
        const result = await initiatePixPayPayout({
          serviceId: String(serviceId),
          amount: creditedAmount,
          phone: phone.replace(/\s/g, ""),
          countryCode,
          orderId: txRef,
          ipnUrl: pixpayIpnUrl,
          customData: txRef,
        });
        if (result.success && result.transactionId) {
          await storage.updateTransactionExternalReference(tx.id, result.transactionId);
        }
        payoutResult = result;

      } else {
        const operatorName = (operator?.name || "").toUpperCase();
        const finalPaymentMethod = resolvePaymentMethod(operatorName, countryCode);
        const result = await createSwychrPayout({
          country_code: countryCode,
          beneficiary_name: recipientName,
          mobile_no: formatInternationalPhone(phone, countryCode),
          amount: creditedAmount,
          transaction_id: txRef,
          payment_method: finalPaymentMethod as any,
          remarks: `Ashtech Pay - ${txRef}`,
        });
        payoutResult = result;
      }

      if (payoutResult.success) {
        await storage.updateTransactionStatus(tx.id, "pending");
        const pollerRef = provider === "afribapay"
          ? txRef
          : (payoutResult.transaction_id || payoutResult.transactionId || txRef);
        addPendingPayout({
          transactionId: tx.id,
          reference:     pollerRef,
          userId:        tx.userId,
          amount:        tx.amount,
          totalDebited:  totalAmount.toFixed(2),
          provider,
          countryCode,
        });
        await storage.createAdminLog({
          adminId: req.userId!,
          action: "execute_pending_payout",
          targetType: "transaction",
          targetId: tx.id,
          details: JSON.stringify({ provider, reference: pollerRef }),
          ipAddress: req.ip || null,
        });
        console.log(`[Admin] Executed pending_manual payout ${txRef} via ${provider} → poller ref: ${pollerRef}`);
        res.json({ message: `Payout soumis via ${provider} avec succès`, reference: pollerRef });
      } else {
        console.error(`[Admin] Execute pending_manual failed (${provider}): ${payoutResult.message}`);
        res.status(400).json({ message: `Échec via ${provider}: ${payoutResult.message}` });
      }
    } catch (error: any) {
      console.error("Admin execute pending-payout error:", error.message);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/admin/pending-payouts/:id/confirm — mark as completed without calling any provider
  app.post("/api/admin/pending-payouts/:id/confirm", requireAdmin, async (req, res) => {
    try {
      const tx = await storage.getTransactionById(req.params.id);
      if (!tx || tx.status !== "pending_manual") {
        return res.status(404).json({ message: "Transaction non trouvée ou statut incorrect" });
      }
      await storage.updateTransactionStatus(tx.id, "completed");
      const txUser = await storage.getUser(tx.userId).catch(() => null);
      if (txUser?.email) {
        sendWithdrawalApprovedEmail(
          txUser.email,
          (txUser as any).fullName || (txUser as any).username,
          tx.amount,
          tx.currency || "XAF",
          tx.reference || undefined
        ).catch(() => {});
      }
      await storage.createUserNotification({
        userId: tx.userId,
        type: tx.type === "withdrawal" ? "withdrawal_confirmed" : "transfer_confirmed",
        title: tx.type === "withdrawal" ? "Retrait confirmé" : "Transfert confirmé",
        message: `Votre ${tx.type === "withdrawal" ? "retrait" : "transfert"} de ${parseFloat(tx.amount).toLocaleString("fr-FR")} ${tx.currency} a été traité avec succès.`,
        transactionId: tx.id,
        isRead: false,
      });
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "confirm_pending_payout",
        targetType: "transaction",
        targetId: tx.id,
        details: JSON.stringify({ amount: tx.amount, currency: tx.currency }),
        ipAddress: req.ip || null,
      });
      console.log(`[Admin] Manually confirmed pending_manual ${tx.reference} as completed`);
      res.json({ message: "Transaction confirmée comme effectuée" });
    } catch (error: any) {
      console.error("Admin confirm pending-payout error:", error.message);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/admin/pending-payouts/:id/refund — cancel and refund user
  app.post("/api/admin/pending-payouts/:id/refund", requireAdmin, async (req, res) => {
    try {
      const tx = await storage.getTransactionById(req.params.id);
      if (!tx || tx.status !== "pending_manual") {
        return res.status(404).json({ message: "Transaction non trouvée ou statut incorrect" });
      }
      const totalAmount = parseFloat(tx.totalAmount || tx.amount);
      await storage.updateTransactionStatus(tx.id, "failed");
      await storage.updateUserBalance(tx.userId, totalAmount);
      await storage.createUserNotification({
        userId: tx.userId,
        type: tx.type === "withdrawal" ? "withdrawal_failed" : "transfer_failed",
        title: tx.type === "withdrawal" ? "Retrait annulé" : "Transfert annulé",
        message: `Votre ${tx.type === "withdrawal" ? "retrait" : "transfert"} de ${parseFloat(tx.amount).toLocaleString("fr-FR")} ${tx.currency} a été annulé et remboursé sur votre compte.`,
        transactionId: tx.id,
        isRead: false,
      });
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "refund_pending_payout",
        targetType: "transaction",
        targetId: tx.id,
        details: JSON.stringify({ totalAmount, currency: tx.currency }),
        ipAddress: req.ip || null,
      });
      console.log(`[Admin] Refunded pending_manual ${tx.reference} — ${totalAmount} ${tx.currency} to user ${tx.userId}`);
      res.json({ message: "Transaction annulée et remboursée" });
    } catch (error: any) {
      console.error("Admin refund pending-payout error:", error.message);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ============= USER NOTIFICATIONS =============

  // Get user notifications
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getUserNotifications(req.userId!);
      const unreadCount = await storage.getUnreadNotificationCount(req.userId!);
      
      // Also include active global messages as notifications (excluding dismissed ones)
      const globalMessages = await storage.getActiveGlobalMessagesForUser(req.userId!);
      const globalNotifications = globalMessages.map(msg => ({
        id: `global-${msg.id}`,
        userId: req.userId!,
        type: "global_message",
        title: msg.title,
        message: msg.message,
        transactionId: null,
        isRead: false,
        createdAt: msg.createdAt,
      }));
      
      res.json({ 
        notifications: [...globalNotifications, ...notifications],
        unreadCount: unreadCount + globalMessages.length
      });
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Mark notification as read (handles global messages too)
  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const notificationId = req.params.id;
      
      // Check if it's a global message - dismiss it instead of marking as read
      if (notificationId.startsWith("global-")) {
        const globalMessageId = notificationId.replace("global-", "");
        await storage.dismissGlobalMessage(req.userId!, globalMessageId);
      } else {
        await storage.markNotificationAsRead(notificationId, req.userId!);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Mark notification read error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Mark all notifications as read
  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      // Mark regular notifications as read
      await storage.markAllNotificationsAsRead(req.userId!);
      
      // Also dismiss all active global messages for this user
      const globalMessages = await storage.getActiveGlobalMessagesForUser(req.userId!);
      for (const msg of globalMessages) {
        await storage.dismissGlobalMessage(req.userId!, msg.id);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Mark all notifications read error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Delete notification (handles global messages too)
  app.delete("/api/notifications", requireAuth, async (req, res) => {
    try {
      await storage.deleteAllUserNotifications(req.userId!);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete all notifications error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      const notificationId = req.params.id;
      
      // Check if it's a global message - dismiss it
      if (notificationId.startsWith("global-")) {
        const globalMessageId = notificationId.replace("global-", "");
        await storage.dismissGlobalMessage(req.userId!, globalMessageId);
      } else {
        await storage.deleteUserNotification(notificationId, req.userId!);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete notification error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ============= ADMIN GLOBAL MESSAGES =============

  // Get all global messages (admin)
  app.get("/api/admin/global-messages", requireAdmin, async (req, res) => {
    try {
      const messages = await storage.getAllGlobalMessages();
      res.json(messages);
    } catch (error) {
      console.error("Get global messages error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Create global message
  app.post("/api/admin/global-messages", requireAdmin, async (req, res) => {
    try {
      const { title, message, expiresAt } = req.body;
      
      if (!title || !message) {
        return res.status(400).json({ message: "Titre et message requis" });
      }
      
      const globalMessage = await storage.createGlobalMessage({
        adminId: req.userId!,
        title,
        message,
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "create_global_message",
        targetType: "global_message",
        targetId: globalMessage.id,
        details: JSON.stringify({ title }),
        ipAddress: req.ip || null,
      });
      
      res.json(globalMessage);
    } catch (error) {
      console.error("Create global message error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Update global message
  app.patch("/api/admin/global-messages/:id", requireAdmin, async (req, res) => {
    try {
      const { title, message, isActive, expiresAt } = req.body;
      
      const updates: Record<string, any> = {};
      if (title !== undefined) updates.title = title;
      if (message !== undefined) updates.message = message;
      if (isActive !== undefined) updates.isActive = isActive;
      if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;
      
      const globalMessage = await storage.updateGlobalMessage(req.params.id, updates);
      
      if (!globalMessage) {
        return res.status(404).json({ message: "Message non trouvé" });
      }
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "update_global_message",
        targetType: "global_message",
        targetId: req.params.id,
        details: JSON.stringify(updates),
        ipAddress: req.ip || null,
      });
      
      res.json(globalMessage);
    } catch (error) {
      console.error("Update global message error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Delete global message
  app.delete("/api/admin/global-messages/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteGlobalMessage(req.params.id);
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "delete_global_message",
        targetType: "global_message",
        targetId: req.params.id,
        details: null,
        ipAddress: req.ip || null,
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error("Delete global message error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ============ KYC Routes ============

  // User: Get own KYC submission
  app.get("/api/kyc", requireAuth, async (req, res) => {
    try {
      const submission = await storage.getKycSubmissionByUserId(req.userId!);
      res.json(submission || null);
    } catch (error) {
      console.error("Get KYC error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // User: Submit KYC
  app.post("/api/kyc", requireAuth, async (req, res) => {
    try {
      const userId = req.userId!;
      
      // Check if user already has a pending KYC submission
      const existingSubmission = await storage.getKycSubmissionByUserId(userId);
      if (existingSubmission && existingSubmission.status === "pending") {
        return res.status(400).json({ message: "Vous avez déjà une demande KYC en attente" });
      }
      if (existingSubmission && existingSubmission.status === "approved") {
        return res.status(400).json({ message: "Votre compte est déjà vérifié" });
      }
      
      const { 
        documentType, 
        documentNumber, 
        documentFrontPath, 
        documentBackPath, 
        selfiePath,
        country,
        city,
        postalCode,
        businessType,
        businessCategory,
        businessDescription 
      } = req.body;
      
      // Validate required fields
      if (!documentType || !documentNumber || !documentFrontPath || !documentBackPath || !selfiePath || !businessType || !businessCategory || !businessDescription) {
        return res.status(400).json({ message: "Tous les champs sont requis" });
      }
      
      const submission = await storage.createKycSubmission({
        userId,
        documentType,
        documentNumber,
        documentFrontPath,
        documentBackPath,
        selfiePath,
        country: country || null,
        city: city || null,
        postalCode: postalCode || null,
        businessType,
        businessCategory,
        businessDescription,
      });
      
      res.json(submission);
    } catch (error) {
      console.error("Submit KYC error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get all KYC submissions
  app.get("/api/admin/kyc", requireAdmin, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const submissions = await storage.getAllKycSubmissions(status);

      // Build a map: documentNumber -> list of submissions with that document
      const docMap = new Map<string, typeof submissions>();
      for (const sub of submissions) {
        if (!sub.documentNumber) continue;
        const key = sub.documentNumber.trim().toLowerCase();
        if (!docMap.has(key)) docMap.set(key, []);
        docMap.get(key)!.push(sub);
      }
      // Also get ALL submissions (not just filtered) to detect cross-status duplicates
      const allSubmissions = status ? await storage.getAllKycSubmissions() : submissions;
      const allDocMap = new Map<string, typeof allSubmissions>();
      for (const sub of allSubmissions) {
        if (!sub.documentNumber) continue;
        const key = sub.documentNumber.trim().toLowerCase();
        if (!allDocMap.has(key)) allDocMap.set(key, []);
        allDocMap.get(key)!.push(sub);
      }

      // Enrich with user info + duplicate detection
      const enrichedSubmissions = await Promise.all(
        submissions.map(async (sub) => {
          const user = await storage.getUser(sub.userId);
          // Find other submissions with same document number (different submission id)
          const key = sub.documentNumber?.trim().toLowerCase() || "";
          const duplicates = (allDocMap.get(key) || []).filter(d => d.id !== sub.id);
          const duplicateAccounts = await Promise.all(
            duplicates.map(async (dup) => {
              const dupUser = await storage.getUser(dup.userId);
              return {
                submissionId: dup.id,
                userId: dup.userId,
                status: dup.status,
                fullName: dupUser?.fullName || "N/A",
                email: dupUser?.email || "N/A",
                username: dupUser?.username || "N/A",
              };
            })
          );
          return {
            ...sub,
            user: user ? {
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              phone: user.phone,
              username: user.username,
              createdAt: (user as any).createdAt,
            } : null,
            duplicateAccounts,
          };
        })
      );

      res.json(enrichedSubmissions);
    } catch (error) {
      console.error("Get admin KYC error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get KYC stats
  app.get("/api/admin/kyc/stats", requireAdmin, async (req, res) => {
    try {
      const pending = await storage.countKycByStatus("pending");
      const approved = await storage.countKycByStatus("approved");
      const rejected = await storage.countKycByStatus("rejected");
      
      res.json({ pending, approved, rejected });
    } catch (error) {
      console.error("Get KYC stats error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Get single KYC submission
  app.get("/api/admin/kyc/:id", requireAdmin, async (req, res) => {
    try {
      const submission = await storage.getKycSubmissionById(req.params.id);
      if (!submission) {
        return res.status(404).json({ message: "Soumission KYC non trouvée" });
      }
      
      const user = await storage.getUser(submission.userId);
      
      res.json({
        ...submission,
        user: user ? {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          username: user.username,
          country: user.country,
          createdAt: user.createdAt,
        } : null,
      });
    } catch (error) {
      console.error("Get KYC detail error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Approve KYC submission
  app.post("/api/admin/kyc/:id/approve", requireAdmin, async (req, res) => {
    try {
      const { note } = req.body;
      const submission = await storage.approveKycSubmission(
        req.params.id, 
        req.userId!, 
        note
      );
      
      if (!submission) {
        return res.status(404).json({ message: "Soumission KYC non trouvée" });
      }
      
      // Send KYC approved email
      const kycUser = await storage.getUser(submission.userId).catch(() => null);
      if (kycUser?.email) {
        sendKycApprovedEmail(kycUser.email, kycUser.fullName || kycUser.username).catch(() => {});
      }

      // Create notification for user
      await storage.createUserNotification({
        userId: submission.userId,
        type: "kyc_approved",
        title: "Compte vérifié",
        message: "Félicitations ! Votre vérification KYC a été approuvée. Vous avez maintenant accès à toutes les fonctionnalités.",
        transactionId: null,
      });
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "approve_kyc",
        targetType: "kyc_submission",
        targetId: req.params.id,
        details: JSON.stringify({ note }),
        ipAddress: req.ip || null,
      });
      
      res.json(submission);
    } catch (error) {
      console.error("Approve KYC error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Admin: Reject KYC submission
  app.post("/api/admin/kyc/:id/reject", requireAdmin, async (req, res) => {
    try {
      const { note } = req.body;
      
      if (!note) {
        return res.status(400).json({ message: "La raison du rejet est requise" });
      }
      
      const submission = await storage.rejectKycSubmission(
        req.params.id, 
        req.userId!, 
        note
      );
      
      if (!submission) {
        return res.status(404).json({ message: "Soumission KYC non trouvée" });
      }
      
      // Create notification for user
      await storage.createUserNotification({
        userId: submission.userId,
        type: "kyc_rejected",
        title: "Vérification rejetée",
        message: `Votre vérification KYC a été rejetée. Raison: ${note}. Veuillez soumettre de nouveaux documents.`,
        transactionId: null,
      });
      
      await storage.createAdminLog({
        adminId: req.userId!,
        action: "reject_kyc",
        targetType: "kyc_submission",
        targetId: req.params.id,
        details: JSON.stringify({ note }),
        ipAddress: req.ip || null,
      });
      
      res.json(submission);
    } catch (error) {
      console.error("Reject KYC error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // Swychr Webhook - Payment status callback
  app.get("/api/checkout/:transactionId", async (req, res) => {
    try {
      const { transactionId } = req.params;
      const details = await fetchPaymentLinkDetails(transactionId);
      if (!details) {
        return res.status(404).json({ message: "Payment details not found" });
      }
      res.json(details);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/swychr/webhook", (req, res) => {
    const proto = (req.headers["x-forwarded-proto"] as string) || (req.secure ? "https" : "http");
    const host  = req.headers["x-forwarded-host"] as string || req.headers.host || "";
    const baseUrl = process.env.APP_URL || `${proto}://${host}`;
    res.redirect(`${baseUrl}/dashboard?payment=processing`);
  });

  app.post("/api/swychr/webhook", async (req, res) => {
    try {
      const payload = req.body;
      console.log("[Swychr Webhook] Received:", JSON.stringify(payload));

      // Extract transaction_id from nested payload
      const inner = payload?.data?.data || payload?.data || {};
      const transactionId = inner?.transaction_id || inner?.attributes?.transaction_id || payload?.transaction_id;
      const rawStatus = inner?.status ?? inner?.attributes?.status ?? null;

      if (!transactionId) {
        console.error("[Swychr Webhook] Missing transaction_id");
        return res.status(400).json({ message: "Missing transaction_id" });
      }

      const transaction = await storage.getTransactionByReference(transactionId);
      if (!transaction) {
        console.error("[Swychr Webhook] Transaction not found:", transactionId);
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (transaction.status !== "pending") {
        console.log("[Swychr Webhook] Transaction already processed:", transactionId);
        return res.json({ success: true });
      }

      let status: "completed" | "failed" | null = null;
      if (rawStatus === 1) {
        status = "completed";
      } else if (rawStatus === 2 || rawStatus === 3) {
        // 2 = failed, 3 = refunded (YAML spec v1.0.3)
        status = "failed";
      }

      if (status === "completed") {
        await storage.updateTransactionStatus(transaction.id, "completed");
        const isPaymentLink = transaction.type === "payment_link";
        const txCurrency = transaction.currency || "XAF";
        // Credit the correct wallet (XOFB for Benin, XOFS for Senegal, XAF for Cameroon, etc.)
        await creditUserWallet(transaction.userId, parseFloat(transaction.amount), txCurrency);
        await storage.createUserNotification({
          userId: transaction.userId,
          type: isPaymentLink ? "payment_link_received" : "deposit_confirmed",
          title: isPaymentLink ? "Paiement reçu" : "Dépôt confirmé",
          message: isPaymentLink
            ? `Vous avez reçu un paiement de ${transaction.amount} ${txCurrency} de ${transaction.payerName || "un client"}.`
            : `Votre dépôt de ${transaction.amount} ${txCurrency} a été crédité sur votre compte.`,
          transactionId: transaction.id,
        });
        if (isPaymentLink && transaction.paymentIntentId) {
          await storage.updatePaymentIntentStatus(transaction.paymentIntentId, "completed");
        }
        console.log(`[Swychr Webhook] ✓ Payment SUCCESS: ${transaction.id} → credited ${transaction.amount} ${txCurrency}`);
      } else if (status === "failed") {
        await storage.updateTransactionStatus(transaction.id, "failed");
        if (transaction.type === "payment_link" && transaction.paymentIntentId) {
          await storage.updatePaymentIntentStatus(transaction.paymentIntentId, "failed");
        }
        const isPaymentLink = transaction.type === "payment_link";
        await storage.createUserNotification({
          userId: transaction.userId,
          type: isPaymentLink ? "payment_link_failed" : "deposit_failed",
          title: isPaymentLink ? "Paiement échoué" : "Dépôt échoué",
          message: isPaymentLink
            ? `Un paiement de ${transaction.totalAmount || transaction.amount} a échoué.`
            : `Votre dépôt de ${transaction.totalAmount || transaction.amount} a échoué.`,
          transactionId: transaction.id,
        });
        console.log("[Swychr Webhook] Payment FAILED for:", transaction.id);
      } else {
        console.log("[Swychr Webhook] Unrecognized status:", rawStatus, "for:", transactionId);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[Swychr Webhook] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Swychr manual status check
  app.get("/api/swychr/verify/:transactionId", requireAuth, async (req, res) => {
    try {
      const { transactionId } = req.params;
      const result = await checkSwychrPaymentStatus(transactionId);
      res.json(result);
    } catch (error) {
      console.error("[Swychr Verify] Error:", error);
      res.status(500).json({ message: "Erreur de vérification" });
    }
  });

  // ─── AfribaPay Webhook ────────────────────────────────────────────────────
  app.post("/api/afribapay/webhook", async (req, res) => {
    try {
      const payload = req.body;
      console.log("[AfribaPay Webhook] Received:", JSON.stringify(payload));

      const parsed = parseAfribaPayWebhook(payload);
      const { order_id, transaction_id, status } = parsed;

      const ref = order_id || transaction_id;
      if (!ref) {
        console.error("[AfribaPay Webhook] Missing order_id/transaction_id");
        return res.status(400).json({ message: "Missing identifier" });
      }

      const transaction = await storage.getTransactionByReference(ref);
      if (!transaction) {
        console.error("[AfribaPay Webhook] Transaction not found:", ref);
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (transaction.status !== "pending") {
        return res.json({ success: true });
      }

      const isPaymentLink = transaction.type === "payment_link";
      const isPayout = transaction.type === "withdrawal" || transaction.type === "transfer_out";
      const txCurrency = transaction.currency || "XAF";

      if (status === "completed") {
        await storage.updateTransactionStatus(transaction.id, "completed");

        if (isPayout) {
          // Payout success: money already left user's account, just notify
          removePendingPayout(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: "withdrawal_confirmed",
            title: transaction.type === "transfer_out" ? "Transfert confirmé" : "Retrait confirmé",
            message: transaction.type === "transfer_out"
              ? `Votre transfert de ${transaction.amount} ${txCurrency} a été envoyé avec succès.`
              : `Votre retrait de ${transaction.amount} ${txCurrency} a été envoyé avec succès.`,
            transactionId: transaction.id,
          });
          console.log(`[AfribaPay Webhook] ✓ Payout SUCCESS: ${transaction.id} (${transaction.type})`);
        } else {
          // Payin / deposit success: credit user's wallet
          await creditUserWallet(transaction.userId, parseFloat(transaction.amount), txCurrency);
          removePendingPayment(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: isPaymentLink ? "payment_link_received" : "deposit_confirmed",
            title: isPaymentLink ? "Paiement reçu" : "Dépôt confirmé",
            message: isPaymentLink
              ? `Vous avez reçu un paiement de ${transaction.amount} ${txCurrency} de ${transaction.payerName || "un client"}.`
              : `Votre dépôt de ${transaction.amount} ${txCurrency} a été crédité sur votre compte.`,
            transactionId: transaction.id,
          });
          if (transaction.paymentIntentId) {
            await storage.updatePaymentIntentStatus(transaction.paymentIntentId, "completed");
          }
          console.log(`[AfribaPay Webhook] ✓ Deposit SUCCESS: ${transaction.id} → credited ${transaction.amount} ${txCurrency}`);
        }

      } else if (status === "failed") {
        await storage.updateTransactionStatus(transaction.id, "failed");

        if (isPayout) {
          // Payout failed: refund the full debited amount to user
          const refundAmount = parseFloat((transaction as any).totalAmount || transaction.amount);
          await storage.updateUserBalance(transaction.userId, refundAmount);
          removePendingPayout(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: "withdrawal_failed",
            title: transaction.type === "transfer_out" ? "Transfert échoué" : "Retrait échoué",
            message: transaction.type === "transfer_out"
              ? `Votre transfert de ${transaction.amount} ${txCurrency} a échoué. Le montant a été recrédité sur votre compte.`
              : `Votre retrait de ${transaction.amount} ${txCurrency} a échoué. Le montant a été recrédité sur votre compte.`,
            transactionId: transaction.id,
          });
          console.log(`[AfribaPay Webhook] ✗ Payout FAILED: ${transaction.id} — refunded ${refundAmount} ${txCurrency}`);
        } else {
          if (transaction.paymentIntentId) {
            await storage.updatePaymentIntentStatus(transaction.paymentIntentId, "failed");
          }
          removePendingPayment(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: isPaymentLink ? "payment_link_failed" : "deposit_failed",
            title: isPaymentLink ? "Paiement annulé" : "Dépôt annulé",
            message: isPaymentLink
              ? "Le paiement a été annulé ou a échoué."
              : "Votre dépôt a été annulé. Aucun montant n'a été débité.",
            transactionId: transaction.id,
          });
          console.log(`[AfribaPay Webhook] ✗ Deposit FAILED/CANCELLED: ${transaction.id}`);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[AfribaPay Webhook] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── PixPay IPN Webhook ───────────────────────────────────────────────────────
  app.post("/api/pixpay/webhook", async (req, res) => {
    try {
      const payload = req.body;
      console.log("[PixPay Webhook] Received:", JSON.stringify(payload));

      const parsed = parsePixPayWebhook(payload);
      const { transactionId, orderId, status, providerMessage } = parsed;

      const ref = orderId || transactionId;
      if (!ref) {
        console.error("[PixPay Webhook] Missing identifier (custom_data / transaction_id)");
        return res.status(400).json({ message: "Missing identifier" });
      }

      // Prefer lookup by our order reference stored in custom_data
      const transaction = await storage.getTransactionByReference(ref);
      if (!transaction) {
        console.error("[PixPay Webhook] Transaction not found:", ref);
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (transaction.status !== "pending") {
        return res.json({ success: true });
      }

      const isPaymentLink = transaction.type === "payment_link";
      const isPayout = transaction.type === "withdrawal" || transaction.type === "transfer_out";
      const txCurrency = transaction.currency || "XAF";

      if (status === "completed") {
        await storage.updateTransactionStatus(transaction.id, "completed");

        if (isPayout) {
          // Payout success: money already left user's account, just notify
          removePendingPayout(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: "withdrawal_confirmed",
            title: transaction.type === "transfer_out" ? "Transfert confirmé" : "Retrait confirmé",
            message: transaction.type === "transfer_out"
              ? `Votre transfert de ${transaction.amount} ${txCurrency} a été envoyé avec succès.`
              : `Votre retrait de ${transaction.amount} ${txCurrency} a été envoyé avec succès.`,
            transactionId: transaction.id,
          });
          console.log(`[PixPay Webhook] ✓ Payout SUCCESS: ${transaction.id} (${transaction.type})`);
        } else {
          // Payin / deposit success: credit user's wallet
          await creditUserWallet(transaction.userId, parseFloat(transaction.amount), txCurrency);
          removePendingPayment(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: isPaymentLink ? "payment_link_received" : "deposit_confirmed",
            title: isPaymentLink ? "Paiement reçu" : "Dépôt confirmé",
            message: isPaymentLink
              ? `Vous avez reçu un paiement de ${transaction.amount} ${txCurrency} de ${transaction.payerName || "un client"}.`
              : `Votre dépôt de ${transaction.amount} ${txCurrency} a été crédité sur votre compte.`,
            transactionId: transaction.id,
          });
          if (transaction.paymentIntentId) {
            await storage.updatePaymentIntentStatus(transaction.paymentIntentId, "completed");
          }
          console.log(`[PixPay Webhook] ✓ Deposit SUCCESS: ${transaction.id} → ${transaction.amount} ${txCurrency}`);
        }

      } else if (status === "failed") {
        await storage.updateTransactionStatus(transaction.id, "failed");

        if (isPayout) {
          // Payout failed: refund the full debited amount to user
          const refundAmount = parseFloat((transaction as any).totalAmount || transaction.amount);
          await storage.updateUserBalance(transaction.userId, refundAmount);
          removePendingPayout(ref);
          await storage.createUserNotification({
            userId: transaction.userId,
            type: "withdrawal_failed",
            title: transaction.type === "transfer_out" ? "Transfert échoué" : "Retrait échoué",
            message: transaction.type === "transfer_out"
              ? `Votre transfert de ${transaction.amount} ${txCurrency} a échoué. Le montant a été recrédité sur votre compte.${providerMessage ? ` (${providerMessage})` : ""}`
              : `Votre retrait de ${transaction.amount} ${txCurrency} a échoué. Le montant a été recrédité sur votre compte.${providerMessage ? ` (${providerMessage})` : ""}`,
            transactionId: transaction.id,
          });
          console.log(`[PixPay Webhook] ✗ Payout FAILED: ${transaction.id} — refunded ${refundAmount} ${txCurrency}`);
        } else {
          removePendingPayment(ref);
          if (transaction.paymentIntentId) {
            await storage.updatePaymentIntentStatus(transaction.paymentIntentId, "failed");
          }
          await storage.createUserNotification({
            userId: transaction.userId,
            type: isPaymentLink ? "payment_link_failed" : "deposit_failed",
            title: isPaymentLink ? "Paiement annulé" : "Dépôt annulé",
            message: isPaymentLink
              ? `Le paiement a été annulé ou a échoué.${providerMessage ? ` (${providerMessage})` : ""}`
              : `Votre dépôt a été annulé.${providerMessage ? ` (${providerMessage})` : ""}`,
            transactionId: transaction.id,
          });
          console.log(`[PixPay Webhook] ✗ Deposit FAILED: ${transaction.id} — ${providerMessage}`);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("[PixPay Webhook] Error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── AfribaPay OTP Confirm Routes ────────────────────────────────────────────

  // POST /api/deposits/confirm-otp — validate OTP for an AfribaPay deposit
  app.post("/api/deposits/confirm-otp", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { ref, otpCode } = req.body;

      if (!ref || !otpCode) {
        return res.status(400).json({ message: "Référence et code OTP requis" });
      }

      const ctx = otpContextCache.get(ref);
      if (!ctx) {
        return res.status(400).json({ message: "Session OTP expirée ou introuvable. Veuillez recommencer." });
      }
      if (ctx.expiresAt < Date.now()) {
        otpContextCache.delete(ref);
        return res.status(400).json({ message: "Le code OTP a expiré. Veuillez recommencer." });
      }

      const callbackUrl = `${process.env.APP_URL || ""}/api/afribapay/webhook`;
      const result = await confirmAfribaPayOtp({
        operator: ctx.operator,
        country: ctx.country,
        phone_number: ctx.phone,
        amount: ctx.amount,
        currency: ctx.currency,
        order_id: ref,
        reference_id: ref,
        otp_code: otpCode,
        notify_url: callbackUrl,
      });

      if (!result.success) {
        return res.status(400).json({ message: result.message || "Code OTP invalide ou expiré" });
      }

      otpContextCache.delete(ref);
      console.log(`[OTP Confirm] ✓ Deposit OTP confirmed for ref=${ref}, afriba_tx=${result.transaction_id}`);

      // Update transaction external reference with AfribaPay's transaction_id and start polling
      const tx = await storage.getTransactionByReference(ref);
      if (tx) {
        const extRef = result.transaction_id || ref;
        await storage.updateTransactionExternalReference(tx.id, extRef);
        addPendingPayment({
          transactionId: tx.id,
          reference: ref,
          externalReference: extRef,
          attempts: 0,
          userId: user.id,
          type: "deposit",
          amount: ctx.amount.toString(),
          provider: "afribapay",
        });
      }

      res.json({ success: true, message: "OTP validé. Votre paiement est en cours de traitement." });
    } catch (error) {
      console.error("[OTP Confirm Deposit] Error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/payment-links/:slug/confirm-otp — validate OTP for a payment link
  app.post("/api/payment-links/:slug/confirm-otp", async (req, res) => {
    try {
      const { ref, otpCode } = req.body;

      if (!ref || !otpCode) {
        return res.status(400).json({ message: "Référence et code OTP requis" });
      }

      const ctx = otpContextCache.get(ref);
      if (!ctx) {
        return res.status(400).json({ message: "Session OTP expirée ou introuvable. Veuillez recommencer." });
      }
      if (ctx.expiresAt < Date.now()) {
        otpContextCache.delete(ref);
        return res.status(400).json({ message: "Le code OTP a expiré. Veuillez recommencer." });
      }

      const callbackUrl = `${process.env.APP_URL || ""}/api/afribapay/webhook`;
      const result = await confirmAfribaPayOtp({
        operator: ctx.operator,
        country: ctx.country,
        phone_number: ctx.phone,
        amount: ctx.amount,
        currency: ctx.currency,
        order_id: ref,
        reference_id: ref,
        otp_code: otpCode,
        notify_url: callbackUrl,
      });

      if (!result.success) {
        return res.status(400).json({ message: result.message || "Code OTP invalide ou expiré" });
      }

      otpContextCache.delete(ref);
      console.log(`[OTP Confirm] ✓ PaymentLink OTP confirmed for ref=${ref}, afriba_tx=${result.transaction_id}`);

      // Update transaction external reference and start polling
      const tx = await storage.getTransactionByReference(ref);
      if (tx) {
        const extRef = result.transaction_id || ref;
        await storage.updateTransactionExternalReference(tx.id, extRef);
        addPendingPayment({
          transactionId: tx.id,
          reference: ref,
          externalReference: extRef,
          attempts: 0,
          userId: tx.userId,
          type: "payment_link",
          amount: ctx.amount.toString(),
          provider: "afribapay",
        });
      }

      res.json({ success: true, message: "OTP validé. Le paiement est en cours de traitement." });
    } catch (error) {
      console.error("[OTP Confirm PaymentLink] Error:", error);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // ─── AfribaPay Admin Routes ───────────────────────────────────────────────

  // GET /api/admin/afribapay/countries — fetch live AfribaPay country list
  app.get("/api/admin/afribapay/countries", requireAdmin, async (_req, res) => {
    try {
      const countries = await fetchAfribaPayCountries();
      res.json({ success: true, data: countries });
    } catch (err: any) {
      console.error("[AfribaPay Countries] Error:", err);
      res.status(500).json({ message: err.message || "Erreur AfribaPay" });
    }
  });

  // PATCH /api/admin/operators/:id/provider — set provider: swychr | afribapay | pixpay
  app.patch("/api/admin/operators/:id/provider", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { paymentProvider, afribapayOperatorCode, pixpayServiceId } = req.body;

      if (!["swychr", "afribapay", "pixpay"].includes(paymentProvider)) {
        return res.status(400).json({ message: "Fournisseur invalide. Choisir swychr, afribapay ou pixpay." });
      }

      // If switching to PixPay, auto-detect flow type from operator name + country
      let autoFlowType = "ussd";
      if (paymentProvider === "pixpay") {
        const existingOp = await storage.getOperator(id);
        if (existingOp) {
          const country = await storage.getCountry(existingOp.countryId!);
          const countryCode = (country as any)?.code || "";
          autoFlowType = detectPixPayFlowType(existingOp.name, countryCode);
        }
      }

      const updateData: any = {
        paymentProvider,
        afribapayOperatorCode: afribapayOperatorCode || null,
        pixpayServiceId: pixpayServiceId !== undefined ? (pixpayServiceId || null) : undefined,
        pixpayOperatorType: paymentProvider === "pixpay" ? autoFlowType : "ussd",
      };
      // Remove undefined keys
      Object.keys(updateData).forEach(k => updateData[k] === undefined && delete updateData[k]);

      const updated = await storage.updateOperator(id, updateData);
      if (!updated) return res.status(404).json({ message: "Opérateur non trouvé" });
      console.log(`[Admin] ✓ Operator ${updated.name} (${id}) → provider=${paymentProvider} | pixpayServiceId=${pixpayServiceId || "null"} | type=${autoFlowType}`);
      res.json({ success: true, operator: updated, autoFlowType });
    } catch (err: any) {
      console.error("[Admin Provider] Error:", err);
      res.status(500).json({ message: err.message || "Erreur serveur" });
    }
  });

  // PATCH /api/admin/fees/:id/afribapay — update AfribaPay fee rate for a fee entry
  app.patch("/api/admin/fees/:id/afribapay", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { afribapayFee, ashtechMargin, isActive, minFee } = req.body;
      const updates: any = {};
      if (afribapayFee !== undefined) {
        const rate = parseFloat(afribapayFee);
        const margin = parseFloat(ashtechMargin || "0");
        updates.afribapayFee = String(rate);
        updates.ashtechMargin = String(margin);
        updates.feeValue = String((rate + margin).toFixed(4));
      } else if (ashtechMargin !== undefined) {
        updates.ashtechMargin = String(ashtechMargin);
      }
      if (isActive !== undefined) updates.isActive = Boolean(isActive);
      if (minFee !== undefined) updates.minFee = minFee ? String(minFee) : null;
      const updated = await storage.updateFee(id, updates);
      if (!updated) return res.status(404).json({ message: "Frais non trouvé" });
      res.json({ success: true, fee: updated });
    } catch (err: any) {
      console.error("[Admin AfribaPay Fee] Error:", err);
      res.status(500).json({ message: err.message || "Erreur serveur" });
    }
  });

  // PATCH /api/admin/fees/:id/pixpay — update PixPay fee rate for a fee entry
  app.patch("/api/admin/fees/:id/pixpay", requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { pixpayFee, ashtechMargin, isActive, minFee } = req.body;
      const updates: any = {};
      if (pixpayFee !== undefined) {
        const rate = parseFloat(pixpayFee);
        const margin = parseFloat(ashtechMargin || "0");
        updates.pixpayFee = String(rate);
        updates.ashtechMargin = String(margin);
        updates.feeValue = String((rate + margin).toFixed(4));
      } else if (ashtechMargin !== undefined) {
        updates.ashtechMargin = String(ashtechMargin);
      }
      if (isActive !== undefined) updates.isActive = Boolean(isActive);
      if (minFee !== undefined) updates.minFee = minFee ? String(minFee) : null;
      const updated = await storage.updateFee(id, updates);
      if (!updated) return res.status(404).json({ message: "Frais non trouvé" });
      res.json({ success: true, fee: updated });
    } catch (err: any) {
      console.error("[Admin PixPay Fee] Error:", err);
      res.status(500).json({ message: err.message || "Erreur serveur" });
    }
  });

  // GET /api/admin/pixpay/operators — list operators that use PixPay
  app.get("/api/admin/pixpay/operators", requireAdmin, async (req, res) => {
    try {
      const allOperators = await storage.getOperators();
      const pixpayOperators = allOperators.filter((op: any) => op.paymentProvider === "pixpay");
      res.json(pixpayOperators);
    } catch (err: any) {
      console.error("[Admin PixPay Operators] Error:", err);
      res.status(500).json({ message: err.message || "Erreur serveur" });
    }
  });

  // GET /api/admin/pixpay/supported-countries — list all PixPay supported countries
  app.get("/api/admin/pixpay/supported-countries", requireAdmin, async (_req, res) => {
    res.json(PIXPAY_SUPPORTED_COUNTRIES);
  });

  // ════════════════════════════════════════════════════════════════════════════
  //  API v1  —  External merchant API (authenticated by Bearer API key)
  // ════════════════════════════════════════════════════════════════════════════

  /** Middleware: authenticate via Bearer API key */
  async function requireApiKey(req: any, res: any, next: any) {
    const authHeader = req.headers["authorization"] as string | undefined;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "unauthorized", message: "En-tête Authorization manquant. Format : Bearer <clé>" });
    }
    const key = authHeader.slice(7).trim();
    if (!key.startsWith("ak_")) {
      return res.status(401).json({ error: "unauthorized", message: "Clé API invalide." });
    }
    const user = await storage.getUserByApiKey(key);
    if (!user) return res.status(401).json({ error: "unauthorized", message: "Clé API introuvable ou révoquée." });
    if (!user.isVerified) {
      return res.status(403).json({ error: "account_not_verified", message: "Votre compte n'est pas vérifié. Complétez la vérification KYC pour accéder à l'API." });
    }
    if (!(user as any).apiEnabled) {
      return res.status(403).json({ error: "api_not_enabled", message: "L'accès API n'est pas activé sur votre compte. Contactez l'administrateur pour l'activer." });
    }
    req.apiUser = user;
    next();
  }

  /**
   * Normalize internal DB currency codes to standard ISO codes.
   * The DB uses suffixed codes (XOFB, XOFF, XAFC…) to distinguish sub-zones internally,
   * but merchants must use standard codes (XOF, XAF…).
   */
  function normalizeApiCurrency(dbCurrency: string): string {
    const c = (dbCurrency || "").toUpperCase();
    if (c.startsWith("XOF")) return "XOF";
    if (c.startsWith("XAF")) return "XAF";
    return c; // GNF, CDF stay unchanged
  }

  /** GET /v1/countries — list all active countries with their operators */
  app.get("/v1/countries", requireApiKey, async (_req, res) => {
    try {
      const countries = await storage.getActiveCountries();
      const result = await Promise.all(
        countries.map(async (c: any) => {
          const ops = await storage.getOperatorsByCountry(c.id);
          return {
            code: c.code,
            name: c.name,
            currency: normalizeApiCurrency(c.currency),
            operators: ops
              .filter((o: any) => o.paymentProvider !== "swychr")
              .map((o: any) => o.name),
          };
        })
      );
      res.json(result.filter((c: any) => c.operators.length > 0));
    } catch (e: any) {
      console.error("[API v1 /countries]", e);
      res.status(500).json({ error: "server_error", message: "Erreur serveur" });
    }
  });

  /** POST /v1/collect — initiate a Mobile Money collection */
  app.post("/v1/collect", requireApiKey, async (req: any, res) => {
    try {
      const merchant = req.apiUser;
      const { amount, currency, phone, operator: operatorName, country_code, reference, notify_url } = req.body;

      // ── Validation ────────────────────────────────────────────────────────
      if (!amount || !currency || !phone || !operatorName || !country_code) {
        return res.status(400).json({ error: "bad_request", message: "Champs requis : amount, currency, phone, operator, country_code" });
      }
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: "bad_request", message: "Le montant doit être un nombre positif." });
      }

      // ── Find country ──────────────────────────────────────────────────────
      const allCountries = await storage.getActiveCountries();
      const country = allCountries.find(
        (c: any) => c.code.toUpperCase() === country_code.toUpperCase()
      );
      if (!country) return res.status(422).json({ error: "unprocessable", message: `Pays non supporté : ${country_code}` });

      // ── Find operator ──────────────────────────────────────────────────────
      const countryOps = await storage.getOperatorsByCountry(country.id);
      const operatorRecord = countryOps.find(
        (o: any) => o.name.toLowerCase() === operatorName.toLowerCase()
      );
      if (!operatorRecord) {
        const available = countryOps.map((o: any) => o.name).join(", ");
        return res.status(422).json({
          error: "unprocessable",
          message: `Opérateur non supporté pour ce pays. Disponibles : ${available}`,
        });
      }
      if ((operatorRecord as any).paymentProvider === "swychr") {
        return res.status(422).json({ error: "unprocessable", message: "Cet opérateur n'est pas disponible via l'API directe." });
      }

      // ── Validate currency matches country (accept both normalized and internal codes) ────
      const expectedIso = normalizeApiCurrency(country.currency);
      const receivedIso = normalizeApiCurrency(currency);
      if (receivedIso !== expectedIso) {
        return res.status(422).json({
          error: "unprocessable",
          message: `Devise incorrecte pour ce pays. Attendu : ${expectedIso}`,
        });
      }

      // ── Resolve fees from DB ─────────────────────────────────────────────
      const paymentProvider = (operatorRecord as any).paymentProvider as string;
      const resolvedFeeRecord = await storage.resolveFee("deposit", country.id, (operatorRecord as any).id);
      const ashtechMarginPct = (resolvedFeeRecord as any)?.ashtechMargin != null
        ? parseFloat((resolvedFeeRecord as any).ashtechMargin)
        : ASHTECH_MARGIN;

      let creditedAmount: number;
      let ashtechFeeAmount: number;
      if (paymentProvider === "afribapay") {
        const rate = (resolvedFeeRecord as any)?.afribapayFee ? parseFloat((resolvedFeeRecord as any).afribapayFee) : 3.0;
        const af = computeAfribaPayFees(amountNum, rate, ashtechMarginPct);
        creditedAmount = af.creditedAmount;
        ashtechFeeAmount = af.ashtechFeeAmount;
      } else {
        const rate = (resolvedFeeRecord as any)?.pixpayFee ? parseFloat((resolvedFeeRecord as any).pixpayFee) : 3.0;
        const pf = computePixPayFees(amountNum, rate, ashtechMarginPct);
        creditedAmount = pf.creditedAmount;
        ashtechFeeAmount = pf.ashtechFeeAmount;
      }

      const depositRef = reference || generateTransactionReference("deposit");

      // ── PixPay OTP pre-check ──────────────────────────────────────────────
      if (paymentProvider === "pixpay") {
        const pxFlowType = detectPixPayFlowType(operatorName, country.code);
        if (pxFlowType === "otp" && !req.body.otp) {
          const ussdCode = PIXPAY_OTP_USSD_CODES[country.code.toUpperCase()] || "#144*82#";
          const amountForCode = ussdCode.includes("montant") ? ussdCode.replace("montant", String(Math.round(amountNum))) : ussdCode;
          return res.status(400).json({
            error: "otp_required",
            message: `OTP requis. Composez ${amountForCode} pour obtenir votre code OTP, puis relancez la requête avec le champ 'otp'.`,
            ussd_code: amountForCode,
          });
        }
      }

      // ── AfribaPay OTP pre-check ──────────────────────────────────────────
      if (paymentProvider === "afribapay") {
        const afribaOpCode = (operatorRecord as any).afribapayOperatorCode || operatorName.toLowerCase();
        const otpInfo = await getAfribaPayOtpInfo(country.code, afribaOpCode);
        if (otpInfo.required && !req.body.otp) {
          return res.status(400).json({
            error: "otp_required",
            message: `OTP requis pour cet opérateur. ${otpInfo.instructions || ""}`,
            ussd_code: otpInfo.ussdCode || null,
          });
        }
      }

      // ── Create transaction ────────────────────────────────────────────────
      const transaction = await storage.createTransaction({
        userId: merchant.id,
        type: "deposit",
        amount: creditedAmount.toString(),
        currency: country.currency,
        status: "pending",
        description: `Paiement API — ${operatorName} — ${phone}`,
        paymentMethod: "mobile_money",
        reference: depositRef,
        operatorId: (operatorRecord as any).id,
        feeAmount: ashtechFeeAmount.toFixed(2),
        totalAmount: amountNum.toFixed(2),
        recipientPhone: phone,
        notifyUrl: notify_url || null,
        source: "api",
      });

      // ── Call payment provider ──────────────────────────────────────────────
      const callbackUrl = `${process.env.APP_URL || ""}/api/afribapay/webhook`;
      const pixpayIpnUrl = `${process.env.APP_URL || ""}/api/pixpay/webhook`;

      if (paymentProvider === "afribapay") {
        const afribaOpCode = (operatorRecord as any).afribapayOperatorCode || operatorName.toLowerCase();
        const otpInfo = await getAfribaPayOtpInfo(country.code, afribaOpCode);
        let afribaResponse: any;
        if (otpInfo.required && req.body.otp) {
          const otpInitResult = await initiateAfribaPayOtp(
            amountNum, phone, afribaOpCode, country.code, depositRef, callbackUrl
          );
          if (!otpInitResult.success) {
            await storage.updateTransactionStatus(transaction.id, "failed");
            return res.status(502).json({ error: "gateway_error", message: otpInitResult.message || "Échec de l'initiation OTP." });
          }
          afribaResponse = await confirmAfribaPayOtp(otpInitResult.transactionId!, req.body.otp, country.code);
        } else {
          afribaResponse = await initiateAfribaPayin(
            amountNum, phone, afribaOpCode, country.code, depositRef,
            callbackUrl, `${process.env.APP_URL}/dashboard/deposit?status=success`,
            `${process.env.APP_URL}/dashboard/deposit?status=cancelled`
          );
        }
        if (afribaResponse.success) {
          await storage.updateTransactionExternalReference(transaction.id, afribaResponse.transactionId || depositRef);
          addPendingPayment({
            transactionId: transaction.id,
            reference: depositRef,
            externalReference: afribaResponse.transactionId || depositRef,
            attempts: 0,
            userId: merchant.id,
            type: "deposit",
            amount: creditedAmount.toString(),
            provider: "afribapay",
            countryCode: country.code,
          });
        } else {
          await storage.updateTransactionStatus(transaction.id, "failed");
          return res.status(502).json({ error: "gateway_error", message: afribaResponse.message || "Échec du paiement AfribaPay." });
        }
      } else {
        // PixPay
        const pxFlowType = detectPixPayFlowType(operatorName, country.code);
        const pxServiceId = getPixPayServiceId(operatorName, country.code, "cash_in");
        const pxBaseParams = {
          serviceId: String(pxServiceId ?? 0),
          amount: amountNum,
          phone,
          countryCode: country.code,
          orderId: depositRef,
          ipnUrl: pixpayIpnUrl,
          customData: depositRef,
        };
        let pixpayResponse: any;
        if (pxFlowType === "otp") {
          pixpayResponse = await initiatePixPayOtp({ ...pxBaseParams, omOtp: req.body.otp! });
        } else if (pxFlowType === "wave") {
          const appBase = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
          pixpayResponse = await initiatePixPayWave({
            ...pxBaseParams,
            redirectUrl: `${appBase}/dashboard/deposit?ref=${depositRef}&status=success`,
            redirectErrorUrl: `${appBase}/dashboard/deposit?ref=${depositRef}&status=cancelled`,
          });
        } else {
          pixpayResponse = await initiatePixPayUssd(pxBaseParams);
        }
        if (pixpayResponse.success) {
          const extRef = pixpayResponse.transactionId || depositRef;
          await storage.updateTransactionExternalReference(transaction.id, extRef);
          addPendingPayment({
            transactionId: transaction.id,
            reference: depositRef,
            externalReference: extRef,
            attempts: 0,
            userId: merchant.id,
            type: "deposit",
            amount: creditedAmount.toString(),
            provider: "pixpay",
            countryCode: country.code,
          });
          if (pixpayResponse.waveUrl) {
            (transaction as any)._waveUrl = pixpayResponse.waveUrl;
          }
        } else {
          await storage.updateTransactionStatus(transaction.id, "failed");
          return res.status(502).json({ error: "gateway_error", message: pixpayResponse.message || "Échec du paiement PixPay." });
        }
      }

      // Detect if Wave to include wave_url in response
      const isWave = detectPixPayFlowType(operatorName, country.code) === "wave";

      const responseBody: Record<string, any> = {
        transaction_id: transaction.id,
        reference: depositRef,
        status: "pending",
        amount: amountNum,
        credited_amount: creditedAmount,
        fee_amount: ashtechFeeAmount,
        currency: normalizeApiCurrency(country.currency),
        operator: operatorName,
        phone,
        country_code: country.code,
        created_at: (transaction as any).createdAt,
      };
      if (isWave && (transaction as any)._waveUrl) {
        responseBody.wave_url = (transaction as any)._waveUrl;
        responseBody.flow = "wave";
      }

      res.status(202).json(responseBody);
    } catch (e: any) {
      console.error("[API v1 /collect]", e);
      res.status(500).json({ error: "server_error", message: "Erreur interne." });
    }
  });

  /** GET /v1/transaction/:id — get status of an API transaction */
  app.get("/v1/transaction/:id", requireApiKey, async (req: any, res) => {
    try {
      const merchant = req.apiUser;
      const tx = await storage.getTransactionById(req.params.id);
      if (!tx) return res.status(404).json({ error: "not_found", message: "Transaction introuvable." });
      if (tx.userId !== merchant.id) return res.status(403).json({ error: "forbidden", message: "Accès refusé." });

      // Resolve operator name from operatorId
      let operatorName: string | null = null;
      if ((tx as any).operatorId) {
        try {
          const op = await storage.getOperator((tx as any).operatorId);
          if (op) operatorName = op.name;
        } catch (_) { /* non-blocking */ }
      }

      const isoStatus = tx.status === "completed" ? "success" : tx.status;

      res.json({
        transaction_id: tx.id,
        reference: tx.reference,
        status: isoStatus,
        amount: parseFloat((tx as any).totalAmount || tx.amount),
        credited_amount: parseFloat(tx.amount),
        fee_amount: parseFloat((tx as any).feeAmount || "0"),
        currency: normalizeApiCurrency(tx.currency),
        phone: tx.recipientPhone,
        operator: operatorName,
        created_at: tx.createdAt,
        confirmed_at: (tx as any).confirmedAt || null,
      });
    } catch (e: any) {
      console.error("[API v1 /transaction/:id]", e);
      res.status(500).json({ error: "server_error", message: "Erreur interne." });
    }
  });

  // ── Hosted Page ──────────────────────────────────────────────────────────

  function generateHpKey(prefix: string): string {
    return prefix + crypto.randomBytes(20).toString("hex");
  }

  // GET /api/hosted-page/config — get merchant config
  app.get("/api/hosted-page/config", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const config = await storage.getHostedPageConfig(req.session.userId);
      res.json(config || null);
    } catch (e: any) {
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/hosted-page/config — save URLs + generate keys
  app.post("/api/hosted-page/config", async (req: Request, res: Response) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { successUrl, cancelUrl, regenerate } = req.body;
      const existing = await storage.getHostedPageConfig(req.session.userId);
      const hasKeys = existing?.pkLive && existing?.skLive && existing?.hpLive;
      const data: any = {};
      if (successUrl !== undefined) data.successUrl = successUrl;
      if (cancelUrl !== undefined) data.cancelUrl = cancelUrl;
      if (!hasKeys || regenerate) {
        data.pkLive = generateHpKey("pk_live_");
        data.skLive = generateHpKey("sk_live_");
        data.hpLive = generateHpKey("hp_live_");
      }
      const config = await storage.saveHostedPageConfig(req.session.userId, data);
      res.json(config);
    } catch (e: any) {
      console.error("[hosted-page/config]", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/v1/hosted-payment/create — create a hosted payment link (uses existing /pay/:slug page)
  app.post("/api/v1/hosted-payment/create", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || "";
      const hpKey = authHeader.replace("Bearer ", "").trim();
      if (!hpKey.startsWith("hp_live_")) {
        return res.status(401).json({ error: "unauthorized", message: "Invalid hp_live key." });
      }
      const merchant = await storage.getUserByHpKey(hpKey);
      if (!merchant) return res.status(401).json({ error: "unauthorized", message: "Key not found." });
      if (!merchant.isVerified) {
        return res.status(403).json({ error: "account_not_verified", message: "Votre compte n'est pas vérifié. Complétez la vérification KYC pour accéder à l'API." });
      }
      if (!(merchant as any).apiEnabled) {
        return res.status(403).json({ error: "api_not_enabled", message: "L'accès API n'est pas activé sur votre compte. Contactez l'administrateur pour l'activer." });
      }

      const {
        amount,
        currency,
        description,
        is_fixed_amount,
        allowed_countries,
      } = req.body;

      const isFixedAmount = is_fixed_amount !== false; // default: true (fixed price)

      if (!currency) {
        return res.status(400).json({ error: "missing_fields", message: "currency is required." });
      }
      const validCurrencies = ["XOF", "XAF", "GNF", "CDF"];
      if (!validCurrencies.includes(currency)) {
        return res.status(400).json({ error: "invalid_currency", message: `currency must be one of: ${validCurrencies.join(", ")}` });
      }

      let numAmount = 0;
      if (isFixedAmount) {
        if (!amount) {
          return res.status(400).json({ error: "missing_fields", message: "amount is required when is_fixed_amount is true." });
        }
        numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
          return res.status(400).json({ error: "invalid_amount", message: "amount must be a positive number." });
        }
      }

      // Validate allowed_countries if provided
      const countriesFilter: string[] | null =
        Array.isArray(allowed_countries) && allowed_countries.length > 0
          ? allowed_countries.map((c: string) => c.toUpperCase())
          : null;

      // Generate a unique slug for this payment link
      let slug = "hp-" + generateSlug();
      while (await storage.getPaymentLinkBySlug(slug)) {
        slug = "hp-" + generateSlug();
      }

      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min

      // Create a real payment link in the existing system → uses the existing /pay/:slug page
      const paymentLink = await storage.createPaymentLink({
        userId: merchant.id,
        title: description || "Paiement Ashtech Pay",
        description: description || null,
        amount: String(numAmount),
        currency,
        slug,
        isFixedAmount,
        imagePath: null,
        pdfPath: null,
        hasPdfDelivery: false,
        redirectUrl: null,
        expiresAt,
        allowedCountries: countriesFilter,
      });

      const host = req.headers.host || "pay.ashtechpay.top";
      const protocol = req.headers["x-forwarded-proto"] || "https";
      const payUrl = `${protocol}://${host}/pay/${slug}`;

      res.json({
        status: "success",
        payment_link: payUrl,
        payment_id: paymentLink.id,
        slug,
        is_fixed_amount: isFixedAmount,
        amount: isFixedAmount ? numAmount : null,
        currency,
        allowed_countries: countriesFilter,
        expires_at: expiresAt,
      });
    } catch (e: any) {
      console.error("[v1/hosted-payment/create]", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/v1/hosted-payment/:id — check payment link status
  app.get("/api/v1/hosted-payment/:id", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization || "";
      const hpKey = authHeader.replace("Bearer ", "").trim();
      if (!hpKey.startsWith("hp_live_")) {
        return res.status(401).json({ error: "unauthorized", message: "Invalid hp_live key." });
      }
      const merchant = await storage.getUserByHpKey(hpKey);
      if (!merchant) return res.status(401).json({ error: "unauthorized" });

      const link = await storage.getPaymentLinkById(req.params.id);
      if (!link) return res.status(404).json({ error: "not_found" });
      if (link.userId !== merchant.id) return res.status(403).json({ error: "forbidden" });

      // Determine status from transactions linked to this payment link
      const txns = await storage.getTransactionsByPaymentLinkId(link.id);
      let status = "pending";
      const now = new Date();
      if (txns.some((t: any) => t.status === "completed")) {
        status = "success";
      } else if (txns.some((t: any) => t.status === "processing")) {
        status = "processing";
      } else if (txns.some((t: any) => t.status === "failed")) {
        status = "failed";
      } else if (link.expiresAt && link.expiresAt < now) {
        status = "expired";
      }

      // Find the successful transaction for amount paid (in case of free amount)
      const successTxn = txns.find((t: any) => t.status === "completed");

      res.json({
        payment_id: link.id,
        slug: link.slug,
        is_fixed_amount: link.isFixedAmount,
        amount: link.isFixedAmount ? parseFloat(link.amount) : (successTxn ? parseFloat(successTxn.amount) : null),
        currency: link.currency,
        description: link.description,
        allowed_countries: link.allowedCountries,
        status,
        paid_at: successTxn?.createdAt ?? null,
        created_at: link.createdAt,
        expires_at: link.expiresAt,
      });
    } catch (e: any) {
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/public/countries — list active countries with operators (no auth)
  app.get("/api/public/countries", async (_req: Request, res: Response) => {
    try {
      const countries = await storage.getActiveCountries();
      const result = await Promise.all(
        countries.map(async (c) => {
          const ops = await storage.getOperatorsByCountry(c.id);
          return {
            id: c.id,
            name: c.name,
            code: c.code,
            currency: normalizeApiCurrency(c.currency),
            flag: c.flag,
            operators: ops.map((o) => ({ id: o.id, name: o.name })),
          };
        })
      );
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/public/hosted-session/:id — get session for public checkout
  app.get("/api/public/hosted-session/:id", async (req: Request, res: Response) => {
    try {
      const session = await storage.getHostedPaymentSession(req.params.id);
      if (!session) return res.status(404).json({ error: "not_found", message: "Session introuvable." });
      if (session.expiresAt && new Date() > session.expiresAt) {
        return res.status(410).json({ error: "expired", message: "Ce lien de paiement a expiré." });
      }
      const merchant = await storage.getUser(session.merchantId);
      res.json({
        payment_id: session.id,
        amount: parseFloat(session.amount),
        currency: session.currency,
        description: session.description,
        status: session.status,
        merchant_name: merchant?.fullName || "Marchand",
        expires_at: session.expiresAt,
      });
    } catch (e: any) {
      res.status(500).json({ error: "server_error" });
    }
  });

  // POST /api/public/hosted-session/:id/pay — initiate payment for checkout
  app.post("/api/public/hosted-session/:id/pay", async (req: Request, res: Response) => {
    try {
      const hpSession = await storage.getHostedPaymentSession(req.params.id);
      if (!hpSession) return res.status(404).json({ error: "not_found" });
      if (hpSession.status !== "pending") {
        return res.status(400).json({ error: "already_processed", message: "Ce paiement a déjà été traité." });
      }
      if (hpSession.expiresAt && new Date() > hpSession.expiresAt) {
        return res.status(410).json({ error: "expired", message: "Ce lien de paiement a expiré." });
      }

      const { phone, countryId, operatorId } = req.body;
      if (!phone || !countryId || !operatorId) {
        return res.status(400).json({ error: "missing_fields", message: "phone, countryId et operatorId sont requis." });
      }

      const country = await storage.getCountry(countryId);
      if (!country) return res.status(400).json({ error: "invalid_country" });
      const operator = await storage.getOperator(operatorId);
      if (!operator) return res.status(400).json({ error: "invalid_operator" });

      const merchant = await storage.getUser(hpSession.merchantId);
      if (!merchant) return res.status(500).json({ error: "merchant_not_found" });

      // Resolve fee
      const fee = await storage.resolveFee("deposit", country.id, operator.id);
      const feePercent = fee?.percentage ? parseFloat(fee.percentage) : 0;
      const amount = parseFloat(hpSession.amount);
      const feeAmount = (amount * feePercent) / 100;
      const totalAmount = amount + feeAmount;

      // Create transaction
      const txRef = "HP-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      const tx = await storage.createTransaction({
        userId: merchant.id,
        type: "deposit",
        amount: String(amount),
        currency: country.currency,
        status: "pending",
        reference: txRef,
        recipientPhone: phone,
        recipientName: null,
        description: hpSession.description || `Paiement ${hpSession.id}`,
        countryId: country.id,
        operatorId: operator.id,
        feeAmount: String(feeAmount),
        totalAmount: String(totalAmount),
        notifyUrl: null,
        source: "hosted_page",
        confirmedAt: null,
      } as any);

      // Update hosted session to processing
      await storage.updateHostedPaymentSession(hpSession.id, {
        status: "processing",
        transactionId: tx.id,
      });

      // Initiate payment (AfribaPay or PixPay)
      let payResult: any = null;
      const countryCode = country.code;
      const afribaPayCodes = ["CM", "CI", "SN", "ML", "GN", "CF", "CG", "GA", "GW", "GQ", "CD", "TD", "NE", "BJ", "RW", "BF", "TG", "GQ"];

      try {
        if (PIXPAY_SUPPORTED_COUNTRIES.includes(countryCode)) {
          const pixpayServiceId = getPixPayServiceId(operator.name, countryCode, "cash_in");
          const pixBaseParams = {
            serviceId: String(pixpayServiceId || "1"),
            amount: totalAmount,
            phone,
            countryCode,
            orderId: txRef,
            customData: txRef,
          };
          const flowType = detectPixPayFlowType(operator.name, countryCode);
          if (flowType === "wave") {
            const appBase = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
            const waveRes = await initiatePixPayWave({
              ...pixBaseParams,
              redirectUrl: `${appBase}/hpay/${hpSession.id}?status=success`,
              redirectErrorUrl: `${appBase}/hpay/${hpSession.id}?status=cancelled`,
            });
            if (!waveRes.success) throw new Error(waveRes.message || "Erreur PixPay Wave");
            const extRef = waveRes.transactionId || txRef;
            await storage.updateTransactionExternalReference(tx.id, extRef);
            payResult = { flow: "wave", wave_url: waveRes.waveUrl || null, ussd_code: null, extRef };
          } else if (flowType === "otp") {
            const ussdCode = PIXPAY_OTP_USSD_CODES[countryCode.toUpperCase()] || "*144#";
            payResult = { flow: "otp_ussd", ussd_code: ussdCode, extRef: txRef };
          } else {
            const ussdRes = await initiatePixPayUssd(pixBaseParams);
            if (!ussdRes.success) throw new Error(ussdRes.message || "Erreur PixPay USSD");
            const extRef = ussdRes.transactionId || txRef;
            await storage.updateTransactionExternalReference(tx.id, extRef);
            payResult = { flow: "ussd_push", ussd_code: null, extRef };
          }
        } else if (afribaPayCodes.includes(countryCode)) {
          const afribapayOperatorCode = resolveAfribaPayOperatorCode(operator, operator.name);
          const afribapayCurrency = AFRIBAPAY_ISO_CURRENCY[countryCode.toUpperCase()] || country.currency;
          let localPhone = phone.replace(/\s/g, "");
          if (localPhone.startsWith("+")) localPhone = localPhone.slice(1);
          const afribaResponse = await initiateAfribaPayin({
            operator: afribapayOperatorCode,
            country: countryCode,
            phone_number: localPhone,
            amount: totalAmount,
            currency: afribapayCurrency,
            order_id: txRef,
            reference_id: txRef,
          });
          if (!afribaResponse.success) throw new Error(afribaResponse.message || "Erreur AfribaPay");
          const extRef = afribaResponse.transaction_id || txRef;
          await storage.updateTransactionExternalReference(tx.id, extRef);
          payResult = { flow: "ussd_push", ussd_code: null, extRef };
        } else {
          return res.status(400).json({ error: "unsupported_country", message: "Pays non supporté pour le paiement." });
        }
      } catch (payErr: any) {
        await storage.updateHostedPaymentSession(hpSession.id, { status: "failed" });
        await storage.updateTransactionStatus(tx.id, "failed");
        return res.status(502).json({ error: "payment_initiation_failed", message: payErr?.message || "Échec de l'initiation du paiement." });
      }

      // Register in poller
      const provider = PIXPAY_SUPPORTED_COUNTRIES.includes(countryCode) ? "pixpay" : "afribapay";
      addPendingPayment({
        transactionId: tx.id,
        reference: txRef,
        externalReference: payResult.extRef || txRef,
        userId: merchant.id,
        type: "deposit",
        amount: String(amount),
        provider,
        countryCode,
      });

      res.json({
        status: "initiated",
        transaction_id: tx.id,
        flow: payResult.flow,
        ussd_code: payResult.ussd_code || null,
        wave_url: payResult.wave_url || null,
        otp_info: payResult.otp_info || null,
      });
    } catch (e: any) {
      console.error("[public/hosted-session/:id/pay]", e);
      res.status(500).json({ error: "server_error" });
    }
  });

  // GET /api/public/hosted-session/:id/status — poll transaction status
  app.get("/api/public/hosted-session/:id/status", async (req: Request, res: Response) => {
    try {
      const session = await storage.getHostedPaymentSession(req.params.id);
      if (!session) return res.status(404).json({ error: "not_found" });

      let status = session.status;

      // If processing, check underlying transaction
      if (session.transactionId && session.status === "processing") {
        const tx = await storage.getTransactionById(session.transactionId);
        if (tx?.status === "completed") {
          status = "success";
          await storage.updateHostedPaymentSession(session.id, { status: "success" });
        } else if (tx?.status === "failed") {
          status = "failed";
          await storage.updateHostedPaymentSession(session.id, { status: "failed" });
        }
      }

      const config = await storage.getHostedPageConfig(session.merchantId);
      res.json({
        status,
        success_url: config?.successUrl || null,
        cancel_url: config?.cancelUrl || null,
      });
    } catch (e: any) {
      res.status(500).json({ error: "server_error" });
    }
  });

  // ── Admin API Management ─────────────────────────────────────────────────────

  // GET /api/admin/api-management — list users with API stats
  app.get("/api/admin/api-management", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const allTransactions = await storage.getAllTransactions();

      const apiTxns = allTransactions.filter((t: any) =>
        t.type === "payment_link" || t.type === "deposit"
      );

      const result = allUsers
        .filter((u: any) => u.role !== "admin" && u.role !== "support")
        .map((u: any) => {
          const userTxns = apiTxns.filter((t: any) => t.userId === u.id && t.status === "completed");
          const sdkTxns = userTxns.filter((t: any) => t.source === "sdk" || (t.type === "deposit" && t.reference?.startsWith("sdk-")));
          const hpTxns = userTxns.filter((t: any) => t.type === "payment_link" && t.paymentLinkId);

          const totalSdk = sdkTxns.reduce((s: number, t: any) => s + parseFloat(t.amount || "0"), 0);
          const totalHp = hpTxns.reduce((s: number, t: any) => s + parseFloat(t.amount || "0"), 0);
          const totalAll = userTxns.reduce((s: number, t: any) => s + parseFloat(t.amount || "0"), 0);

          return {
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            username: u.username,
            isVerified: u.isVerified,
            apiEnabled: u.apiEnabled || false,
            hasApiKey: !!u.apiKey,
            createdAt: u.createdAt,
            stats: {
              totalTransactions: userTxns.length,
              sdkTransactions: sdkTxns.length,
              hpTransactions: hpTxns.length,
              totalCollected: totalAll,
              sdkCollected: totalSdk,
              hpCollected: totalHp,
            },
          };
        });

      res.json(result);
    } catch (e: any) {
      console.error("[Admin API Management]", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  // POST /api/admin/api-management/:userId/toggle — enable or disable API access
  app.post("/api/admin/api-management/:userId/toggle", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ message: "'enabled' doit être un booléen" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

      await storage.updateUser(userId, { apiEnabled: enabled } as any);
      res.json({ success: true, userId, apiEnabled: enabled });
    } catch (e: any) {
      console.error("[Admin API Toggle]", e);
      res.status(500).json({ message: "Erreur serveur" });
    }
  });

  return httpServer;
}
