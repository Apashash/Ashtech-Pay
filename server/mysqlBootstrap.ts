import { pool } from "./db";

const MYSQL_AUXILIARY_SCHEMA_NAME = "mysql-runtime-auxiliary";
const MYSQL_AUXILIARY_SCHEMA_VERSION = "2026-09-28-api-idempotency-otp-v1";

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
let auxiliarySchemaPromise: Promise<void> | null = null;

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
      claimed_by VARCHAR(191),
      claimed_until DATETIME(3),
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      CONSTRAINT api_otp_sessions_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    `ALTER TABLE api_otp_sessions ADD COLUMN IF NOT EXISTS claimed_by VARCHAR(191) NULL`,
    `ALTER TABLE api_otp_sessions ADD COLUMN IF NOT EXISTS claimed_until DATETIME(3) NULL`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_reference VARCHAR(191) NULL`,
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
      pk_live VARCHAR(191) NULL UNIQUE,
      sk_live VARCHAR(191) NULL UNIQUE,
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
    `ALTER TABLE hosted_page_keys MODIFY COLUMN pk_live VARCHAR(191) NULL`,
    `ALTER TABLE hosted_page_keys MODIFY COLUMN sk_live VARCHAR(191) NULL`,
    `ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS hosted_page_key_id VARCHAR(191) NULL`,
    `ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(191) NULL`,
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
    `CREATE TABLE IF NOT EXISTS revoked_device_tokens (
      user_id VARCHAR(191) NOT NULL,
      token_issued_at BIGINT NOT NULL,
      revoked_at BIGINT NOT NULL,
      PRIMARY KEY (user_id, token_issued_at),
      INDEX revoked_device_tokens_token_issued_at_idx (token_issued_at)
    ) ENGINE=InnoDB`,
    `ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS private_folder_path TEXT NULL`,
    `ALTER TABLE kyc_submissions ADD COLUMN IF NOT EXISTS summary_pdf_path TEXT NULL`,
  ];

  if (!auxiliarySchemaPromise) {
    auxiliarySchemaPromise = (async () => {
      // Avoid rerunning every ALTER TABLE on every Passenger restart. The
      // marker is written only after the complete idempotent block succeeds.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS runtime_schema_migrations (
          name VARCHAR(191) NOT NULL PRIMARY KEY,
          version VARCHAR(191) NOT NULL,
          applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ) ENGINE=InnoDB
      `);
      const marker = await pool.query(
        "SELECT version FROM runtime_schema_migrations WHERE name = ? LIMIT 1",
        [MYSQL_AUXILIARY_SCHEMA_NAME],
      );
      if (marker.rows?.[0]?.version === MYSQL_AUXILIARY_SCHEMA_VERSION) {
        return;
      }

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

      // Keep repeated hosted-payment creation requests idempotent per merchant.
      // Existing links have a NULL key and remain unaffected.
      try {
        await pool.query(
          "ALTER TABLE payment_links ADD UNIQUE KEY payment_links_user_idempotency_unique (user_id, idempotency_key)",
        );
      } catch (error: any) {
        const code = String(error?.code || "");
        const message = String(error?.message || "");
        if (code !== "ER_DUP_KEYNAME" && !/duplicate key name|already exists/i.test(message)) {
          throw error;
        }
      }

      // Merchant-supplied Direct API references must be unique per merchant.
      // Existing rows keep NULL and therefore do not conflict with this index.
      try {
        await pool.query(
          "ALTER TABLE transactions ADD UNIQUE KEY transactions_api_user_merchant_reference_unique (user_id, merchant_reference)",
        );
      } catch (error: any) {
        const code = String(error?.code || "");
        const message = String(error?.message || "");
        if (code !== "ER_DUP_KEYNAME" && !/duplicate key name|already exists/i.test(message)) {
          throw error;
        }
      }
      await ensureMysqlKycDocumentsSchema();
      await pool.query(
        `INSERT INTO runtime_schema_migrations (name, version)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE version = VALUES(version), applied_at = CURRENT_TIMESTAMP(3)`,
        [MYSQL_AUXILIARY_SCHEMA_NAME, MYSQL_AUXILIARY_SCHEMA_VERSION],
      );
    })().catch(error => {
      auxiliarySchemaPromise = null;
      throw error;
    });
  }
  return auxiliarySchemaPromise;
}