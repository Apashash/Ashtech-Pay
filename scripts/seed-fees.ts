import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
});

// Swychr fee structure per country (from official tariff table)
const SWYCHR_FEES: Record<string, { swychr: number; ashtech: number }> = {
  'CM': { swychr: 2.50, ashtech: 2.00 }, // Cameroun
  'GA': { swychr: 3.00, ashtech: 2.00 }, // Gabon
  'CG': { swychr: 4.50, ashtech: 2.00 }, // Congo Brazzaville
  'CD': { swychr: 3.50, ashtech: 2.00 }, // Congo DRC
  'SN': { swychr: 2.50, ashtech: 2.00 }, // Sénégal
  'CI': { swychr: 3.00, ashtech: 2.00 }, // Côte d'Ivoire
  'BF': { swychr: 3.00, ashtech: 2.00 }, // Burkina Faso
  'ML': { swychr: 3.00, ashtech: 2.00 }, // Mali
  'BJ': { swychr: 3.00, ashtech: 2.00 }, // Bénin
  'TG': { swychr: 3.00, ashtech: 2.00 }, // Togo
  'TZ': { swychr: 3.00, ashtech: 2.00 }, // Tanzanie
  'UG': { swychr: 3.00, ashtech: 2.00 }, // Ouganda
  'NG': { swychr: 2.00, ashtech: 2.00 }, // Nigéria
  'NE': { swychr: 3.50, ashtech: 2.00 }, // Niger
  'RW': { swychr: 3.75, ashtech: 2.00 }, // Rwanda
  'GN': { swychr: 3.75, ashtech: 2.00 }, // Guinée Conakry
  'GH': { swychr: 2.50, ashtech: 2.00 }, // Ghana
  'KE': { swychr: 1.50, ashtech: 2.00 }, // Kenya
};

async function seedFees() {
  const client = await pool.connect();
  
  try {
    const countriesResult = await client.query(`SELECT id, code, name FROM countries`);
    
    const countryIdByCode: Record<string, string> = {};
    const countryNameByCode: Record<string, string> = {};
    for (const row of countriesResult.rows) {
      countryIdByCode[row.code] = row.id;
      countryNameByCode[row.code] = row.name;
    }
    
    console.log('Seeding Swychr-based deposit fees per country...');
    
    for (const [code, tariff] of Object.entries(SWYCHR_FEES)) {
      const countryId = countryIdByCode[code];
      if (!countryId) {
        console.warn(`Country not found for code: ${code}, skipping`);
        continue;
      }
      
      const total = tariff.swychr + tariff.ashtech;
      const countryName = countryNameByCode[code];
      
      // Upsert deposit fee for this country (country-level, applies to all operators)
      await client.query(`
        INSERT INTO fees (id, name, transaction_type, fee_type, fee_value, swychr_fee, ashtech_margin, country_id, operator_id, is_active)
        VALUES (
          gen_random_uuid(),
          $1, 'deposit', 'percentage', $2, $3, $4, $5, NULL, true
        )
        ON CONFLICT DO NOTHING
      `, [
        `Dépôt ${countryName}`,
        total.toFixed(4),
        tariff.swychr.toFixed(4),
        tariff.ashtech.toFixed(4),
        countryId,
      ]);
      
      console.log(`  ${code} (${countryName}): Swychr ${tariff.swychr}% + Ashtech ${tariff.ashtech}% = ${total}%`);
    }
    
    // Add a global withdrawal fee (1% flat, not gateway-specific)
    console.log('Seeding withdrawal fees...');
    const withdrawalExists = await client.query(`SELECT id FROM fees WHERE transaction_type = 'withdrawal' AND country_id IS NULL AND operator_id IS NULL`);
    if (withdrawalExists.rows.length === 0) {
      await client.query(`
        INSERT INTO fees (id, name, transaction_type, fee_type, fee_value, swychr_fee, ashtech_margin, country_id, operator_id, is_active)
        VALUES (gen_random_uuid(), 'Retrait Standard', 'withdrawal', 'percentage', '1.0000', '0', '1.0000', NULL, NULL, true)
      `);
      console.log('  Global withdrawal fee: 1%');
    }
    
    // Transfer fee
    const transferExists = await client.query(`SELECT id FROM fees WHERE transaction_type = 'transfer' AND country_id IS NULL AND operator_id IS NULL`);
    if (transferExists.rows.length === 0) {
      await client.query(`
        INSERT INTO fees (id, name, transaction_type, fee_type, fee_value, swychr_fee, ashtech_margin, country_id, operator_id, is_active)
        VALUES (gen_random_uuid(), 'Transfert Standard', 'transfer', 'percentage', '0.5000', '0', '0.5000', NULL, NULL, true)
      `);
      console.log('  Global transfer fee: 0.5%');
    }
    
    const countResult = await client.query(`SELECT COUNT(*) FROM fees`);
    console.log(`\nTotal fees in DB: ${countResult.rows[0].count}`);
    console.log('Fee seeding completed!');
    
  } finally {
    client.release();
    await pool.end();
  }
}

seedFees().catch(console.error);
