import * as React from "react";
import { Input } from "@/components/ui/input";

/**
 * DateInputBR — input de data no formato DD/MM/AA.
 * value/onChange usam string ISO (YYYY-MM-DD) ou "" para vazio.
 * Internamente exibe e aceita digitação como DD/MM/AA (anos 00-99 → 2000-2099).
 */
export interface DateInputBRProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value?: string | null;
  onChange?: (iso: string | null) => void;
}

function isoToBR(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1].slice(-2)}`;
}

function brToIso(br: string): string | null {
  const digits = br.replace(/\D/g, "");
  if (digits.length !== 6) return null;
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yy = digits.slice(4, 6);
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const year = 2000 + parseInt(yy, 10);
  return `${year}-${mm}-${dd}`;
}

function maskBR(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 6);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export const DateInputBR = React.forwardRef<HTMLInputElement, DateInputBRProps>(
  ({ value, onChange, placeholder = "DD/MM/AA", onBlur, ...props }, ref) => {
    const [text, setText] = React.useState<string>(isoToBR(value));

    React.useEffect(() => {
      setText(isoToBR(value));
    }, [value]);

    return (
      <Input
        ref={ref}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        maxLength={8}
        value={text}
        onChange={(e) => {
          const masked = maskBR(e.target.value);
          setText(masked);
          const iso = brToIso(masked);
          if (iso) onChange?.(iso);
          else if (masked === "") onChange?.(null);
        }}
        onBlur={(e) => {
          const iso = brToIso(text);
          if (!iso && text !== "") setText(isoToBR(value));
          onBlur?.(e);
        }}
        {...props}
      />
    );
  },
);
DateInputBR.displayName = "DateInputBR";
