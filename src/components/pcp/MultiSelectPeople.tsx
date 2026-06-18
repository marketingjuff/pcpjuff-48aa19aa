import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";

/** Converte string "Ana; Bia" em array. */
export function parsePeople(s: string | null | undefined): string[] {
  if (!s) return [];
  return s.split(";").map((x) => x.trim()).filter(Boolean);
}
export function joinPeople(arr: string[]): string | null {
  const clean = arr.map((x) => x.trim()).filter(Boolean);
  return clean.length ? clean.join("; ") : null;
}

interface Props {
  value: string | null | undefined;
  options: string[];
  onChange: (next: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MultiSelectPeople({ value, options, onChange, disabled, placeholder = "Selecione..." }: Props) {
  const [open, setOpen] = useState(false);
  const selected = parsePeople(value);
  function toggle(name: string, on: boolean) {
    const set = new Set(selected);
    if (on) set.add(name); else set.delete(name);
    onChange(joinPeople(Array.from(set)));
  }
  const label = selected.length === 0 ? placeholder : selected.join(", ");
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-between font-normal h-10"
        >
          <span className={`truncate ${selected.length === 0 ? "text-muted-foreground" : ""}`}>{label}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2 w-56" align="start">
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {options.length === 0 ? (
            <div className="text-xs text-muted-foreground p-2">Nenhuma opção cadastrada.</div>
          ) : options.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                <Checkbox checked={checked} onCheckedChange={(c) => toggle(opt, c === true)} />
                <span className="flex-1">{opt}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
