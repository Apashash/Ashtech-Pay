import { useState } from "react";
import { networkLogoUrl } from "@/lib/use-crypto-assets";

const NETWORK_SYMBOLS: Record<string, string> = {
  TRC20: "TRX",
  TRX: "TRX",
  BEP20: "BNB",
  BSC: "BNB",
  ERC20: "ETH",
  ETH: "ETH",
  TON: "TON",
  POLYGON: "POL",
  POL: "POL",
  MATIC: "POL",
  SOL: "SOL",
};

export function CryptoNetworkLogo({ networkId }: { networkId: string }) {
  const [failedNetworkId, setFailedNetworkId] = useState<string | null>(null);
  const normalizedNetworkId = networkId.trim().toUpperCase();
  const symbol = NETWORK_SYMBOLS[normalizedNetworkId]
    || normalizedNetworkId.replace(/[^A-Z0-9]/g, "").slice(0, 2)
    || "CR";
  const hasError = failedNetworkId === networkId;

  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[9px] font-bold"
    >
      {hasError ? (
        <span>{symbol.slice(0, 2)}</span>
      ) : (
        <img
          src={networkLogoUrl(networkId)}
          alt=""
          className="h-full w-full object-contain"
          onError={() => setFailedNetworkId(networkId)}
        />
      )}
    </span>
  );
}