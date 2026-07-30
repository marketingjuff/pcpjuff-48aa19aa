import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REFACAO_CORES } from "@/lib/pedidos";
import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";

/** Estilo (fundo + texto legível) para uma cor do catálogo. */
export function corStyle(nome: string | null | undefined): React.CSSProperties {
  if (!nome) return {};
  const hex = corHex(nome);
  return { backgroundColor: hex, color: corTextoSobre(hex) };
}

/** Nome base da cor (remove sufixo "-ACABx"). */
export function corNomeBase(v: string | null | undefined): string {
  return v ? v.split("-")[0] : "";
}

interface CorSelectProps {
  value: string | null | undefined;
  onChange: (v: string) => void;
  /** Valor/rótulo para a opção "todas" (opcional). */
  allValue?: string;
  allLabel?: string;
  /** Lista alternativa de opções (nome + label opcional). */
  options?: { nome: string; label?: string }[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Dropdown de cores padrão do sistema: o gatilho e cada opção mostram a cor
 * de fundo real da peça, com texto automaticamente legível.
 */
export function CorSelect({
  value, onChange, allValue, allLabel = "Todas as cores",
  options, placeholder = "Cor", disabled, className,
}: CorSelectProps) {
  const lista = options ?? REFACAO_CORES.map((c) => ({ nome: c.nome }));
  const isAll = allValue != null && value === allValue;
  const base = corNomeBase(value);
  const atual = lista.find((o) => o.nome === base || o.nome === value);
  const style = !isAll && atual ? corStyle(atual.nome) : {};

  return (
    <Select value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={`h-7 text-[12.5px] rounded-full border-0 font-medium ${className ?? ""}`}
        style={style}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allValue != null && <SelectItem value={allValue}>{allLabel}</SelectItem>}
        {lista.map((o) => (
          <SelectItem key={o.nome} value={o.nome}>
            <span className="inline-block rounded-full px-2 py-0.5 font-medium" style={corStyle(o.nome)}>
              {o.label ?? o.nome}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
