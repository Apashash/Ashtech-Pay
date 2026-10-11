import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface OperationFeeQuote {
  feeAmount: number;
  netAmount: number;
  totalAmount: number;
  feePercentage: number;
  promoApplied: boolean;
  normalFeeAmount: number;
  promoExpiresAt: string | null;
}

export function useOperationFees(type: "deposit" | "withdrawal", amount: string, countryId: string, operatorId: string, enabled = true) {
  const [debounced, setDebounced] = useState(amount);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(amount), 250);
    return () => clearTimeout(timer);
  }, [amount]);
  const query = useQuery<OperationFeeQuote>({
    queryKey: ["/api/fees/calculate", type, debounced, countryId, operatorId],
    queryFn: async ({ signal }) => {
      const res = await apiRequest("POST", "/api/fees/calculate", {
        transactionType: type, amount: debounced, countryId, operatorId, paymentMethod: "mobile_money",
      }, { signal });
      return res.json();
    },
    enabled: enabled && Number(debounced) > 0 && !!countryId && !!operatorId,
    staleTime: 0,
    refetchInterval: 30000,
    retry: 1,
  });
  return { ...query, isUpdating: amount !== debounced || query.isFetching };
}
