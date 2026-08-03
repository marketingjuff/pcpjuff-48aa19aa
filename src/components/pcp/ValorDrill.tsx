import type { ReactNode } from "react";
import type { DrillPayload } from "@/lib/indicadores-drill";

interface Props {
  /** Construtor do payload — só roda no clique, para não pesar o render. */
  build: () => DrillPayload;
  onDrill: (payload: DrillPayload) => void;
  children: ReactNode;
  className?: string;
  /** Desativa o clique (ex.: indicador zerado). */
  disabled?: boolean;
  title?: string;
}

/**
 * Envolve qualquer número/rótulo do painel e abre o detalhamento no clique.
 * Somente leitura: nunca altera filtros nem dados.
 */
export function ValorDrill({ build, onDrill, children, className, disabled, title }: Props) {
  if (disabled) return <span className={className}>{children}</span>;
  return (
    <button
      type="button"
      title={title ?? "Ver detalhamento"}
      onClick={(e) => {
        e.stopPropagation();
        onDrill(build());
      }}
      className={`text-left underline decoration-dotted decoration-muted-foreground/50 underline-offset-2 hover:decoration-foreground hover:text-primary transition-colors cursor-pointer ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

export default ValorDrill;
