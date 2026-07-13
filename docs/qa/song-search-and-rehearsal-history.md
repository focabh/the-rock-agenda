# QA — Busca de músicas (versão original) + Histórico de ensaios

Relatório docs-only. Sem cookies, credenciais ou dados pessoais.

## Escopo

Dois escopos, sem expansão:

1. **Busca "Adicionar por nome"** — trazer a versão **original de estúdio** no
   topo (o `/search` do iTunes rankeia mal), respeitando a versão pedida
   explicitamente; ranking testável; expansão de catálogo que não bloqueia;
   cache com TTL/limite; testes determinísticos + smoke opcional.
2. **Ensaios anteriores** — sair da tela principal para uma **tela própria**,
   com link discreto e preservação total dos dados.

Fora de escopo (backlog não-bloqueante): fuzzy matching de `rem`→`R.E.M.`;
cache compartilhado entre instâncias; novas fontes musicais; novos rankings;
outras mudanças em ensaios; e o **hydration warning #418 app-wide** (ver
Riscos).

## Commits

- `cf024b9` — 1ª versão da resolução de artista + penalização de variantes.
- `b945ce1` — ranking puro/testável, intenção de versão, 2 fases, timeout/cache,
  histórico de ensaios em tela própria, confirmação de update no PWA, E2E.
- (este lote) — ajustes finais de QA: assert reforçado do topo `creep radiohead`,
  invalidação de fase 2 ao fechar o diálogo (corrida B), E2E de corridas A/B,
  log técnico de versão no SW (`v33`), este relatório.

## Arquivos alterados

- `src/lib/song-search.ts` — ranking puro + IO (2 fases, timeout, cache).
- `src/lib/song-search.test.ts` — 31 testes determinísticos + 2 smoke opcionais.
- `src/app/(app)/repertorio/actions.ts` — `searchAddCandidatesAction` (fase 1),
  `refineAddCandidatesAction` (fase 2).
- `src/components/repertorio/add-by-name-dialog.tsx` — 2 fases + invalidação por `seq`.
- `src/app/(app)/ensaios/page.tsx` — só próximos + link discreto ao histórico.
- `src/app/(app)/ensaios/anteriores/page.tsx` — tela própria do histórico.
- `src/components/agenda/rehearsal-row.tsx` — linha de ensaio compartilhada.
- `src/components/shared/service-worker-register.tsx` — toast "App atualizado ✓".
- `public/sw.js` — versão + log técnico de versão ativa.
- `scripts/_chkensaios_search.mjs` — E2E (ensaios + busca + corridas A/B).

## Regra final de ranking (`scoreTrack`, pura/testável)

Soma de sinais:

| Sinal | Peso |
|---|---|
| Faixa do catálogo OFICIAL do artista resolvido | +8 |
| Artista bate com o texto (match por frase, limite de palavra) | +5 |
| Cobertura das palavras-núcleo (query − artista − variantes) no título | +5 × fração |
| Título "limpo" (sem parênteses) — só quando **não** se pediu variante | +3 |
| Faixa TEM uma variante **pedida** (ex.: "acoustic") | +6 |
| Variante **não pedida** (acoustic/live/remix/karaoke/cover/tributo/instrumental) | −20 |
| Pediram uma variante que a faixa **não tem** | −10 |
| Remaster (canônico → penalidade leve) | −2 |
| Ordem de origem (desempate estável) | −0,1 × índice |
| Popularidade | N/A (iTunes não expõe sinal confiável) |

Detecção de variante por **limite de palavra** (`\b`): "Alive" **não** é tratado
como versão "live". Nomes de artista normalizados (acento/pontuação/apóstrofo +
"the" inicial): The Killers, AC/DC, R.E.M., Guns N' Roses, etc.

## Regra de ambiguidade (corrigida)

- `creep radiohead` → prioriza **Creep, Radiohead, versão original de estúdio**.
- `creep acoustic radiohead` → prioriza a **versão acústica**.
- `creep live radiohead` → prioriza a **versão ao vivo**.
- `creep` (só o título) → **permanece ambíguo por design**, sem garantia de
  artista ou versão (o iTunes tem dezenas de "Creep"). A resolução de catálogo
  só age quando o texto tem 2+ palavras e o artista aparece nos resultados.

## Gate de testes

- `npm run verify` = `tsc --noEmit && vitest run` → **apenas determinísticos**.
- Unitários usam **mocks/fixtures** (fetch mockado) — não tocam a rede.
- Os 2 **smoke reais** usam `describe.skipIf(!process.env.ITUNES_SMOKE)` →
  ficam **skipped** no verify normal. Indisponibilidade do iTunes **não quebra**
  o CI. Rodar sob demanda: `ITUNES_SMOKE=1 npx vitest run src/lib/song-search.test.ts`.

## Cobertura de corridas (busca em 2 fases)

Mecanismo: um contador `seq` (ref). Cada nova busca faz `mine = ++seq.current`;
fases 1 e 2 só aplicam estado se `mine === seq.current`. Fechar o diálogo faz
`seq.current++` (invalida qualquer fase 2 em voo).

- **A — troca rápida** (`creep radiohead` → `wonderwall oasis`): resposta tardia
  da 1ª nunca sobrescreve a 2ª. **E2E** ✅.
