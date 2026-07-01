import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL });
const client = await pool.connect();

const { rows } = await client.query('SELECT id FROM users WHERE account_id IS NULL');
console.log('Users without accountId:', rows.length);

for (const row of rows) {
  const accountId = 'ASHTECH' + Math.floor(10000000 + Math.random() * 90000000).toString();
  await client.query('UPDATE users SET account_id = $1 WHERE id = $2', [accountId, row.id]);
  console.log('Updated user', row.id, '->', accountId);
}

client.release();
await pool.end();
console.log('Done');
