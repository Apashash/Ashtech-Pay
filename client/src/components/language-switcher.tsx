import { useLanguage, type Language } from "@/lib/language";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";

const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

export function LanguageSwitcher({ variant = "default" }: { variant?: "default" | "compact" }) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  const current = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground border border-border"
          aria-label="Changer de langue"
          data-testid="button-language-switcher"
        >
          <span className="text-base leading-none">{current.flag}</span>
          {variant === "default" && (
            <span className="hidden sm:inline text-xs text-muted-foreground uppercase tracking-wide">
              {current.code.toUpperCase()}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-40 p-1.5 rounded-xl shadow-lg"
        align="end"
        sideOffset={8}
      >
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => { setLanguage(lang.code); setOpen(false); }}
            data-testid={`button-lang-${lang.code}`}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              language === lang.code
                ? "bg-primary/10 text-primary font-semibold"
                : "hover:bg-accent text-foreground"
            }`}
          >
            <span className="text-lg leading-none">{lang.flag}</span>
            <span>{lang.label}</span>
            {language === lang.code && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
