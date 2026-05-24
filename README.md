# The Rock — Plataforma Operacional

Plataforma interna da banda **The Rock** (Belo Horizonte / MG) para centralizar shows, repertório, setlists, casas, finanças e contratos.

> Não é SaaS. Não é multi-banda. É uma ferramenta operacional usada pelos próprios membros.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (dark theme, accent vermelho)
- **SQLite** + **Drizzle ORM** + `better-sqlite3` (banco local, arquivo único)
- **iron-session** + **bcryptjs** (auth interna por usuário/senha)
- **React Hook Form** + **Zod** (formulários)
- **date-fns** (locale `pt-BR`)
- **Lucide React** (ícones)
- **Sonner** (toasts)

## Pré-requisitos

- Node.js 20+ (testado com Node 24)
- npm

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env.local
# Edite .env.local e troque o SESSION_SECRET por algo aleatório

# 3. Criar tabelas no banco
npm run db:migrate

# 4. Popular com dados iniciais (admin, repertório, casas, checklists)
npm run db:seed

# 5. Subir o servidor de dev
npm run dev
```

App disponível em `http://localhost:3000`.

**Login padrão (criado pelo seed):**
- Usuário: `admin`
- Senha: `therock` (ou o valor de `ADMIN_PASSWORD` no `.env.local`)

## Integração com Spotify (opcional)

Para importar playlists direto do Spotify no repertório ou setlist:

1. Acesse [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) e faça login com a conta do Spotify
2. Clique em **Create app** → preencha qualquer nome/descrição
3. Após criar, abra o app e copie o **Client ID** e o **Client Secret**
4. Cole no `.env.local`:
   ```
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   ```
5. Reinicie o dev server

A playlist precisa estar **pública** (ou unlisted). Botão **"Importar do Spotify"** disponível em:
- `/repertorio` — adiciona músicas novas ao repertório (skip duplicados)
- show → aba **Setlist** → adiciona à setlist daquele show (opção de substituir a atual)

## Scripts disponíveis

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Turbopack) |
| `npm run build` | Build de produção |
| `npm run start` | Servidor de produção |
| `npm run db:generate` | Gera migrations a partir do schema |
| `npm run db:migrate` | Aplica migrations pendentes |
| `npm run db:push` | Sincroniza schema direto (uso rápido, sem migrations) |
| `npm run db:studio` | Abre Drizzle Studio (UI para inspecionar o banco) |
| `npm run db:seed` | Popula o banco com dados iniciais |

## Estrutura

```
src/
├── app/
│   ├── (auth)/login/          # Tela de login
│   ├── (app)/                 # Rotas autenticadas (com AppShell)
│   │   └── page.tsx           # Painel principal
│   ├── globals.css            # Tema dark + variáveis shadcn
│   └── layout.tsx             # Layout raiz
├── components/
│   ├── ui/                    # Primitivas shadcn (Button, Card, Input, etc.)
│   └── shared/                # AppShell, SidebarNav, PageHeader
├── db/
│   ├── schema.ts              # Schema Drizzle (16 tabelas)
│   ├── index.ts               # Cliente SQLite
│   ├── seed.ts                # Dados iniciais
│   └── migrations/            # SQL gerado pelo drizzle-kit
└── lib/
    ├── auth.ts                # iron-session helpers
    ├── utils.ts               # cn() do shadcn
    └── formatters.ts          # formatBRL, formatDataBR, formatDuracao

data/
└── therock.db                 # Banco SQLite (gitignored)
```

## Tabelas

`users`, `members`, `venues`, `songs`, `shows`, `setlists`, `setlist_items`, `venue_evaluations`, `checklist_templates`, `checklist_template_items`, `show_checklists`, `show_checklist_items`, `show_day_tasks`, `cost_calculations`, `contracts`, `contract_templates`.

Relações completas via `relations()` no schema. FKs com `ON DELETE` apropriado por tabela.

## Ordem de construção dos módulos

1. ✅ Base — scaffold, auth, AppShell, schema, seed
2. ⏳ Casas (CRUD)
3. ⏳ Banda (membros CRUD)
4. ⏳ Shows (CRUD + linha do tempo + detalhe)
5. ⏳ Repertório (CRUD + filtros + favoritos)
6. ⏳ Setlists (montar, reordenar, modo impressão)
7. ⏳ Checklists (modelos + instâncias por show)
8. ⏳ Dia do show (passo a passo hora-a-hora)
9. ⏳ Calculadora de cachê
10. ⏳ Avaliação de casas + ranking
11. ⏳ Contratos (geração de PDF)
12. ⏳ Painel completo

## Backup

O banco inteiro é um único arquivo: `data/therock.db`. Para backup, copiar este arquivo.

## Deploy futuro

A stack roda em qualquer Node 20+. Opções gratuitas:

- **Vercel** — funciona, mas SQLite precisa de storage persistente (usar Turso ou trocar para Postgres na hora do deploy)
- **VPS / Raspberry Pi** — `npm run build && npm run start` atrás de um nginx; banco SQLite vive no disco
- **Railway / Fly.io** — free tier suporta SQLite com volume persistente

Para crescer além de 10k registros ou múltiplos writers concorrentes: migrar para Postgres trocando apenas o driver Drizzle e a config.
