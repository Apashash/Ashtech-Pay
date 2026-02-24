import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Coins, Check, MapPin } from "lucide-react";
import type { User } from "@shared/schema";
import { COUNTRY_CURRENCIES } from "@shared/schema";
import { CURRENCY_OPTIONS, ALL_CURRENCY_META } from "@/lib/currency";

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
  const localCurrency = user?.country ? (COUNTRY_CURRENCIES[user.country] || "XAF") : "XAF";
  const localCurrencyMeta = ALL_CURRENCY_META[localCurrency] || ALL_CURRENCY_META["XAF"];
  const isOnLocalCurrency = currentCurrency === localCurrency;

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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={() => updateCurrencyMutation.mutate(localCurrency)}
          className="flex items-center justify-between cursor-pointer bg-primary/5 focus:bg-primary/10"
          data-testid="currency-option-local"
        >
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
            <div>
              <span className="font-medium text-primary text-sm">Devise locale</span>
              <span className="text-muted-foreground text-xs block">
                {localCurrencyMeta.flag} {localCurrencyMeta.label} — {localCurrencyMeta.name}
              </span>
            </div>
          </div>
          {isOnLocalCurrency && (
            <Check className="w-4 h-4 text-primary flex-shrink-0" />
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {CURRENCY_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => updateCurrencyMutation.mutate(option.value)}
            className="flex items-center justify-between cursor-pointer"
            data-testid={`currency-option-${option.value}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">{option.flag}</span>
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
