import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

async function seedFees() {
  const client = await pool.connect();
  
  try {
    // Get countries and operators
    const countriesResult = await client.query(`SELECT id, code, name FROM countries`);
    const operatorsResult = await client.query(`SELECT id, name, country_id FROM operators`);
    
    const countryIdByCode: Record<string, string> = {};
    const countryCodeById: Record<string, string> = {};
    for (const row of countriesResult.rows) {
      countryIdByCode[row.code] = row.id;
      countryCodeById[row.id] = row.code;
    }
    
    // Define fees per country/operator
    const feesByCountryOperator: Record<string, Record<string, { deposit: number; withdrawal: number }>> = {
      'CI': {
        'Wave': { deposit: 2.5, withdrawal: 2.0 },
        'MTN Mobile Money': { deposit: 2.9, withdrawal: 2.5 },
        'Orange Money': { deposit: 3.5, withdrawal: 3.0 },
        'Moov Money': { deposit: 3.0, withdrawal: 2.5 },
      },
      'SN': {
        'Orange Money': { deposit: 2.5, withdrawal: 2.0 },
        'Wave': { deposit: 2.5, withdrawal: 2.0 },
        'Free Money': { deposit: 2.5, withdrawal: 2.0 },
      },
      'BJ': {
        'MTN Mobile Money': { deposit: 2.7, withdrawal: 2.2 },
        'Moov Money': { deposit: 2.7, withdrawal: 2.2 },
      },
      'TG': {
        'Flooz (Moov)': { deposit: 3.5, withdrawal: 3.0 },
        'T-Money': { deposit: 3.5, withdrawal: 3.0 },
      },
      'ML': {
        'Orange Money': { deposit: 4.0, withdrawal: 3.5 },
        'Moov Money': { deposit: 4.0, withdrawal: 3.5 },
      },
      'BF': {
        'Orange Money': { deposit: 4.5, withdrawal: 4.0 },
        'Moov Money': { deposit: 4.5, withdrawal: 4.0 },
      },
      'NE': {
        'Airtel Money': { deposit: 5.0, withdrawal: 4.5 },
        'Orange Money': { deposit: 5.0, withdrawal: 4.5 },
      },
      // CEMAC countries
      'CM': {
        'MTN Mobile Money': { deposit: 2.5, withdrawal: 2.0 },
        'Orange Money': { deposit: 2.5, withdrawal: 2.0 },
      },
      'TD': {
        'Airtel Money': { deposit: 3.5, withdrawal: 3.0 },
        'Moov Money': { deposit: 3.5, withdrawal: 3.0 },
      },
      'CF': {
        'Orange Money': { deposit: 4.0, withdrawal: 3.5 },
      },
      'CG': {
        'MTN Mobile Money': { deposit: 3.0, withdrawal: 2.5 },
        'Airtel Money': { deposit: 3.0, withdrawal: 2.5 },
      },
      'GA': {
        'Airtel Money': { deposit: 3.5, withdrawal: 3.0 },
        'Moov Money': { deposit: 3.5, withdrawal: 3.0 },
      },
      'GQ': {
        'Orange Money': { deposit: 4.0, withdrawal: 3.5 },
      },
      'GW': {
        'Orange Money': { deposit: 3.5, withdrawal: 3.0 },
      },
      'CD': {
        'Vodacom M-Pesa': { deposit: 3.0, withdrawal: 2.5 },
        'Airtel Money': { deposit: 3.0, withdrawal: 2.5 },
        'Orange Money': { deposit: 3.0, withdrawal: 2.5 },
      },
      'NG': {
        'OPay': { deposit: 2.5, withdrawal: 2.0 },
        'PalmPay': { deposit: 2.5, withdrawal: 2.0 },
        'Paga': { deposit: 2.5, withdrawal: 2.0 },
      },
      'GH': {
        'MTN Mobile Money': { deposit: 2.5, withdrawal: 2.0 },
        'Vodafone Cash': { deposit: 2.5, withdrawal: 2.0 },
        'AirtelTigo Money': { deposit: 2.5, withdrawal: 2.0 },
      },
      'KE': {
        'M-Pesa': { deposit: 2.0, withdrawal: 1.5 },
        'Airtel Money': { deposit: 2.0, withdrawal: 1.5 },
      },
    };
    
    console.log('Inserting fees...');
    let feesInserted = 0;
    
    for (const operator of operatorsResult.rows) {
      const countryCode = countryCodeById[operator.country_id];
      const countryFees = feesByCountryOperator[countryCode];
      const operatorFees = countryFees?.[operator.name] || { deposit: 3.0, withdrawal: 2.5 }; // Default fees
      
      // Insert deposit fee
      await client.query(`
        INSERT INTO fees (id, name, transaction_type, fee_type, fee_value, min_fee, max_fee, country_id, operator_id, is_active)
        VALUES (gen_random_uuid(), $1, 'deposit', 'percentage', $2, 100, 50000, $3, $4, true)
        ON CONFLICT DO NOTHING
      `, [`Frais dépôt ${operator.name}`, operatorFees.deposit, operator.country_id, operator.id]);
      
      // Insert withdrawal fee
      await client.query(`
        INSERT INTO fees (id, name, transaction_type, fee_type, fee_value, min_fee, max_fee, country_id, operator_id, is_active)
        VALUES (gen_random_uuid(), $1, 'withdrawal', 'percentage', $2, 100, 50000, $3, $4, true)
        ON CONFLICT DO NOTHING
      `, [`Frais retrait ${operator.name}`, operatorFees.withdrawal, operator.country_id, operator.id]);
      
      feesInserted += 2;
      console.log(`Added fees for ${operator.name} (${countryCode}): deposit ${operatorFees.deposit}%, withdrawal ${operatorFees.withdrawal}%`);
    }
    
    // Add transfer fees (global)
    await client.query(`
      INSERT INTO fees (id, name, transaction_type, fee_type, fee_value, min_fee, max_fee, is_active)
      VALUES (gen_random_uuid(), 'Frais de transfert', 'transfer', 'percentage', 1.5, 50, 25000, true)
      ON CONFLICT DO NOTHING
    `);
    
    console.log(`\n${feesInserted} fees inserted for operators.`);
    console.log('Done!');
    
  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedFees();
