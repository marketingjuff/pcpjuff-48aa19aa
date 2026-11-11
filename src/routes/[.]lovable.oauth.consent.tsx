import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Detalhes = {
  client?: { name?: string; client_name?: string; redirect_uri?: string } | null;
  redirect_uri?: string;
  scope?: string;
  user?: { email?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
};
type Resp = { data: Detalhes | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<Resp>;
  approveAuthorization: (id: string) => Promise<Resp>;
  denyAuthorization: (id: string) => Promise<Resp>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

const ESCOPOS: Record<string, string> = {
  openid: "Confirmar quem você é",
  email: "Ver seu e-mail",
  profile: "Ver seu nome e perfil básico",
};

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Pedido de autorização inválido ou incompleto.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ href: "/auth?next=" + encodeURIComponent(next) });
    }
  },
  loaderDeps: ({ search }) => ({ id: search.authorization_id }),
  loader: async ({ deps }) => {
    const { data, error } = await oauth().getAuthorizationDetails(deps.id);
    if (error) throw new Error(error.message || "Este pedido de conexão expirou ou não existe mais.");
    const imediato = data?.redirect_url ?? data?.redirect_to;
    if (imediato && !data?.client) throw redirect({ href: imediato });
    return data;
  },
  head: () => ({
    meta: [
      { title: "Conectar ao PCP Juff" },
      { name: "description", content: "Autorize um assistente a consultar o PCP Juff com o seu acesso." },
      { property: "og:title", content: "Conectar ao PCP Juff" },
      { property: "og:description", content: "Autorize um assistente a consultar o PCP Juff com o seu acesso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Consentimento,
  errorComponent: ({ error }) => (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Não deu para abrir este pedido de conexão</CardTitle>
          <CardDescription>{error instanceof Error ? error.message : String(error)}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Volte ao assistente e tente conectar de novo.</CardContent>
      </Card>
    </main>
  ),
});

function Consentimento() {
  const d = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cliente = d?.client?.name ?? d?.client?.client_name ?? "Um assistente";
  const redirectUri = d?.redirect_uri ?? d?.client?.redirect_uri;
  const escopos = (d?.scope ?? "").split(/\s+/).filter(Boolean);

  async function decidir(aprovar: boolean) {
    setOcupado(true);
    setErro(null);
    try {
      const { data, error } = aprovar
        ? await oauth().approveAuthorization(authorization_id)
        : await oauth().denyAuthorization(authorization_id);
      if (error) throw new Error(error.message);
      const alvo = data?.redirect_url ?? data?.redirect_to;
      if (!alvo) throw new Error("O servidor de autorização não devolveu para onde voltar.");
      window.location.href = alvo;
    } catch (e) {
      setOcupado(false);
      setErro((aprovar ? "Não foi possível aprovar: " : "Não foi possível cancelar: ") + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Conectar {cliente} ao PCP Juff</CardTitle>
          <CardDescription>
            {cliente} vai poder consultar o PCP Juff como você{d?.user?.email ? ` (${d.user.email})` : ""}, só para leitura.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {redirectUri && <p className="text-muted-foreground">Endereço de retorno: <span className="break-all">{redirectUri}</span></p>}
          {escopos.length > 0 && (
            <ul className="list-disc space-y-1 pl-5">
              {escopos.map((s) => <li key={s}>{ESCOPOS[s] ?? `Permissão adicional pedida: ${s}`}</li>)}
            </ul>
          )}
          <p className="text-muted-foreground">Isso não passa por cima das suas permissões: ele só vê o que você já vê nas abas.</p>
          {erro && <p role="alert" className="text-destructive">{erro}</p>}
          <div className="flex gap-2">
            <Button disabled={ocupado} onClick={() => decidir(true)} className="flex-1">Autorizar</Button>
            <Button disabled={ocupado} variant="outline" onClick={() => decidir(false)} className="flex-1">Cancelar conexão</Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
