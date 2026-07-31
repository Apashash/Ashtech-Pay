import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import type { DynCryptoCoin } from "@/lib/use-crypto-assets";

interface CoinSelectProps {
  value: string;
  onChange: (sym: string) => void;
  coinList: Record<string, DynCryptoCoin>;
  coinLogoUrl: (sym: string) => string;
}

/**
 * Custom coin picker — shows a search bar + scrollable list (5 rows visible).
 * Replaces the native <select> on the crypto deposit / payment pages.
 */
export function CoinSelect({ value, onChange, coinList, coinLogoUrl }: CoinSelectProps) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const containerRef        = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);

  const entries = Object.entries(coinList);
  const filtered = query.trim()
    ? entries.filter(([sym, def]) =>
        sym.toLowerCase().includes(query.toLowerCase()) ||
        def.name.toLowerCase().includes(query.toLowerCase())
      )
    : entries;

  const selectedDef = coinList[value];

  /* close on outside click */
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  /* focus search when opening */
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  function select(sym: string) {
    onChange(sym);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full h-12 pl-11 pr-10 rounded-xl border border-border bg-background text-sm font-semibold text-left focus:outline-none focus:ring-2 focus:ring-primary/40 flex items-center"
      >
        <span className="truncate">{value} — {selectedDef?.name ?? value}</span>
      </button>

      {/* coin logo left */}
      <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center">
        <img
          src={coinLogoUrl(value.toLowerCase())}
          alt={value}
          className="w-6 h-6 object-contain"
          onLoad={e  => { (e.target as HTMLImageElement).style.display = ""; }}
          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      </div>

      {/* chevron right */}
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs transition-transform" style={{ transform: open ? "translateY(-50%) rotate(180deg)" : undefined }}>▼</div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-background shadow-lg overflow-hidden">
          {/* Search bar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Rechercher…"
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* List — 5 rows × 48 px = 240 px max-height */}
          <div className="overflow-y-auto" style={{ maxHeight: "240px" }}>
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Aucun résultat</p>
            ) : (
              filtered.map(([sym, def]) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => select(sym)}
                  className={`w-full flex items-center gap-3 px-3 h-12 text-sm font-medium hover:bg-muted/60 transition-colors ${sym === value ? "bg-primary/8 text-primary" : ""}`}
                >
                  {/* logo */}
                  <span className="w-6 h-6 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    <img
                      src={coinLogoUrl(sym.toLowerCase())}
                      alt={sym}
                      className="w-6 h-6 object-contain"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </span>
                  <span className="font-semibold">{sym}</span>
                  <span className="text-muted-foreground font-normal truncate">— {def.name}</span>
                  {sym === value && <span className="ml-auto text-primary">✓</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
