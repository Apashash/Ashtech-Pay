import { useState, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  flag?: string;
  sub?: string;
  testId?: string;
}

interface SearchableSelectContentProps {
  options: SelectOption[];
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
}

export function SearchableSelectContent({
  options,
  searchPlaceholder = "Rechercher un pays...",
  emptyMessage = "Aucun résultat",
  className,
}: SearchableSelectContentProps) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const filtered = search.trim()
    ? options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.value.toLowerCase().includes(search.toLowerCase()) ||
        (o.sub && o.sub.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  return (
    <SelectContent
      className={cn("p-0 overflow-hidden", className)}
      onCloseAutoFocus={() => setSearch("")}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-popover sticky top-0 z-10">
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground min-w-0"
          placeholder={searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            e.stopPropagation();
            if (e.key === "Escape") setSearch("");
          }}
          onPointerDown={e => e.stopPropagation()}
        />
        {search && (
          <button
            onPointerDown={e => e.preventDefault()}
            onClick={() => { setSearch(""); inputRef.current?.focus(); }}
            className="text-muted-foreground hover:text-foreground text-lg leading-none px-1"
          >
            ×
          </button>
        )}
      </div>
      <div className="max-h-[240px] overflow-y-auto p-1">
        {filtered.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          filtered.map(o => (
            <SelectItem key={o.value} value={o.value} data-testid={o.testId}>
              <span className="flex items-center gap-2">
                {o.flag && <span>{o.flag}</span>}
                <span>{o.label}</span>
                {o.sub && <span className="text-muted-foreground text-xs">({o.sub})</span>}
              </span>
            </SelectItem>
          ))
        )}
      </div>
    </SelectContent>
  );
}
