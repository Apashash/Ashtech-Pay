import { Link, useLocation } from "wouter";
import type { LucideIcon } from "lucide-react";

interface AdminSectionTab {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface AdminSectionTabsProps {
  items: AdminSectionTab[];
  label: string;
}

export function AdminSectionTabs({ items, label }: AdminSectionTabsProps) {
  const [location] = useLocation();

  return (
    <nav
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted/30 p-1"
    >
      {items.map(({ href, label: tabLabel, icon: Icon }) => {
        const isActive = location === href || location.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`inline-flex min-h-10 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {tabLabel}
          </Link>
        );
      })}
    </nav>
  );
}