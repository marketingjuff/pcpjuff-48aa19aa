import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useFeriados } from "@/hooks/use-feriados";

/**
 * DateInputBR — input de data no formato DD/MM/AA com popover de calendário.
 * value/onChange usam string ISO (YYYY-MM-DD) ou "" para vazio.
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

function isoToDate(iso?: string | null): Date | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return undefined;
  const d = new Date(
    parseInt(m[1], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[3], 10),
  );
  return isNaN(d.getTime()) ? undefined : d;
}

function dateToIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const DateInputBR = React.forwardRef<HTMLInputElement, DateInputBRProps>(
  ({ value, onChange, placeholder = "DD/MM/AA", onBlur, className, disabled, ...props }, ref) => {
    const [text, setText] = React.useState<string>(isoToBR(value));
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
      setText(isoToBR(value));
    }, [value]);

    const selectedDate = isoToDate(value);
    const isWeekend = selectedDate
      ? selectedDate.getDay() === 0 || selectedDate.getDay() === 6
      : false;

    return (
      <div className={cn("relative", className)}>
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          placeholder={placeholder}
          maxLength={8}
          value={text}
          disabled={disabled}
          className={cn("pr-10", isWeekend && "bg-muted")}
          title={isWeekend ? "Atenção: data cai em fim de semana (não é dia útil)" : undefined}
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

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="absolute right-0 top-0 h-full w-9 text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => {
                if (d) {
                  const iso = dateToIso(d);
                  setText(isoToBR(iso));
                  onChange?.(iso);
                }
                setOpen(false);
              }}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);
DateInputBR.displayName = "DateInputBR";
