import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Inline input that fires onCommit only when the value actually changed on blur / Enter.
 * - Renders "—" for empty when readOnly.
 * - Sends only the changed field to the parent (parent is responsible for partial update).
 */
interface Props {
  value: string | number | null | undefined;
  onCommit: (next: string | null) => void | Promise<void>;
  type?: "text" | "number" | "date";
  step?: string;
  min?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onEnterMoveNext?: () => void;
}

export function InlineInput({ value, onCommit, type = "text", step, min, placeholder, className, disabled, inputRef, onEnterMoveNext }: Props) {
  const initial = value == null ? "" : String(value);
  const [v, setV] = useState<string>(initial);
  useEffect(() => { setV(initial); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [initial]);

  async function commit() {
    if (v === initial) return;
    const trimmed = v.trim();
    await onCommit(trimmed === "" ? null : trimmed);
  }

  return (
    <Input
      ref={inputRef}
      type={type}
      step={step}
      min={min}
      placeholder={placeholder ?? "—"}
      value={v}
      disabled={disabled}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { void commit(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (onEnterMoveNext) {
            void commit().then(onEnterMoveNext);
          } else {
            (e.currentTarget as HTMLInputElement).blur();
          }
        }
        if (e.key === "Escape") { setV(initial); (e.currentTarget as HTMLInputElement).blur(); }
      }}
      className={cn("h-7 text-[12.5px] px-1.5", className)}
    />
  );
}

