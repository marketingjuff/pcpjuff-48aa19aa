import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type NumberInputProps = {
  value: number | null | undefined;
  onValueChange: (valor: number) => void;
  /** 0 = inteiro (padrão), 2 = moeda, 3 = fracionável */
  decimais?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

function fmt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return "";
  return String(v);
}

/** Sanitiza o texto digitado: só dígitos e, quando permitido, um separador decimal. */
function limpar(texto: string, decimais: number): string {
  const t = texto.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  if (decimais === 0) return t.replace(/\./g, "");
  const [inteiro, ...resto] = t.split(".");
  const dec = resto.join("").slice(0, decimais);
  return resto.length > 0 ? `${inteiro}.${dec}` : inteiro;
}

/**
 * Campo numérico digitável, sem setinhas em nenhum navegador.
 * Scroll do mouse e setas ↑/↓ não alteram o valor.
 */
export function NumberInput({
  value,
  onValueChange,
  decimais = 0,
  min,
  max,
  disabled,
  className,
  placeholder,
}: NumberInputProps) {
  const [texto, setTexto] = useState<string>(fmt(value));
  const [focado, setFocado] = useState(false);

  useEffect(() => {
    if (!focado) setTexto(fmt(value));
  }, [value, focado]);

  function clamp(x: number): number {
    let r = x;
    if (min != null && r < min) r = min;
    if (max != null && r > max) r = max;
    return r;
  }

  return (
    <Input
      type="text"
      inputMode={decimais === 0 ? "numeric" : "decimal"}
      value={texto}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={() => setFocado(true)}
      onChange={(e) => {
        const t = limpar(e.target.value, decimais);
        setTexto(t);
        if (t === "" || t.endsWith(".")) return;
        const num = Number(t);
        if (Number.isFinite(num)) onValueChange(num);
      }}
      onBlur={() => {
        setFocado(false);
        const t = limpar(texto, decimais);
        if (t === "" || !Number.isFinite(Number(t))) {
          setTexto("0");
          onValueChange(0);
          return;
        }
        const num = clamp(Number(t));
        setTexto(String(num));
        onValueChange(num);
      }}
      onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
      }}
      className={cn("text-right tabular-nums min-w-[6rem]", className)}
    />
  );
}
