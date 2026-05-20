import { storage } from "./storage";
import { sendMessage } from "./telegram";

const REPORT_HOUR = 8;
const TIMEZONE = "Africa/Douala";

function fmtNum(n: number | string): string {
  return Number(n).toLocaleString("fr-FR");
}

function fmtXAF(n: number | string): string {
  const v = parseFloat(String(n));
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)} M XAF`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)} k XAF`;
  return `${fmtNum(v)} XAF`;
}

function nowDouala(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
}

function yesterdayLabel(): string {
  const d = nowDouala();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

async function sendDailyReport(): Promise<void> {
  try {
    console.log("[DailyReport] Generating daily report for yesterday...");

    const [stats, kycPending, kycApproved, kycRejected, allUsers] = await Promise.all([
      storage.getAdminStats("yesterday"),
      storage.countKycByStatus("pending"),
      storage.countKycByStatus("approved"),
      storage.countKycByStatus("rejected"),
      storage.getAllUsers(),
    ]);

    const totalTx = (stats.depositCount || 0) + (stats.withdrawalCount || 0) +
                    (stats.transferCount || 0) + (stats.paymentLinkCount || 0);
    const totalVol = parseFloat(stats.totalDeposits || "0") + parseFloat(stats.totalWithdrawals || "0");

    const newUsersYesterday = allUsers.filter(u => {
      if (!u.createdAt) return false;
      const d = nowDouala();
      d.setDate(d.getDate() - 1);
      const yStart = new Date(d); yStart.setHours(0, 0, 0, 0);
      const yEnd   = new Date(d); yEnd.setHours(23, 59, 59, 999);
      const created = new Date(u.createdAt);
      return created >= yStart && created <= yEnd;
    });

    const msg =
      `☀️ <b>RAPPORT QUOTIDIEN — ${yesterdayLabel().toUpperCase()}</b>\n` +
      `──────────────────\n` +
      `👥 <b>Utilisateurs</b>\n` +
      `  Total plateforme : <b>${fmtNum(stats.totalUsers)}</b>\n` +
      `  Nouveaux hier : <b>${fmtNum(newUsersYesterday.length)}</b>\n` +
      `  KYC en attente : ${kycPending} | Approuvés : ${kycApproved} | Rejetés : ${kycRejected}\n` +
      `──────────────────\n` +
      `💸 <b>Transactions hier</b>\n` +
      `  Total opérations : <b>${fmtNum(totalTx)}</b>\n` +
      `  💰 Dépôts : ${fmtNum(stats.depositCount)} — <b>${fmtXAF(stats.totalDeposits || 0)}</b>\n` +
      `  🏧 Retraits : ${fmtNum(stats.withdrawalCount)} — <b>${fmtXAF(stats.totalWithdrawals || 0)}</b>\n` +
      `  🔄 Transferts : ${fmtNum(stats.transferCount)}\n` +
      `  🔗 Liens paiement : ${fmtNum(stats.paymentLinkCount)}\n` +
      `  📦 Volume total : <b>${fmtXAF(totalVol)}</b>\n` +
      `──────────────────\n` +
      `💵 <b>Revenus Ashtech hier</b>\n` +
      `  Total commissions : <b>${fmtXAF(stats.totalRevenue || 0)}</b>\n` +
      `  • Dépôts : ${fmtXAF(stats.depositFees || 0)}\n` +
      `  • Retraits : ${fmtXAF(stats.withdrawalFees || 0)}\n` +
      `  • Transferts : ${fmtXAF(stats.transferFees || 0)}\n` +
      `  • Liens : ${fmtXAF(stats.paymentLinkFees || 0)}\n` +
      `──────────────────\n` +
      `⏳ <b>En attente en ce moment</b>\n` +
      `  Dépôts : ${stats.pendingDeposits} | Retraits : ${stats.pendingWithdrawals} | KYC : ${kycPending}\n` +
      `──────────────────\n` +
      `🕐 Envoyé à ${nowDouala().toLocaleTimeString("fr-FR")} (Douala)`;

    await sendMessage(msg);
    console.log("[DailyReport] Report sent successfully.");
  } catch (err: any) {
    console.error("[DailyReport] Failed to send daily report:", err.message);
  }
}

let reportInterval: NodeJS.Timeout | null = null;
let lastReportDay = -1;

export function startDailyReportScheduler(): void {
  if (reportInterval) return;

  console.log(`[DailyReport] Scheduler started — will send report every day at ${REPORT_HOUR}:00 (${TIMEZONE})`);

  reportInterval = setInterval(() => {
    const now = nowDouala();
    const hour = now.getHours();
    const day  = now.getDate();

    if (hour === REPORT_HOUR && day !== lastReportDay) {
      lastReportDay = day;
      sendDailyReport().catch(err =>
        console.error("[DailyReport] Scheduled report error:", err.message)
      );
    }
  }, 60 * 1000);
}

export function stopDailyReportScheduler(): void {
  if (reportInterval) {
    clearInterval(reportInterval);
    reportInterval = null;
  }
}
