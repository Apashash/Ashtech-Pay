// Seed/update withdrawal and transfer fees per country
// Swychr base fee (fixed) + Ashtech margin 2.00% = total client fee
// Run once on startup — fully idempotent (upsert by country + transactionType)

import { db } from "./db";
import { fees, countries } from "../shared/schema";
import { eq, and, isNull } from "drizzle-orm";

interface CountryFeeSpec {
  code:          string;
  countryName:   string;
  swychrFee:     number;
  afribapayFee:  number;
  ashtechMargin: number;
  minFee:        number;
}

const FEE_SPECS: CountryFeeSpec[] = [
  { code: "CM", countryName: "Cameroun",           swychrFee: 1.50, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 550 },
  { code: "BF", countryName: "Burkina Faso",        swychrFee: 1.80, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 550 },
  { code: "BJ", countryName: "Bénin",               swychrFee: 1.80, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 100 },
  { code: "CG", countryName: "Congo Brazzaville",   swychrFee: 2.00, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 800 },
  { code: "CD", countryName: "Congo RDC",           swychrFee: 1.80, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 27 },
  { code: "CI", countryName: "Côte d'Ivoire",       swychrFee: 1.80, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 550 },
  { code: "GA", countryName: "Gabon",               swychrFee: 1.80, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 550 },
  { code: "GH", countryName: "Ghana",               swychrFee: 2.00, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 20.7 },
  { code: "GN", countryName: "Guinée Conakry",      swychrFee: 2.00, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 6500.76 },
  { code: "IN", countryName: "Inde",                swychrFee: 1.50, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 10.83 },
  { code: "KE", countryName: "Kenya",               swychrFee: 1.50, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 105.2 },
  { code: "ML", countryName: "Mali",                swychrFee: 1.80, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 550 },
  { code: "NE", countryName: "Niger",               swychrFee: 2.50, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 790 },
  { code: "NG", countryName: "Nigeria",             swychrFee: 2.00, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 144 },
  { code: "RW", countryName: "Rwanda",              swychrFee: 1.80, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 2300.07 },
  { code: "SN", countryName: "Sénégal",             swychrFee: 1.80, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 550 },
  { code: "TG", countryName: "Togo",                swychrFee: 1.80, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 100 },
  { code: "TZ", countryName: "Tanzanie",            swychrFee: 4.00, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 2.6 },
  { code: "UG", countryName: "Ouganda",             swychrFee: 4.00, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 0.19 },
  { code: "US", countryName: "États-Unis",          swychrFee: 3.00, afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 50.17 },
];

const TRANSACTION_TYPES = ["withdrawal", "transfer", "deposit"] as const;

const TX_TYPE_LABEL: Record<string, string> = {
  withdrawal: "Retrait",
  transfer:   "Transfert",
  deposit:    "Dépôt",
};

export async function seedWithdrawalTransferFees() {
  console.log("[FeesSeed] Starting fee seeding (withdrawal + transfer + deposit)...");
  let created = 0;
  let updated = 0;

  for (const spec of FEE_SPECS) {
    const [country] = await db
      .select()
      .from(countries)
      .where(eq(countries.code, spec.code))
      .limit(1);

    if (!country) {
      console.warn(`[FeesSeed] Country not found for code=${spec.code} (${spec.countryName}) — skipping`);
      continue;
    }

    for (const txType of TRANSACTION_TYPES) {
      const isDeposit = txType === "deposit";
      // For deposit: feeValue is based on AfribaPay fee (most common deposit provider)
      const totalPercentage = isDeposit
        ? spec.afribapayFee + spec.ashtechMargin
        : spec.swychrFee + spec.ashtechMargin;

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
        afribapayFee:  spec.afribapayFee.toFixed(4),
        ashtechMargin: spec.ashtechMargin.toFixed(4),
        minFee:        spec.minFee.toString(),
        feeType:       "percentage",
        isActive:      true,
        name:          `${spec.countryName} - ${TX_TYPE_LABEL[txType]} (${totalPercentage.toFixed(2)}%)`,
      };

      if (existing.length > 0) {
        // Only update fields that are NOT already customized — preserve admin edits
        // For deposit fees that didn't exist before: always seed afribapayFee
        const existingFee = existing[0];
        const updateData: any = { ...feeData };
        // Don't overwrite name if already set (keep admin-customized names)
        if (existingFee.name && !existingFee.name.startsWith(spec.countryName + " - ")) {
          delete updateData.name;
        }
        await db.update(fees).set(updateData).where(eq(fees.id, existingFee.id));
        updated++;
      } else {
        await db.insert(fees).values({
          ...feeData,
          transactionType: txType,
          countryId:       country.id,
          operatorId:      null,
        });
        created++;
      }
    }
  }

  console.log(`[FeesSeed] Done — created=${created}, updated=${updated} (${TRANSACTION_TYPES.join("+")} fees)`);
}
