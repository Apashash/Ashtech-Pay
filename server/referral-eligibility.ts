import { sql } from "drizzle-orm";
import { isReferralTransaction } from "../shared/referral-policy";

function rows(result: any): any[] {
  if (Array.isArray(result)) return Array.isArray(result[0]) ? result[0] : result;
  return result.rows || [];
}
function eligible(tx: any) {
  return tx.confirmed_at && isReferralTransaction({
    type: tx.type, status: tx.status, paymentMethod: tx.payment_method,
    source: tx.source, paymentLinkId: tx.payment_link_id, paymentIntentId: tx.payment_intent_id,
    metadata: typeof tx.metadata === "string" ? JSON.parse(tx.metadata) : tx.metadata,
  });
}

/** Minimal, idempotent proof of the threshold, independent of history retention. */
export async function qualifyingTransactions(trx: any, userId: string, after: Date) {
  const current = rows(await trx.execute(sql`SELECT id,reference,type,status,payment_method,source,
    payment_link_id,payment_intent_id,metadata,confirmed_at
    FROM transactions WHERE user_id=${userId} AND status='completed'
    AND type IN ('deposit','withdrawal') AND payment_method='mobile_money'
    AND payment_link_id IS NULL AND payment_intent_id IS NULL
    AND (source IS NULL OR source='' OR source='dashboard')
    AND created_at>=${new Date(Math.floor(new Date(after).getTime() / 1000) * 1000)}
    ORDER BY confirmed_at,created_at,id LIMIT 10000`))
    .filter(eligible);
  const currentIds = new Set(current.map(tx => tx.id));
  const stored = rows(await trx.execute(sql`SELECT transaction_id FROM referral_qualifying_transactions
    WHERE invitee_id=${userId}`));
  const known = new Set<string>();
  for (const proof of stored) {
    if (!currentIds.has(proof.transaction_id)) {
      // Known refunds/failures invalidate proof. A purged history row does not.
      const latest = rows(await trx.execute(sql`SELECT * FROM transactions WHERE id=${proof.transaction_id}`))[0];
      if (latest && (latest.user_id !== userId || !eligible(latest))) {
        await trx.execute(sql`DELETE FROM referral_qualifying_transactions
          WHERE transaction_id=${proof.transaction_id} AND invitee_id=${userId}`);
        continue;
      }
    }
    known.add(proof.transaction_id);
  }
  for (const tx of current) {
    if (known.size >= 3) break;
    if (known.has(tx.id)) continue;
    if (process.env.DB_DIALECT?.toLowerCase() === "mysql") {
      await trx.execute(sql`INSERT IGNORE INTO referral_qualifying_transactions
        (transaction_id,invitee_id,reference,type,confirmed_at)
        VALUES (${tx.id},${userId},${tx.reference},${tx.type},${tx.confirmed_at})`);
    } else {
      await trx.execute(sql`INSERT INTO referral_qualifying_transactions
        (transaction_id,invitee_id,reference,type,confirmed_at)
        VALUES (${tx.id},${userId},${tx.reference},${tx.type},${tx.confirmed_at})
        ON CONFLICT (transaction_id) DO NOTHING`);
    }
    known.add(tx.id);
  }
  return rows(await trx.execute(sql`SELECT q.transaction_id AS id,q.reference,q.type,q.confirmed_at,
    t.id AS current_id FROM referral_qualifying_transactions q
    LEFT JOIN transactions t ON t.id=q.transaction_id WHERE q.invitee_id=${userId}
    ORDER BY q.confirmed_at,q.transaction_id LIMIT 3`));
}