- **B — fechar antes da fase 2**: sem atualização indevida / sem erro de estado /
  sem setState em componente desmontado. **E2E** (checa erros de console novos
  após o fechamento) ✅.
- **C — fase 2 expira/falha**: `withTimeout` + `.catch` mantêm os resultados da
  fase 1; loading termina (`.finally`). **Unit** (timeout do catálogo → degrada)
  ✅ + lógica do diálogo.
- **D — duas buscas idênticas**: cache de catálogo (TTL) reutilizado; `seq`
  garante que nada de outra consulta se mistura. **Unit** (cache/dedupe) ✅.

## Comandos executados

```
npm run verify
npm run build
ITUNES_SMOKE=1 npx vitest run src/lib/song-search.test.ts   # smoke real (opcional)
node scripts/_chkensaios_search.mjs                          # E2E (app em :3000 + sessão)
```

## Resultados

- `npm run verify`: **79 passed, 2 skipped** (tsc limpo).
- `npm run build`: **Compiled successfully**; rota `/ensaios/anteriores` presente.
- Smoke real: **33 passed** (inclui os 2 reais: `creep radiohead`→Radiohead,
  `wonderwall oasis`→Oasis).
- E2E: **12/12 OK** (ensaios principal/histórico/voltar + busca + corridas A/B).
  Baseline app-wide `#418` na carga: 2 (pré-existente, fora do escopo).

## Latências (busca, medidas contra iTunes real)

- Casos leves (`wonderwall oasis`, `alive pearl jam`): ~70–470 ms.
- Pior caso (`zombie cranberries`, `black pearl jam`, catálogo grande): ~2,6–3 s
  (dentro do budget; se estourar, **degrada** para a fase 1).
- Cache quente (repetição): ~23 ms.
- Fase 1 (resultados normais) aparece na hora; a fase 2 refina por cima.

## Evidências visuais

`resp-report/` (geradas pelo E2E, não versionadas):
- `_ensaios_main.png` — principal só com próximos + "Ver ensaios anteriores (2)".
- `_ensaios_hist.png` — `/ensaios/anteriores` + "Voltar aos ensaios".
- `_search_creep.png` — "Creep · Radiohead" em 1º, acima de Stone Temple/Glee.

## Como confirmar a versão ativa do PWA

- **DevTools → Application → Service Workers**: mostra o worker **ativado**
  (`/sw.js`); o fonte contém `const VERSION`.
- **Console**: no `activate`, o SW loga `[SW] ativo: v33-qa-race-hardening`.
- **`caches.keys()`**: nomes estáveis `rock-static` / `rock-runtime` (o
  `activate` limpa versões antigas).
- Distingue **bundle antigo em cache** × **atual** × **SW v33 ativo**.

## Riscos residuais

- **`#418` hydration (app-wide, pré-existente)**: aparece na carga de todas as
  páginas (inclusive não tocadas). Não introduzido por este lote (layout usa
  `dark` fixo, sem `suppressHydrationWarning`). **Não-bloqueante**; backlog.
- Pior caso de latência ~3 s em artistas de catálogo grande (mitigado por 2
  fases + timeout + cache).
- Cache é **por-instância** serverless (não compartilha entre instâncias no
  Vercel; zera no cold start) — best-effort, por design.
- Se o iTunes não tiver o original no catálogo licenciado (raro) → degrada.
- `R.E.M.` casa com pontuação; `rem` como palavra única, não (backlog: fuzzy).

## Rollback

- Reverter este lote: `git revert <hash>` (mantém `b945ce1`).
- Reverter a busca inteira: `git revert b945ce1 cf024b9`.
- Depois, bumpar `public/sw.js` para forçar atualização dos clientes.
- **Sem migração de banco** envolvida → rollback limpo.

## Checklist de UAT

### Busca
- [ ] `creep radiohead` → **Creep — Radiohead** em 1º (não acústico/ao vivo/cover).
- [ ] `creep acoustic radiohead` → uma versão **acústica** é priorizada.
- [ ] `wonderwall oasis` → **Wonderwall — Oasis** em 1º.
- [ ] `creep` → permanece **ambíguo**, sem promessa de Radiohead.
- [ ] Duas buscas rápidas (`creep radiohead` → `wonderwall oasis`) → a 1ª nunca
      sobrescreve a 2ª.
- [ ] Fechar o diálogo durante "Buscando a versão original…" → sem erro/estado
      indevido.

### Ensaios
- [ ] A tela principal mostra **apenas** ensaios atuais e futuros.
- [ ] O link "Ver ensaios anteriores" mostra a **contagem correta**.
- [ ] A rota `/ensaios/anteriores` abre corretamente.
- [ ] Os ensaios passados permanecem preservados (setlists reutilizáveis).
- [ ] "Voltar aos ensaios" retorna corretamente.

### PWA
- [ ] O app atualiza para o service worker **v33**.
- [ ] O toast "App atualizado ✓" aparece quando aplicável.
- [ ] Fechar e reabrir **não** restaura a versão anterior.
- [ ] A versão ativa pode ser confirmada tecnicamente (console `[SW] ativo: v33…`).
