import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
});

async function seedCountriesAndOperators() {
  const client = await pool.connect();
  
  try {
    console.log('Inserting countries...');
    
    const countriesResult = await client.query(`
      INSERT INTO countries (id, name, code, flag, dial_code, currency, exchange_rate, is_active, min_deposit, max_deposit, min_withdrawal, max_withdrawal) VALUES
      (gen_random_uuid(), 'Cameroun', 'CM', '🇨🇲', '+237', 'XAF', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Tchad', 'TD', '🇹🇩', '+235', 'XAF', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Centrafrique', 'CF', '🇨🇫', '+236', 'XAF', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Congo', 'CG', '🇨🇬', '+242', 'XAF', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Gabon', 'GA', '🇬🇦', '+241', 'XAF', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Guinée équatoriale', 'GQ', '🇬🇶', '+240', 'XAF', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Sénégal', 'SN', '🇸🇳', '+221', 'XOFS', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Côte d''Ivoire', 'CI', '🇨🇮', '+225', 'XOFC', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Mali', 'ML', '🇲🇱', '+223', 'XOFM', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Burkina Faso', 'BF', '🇧🇫', '+226', 'XOFF', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Niger', 'NE', '🇳🇪', '+227', 'XOFN', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Togo', 'TG', '🇹🇬', '+228', 'XOFT', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Bénin', 'BJ', '🇧🇯', '+229', 'XOFB', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Guinée-Bissau', 'GW', '🇬🇼', '+245', 'XOF', 1, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'RD Congo', 'CD', '🇨🇩', '+243', 'CDF', 0.27, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Nigeria', 'NG', '🇳🇬', '+234', 'NGN', 0.0016, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Ghana', 'GH', '🇬🇭', '+233', 'GHS', 0.0016, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Kenya', 'KE', '🇰🇪', '+254', 'KES', 0.0016, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Gambie', 'GM', '🇬🇲', '+220', 'GMD', 0.0016, true, 100, 5000000, 300, 500000),
      (gen_random_uuid(), 'Guinée Conakry', 'GN', '🇬🇳', '+224', 'GNF', 0.0076, true, 100, 5000000, 300, 500000)
      ON CONFLICT (code) DO UPDATE SET currency = EXCLUDED.currency
      RETURNING id, code;
    `);
    
    console.log(`${countriesResult.rowCount} countries inserted.`);
    
    const countriesMap = await client.query(`SELECT id, code FROM countries`);
    const countryIdByCode: Record<string, string> = {};
    for (const row of countriesMap.rows) {
      countryIdByCode[row.code] = row.id;
    }
    
    console.log('Inserting operators...');
    
    const operators = [
      { name: 'MTN Mobile Money', code: 'CM' },
      { name: 'Orange Money', code: 'CM' },
      { name: 'Airtel Money', code: 'TD' },
      { name: 'Moov Money', code: 'TD' },
      { name: 'Orange Money', code: 'CF' },
      { name: 'MTN Mobile Money', code: 'CG' },
      { name: 'Airtel Money', code: 'CG' },
      { name: 'Airtel Money', code: 'GA' },
      { name: 'Moov Money', code: 'GA' },
      { name: 'Orange Money', code: 'GQ' },
      { name: 'Orange Money', code: 'SN' },
      { name: 'Wave', code: 'SN' },
      { name: 'Free Money', code: 'SN' },
      { name: 'Orange Money', code: 'CI' },
      { name: 'MTN Mobile Money', code: 'CI' },
      { name: 'Moov Money', code: 'CI' },
      { name: 'Wave', code: 'CI' },
      { name: 'Orange Money', code: 'ML' },
      { name: 'Moov Money', code: 'ML' },
      { name: 'Orange Money', code: 'BF' },
      { name: 'Moov Money', code: 'BF' },
      { name: 'Airtel Money', code: 'NE' },
      { name: 'Orange Money', code: 'NE' },
      { name: 'Flooz (Moov)', code: 'TG' },
      { name: 'Mixx By Yas', code: 'TG' },
      { name: 'MTN Mobile Money', code: 'BJ' },
      { name: 'Moov Money', code: 'BJ' },
      { name: 'Orange Money', code: 'GW' },
      { name: 'Vodacom M-Pesa', code: 'CD' },
      { name: 'Airtel Money', code: 'CD' },
      { name: 'Orange Money', code: 'CD' },
      { name: 'OPay', code: 'NG' },
      { name: 'PalmPay', code: 'NG' },
      { name: 'Paga', code: 'NG' },
      { name: 'MTN Mobile Money', code: 'GH' },
      { name: 'Vodafone Cash', code: 'GH' },
      { name: 'AirtelTigo Money', code: 'GH' },
      { name: 'M-Pesa', code: 'KE' },
      { name: 'Airtel Money', code: 'KE' },
    ];
    
    let operatorsInserted = 0;
    for (const op of operators) {
      const countryId = countryIdByCode[op.code];
      if (countryId) {
        await client.query(`
          INSERT INTO operators (id, name, type, country_id, is_active, is_in_maintenance, daily_limit)
          VALUES (gen_random_uuid(), $1, 'mobile_money', $2, true, false, 1000000)
          ON CONFLICT DO NOTHING
        `, [op.name, countryId]);
        await client.query(`
          UPDATE operators SET is_active = true WHERE name = $1 AND country_id = $2
        `, [op.name, countryId]);
        operatorsInserted++;
      }
    }
    
    console.log(`${operatorsInserted} operators inserted.`);
    console.log('Done!');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedCountriesAndOperators();
