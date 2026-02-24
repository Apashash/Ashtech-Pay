// Seed/update withdrawal and transfer fees per country
// Swychr base fee (fixed) + Ashtech margin 2.00% = total client fee
// Run once on startup — fully idempotent (upsert by country + transactionType)

import { db } from "./db";
import { fees, countries } from "../shared/schema";
import { eq, and, isNull } from "drizzle-orm";

interface CountryFeeSpec {
  code:         string;
  countryName:  string;
  swychrFee:    number; // %
  ashtechMargin: number; // %
}

const FEE_SPECS: CountryFeeSpec[] = [
  { code: "CM", countryName: "Cameroun",             swychrFee: 1.50, ashtechMargin: 2.00, minFee: 550 },
  { code: "BF", countryName: "Burkina Faso",          swychrFee: 1.80, ashtechMargin: 2.00, minFee: 550 },
  { code: "BJ", countryName: "Bénin",                 swychrFee: 1.80, ashtechMargin: 2.00, minFee: 100 },
  { code: "CG", countryName: "Congo Brazzaville",     swychrFee: 2.00, ashtechMargin: 2.00, minFee: 800 },
  { code: "CD", countryName: "Congo RDC",             swychrFee: 1.80, ashtechMargin: 2.00, minFee: 27 },
  { code: "CI", countryName: "Côte d'Ivoire",         swychrFee: 1.80, ashtechMargin: 2.00, minFee: 550 },
  { code: "GA", countryName: "Gabon",                 swychrFee: 1.80, ashtechMargin: 2.00, minFee: 550 },
  { code: "GH", countryName: "Ghana",                 swychrFee: 2.00, ashtechMargin: 2.00, minFee: 20.7 },
  { code: "GN", countryName: "Guinée Conakry",        swychrFee: 2.00, ashtechMargin: 2.00, minFee: 6500.76 },
  { code: "IN", countryName: "Inde",                  swychrFee: 1.50, ashtechMargin: 2.00, minFee: 10.83 },
  { code: "KE", countryName: "Kenya",                 swychrFee: 1.50, ashtechMargin: 2.00, minFee: 105.2 },
  { code: "ML", countryName: "Mali",                  swychrFee: 1.80, ashtechMargin: 2.00, minFee: 550 },
  { code: "NE", countryName: "Niger",                 swychrFee: 2.50, ashtechMargin: 2.00, minFee: 790 },
  { code: "NG", countryName: "Nigeria",               swychrFee: 2.00, ashtechMargin: 2.00, minFee: 144 },
  { code: "RW", countryName: "Rwanda",                swychrFee: 1.80, ashtechMargin: 2.00, minFee: 2300.07 },
  { code: "SN", countryName: "Sénégal",               swychrFee: 1.80, ashtechMargin: 2.00, minFee: 550 },
  { code: "TG", countryName: "Togo",                  swychrFee: 1.80, ashtechMargin: 2.00, minFee: 100 },
  { code: "TZ", countryName: "Tanzanie",              swychrFee: 4.00, ashtechMargin: 2.00, minFee: 2.6 },
  { code: "UG", countryName: "Ouganda",               swychrFee: 4.00, ashtechMargin: 2.00, minFee: 0.19 },
  { code: "US", countryName: "États-Unis",            swychrFee: 3.00, ashtechMargin: 2.00, minFee: 50.17 },
];

interface CountryFeeSpec {
  code:         string;
  countryName:  string;
  swychrFee:    number; // %
  ashtechMargin: number; // %
  minFee:       number; // Fixed min
}

const TRANSACTION_TYPES = ["withdrawal", "transfer"] as const;

export async function seedWithdrawalTransferFees() {
  console.log("[FeesSeed] Starting withdrawal/transfer fee seeding...");
  let created = 0;
  let updated = 0;

  for (const spec of FEE_SPECS) {
    // Lookup country by ISO code
    const [country] = await db
      .select()
      .from(countries)
      .where(eq(countries.code, spec.code))
      .limit(1);

    if (!country) {
      console.warn(`[FeesSeed] Country not found for code=${spec.code} (${spec.countryName}) — skipping`);
      continue;
    }

    const totalPercentage = spec.swychrFee + spec.ashtechMargin;

    for (const txType of TRANSACTION_TYPES) {
      // Check if a country-level fee (no operator) already exists
      const existing = await db
        .select()
        .from(fees)
        .where(
          and(
            eq(fees.countryId, country.id),
            eq(fees.transactionType, txType),
            isNull(fees.operatorId),
          )
        )
        .limit(1);

      const feeData = {
        feeValue:      totalPercentage.toFixed(4),
        swychrFee:     spec.swychrFee.toFixed(4),
        ashtechMargin: spec.ashtechMargin.toFixed(4),
        minFee:        spec.minFee.toString(),
        feeType:       "percentage",
        isActive:      true,
        name:          `${spec.countryName} - ${txType === "withdrawal" ? "Retrait" : "Transfert"} (${totalPercentage}% / Min ${spec.minFee})`,
      };

      if (existing.length > 0) {
        // Update existing fee
        await db
          .update(fees)
          .set(feeData)
          .where(eq(fees.id, existing[0].id));
        updated++;
      } else {
        // Create new fee
        await db.insert(fees).values({
          ...feeData,
          transactionType: txType,
          countryId:     country.id,
          operatorId:    null,
        });
        created++;
      }
    }
  }

  console.log(`[FeesSeed] Done — created=${created}, updated=${updated} (${TRANSACTION_TYPES.join("+")} fees)`);
}
