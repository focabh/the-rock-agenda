# The Rock — Resumo Técnico (para conversa sobre monetização e proteção de chaves)

> Documento gerado a partir da análise real do código em 2026-05-30. Onde não há certeza, está dito explicitamente.

## 1. Stack e arquitetura

- **Framework:** Next.js **16.2.6** (App Router) + React **19.2.4**, TypeScript.
- **NÃO é PWA puro.** É um app **full-stack Next.js** rodando no **Vercel** (serverless). Tem PWA por cima (instalável): `public/sw.js` (service worker), `public/icons/*` e manifest em `src/app/manifest.ts`. Mas o backend é real (Server Components, Server Actions, Route Handlers).
- **Backend:** embutido no Next.js — não há servidor separado. Lógica server-side via:
  - **Server Components** (renderização no servidor, acesso direto ao banco),
  - **Server Actions** (`"use server"`, mutações),
  - **Route Handlers** (`app/**/route.ts`, endpoints HTTP).
- **Banco de dados:** **remoto** — **Turso (libSQL/SQLite)** acessado via **Drizzle ORM**. Nada de dados de negócio em localStorage/IndexedDB. Conexão em `src/db/index.ts`:

```ts
// src/db/index.ts
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL ?? "file:./data/therock.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });
export const db = drizzle(client, { schema });
```

- **Sessão/auth:** `iron-session` (cookie httpOnly assinado). Senhas com `bcryptjs`.
- **UI:** Tailwind v4, componentes estilo shadcn (`@base-ui/react`), `lucide-react`, `sonner` (toasts), `@dnd-kit` (drag-and-drop de setlist).
- **Outras libs relevantes:** `zod` (validação), `docx` (gera Word das letras), `web-push` (push), `react-pdf`/`pdfjs-dist` (press kit), `date-fns`, `zustand` (instalado; uso pontual).

## 2. Features de custo (chamadas a APIs pagas)

### 2a. Anthropic (Claude) — análise de perfil de casa
- **Onde:** `src/lib/venue-ai.ts`, chamado **só no servidor** pela Server Action `analyzeVenueAction` em `src/app/(app)/casas/contact-actions.ts` (arquivo `"use server"`).
- **Chave:** lida de `process.env.ANTHROPIC_API_KEY` **no servidor**. **NÃO** é `NEXT_PUBLIC`, **não** vai pro browser.

```ts
// src/lib/venue-ai.ts  (executa no servidor)
const MODEL = "claude-haiku-4-5-20251001";

export async function analyzeVenueWithAI(input: {...}): Promise<VenueAISuggestion> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new NoApiKeyError("IA não configurada...");
  // ...
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  // ...
}
```

```ts
// src/app/(app)/casas/contact-actions.ts
"use server";
export async function analyzeVenueAction(venueId: string) {
  await requireAdmin();                 // só admin dispara
  // ...carrega a casa do banco e chama analyzeVenueWithAI(...)
}
```
- **Custo:** Haiku + até 3 web searches → ~US$0,03–0,05 por análise. Sob demanda, resultado salvo no banco (não re-roda sozinho).

### 2b. WhatsApp — **não é API paga**
- O app **não usa a WhatsApp Business API**. Ele só monta **links `wa.me`** e abre no cliente (`window.open`). Sem chave, sem custo. Exemplos: `src/components/shared/notify-band-button.tsx` e `src/components/casas/venue-actions.tsx`.

```ts
// src/components/shared/notify-band-button.tsx (client component)
function go() {
  const text = encodeURIComponent(lines.join("\n"));
  window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
}
```

### 2c. Outras APIs externas (todas com chave **só no servidor**)
- **Google Places** (autocomplete/detalhes de endereço): `src/app/api/places/*/route.ts`, usa `process.env.GOOGLE_PLACES_API_KEY`. O browser chama **o nosso route handler**, que proxia pro Google — a chave nunca vai pro cliente.
- **Resend** (email de aviso de cadastro): `src/lib/email.ts`, `process.env.RESEND_API_KEY` (server). No-op se ausente.
- **Spotify:** import de playlist hoje usa a **página de embed pública** (sem chave). O OAuth (`SPOTIFY_CLIENT_ID/SECRET`) é usado server-side em `src/lib/spotify.ts` (conectar conta — recurso legado/opcional).
- **Web Push (VAPID):** `VAPID_PRIVATE_KEY` server-side; `NEXT_PUBLIC_VAPID_PUBLIC_KEY` é exposto ao cliente **por design** (chave pública de push, não é segredo).

