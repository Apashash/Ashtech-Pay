import { useState } from "react";
import "./_group.css";
import { AdminPinDialog } from "./_shared/AdminPinDialog";

export function AdminPinPreview() {
  const [open, setOpen] = useState(true);

  return (
    <main className="relative min-h-screen overflow-hidden bg-muted p-5 font-sans text-foreground">
      <div className="mx-auto max-w-sm space-y-4 rounded-2xl border bg-background p-5 shadow-sm">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              AshTech Pay
            </p>
            <h1 className="mt-1 text-lg font-semibold">Espace administrateur</h1>
          </div>
          <div className="h-9 w-9 rounded-full bg-primary/15" />
        </div>
        <div className="space-y-3">
          <div className="h-3 w-3/4 rounded bg-muted" />
          <div className="h-3 w-full rounded bg-muted" />
          <div className="h-20 rounded-xl border bg-card" />
        </div>
        <button
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
          onClick={() => setOpen(true)}
        >
          Ouvrir la confirmation PIN
        </button>
      </div>

      <AdminPinDialog
        open={open}
        onCancel={() => setOpen(false)}
        onSubmit={() => setOpen(false)}
      />
    </main>
  );
}