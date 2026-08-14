import { corHex, corTextoSobre } from "@/components/pcp/PecasPerdidasEditor";

/**
 * Chip padrão de cor de peça: fundo com o hex da cor e o nome escrito em cima,
 * com a cor do texto escolhida automaticamente por contraste.
 */
export function CorChip({ cor, className }: { cor: string | null | undefined; className?: string }) {
  if (!cor) return <>—</>;
  const hex = corHex(cor);
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 font-medium ${className ?? ""}`}
      style={{ backgroundColor: hex, color: corTextoSobre(hex) }}
    >
      {cor}
    </span>
  );
}
