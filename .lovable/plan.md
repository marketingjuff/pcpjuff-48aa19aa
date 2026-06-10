## O que está acontecendo

O email que você recebeu é o template padrão do Supabase. O link nele aponta para `localhost:3000` porque essa é a **Site URL** padrão do seu projeto Supabase — e como você não tem nada rodando em `localhost:3000`, o navegador mostra "conexão recusada" e o token expira (`otp_expired`).

Isso **não é um problema de código** do app — é configuração no painel do Supabase. Há duas formas de resolver, e você escolhe:

---

## Opção A (recomendada para uso interno) — Desativar confirmação de email

Se o PCP Juff é uso interno da equipe, o mais simples é não exigir confirmação por email. O usuário cria a conta e já entra direto.

Passos no painel Supabase:
1. Acesse seu projeto em supabase.com
2. Authentication → Providers → Email
3. Desative "Confirm email"
4. Salve

Pronto — novos cadastros entram direto sem precisar do link.

Eu também ajustaria a tela `/auth` para mostrar a mensagem certa após o signup (entrar direto em vez de "verifique seu email").

---

## Opção B — Manter confirmação e arrumar a URL do link

Se quiser manter a confirmação por email, precisa apontar a Site URL para a URL real do app.

Passos no painel Supabase:
1. Authentication → URL Configuration
2. **Site URL**: cole a URL de preview/produção do app, por exemplo
   `https://74c45605-832d-4366-bdd6-081b5bb1b360.lovableproject.com`
   (ou o domínio publicado depois que você publicar)
3. **Redirect URLs** (Additional Redirect URLs): adicione a mesma URL com `/*` no fim para liberar callbacks, ex.:
   `https://74c45605-832d-4366-bdd6-081b5bb1b360.lovableproject.com/*`
4. Salve

Depois disso, peça um novo cadastro — o novo email virá com link correto. **Os links antigos já estão expirados**, não tente reusar.

---

## Decisão que preciso de você

Me responda só com **A** ou **B**:

- **A** — desativar confirmação (mais simples, recomendado para uso interno). Eu ajusto a mensagem da tela de cadastro pra refletir isso.
- **B** — manter confirmação; nesse caso você ajusta as URLs no painel Supabase conforme os passos acima e eu não preciso mexer no código.