### ⚠️ Alguma chave exposta no frontend ou commitada?
- **No frontend:** **Não.** A única var `NEXT_PUBLIC_*` é a **chave pública** do VAPID (push), que é pública por natureza. `ANTHROPIC_API_KEY`, `GOOGLE_PLACES_API_KEY`, `SPOTIFY_CLIENT_SECRET`, `RESEND_API_KEY`, `VAPID_PRIVATE_KEY`, `SESSION_SECRET`, `TURSO_AUTH_TOKEN` são todas lidas **só no servidor**.
- **Commitada no repo:** **Não encontrei.** `.gitignore` ignora `.env*` (linha `.env*`). Busca por padrões de segredo (`sk-ant-`, `vcp_`, JWT) nos arquivos versionados retornou só **1 falso positivo** dentro de um hash `integrity` do `package-lock.json` (não é segredo).

## 3. Autenticação e contas

- **Login existe:** `src/app/(auth)/login` + `loginAction`. Aceita **usuário OU email** + senha (bcrypt). Sessão via `iron-session` (cookie `therock_session`, httpOnly).
- **Cadastro:** **somente por convite** (link mágico gerado por admin). Não há cadastro aberto.
- **Papéis:** `users.role` = `admin` | `membro`. Autorização por Server Action (`requireAdmin()` / `requireCurrentUser()`).
- **Distinção entre bandas:** **NÃO existe.** O app é **single-tenant** — todos os dados (casas, shows, repertório, usuários) pertencem a **uma única banda (The Rock)**. **Não há conceito de "conta/organização/tenant"** que separe bandas diferentes. Há "usuário" (membro da banda), mas **não** "conta de cliente".
  - **Implicação pra monetização:** pra vender assinatura por banda, falta multi-tenancy (tabela de `org/tenant`, escopo de dados por tenant, billing). Hoje isso **não existe**.

## 4. Backend atual / endpoints

Tudo roda no Next.js (Vercel serverless). Não há servidor separado.

**Route Handlers (HTTP):**
- `GET /api/places/autocomplete` e `GET /api/places/details` — proxy Google Places.
- `GET /api/spotify/callback` — OAuth Spotify (legado).
- `GET /api/icon/[size]` — ícone PWA.
- `GET /show/presskit` e `GET /c/[token]/presskit` — servem o PDF do press kit.
- `GET /shows/[id]/letras/docx` — gera o .docx das letras.

**Server Actions** (não são REST; são endpoints POST internos do Next, protegidos por `requireAdmin`/`requireCurrentUser`): login, cadastro, CRUD de casas/shows/repertório/setlist, contato com casas, análise IA, etc.

**Auth enforcement:** o `src/middleware.ts` faz **passthrough** (não bloqueia). A proteção real é no **layout** `src/app/(app)/layout.tsx`, que chama `requireCurrentUser()` e redireciona pra `/login` se não houver sessão.

## 5. Fluxo de dados

- **No servidor/banco (Turso):** praticamente tudo — usuários, casas, shows, setlists, repertório, letras (cache), histórico de contatos, materiais de divulgação, posições, anúncios.
- **No dispositivo (cliente):**
  - **Cookie de sessão** (`iron-session`, httpOnly) — identidade.
  - **localStorage:** só em `src/components/contratantes/share-panel.tsx` — guarda o **template de mensagem** de divulgação e a seleção de vídeos (preferências de UI, nada sensível).
  - **Service worker** (`public/sw.js`) — cache de assets do PWA.
- Não há sincronização offline-first nem IndexedDB de negócio.

## 6. Estrutura de pastas (resumida)

