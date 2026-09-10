import { pool } from "./db";

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
    `CREATE TABLE IF NOT EXISTS kyc_documents (
      id VARCHAR(191) NOT NULL PRIMARY KEY,
      user_id VARCHAR(191) NOT NULL,
      storage_path VARCHAR(500) NOT NULL,
      content_type VARCHAR(120) NOT NULL,
      original_name TEXT NULL,
      encrypted_data MEDIUMTEXT NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY kyc_documents_storage_path_unique (storage_path),
      INDEX kyc_documents_user_id_idx (user_id),
      CONSTRAINT kyc_documents_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
  ];

  for (const statement of statements) {
    await pool.query(statement);
  }
}