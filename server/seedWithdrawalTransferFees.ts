// Seed/update withdrawal and transfer fees per country
// Provider fee + Ashtech margin = total client fee
// Run once on startup — fully idempotent (upsert by country + transactionType)

import { db } from "./db";
import { fees, countries } from "../shared/schema";
import { eq, and, isNull } from "drizzle-orm";

interface CountryFeeSpec {
  code:          string;
  countryName:   string;
  afribapayFee:  number;
  ashtechMargin: number;
  minFee:        number;
}

const FEE_SPECS: CountryFeeSpec[] = [
  { code: "CM", countryName: "Cameroun",           afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 550 },
  { code: "BF", countryName: "Burkina Faso",        afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 550 },
  { code: "BJ", countryName: "Bénin",               afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 100 },
  { code: "CG", countryName: "Congo Brazzaville",   afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 800 },
  { code: "CD", countryName: "Congo RDC",           afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 27 },
  { code: "CI", countryName: "Côte d'Ivoire",       afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 550 },
  { code: "GA", countryName: "Gabon",               afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 550 },
  { code: "IN", countryName: "Inde",                afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 10.83 },
  { code: "ML", countryName: "Mali",                afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 550 },
  { code: "NE", countryName: "Niger",                afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 790 },
  { code: "RW", countryName: "Rwanda",               afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 2300.07 },
  { code: "SN", countryName: "Sénégal",              afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 550 },
  { code: "TG", countryName: "Togo",                 afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 100 },
  { code: "TZ", countryName: "Tanzanie",             afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 2.6 },
  { code: "UG", countryName: "Ouganda",              afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 0.19 },
  { code: "US", countryName: "États-Unis",           afribapayFee: 3.00, ashtechMargin: 2.00, minFee: 50.17 },
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
      const totalPercentage = spec.afribapayFee + spec.ashtechMargin;

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
