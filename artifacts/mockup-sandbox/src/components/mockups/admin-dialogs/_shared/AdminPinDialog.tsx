import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, AlertTriangle, Timer } from "lucide-react";

export interface AdminPinDialogProps {
  open: boolean;
  error?: string | null;
  locked?: boolean;
  retryAfterMs?: number;
  attemptsLeft?: number;
  onSubmit: (pin: string) => void;
  onCancel: () => void;
}

export function AdminPinDialog({
  open,
  error,
  locked,
  retryAfterMs,
  attemptsLeft,
  onSubmit,
  onCancel,
}: AdminPinDialogProps) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setDigits(["", "", "", ""]);
      setCountdown(null);
    } else {
      setTimeout(() => inputRefs[0].current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    if (locked && retryAfterMs) {
      const end = Date.now() + retryAfterMs;
      const tick = () => {
        const left = Math.max(0, end - Date.now());
        setCountdown(Math.ceil(left / 1000));
        if (left > 0) setTimeout(tick, 1000);
      };
      tick();
    }
  }, [locked, retryAfterMs]);

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (digits[index] === "" && index > 0) {
        const next = [...digits];
        next[index - 1] = "";
        setDigits(next);
        inputRefs[index - 1].current?.focus();
      } else {
        const next = [...digits];
        next[index] = "";
        setDigits(next);
      }
      return;
    }
    if (e.key === "Escape") {
      onCancel();
      return;
    }
  };

  const handleChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);

    if (char && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    if (char && index === 3) {
      const pin = next.join("");
      if (pin.length === 4) {
        onSubmit(pin);
      }
    }
  };

  const handleSubmit = () => {
    const pin = digits.join("");
    if (pin.length === 4) onSubmit(pin);
  };

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            Confirmation requise
          </DialogTitle>
          <DialogDescription>
            Entrez votre code PIN à 4 chiffres pour effectuer cette action.
          </DialogDescription>
        </DialogHeader>

        {locked ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="rounded-full bg-red-100 p-4">
              <Timer className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-center font-semibold text-red-600">Accès temporairement bloqué</p>
            <p className="text-sm text-center text-muted-foreground">
              Trop de tentatives incorrectes.
              {countdown !== null && (
                <span className="block mt-1 font-mono font-bold text-foreground text-lg">
                  {formatCountdown(countdown)}
                </span>
              )}
            </p>
            <Button variant="outline" onClick={onCancel} className="w-full">
              Annuler
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex justify-center gap-3">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={inputRefs[i]}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl bg-background focus:border-primary focus:outline-none transition-colors"
                  style={{ caretColor: "transparent" }}
                  autoComplete="off"
                />
              ))}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {attemptsLeft !== undefined && attemptsLeft <= 2 && !error && (
              <p className="text-xs text-center text-amber-600">
                {attemptsLeft} tentative{attemptsLeft > 1 ? "s" : ""} restante{attemptsLeft > 1 ? "s" : ""} avant blocage
              </p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onCancel}>
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={digits.join("").length < 4}
              >
                Confirmer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
