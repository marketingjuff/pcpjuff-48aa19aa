// Helpers do fluxo de canhotos / entregas (aba Frete do PCP e tela do motorista).
import { supabase } from "@/integrations/supabase/client";
import type { Pedido } from "@/lib/pedidos";

export const BUCKET_CANHOTOS = "canhotos";

export type CanhotoFoto = { path: string; em: string; por: string | null };

export function fotosDoPedido(p: Pedido): CanhotoFoto[] {
  const arr = (p as any).canhoto_fotos;
  if (!Array.isArray(arr)) return [];
  return arr.filter((f: any) => f && typeof f.path === "string") as CanhotoFoto[];
}

export function ultimaFoto(p: Pedido): CanhotoFoto | null {
  const arr = fotosDoPedido(p);
  return arr.length ? arr[arr.length - 1]! : null;
}

/** Comprime a foto: máx. 1600px no lado maior, JPEG 0.7. */
export async function comprimirFoto(file: File): Promise<Blob> {
  const bitmapUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      el.src = bitmapUrl;
    });
    const maior = Math.max(img.naturalWidth, img.naturalHeight) || 1;
    const escala = Math.min(1, 1600 / maior);
    const w = Math.max(1, Math.round(img.naturalWidth * escala));
    const h = Math.max(1, Math.round(img.naturalHeight * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível neste navegador.");
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.7),
    );
    if (!blob) throw new Error("Falha ao comprimir a foto.");
    return blob;
  } finally {
    URL.revokeObjectURL(bitmapUrl);
  }
}

/** Sobe a foto comprimida e devolve o novo array de fotos (append-only). */
export async function enviarFotoCanhoto(pedido: Pedido, file: File): Promise<CanhotoFoto[]> {
  const blob = await comprimirFoto(file);
  const path = `${pedido.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET_CANHOTOS)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  const { data } = await supabase.auth.getUser();
  const nova: CanhotoFoto = { path, em: new Date().toISOString(), por: data.user?.id ?? null };
  return [...fotosDoPedido(pedido), nova];
}

/** URL assinada (60s) da foto. */
export async function urlAssinadaCanhoto(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_CANHOTOS).createSignedUrl(path, 60);
  if (error || !data?.signedUrl) throw error ?? new Error("Não foi possível gerar o link da foto.");
  return data.signedUrl;
}

/** Pendentes do motorista: destino Humberto, canhoto impresso e entrega não confirmada. */
export function pedidosPendentesEntrega(pedidos: Pedido[]): Pedido[] {
  return pedidos
    .filter(
      (p) =>
        (p as any).exp_destino_humberto === true &&
        !!(p as any).canhoto_impresso_em &&
        !(p as any).entrega_confirmada_em,
    )
    .sort((a, b) => (a.data_entrega ?? "9999-12-31").localeCompare(b.data_entrega ?? "9999-12-31"));
}

/** Entregues nos últimos 30 dias, mais recentes primeiro. */
export function pedidosEntreguesRecentes(pedidos: Pedido[]): Pedido[] {
  const limite = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return pedidos
    .filter((p) => {
      const em = (p as any).entrega_confirmada_em as string | null;
      return !!em && new Date(em).getTime() >= limite;
    })
    .sort((a, b) =>
      String((b as any).entrega_confirmada_em).localeCompare(String((a as any).entrega_confirmada_em)),
    );
}
