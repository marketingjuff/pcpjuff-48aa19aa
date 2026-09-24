import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";

interface Props {
  values: string[];
  options: { value: string; label: string }[];
  onChange: (next: string[]) => void;
  placeholder: string;
}

export function FiltroMultiSelect({ values, options, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  function toggle(v: string, on: boolean) {
    if (on) onChange(values.includes(v) ? values : [...values, v]);
    else onChange(values.filter((x) => x !== v));
  }
  const label =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? values[0])
        : `${values.length} selecionados`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-8 w-full justify-between font-normal">
          <span className={`truncate ${values.length === 0 ? "text-muted-foreground" : ""}`}>{label}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2 w-64" align="start">
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {options.length === 0 ? (
            <div className="text-xs text-muted-foreground p-2">Nenhuma opção cadastrada.</div>
          ) : options.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
              <Checkbox checked={values.includes(opt.value)} onCheckedChange={(c) => toggle(opt.value, c === true)} />
              <span className="flex-1">{opt.label}</span>
            </label>
          ))}
        </div>
        {values.length > 0 && (
          <div className="flex justify-end pt-1 border-t mt-1">
            <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onChange([])}>
              Limpar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
