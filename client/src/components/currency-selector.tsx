import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Coins, Check } from "lucide-react";
import type { User } from "@shared/schema";
import { CURRENCY_OPTIONS } from "@/lib/currency";

export function CurrencySelector() {
  const { data: user } = useQuery<User>({ queryKey: ["/api/user"] });

  const updateCurrencyMutation = useMutation({
    mutationFn: async (currency: string) => {
      const res = await apiRequest("PATCH", "/api/user/currency", { currency });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
  });

  const currentCurrency = user?.preferredCurrency || "XAF";
  const currentOption = CURRENCY_OPTIONS.find(c => c.value === currentCurrency);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" data-testid="button-currency-selector">
          <Coins className="w-5 h-5 text-primary" />
          <span className="absolute -bottom-1 -right-1 text-[10px] font-bold text-primary bg-primary/20 rounded px-1">
            {currentOption?.label || "XAF"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {CURRENCY_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => updateCurrencyMutation.mutate(option.value)}
            className="flex items-center justify-between cursor-pointer"
            data-testid={`currency-option-${option.value}`}
          >
            <div className="flex items-center gap-2">
              <span>{option.label}</span>
              <span className="text-muted-foreground text-xs">{option.name}</span>
            </div>
            {currentCurrency === option.value && (
              <Check className="w-4 h-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
