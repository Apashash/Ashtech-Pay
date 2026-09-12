import { pool } from "./db";

const KYC_DOCUMENTS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS kyc_documents (
  id VARCHAR(191) NOT NULL PRIMARY KEY,
  user_id VARCHAR(191) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  content_type VARCHAR(120) NOT NULL,
  original_name TEXT NULL,
  encrypted_data MEDIUMTEXT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY kyc_documents_storage_path_unique (storage_path),
  INDEX kyc_documents_user_id_idx (user_id)
) ENGINE=InnoDB`;

let kycDocumentsSchemaPromise: Promise<void> | null = null;
let kycSubmissionSchemaPromise: Promise<void> | null = null;

/**
 * KYC uploads can arrive before a delayed Passenger migration finishes.
 * Ensure only this small table lazily as well, so the first upload is not
 * dependent on the rest of the boot migration chain.
 */
export function ensureMysqlKycDocumentsSchema(): Promise<void> {
  if (process.env.DB_DIALECT?.toLowerCase() !== "mysql") return Promise.resolve();
  if (!kycDocumentsSchemaPromise) {
    const schemaPromise = pool.query(KYC_DOCUMENTS_TABLE_SQL)
      .then(() => undefined)
      .catch((error: unknown) => {
        kycDocumentsSchemaPromise = null;
        throw error;
      });
    kycDocumentsSchemaPromise = schemaPromise;
  }
  return kycDocumentsSchemaPromise!;
}

/**
 * The imported kyc_submissions table may predate the private database-backed
 * document storage columns. Add them lazily before a submission as well as
 * during startup. Duplicate-column errors are expected on later runs.
 */
export function ensureMysqlKycSubmissionSchema(): Promise<void> {
  if (process.env.DB_DIALECT?.toLowerCase() !== "mysql") return Promise.resolve();
  if (!kycSubmissionSchemaPromise) {
    const schemaPromise = (async () => {
      for (const statement of [
        "ALTER TABLE kyc_submissions ADD COLUMN private_folder_path TEXT NULL",
        "ALTER TABLE kyc_submissions ADD COLUMN summary_pdf_path TEXT NULL",
      ]) {
        try {
          await pool.query(statement);
        } catch (error: any) {
          const code = String(error?.code || "");
          const message = String(error?.message || "");
          if (code !== "ER_DUP_FIELDNAME" && !/duplicate column/i.test(message)) {
            throw error;
          }
        }
      }
    })().catch((error: unknown) => {
      kycSubmissionSchemaPromise = null;
      throw error;
    });
    kycSubmissionSchemaPromise = schemaPromise;
  }
  return kycSubmissionSchemaPromise!;
}

/**
 * Creates only tables that are owned by runtime services rather than by the
 * exported Drizzle application schema. The data tables themselves must come
 * from the verified PostgreSQL export/import.
 */
export async function ensureMysqlAuxiliarySchema(): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS api_otp_sessions (
      reference VARCHAR(191) NOT NULL PRIMARY KEY,
      user_id VARCHAR(191),
      context JSON NOT NULL,
      expires_at DATETIME(3) NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT api_otp_sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS merchant_webhook_deliveries (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      merchant_id VARCHAR(191),
      transaction_id VARCHAR(191) NOT NULL,
      event VARCHAR(191) NOT NULL,
      notify_url TEXT NOT NULL,
      payload JSON NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      next_attempt_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      delivered_at DATETIME(3),
      last_error TEXT,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY merchant_webhook_transaction_event_unique (transaction_id, event),
      INDEX merchant_webhook_status_due_idx (status, next_attempt_at)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS hosted_page_keys (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      user_id VARCHAR(191) NOT NULL,
      name VARCHAR(191) NOT NULL,
      pk_live VARCHAR(191) NOT NULL UNIQUE,
      sk_live VARCHAR(191) NOT NULL UNIQUE,
      hp_live VARCHAR(191) NOT NULL UNIQUE,
      hp_live_hash VARCHAR(191) UNIQUE,
      success_url TEXT NULL,
      cancel_url TEXT NULL,
      notify_url TEXT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      INDEX hosted_page_keys_user_id_idx (user_id)
    ) ENGINE=InnoDB`,
    `ALTER TABLE hosted_page_keys ADD COLUMN IF NOT EXISTS success_url TEXT NULL`,
    `ALTER TABLE hosted_page_keys ADD COLUMN IF NOT EXISTS cancel_url TEXT NULL`,
    `ALTER TABLE hosted_page_keys ADD COLUMN IF NOT EXISTS notify_url TEXT NULL`,
    `ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS hosted_page_key_id VARCHAR(191) NULL`,
    `CREATE TABLE IF NOT EXISTS admin_pending_logins (
      token VARCHAR(191) NOT NULL PRIMARY KEY,
      user_id VARCHAR(191) NOT NULL,
      otp VARCHAR(32) NOT NULL,
      expires_at BIGINT NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      claimed_by TEXT,
      claimed_until BIGINT,
      consumed_at BIGINT
    ) ENGINE=InnoDB`,
    `ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS private_folder_path TEXT NULL`,
    `ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS summary_pdf_path TEXT NULL`,
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }
  try {
    await pool.query("ALTER TABLE users ADD COLUMN profile_image_path TEXT NULL");
  } catch (error: any) {
    const code = String(error?.code || "");
    const message = String(error?.message || "");
    if (code !== "ER_DUP_FIELDNAME" && !/duplicate column/i.test(message)) {
      throw error;
    }
  }
  await ensureMysqlKycDocumentsSchema();
}