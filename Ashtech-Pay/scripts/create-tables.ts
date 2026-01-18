import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error("SUPABASE_DATABASE_URL must be set.");
}

const pool = new Pool({ connectionString: databaseUrl });

async function createTables() {
  const client = await pool.connect();
  
  try {
    console.log("Creating tables in Supabase...");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        transaction_id VARCHAR,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✓ user_notifications table created");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS global_messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        admin_id VARCHAR NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✓ global_messages table created");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS dismissed_global_messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR NOT NULL,
        global_message_id VARCHAR NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, global_message_id)
      );
    `);
    console.log("✓ dismissed_global_messages table created");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS kyc_submissions (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR NOT NULL,
        document_type TEXT NOT NULL,
        document_number TEXT NOT NULL,
        document_front_path TEXT NOT NULL,
        document_back_path TEXT NOT NULL,
        selfie_path TEXT NOT NULL,
        business_type TEXT NOT NULL,
        business_category TEXT NOT NULL,
        business_description TEXT NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        reviewer_id VARCHAR,
        review_note TEXT,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✓ kyc_submissions table created");
    
    console.log("Done!");
  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

createTables();