```
the-rock/
├─ src/
│  ├─ app/
│  │  ├─ (app)/            # área logada (layout faz auth)
│  │  │  ├─ page.tsx       # Painel (dashboard + anúncios + lembretes de casas)
│  │  │  ├─ layout.tsx     # checagem de sessão (requireCurrentUser)
│  │  │  ├─ casas/         # CRM de casas (detail, editar, actions, contact-actions)
│  │  │  ├─ shows/         # shows, setlist, letras (/letras, /letras/docx), imprimir
│  │  │  ├─ repertorio/    # músicas, letras, import Spotify, sync letras
│  │  │  ├─ agenda/ ensaios/ banda/ pagamentos/ gastos/
│  │  │  ├─ divulgacao/    # materiais (vídeo/foto/presskit/rider/instagram)
│  │  │  ├─ contratantes/  # painel de compartilhamento público
│  │  │  ├─ cadastros/     # convites (invite-only)
│  │  │  └─ posicoes/      # posições da banda (admin)
│  │  ├─ (auth)/           # login, cadastro, actions de auth
│  │  ├─ api/              # route handlers: places, spotify/callback, icon
│  │  ├─ show/  c/[token]/ # páginas públicas (press kit / divulgação)
│  │  └─ instalar/         # onboarding PWA
│  ├─ components/          # ui/, shared/, casas/, shows/, repertorio/, divulgacao/, ...
│  ├─ lib/                 # auth, validators, venue-ai, venue-messages, venue-reminders,
│  │                       # venue-tags, spotify, lyrics, email, push, payment, invites, ...
│  └─ db/                  # schema.ts (Drizzle), index.ts (Turso), init.ts (seed admin), migrations/
├─ public/                # sw.js, icons/, imagens
├─ drizzle.config.ts
├─ next.config.ts
└─ package.json
```

## 7. Pontos de risco (chaves/credenciais/lógica sensível acessível ao cliente)

1. **Chaves de API:** ✅ Todas server-side. Nenhuma chave secreta no bundle do cliente nem commitada (ver §2). **Bom.**

2. ⚠️ **`SESSION_SECRET` com fallback fraco hardcoded.** Em `src/lib/auth.ts`:
   ```ts
   password:
     process.env.SESSION_SECRET ??
     "dev-secret-replace-me-with-at-least-32-chars-please",
   ```
   Se `SESSION_SECRET` **não** estiver definido em produção, as sessões são assinadas com um segredo **público e conhecido** → risco de forjar sessão. **Ação:** garantir `SESSION_SECRET` setado no Vercel. (Não verifiquei se está setado lá — confirmar.)

3. ⚠️ **Senha de admin padrão `"therock"`.** Em `src/db/init.ts` (e `src/db/seed.ts`):
   ```ts
   const adminPassword = process.env.ADMIN_PASSWORD ?? "therock";
   ```
   Se `ADMIN_PASSWORD` não estiver setado, o admin inicial nasce com senha `therock`. **Ação:** garantir `ADMIN_PASSWORD` no Vercel e/ou que a senha foi trocada.

4. ⚠️ **Single-tenant (não é risco de segurança, é de produto):** como não há separação por banda/conta, qualquer usuário autenticado enxerga os dados da (única) banda. Pra SaaS multi-banda, isso precisa de isolamento por tenant antes de vender assinaturas.

5. **Server Actions/Route Handlers** são endpoints acessíveis por qualquer sessão autenticada; a autorização depende de cada action chamar `requireAdmin`/`requireCurrentUser`. Auditar se **todas** as mutações sensíveis chamam o guard correto (a maioria chama).

6. **Sem billing/assinatura hoje.** Não há Stripe nem controle de plano — terreno zero pra monetização.

---

### Resumo pra próxima conversa (monetização + chaves)
- Chaves **já estão protegidas** (server-side, não commitadas). O ponto a confirmar é `SESSION_SECRET` e `ADMIN_PASSWORD` definidos em produção.
- O maior trabalho pra **assinatura recorrente** é **transformar o app de single-tenant em multi-tenant** (conceito de conta/banda + isolamento de dados) e plugar um provedor de pagamento (ex.: Stripe). Hoje não existe nenhuma dessas duas coisas.
