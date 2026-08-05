import { useEffect, useState } from "react";

/**
 * useState com persistência em localStorage (por chave).
 * Lê no primeiro efeito (evita mismatch de hidratação) e grava em cada mudança.
 */
export function usePersistedState<T>(chave: string, inicial: T) {
  const [valor, setValor] = useState<T>(inicial);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(chave);
      if (raw != null) setValor(JSON.parse(raw) as T);
    } catch {
      /* ignora */
    }
    setCarregado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  useEffect(() => {
    if (!carregado) return;
    try {
      window.localStorage.setItem(chave, JSON.stringify(valor));
    } catch {
      /* ignora */
    }
  }, [chave, valor, carregado]);

  return [valor, setValor] as const;
}
