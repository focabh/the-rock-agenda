# The Rock — Agenda

Sistema de gerenciamento de shows e disponibilidade da banda **The Rock**.

## Stack

- **Next.js 15** + App Router
- **Supabase** (PostgreSQL)
- **TypeScript** + Tailwind CSS

## Funcionalidades

- **Calendário** mensal (2026–2027) com shows e indisponibilidades
- **Gerenciamento de Shows**: contratante, data/hora, duração, cachê, comissão, status de pagamento
- **Disponibilidade dos Músicos**: registro de indisponibilidades com motivo e substituto (sub)
- **Financeiro**: visão anual com totais de cachê, comissão e pagamentos pendentes

## Músicos

| Nome | Função | Observação |
|------|--------|-----------|
| Foca | Vocalista / Líder | — |
| Marco | Guitarrista Base | Ausência não impede o show |
| Felipe | Guitarrista Base e Solo | — |
| Ester | Bateria | — |
| Rafa | Baixo | — |

> Quando qualquer músico (exceto Marco) estiver indisponível, o sistema exibe um campo **Sub** para indicar o substituto. Sem sub, o sistema marca a banda como bloqueada naquela data.

## Setup

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. Abra o **SQL Editor** e execute o conteúdo de `supabase/schema.sql`
3. Copie a URL e a chave anon do projeto

### 2. Variáveis de ambiente

Edite `.env.local` na raiz do projeto:

```
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon
```

### 3. Rodar localmente

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000)

### 4. Deploy (Vercel)

1. Faça push para um repositório GitHub
2. Importe no [Vercel](https://vercel.com)
3. Adicione as variáveis de ambiente no painel do Vercel
4. Deploy automático
