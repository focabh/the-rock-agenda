import { relations } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

// ---------------- USERS (band-internal login) ----------------

export const users = sqliteTable("users", {
  id: id(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "membro"] })
    .notNull()
    .default("membro"),
  // Superusuário (Foca): único que configura o app e gerencia repertório/ensaios.
  // O manager é admin mas NÃO superuser.
  superuser: integer("superuser", { mode: "boolean" }).notNull().default(false),
  nome: text("nome"),
  sobrenome: text("sobrenome"),
  apelido: text("apelido"), // "como gostaria de ser chamado" — usado no app inteiro
  email: text("email"),
  telefone: text("telefone"),
  cpf: text("cpf"),
  chavePix: text("chave_pix"),
  posicao: text("posicao"), // posição na banda escolhida no cadastro
  status: text("status", { enum: ["pendente", "aprovado", "recusado"] })
    .notNull()
    .default("aprovado"),
  createdAt: createdAt(),
});

// Convites de cadastro. O único jeito de criar conta: um admin gera um
// convite amarrado a um telefone e manda o link. Quem abrir o link cadastra
// (sem aprovação) e o telefone já vem travado no valor do convite.
// Single-use: redeemedEm marca consumo; expiresEm/revokedEm invalidam.
export const inviteTokens = sqliteTable("invite_tokens", {
  id: id(),
  token: text("token").notNull().unique(),
  telefone: text("telefone").notNull(), // amarrado — só este telefone pode usar
  nome: text("nome"), // opcional — pré-preenche o cadastro
  posicao: text("posicao"), // opcional — se setado, trava a posição no cadastro
  expiresEm: integer("expires_em", { mode: "timestamp_ms" }).notNull(),
  redeemedEm: integer("redeemed_em", { mode: "timestamp_ms" }),
  redeemedUserId: text("redeemed_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  revokedEm: integer("revoked_em", { mode: "timestamp_ms" }),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
});

// Configuração global (singleton) — controla cadastro aberto, etc.
export const appSettings = sqliteTable("app_settings", {
  id: id(),
  allowRegistrations: integer("allow_registrations", { mode: "boolean" })
    .notNull()
    .default(true),
  logoUrl: text("logo_url"), // data URL (base64) da logo personalizada
  backgroundUrl: text("background_url"), // imagem de fundo do LOGIN
  appBackgroundUrl: text("app_background_url"), // imagem de fundo GERAL do app (após login)
  bandName: text("band_name"), // nome da banda/conta (login dinâmico StageBoss)
  bioTexto: text("bio_texto"), // bio institucional (manual ou IA) — cache definitivo
  whatsappGrupo: text("whatsapp_grupo"), // grupo GERAL (shows/avisos) — manager participa
  whatsappGrupoMusicos: text("whatsapp_grupo_musicos"), // grupo dos MÚSICOS (ensaio/repertório)
  // Listas do Spotify pré-configuradas (URLs) — pré-preenchem o import por contexto.
  spotifyListRepertorio: text("spotify_list_repertorio"),
  spotifyListSetlist: text("spotify_list_setlist"), // shows
  spotifyListEnsaio: text("spotify_list_ensaio"),
  // Opacidade dos blocos/cards (60–100). <100 = efeito vidro deixando o fundo
  // vazar. Só tem efeito visível quando há fundo do app.
  surfaceOpacity: integer("surface_opacity").notNull().default(100),
  // Quando true, o ADMIN também vê só o material da sua posição (ex.: baterista
  // não vê letras). Quando false (padrão), o admin sempre vê letras p/ gerenciar.
  adminMaterialPorPosicao: integer("admin_material_por_posicao", {
    mode: "boolean",
  })
    .notNull()
    .default(false),
  updatedAt: updatedAt(),
});

// Inscrições de Web Push — um registro por dispositivo/navegador.
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: id(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  userAgent: text("user_agent"),
  createdAt: createdAt(),
});

// ---------------- BAND MEMBERS ----------------

export const members = sqliteTable("members", {
  id: id(),
  nome: text("nome").notNull(),
  funcao: text("funcao").notNull(), // vocal, guitarra, baixo, bateria, etc.
  telefone: text("telefone"),
  cpf: text("cpf"),
  chavePix: text("chave_pix"),
  pixTipo: text("pix_tipo"), // CPF | CNPJ | E-mail | Telefone | Aleatória
  pixBanco: text("pix_banco"), // banco/instituição da chave
  equipamentos: text("equipamentos"),
  disponibilidade: text("disponibilidade"),
  percentualDivisao: real("percentual_divisao").default(0),
  observacoes: text("observacoes"),
  avatar: text("avatar"), // data URL (foto do músico) — opcional
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  isManager: integer("is_manager", { mode: "boolean" })
    .notNull()
    .default(false),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Presença confirmada por show por membro
export const showMemberPresence = sqliteTable("show_member_presence", {
  id: id(),
  showId: text("show_id")
    .notNull()
    .references(() => shows.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pendente", "confirmado", "recusado"] })
    .notNull()
    .default("pendente"),
  observacao: text("observacao"),
  // Marca se a confirmação veio de uma notificação (medir utilidade do push).
  viaPush: integer("via_push", { mode: "boolean" }).notNull().default(false),
  updatedAt: updatedAt(),
});

// ---------------- VENUES (CASAS) ----------------

export const venues = sqliteTable("venues", {
  id: id(),
  nome: text("nome").notNull(),
  endereco: text("endereco"),
  cidade: text("cidade"),
  bairro: text("bairro"),
  estado: text("estado"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  contatoPrincipal: text("contato_principal"),
  telefone: text("telefone"),
  observacoes: text("observacoes"),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  // --- CRM: relacionamento com a casa ---
  querTocar: integer("quer_tocar", { mode: "boolean" }).notNull().default(false),
  jaTocou: integer("ja_tocou", { mode: "boolean" }).notNull().default(false),
  // Voltaria a tocar? null = não avaliado, true = voltaria, false = não voltaria.
  voltaria: integer("voltaria", { mode: "boolean" }),
  naoContatar: integer("nao_contatar", { mode: "boolean" })
    .notNull()
    .default(false),
  // --- CRM: campos automáticos (preenchidos por ações no app) ---
  materialEnviadoEm: integer("material_enviado_em", { mode: "timestamp_ms" }),
  ultimoContatoEm: integer("ultimo_contato_em", { mode: "timestamp_ms" }),
  agradecimentoEnviadoEm: integer("agradecimento_enviado_em", {
    mode: "timestamp_ms",
  }),
  // Ajuste manual de histórico antigo (a última apresentação "real" também é
  // derivada dos shows desta casa — usa-se a mais recente entre as duas).
  ultimaApresentacaoManual: integer("ultima_apresentacao_manual", {
    mode: "timestamp_ms",
  }),
  // Perfil/características (preenchidas à mão ou sugeridas por IA — fase futura)
  caracteristicas: text("caracteristicas"), // JSON array de tags
  instagram: text("instagram"),
  // Logo da casa (data URL ou link) — usada nos flyers do show. Pode ser puxada
  // do Instagram (unavatar) a partir do @, ou enviada à mão.
  logoUrl: text("logo_url"),
  perfilPublico: text("perfil_publico"), // resumo do público/estilo
  // Infraestrutura técnica que a casa oferece (PA, canais, energia, palco...).
  // Texto livre — usado no check de compatibilidade técnica do show.
  infraestrutura: text("infraestrutura"),
  // Link de convite do grupo de WhatsApp com a casa/contratante (custo zero).
  whatsappGrupo: text("whatsapp_grupo"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Histórico simples de contatos feitos com cada casa (pelo app).
export const venueContacts = sqliteTable("venue_contacts", {
  id: id(),
  venueId: text("venue_id")
    .notNull()
    .references(() => venues.id, { onDelete: "cascade" }),
  tipo: text("tipo", {
    enum: ["divulgacao", "followup", "agradecimento", "nova_data", "contato"],
  }).notNull(),
  mensagem: text("mensagem"),
  createdAt: createdAt(),
  createdById: text("created_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
});

// ---------------- SONGS (REPERTÓRIO) ----------------

export const songs = sqliteTable("songs", {
  id: id(),
  titulo: text("titulo").notNull(),
  artista: text("artista").notNull(),
  status: text("status", {
    enum: [
      "pronta",
      "precisa_ensaiar",
      "aprendendo",
      "ideia_futura",
      "aposentada",
    ],
  })
    .notNull()
    .default("aprendendo"),
  favorita: integer("favorita", { mode: "boolean" }).notNull().default(false),
  observacoes: text("observacoes"),
  // ID da faixa no Spotify (ex.: "1wrhhPzd2ncJPNgUcGgBGg"), preenchido no
  // import via embed. Usado pro player embutido na lista. Null = música manual.
  spotifyTrackId: text("spotify_track_id"),
  // Letra (cache do LRCLIB na 1ª abertura; admin pode corrigir). Null = ainda
  // não buscada / não encontrada.
  lyrics: text("lyrics"),
  // Letra SINCRONIZADA (LRC, com timestamps por linha) — alimenta o
  // Inteliprompter (rolagem no tempo real da música). Cache do LRCLIB.
  syncedLyrics: text("synced_lyrics"),
  // Marcações de palco (intro/solo/"entra vocal") — JSON [{t:segundos,label}].
  // Sugeridas automaticamente pelos vãos da letra sincronizada e editáveis.
  cues: text("cues"),
  // --- Metadados pra geração de setlist (Fase 6) ---
  duracaoSeg: integer("duracao_seg"), // duração aproximada (preenchida no import)
  energia: integer("energia"), // 1=leve, 2=média, 3=pesada
  conhecida: integer("conhecida", { mode: "boolean" }).notNull().default(false),
  exigeVocal: integer("exige_vocal", { mode: "boolean" })
    .notNull()
    .default(false),
  momento: text("momento", {
    enum: ["qualquer", "abertura", "meio", "fechamento"],
  })
    .notNull()
    .default("qualquer"),
  // "Munição pesada": hino/catarse que fecha show. Trava: só nos últimos 20%
  // (fechamento/bis), nunca no início.
  finalBoss: integer("final_boss", { mode: "boolean" })
    .notNull()
    .default(false),
  tom: text("tom"), // tonalidade musical (ex.: "Em", "A") — muda por música
  // Afinação dropada (Drop D/C etc.)? Agrupa as dropadas p/ minimizar reafinação.
  dropada: integer("dropada", { mode: "boolean" }).notNull().default(false),
  // Popularidade Spotify (0–100), atualizada sob demanda. Desempata o setlist.
  popularidade: integer("popularidade"),
  estilo: text("estilo"), // categoria/estilo livre (ex.: "grunge")
  // Prioridade de ENSAIO: música nova / que a banda não passa com frequência e
  // precisa treinar. O "Gerar" do ensaio puxa estas pra frente (junto com as
  // recém-adicionadas via createdAt). Independente do "favorita".
  prioridade: integer("prioridade", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------- SETLISTS ----------------

export const setlists = sqliteTable("setlists", {
  id: id(),
  nome: text("nome").notNull(),
  showId: text("show_id").references(() => shows.id, { onDelete: "set null" }),
  // Um setlist pertence a um show OU a um ensaio (rehearsal). Ensaios não têm
  // duração-alvo.
  rehearsalId: text("rehearsal_id").references(() => rehearsals.id, {
    onDelete: "cascade",
  }),
  // Setlist OFICIAL do show (só 1 por show). É o que o Modo Show / flyer usam.
  oficial: integer("oficial", { mode: "boolean" }).notNull().default(false),
  duracaoEstimadaSeg: integer("duracao_estimada_seg").default(0),
  // Duração-alvo deste set (min). Null → usa a duração do show. Permite
  // 1º set 60min, bis 20min etc.
  duracaoAlvoMin: integer("duracao_alvo_min"),
  observacoesGerais: text("observacoes_gerais"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const setlistItems = sqliteTable("setlist_items", {
  id: id(),
  setlistId: text("setlist_id")
    .notNull()
    .references(() => setlists.id, { onDelete: "cascade" }),
  songId: text("song_id")
    .notNull()
    .references(() => songs.id, { onDelete: "cascade" }),
  ordem: integer("ordem").notNull(),
  tom: text("tom"), // ex: "Em", "A", "F#m"
  duracaoSeg: integer("duracao_seg"),
  nota: text("nota"), // anotações entre músicas
  // Música que precisa de atenção especial antes do ensaio (marcador).
  prioridade: integer("prioridade", { mode: "boolean" }).notNull().default(false),
  // "Emenda": esta música emenda direto na próxima (sem pausa). Mostra conector
  // no setlist e alerta se houver mudança de tom/afinação no meio da emenda.
  emenda: integer("emenda", { mode: "boolean" }).notNull().default(false),
});

// ---------------- SHOWS ----------------

export const shows = sqliteTable("shows", {
  id: id(),
  casaId: text("casa_id")
    .notNull()
    .references(() => venues.id, { onDelete: "restrict" }),
  data: integer("data", { mode: "timestamp_ms" }).notNull(),
  // Evento particular (festa privada): sem @ da casa no flyer, info mais discreta.
  privado: integer("privado", { mode: "boolean" }).notNull().default(false),
  // Cobrança automática de confirmação de presença.
  lembreteNivel: text("lembrete_nivel", { enum: ["off", "tranquila", "importante", "urgente"] }).notNull().default("off"),
  lembreteEnviadoEm: integer("lembrete_enviado_em", { mode: "timestamp_ms" }),
  lembretesEnviados: integer("lembretes_enviados").notNull().default(0),
  inicio: text("inicio"), // HH:mm
  termino: text("termino"), // HH:mm
  contatoNome: text("contato_nome"),
  contatoTelefone: text("contato_telefone"),
  endereco: text("endereco"),
  cidade: text("cidade"),
  estado: text("estado"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  cacheCentavos: integer("cache_centavos").default(0), // valor em centavos
  pagamentoStatus: text("pagamento_status", {
    enum: ["pendente", "parcial", "pago", "atrasado"],
  })
    .notNull()
    .default("pendente"),
  passagemSom: text("passagem_som"), // HH:mm
  publicoEsperado: integer("publico_esperado"),
  duracaoMin: integer("duracao_min"), // duração planejada do show (minutos)
  consumacao: text("consumacao"), // couvert/consumação mínima
  acompanhantes: text("acompanhantes"), // política de acompanhantes/lista
  valorIngresso: text("valor_ingresso"), // ex.: "R$ 20" ou "Gratuito" (flyer)
  linkVendas: text("link_vendas"), // link de venda de ingressos (vira QR no flyer)
  observacoes: text("observacoes"),
  status: text("status", {
    enum: ["planejado", "confirmado", "concluido", "cancelado"],
  })
    .notNull()
    .default("planejado"),
  // Repartição financeira
  applyCommission: integer("apply_commission", { mode: "boolean" })
    .notNull()
    .default(true),
  commissionPct: real("commission_pct").notNull().default(10),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Override individual de valor pago a um músico em um show específico
export const showMemberPayment = sqliteTable(
  "show_member_payment",
  {
    id: id(),
    showId: text("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    valorCentavos: integer("valor_centavos").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => ({
    uniqShowMemberPay: uniqueIndex("uniq_show_member_pay").on(
      t.showId,
      t.memberId,
    ),
  }),
);

// Marca que a banda já repassou o cachê a um músico (banda -> músico).
// A existência da linha = pago. Distinto de shows.pagamentoStatus (contratante -> banda).
export const showMemberPaid = sqliteTable(
  "show_member_paid",
  {
    id: id(),
    showId: text("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    pagoEm: integer("pago_em", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    // null = linha legada (já quitada). Novos repasses começam "aguardando".
    status: text("status", { enum: ["aguardando", "confirmado"] }),
    comprovante: text("comprovante"), // data URL (imagem/PDF) do comprovante
    confirmadoEm: integer("confirmado_em", { mode: "timestamp_ms" }),
  },
  (t) => ({
    uniqShowMemberPaid: uniqueIndex("uniq_show_member_paid").on(
      t.showId,
      t.memberId,
    ),
  }),
);

// ---------------- GALERIA DE MÍDIA (divulgação) ----------------

// Fotos de alta qualidade da banda, usadas como fundo dos cartazes/flyers.
export const imagensDivulgacao = sqliteTable("imagens_divulgacao", {
  id: id(),
  url: text("url").notNull(),
  legenda: text("legenda"),
  createdAt: createdAt(),
});

// ---------------- INVENTÁRIO DE EQUIPAMENTOS ----------------

// Inventário estruturado da banda (substitui o texto livre em members.equipamentos).
export const equipamentos = sqliteTable("equipamentos", {
  id: id(),
  nome: text("nome").notNull(),
  categoria: text("categoria", {
    enum: ["individual", "infraestrutura_coletiva"],
  }).notNull(),
  tipo: text("tipo", {
    enum: ["mesa_som", "pa", "retorno_palco", "in_ear", "microfone", "periferico", "outro"],
  }).notNull(),
  // Dono (se individual); null = da banda (infraestrutura coletiva).
  proprietarioId: text("proprietario_id").references(() => members.id, {
    onDelete: "set null",
  }),
  especificacoes: text("especificacoes"), // canais, potência, etc.
  createdAt: createdAt(),
});

// ---------------- REHEARSALS (ENSAIOS) ----------------

export const rehearsals = sqliteTable("rehearsals", {
  id: id(),
  data: integer("data", { mode: "timestamp_ms" }).notNull(),
  // Show relacionado (opcional) — permite importar o setlist do show pro ensaio.
  showId: text("show_id").references(() => shows.id, { onDelete: "set null" }),
  // Cobrança automática de confirmação de presença.
  lembreteNivel: text("lembrete_nivel", { enum: ["off", "tranquila", "importante", "urgente"] }).notNull().default("off"),
  lembreteEnviadoEm: integer("lembrete_enviado_em", { mode: "timestamp_ms" }),
  lembretesEnviados: integer("lembretes_enviados").notNull().default(0),
  inicio: text("inicio"), // HH:mm
  termino: text("termino"), // HH:mm
  local: text("local"),
  endereco: text("endereco"),
  cidade: text("cidade"),
  estado: text("estado"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  foco: text("foco"), // o que será ensaiado
  observacoes: text("observacoes"),
  status: text("status", {
    enum: ["planejado", "confirmado", "cancelado"],
  })
    .notNull()
    .default("planejado"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// Presença confirmada por ensaio por membro
export const rehearsalMemberPresence = sqliteTable("rehearsal_member_presence", {
  id: id(),
  rehearsalId: text("rehearsal_id")
    .notNull()
    .references(() => rehearsals.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  status: text("status", { enum: ["pendente", "confirmado", "recusado"] })
    .notNull()
    .default("pendente"),
  observacao: text("observacao"),
  // Marca se a confirmação veio de uma notificação (medir utilidade do push).
  viaPush: integer("via_push", { mode: "boolean" }).notNull().default(false),
  updatedAt: updatedAt(),
});

// ---------------- VENUE EVALUATIONS ----------------

export const venueEvaluations = sqliteTable("venue_evaluations", {
  id: id(),
  showId: text("show_id")
    .notNull()
    .references(() => shows.id, { onDelete: "cascade" }),
  notaGeral: integer("nota_geral"), // 1-5 (UI usa esta)
  qualidadeSom: integer("qualidade_som"), // 1-5 (reserva — não exposto no MVP)
  publico: integer("publico"),
  retornoFinanceiro: integer("retorno_financeiro"),
  estrutura: integer("estrutura"),
  hospitalidade: integer("hospitalidade"),
  facilidadeMontagem: integer("facilidade_montagem"),
  tocariaNovamente: integer("tocaria_novamente", { mode: "boolean" }),
  observacoes: text("observacoes"),
  createdAt: createdAt(),
});

// Prontidão por músico em cada música — "Fulano já tirou essa?"
export const songMemberReadiness = sqliteTable(
  "song_member_readiness",
  {
    id: id(),
    songId: text("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pronta", "precisa_ensaiar", "aprendendo"],
    })
      .notNull()
      .default("aprendendo"),
    updatedAt: updatedAt(),
  },
  (t) => ({
    uniqSongMember: uniqueIndex("uniq_song_member").on(t.songId, t.memberId),
  }),
);

// Feedback POR MÚSICA de um show (marcação da banda — qualquer um edita).
// Alimenta o aprendizado: o que bombou/caiu por casa, pra sugerir em casas de
// perfil parecido. Uma linha por (show, música).
export const showSongFeedback = sqliteTable(
  "show_song_feedback",
  {
    id: id(),
    showId: text("show_id")
      .notNull()
      .references(() => shows.id, { onDelete: "cascade" }),
    songId: text("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    publicoCurtiu: integer("publico_curtiu", { mode: "boolean" }).notNull().default(false),
    bandaCurtiu: integer("banda_curtiu", { mode: "boolean" }).notNull().default(false),
    caiu: integer("caiu", { mode: "boolean" }).notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => ({
    uniqShowSong: uniqueIndex("uniq_show_song_feedback").on(t.showId, t.songId),
  }),
);

// Token OAuth da Spotify (singleton — uma conta conectada para toda a banda)
export const spotifyAuth = sqliteTable("spotify_auth", {
  id: id(),
  refreshToken: text("refresh_token").notNull(),
  scope: text("scope"),
  ownerDisplayName: text("owner_display_name"),
  updatedAt: updatedAt(),
});

// Indisponibilidade de membros — datas em que não podem tocar
export const memberUnavailability = sqliteTable("member_unavailability", {
  id: id(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  dataInicio: integer("data_inicio", { mode: "timestamp_ms" }).notNull(),
  dataFim: integer("data_fim", { mode: "timestamp_ms" }).notNull(),
  horaInicio: text("hora_inicio"), // HH:mm — opcional
  horaFim: text("hora_fim"), // HH:mm — opcional
  motivo: text("motivo"),
  createdAt: createdAt(),
});

// Proposta/contrato simples por show — markdown editável, copiável e imprimível
export const showPropostas = sqliteTable("show_propostas", {
  id: id(),
  showId: text("show_id")
    .notNull()
    .unique()
    .references(() => shows.id, { onDelete: "cascade" }),
  corpoMarkdown: text("corpo_markdown").notNull(),
  updatedAt: updatedAt(),
});

// ---------------- CHECKLISTS ----------------

export const checklistTemplates = sqliteTable("checklist_templates", {
  id: id(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  createdAt: createdAt(),
});

export const checklistTemplateItems = sqliteTable("checklist_template_items", {
  id: id(),
  templateId: text("template_id")
    .notNull()
    .references(() => checklistTemplates.id, { onDelete: "cascade" }),
  texto: text("texto").notNull(),
  ordem: integer("ordem").notNull(),
});

export const showChecklists = sqliteTable("show_checklists", {
  id: id(),
  showId: text("show_id")
    .notNull()
    .references(() => shows.id, { onDelete: "cascade" }),
  templateId: text("template_id").references(() => checklistTemplates.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
});

export const showChecklistItems = sqliteTable("show_checklist_items", {
  id: id(),
  showChecklistId: text("show_checklist_id")
    .notNull()
    .references(() => showChecklists.id, { onDelete: "cascade" }),
  texto: text("texto").notNull(),
  ordem: integer("ordem").notNull(),
  concluido: integer("concluido", { mode: "boolean" }).notNull().default(false),
  responsavelMemberId: text("responsavel_member_id").references(
    () => members.id,
    {
      onDelete: "set null",
    },
  ),
  concluidoEm: integer("concluido_em", { mode: "timestamp_ms" }),
});

// ---------------- SHOW DAY TASKS ----------------

export const showDayTasks = sqliteTable("show_day_tasks", {
  id: id(),
  showId: text("show_id")
    .notNull()
    .references(() => shows.id, { onDelete: "cascade" }),
  horario: text("horario"), // HH:mm
  descricao: text("descricao").notNull(),
  ordem: integer("ordem").notNull(),
  concluido: integer("concluido", { mode: "boolean" }).notNull().default(false),
});

// ---------------- COST CALCULATIONS ----------------

export const costCalculations = sqliteTable("cost_calculations", {
  id: id(),
  showId: text("show_id").references(() => shows.id, { onDelete: "set null" }),
  nomeCenario: text("nome_cenario").notNull(),
  transporte: integer("transporte").default(0), // centavos
  combustivel: integer("combustivel").default(0),
  equipamentoLogistica: integer("equipamento_logistica").default(0),
  ensaio: integer("ensaio").default(0),
  extras: integer("extras").default(0),
  margemSegurancaPct: real("margem_seguranca_pct").default(20),
  cacheMinimoCalc: integer("cache_minimo_calc").default(0),
  cacheRecomendadoCalc: integer("cache_recomendado_calc").default(0),
  createdAt: createdAt(),
});

// ---------------- CONTRACTS ----------------

export const contractTemplates = sqliteTable("contract_templates", {
  id: id(),
  nome: text("nome").notNull(),
  corpoMarkdown: text("corpo_markdown").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const contracts = sqliteTable("contracts", {
  id: id(),
  showId: text("show_id")
    .notNull()
    .references(() => shows.id, { onDelete: "cascade" }),
  templateId: text("template_id").references(() => contractTemplates.id, {
    onDelete: "set null",
  }),
  conteudoJson: text("conteudo_json"), // campos preenchidos serializados
  pdfPath: text("pdf_path"),
  geradoEm: createdAt(),
});

// ---------------- RELATIONS ----------------

export const showsRelations = relations(shows, ({ one, many }) => ({
  casa: one(venues, { fields: [shows.casaId], references: [venues.id] }),
  avaliacao: one(venueEvaluations, {
    fields: [shows.id],
    references: [venueEvaluations.showId],
  }),
  setlists: many(setlists),
  checklists: many(showChecklists),
  dayTasks: many(showDayTasks),
  contratos: many(contracts),
  calculos: many(costCalculations),
}));

export const venuesRelations = relations(venues, ({ many }) => ({
  shows: many(shows),
}));

export const setlistsRelations = relations(setlists, ({ one, many }) => ({
  show: one(shows, { fields: [setlists.showId], references: [shows.id] }),
  rehearsal: one(rehearsals, {
    fields: [setlists.rehearsalId],
    references: [rehearsals.id],
  }),
  items: many(setlistItems),
}));

export const rehearsalsRelations = relations(rehearsals, ({ one, many }) => ({
  show: one(shows, { fields: [rehearsals.showId], references: [shows.id] }),
  setlists: many(setlists),
}));

export const setlistItemsRelations = relations(setlistItems, ({ one }) => ({
  setlist: one(setlists, {
    fields: [setlistItems.setlistId],
    references: [setlists.id],
  }),
  song: one(songs, { fields: [setlistItems.songId], references: [songs.id] }),
}));

export const songsRelations = relations(songs, ({ many }) => ({
  setlistItems: many(setlistItems),
}));

export const checklistTemplatesRelations = relations(
  checklistTemplates,
  ({ many }) => ({
    items: many(checklistTemplateItems),
  }),
);

export const checklistTemplateItemsRelations = relations(
  checklistTemplateItems,
  ({ one }) => ({
    template: one(checklistTemplates, {
      fields: [checklistTemplateItems.templateId],
      references: [checklistTemplates.id],
    }),
  }),
);

export const showChecklistsRelations = relations(
  showChecklists,
  ({ one, many }) => ({
    show: one(shows, {
      fields: [showChecklists.showId],
      references: [shows.id],
    }),
    template: one(checklistTemplates, {
      fields: [showChecklists.templateId],
      references: [checklistTemplates.id],
    }),
    items: many(showChecklistItems),
  }),
);

export const showChecklistItemsRelations = relations(
  showChecklistItems,
  ({ one }) => ({
    checklist: one(showChecklists, {
      fields: [showChecklistItems.showChecklistId],
      references: [showChecklists.id],
    }),
    responsavel: one(members, {
      fields: [showChecklistItems.responsavelMemberId],
      references: [members.id],
    }),
  }),
);

export const showDayTasksRelations = relations(showDayTasks, ({ one }) => ({
  show: one(shows, { fields: [showDayTasks.showId], references: [shows.id] }),
}));

export const venueEvaluationsRelations = relations(
  venueEvaluations,
  ({ one }) => ({
    show: one(shows, {
      fields: [venueEvaluations.showId],
      references: [shows.id],
    }),
  }),
);

export const memberUnavailabilityRelations = relations(
  memberUnavailability,
  ({ one }) => ({
    member: one(members, {
      fields: [memberUnavailability.memberId],
      references: [members.id],
    }),
  }),
);

export const showMemberPresenceRelations = relations(
  showMemberPresence,
  ({ one }) => ({
    show: one(shows, {
      fields: [showMemberPresence.showId],
      references: [shows.id],
    }),
    member: one(members, {
      fields: [showMemberPresence.memberId],
      references: [members.id],
    }),
  }),
);

export const membersRelations = relations(members, ({ one, many }) => ({
  user: one(users, { fields: [members.userId], references: [users.id] }),
  unavailability: many(memberUnavailability),
  presences: many(showMemberPresence),
}));

export const usersRelations = relations(users, ({ one }) => ({
  member: one(members, { fields: [users.id], references: [members.userId] }),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  show: one(shows, { fields: [contracts.showId], references: [shows.id] }),
  template: one(contractTemplates, {
    fields: [contracts.templateId],
    references: [contractTemplates.id],
  }),
}));

// ---------------- GASTOS (DESPESAS DA BANDA) ----------------

// Investimentos/gastos da banda: equipamento, transporte, divulgação, etc.
// O dinheiro saiu do caixa da banda (ou via PIX direto). Comprovante opcional
// na real, mas mantido como obrigatório pra auditoria.
export const gastos = sqliteTable("gastos", {
  id: id(),
  tipo: text("tipo", { enum: ["show", "extra"] }).notNull(),
  showId: text("show_id").references(() => shows.id, { onDelete: "set null" }),
  descricao: text("descricao").notNull(),
  recipient: text("recipient").notNull(), // pra quem foi (loja, fornecedor...)
  valorCentavos: integer("valor_centavos").notNull(),
  comprovante: text("comprovante").notNull(), // data URL — obrigatório
  paidEm: integer("paid_em", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  createdAt: createdAt(),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
});

// ---------------- REEMBOLSOS (BANDA -> MÚSICO) ----------------

// Quando um músico bancou um gasto e a banda reembolsa. Tem o mesmo
// ciclo de confirmação do cachê: aguardando -> confirmado.
export const reembolsos = sqliteTable("reembolsos", {
  id: id(),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  gastoId: text("gasto_id").references(() => gastos.id, { onDelete: "set null" }),
  descricao: text("descricao").notNull(),
  valorCentavos: integer("valor_centavos").notNull(),
  comprovante: text("comprovante").notNull(),
  status: text("status", { enum: ["aguardando", "confirmado"] })
    .notNull()
    .default("aguardando"),
  paidEm: integer("paid_em", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
  confirmadoEm: integer("confirmado_em", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
});

// ---------------- LINKS PARA CONTRATANTES (PÚBLICOS) ----------------

// Link público, com expiração, pra mostrar press kit + vídeos pra um
// contratante interessado. Acessado sem login via /c/{token}.
export const contractorLinks = sqliteTable("contractor_links", {
  id: id(),
  token: text("token").notNull().unique(),
  label: text("label"), // ex.: "Bar do Zé — orçamento jun/2026"
  expiresEm: integer("expires_em", { mode: "timestamp_ms" }).notNull(),
  revokedEm: integer("revoked_em", { mode: "timestamp_ms" }),
  viewCount: integer("view_count").notNull().default(0),
  lastViewedEm: integer("last_viewed_em", { mode: "timestamp_ms" }),
  createdBy: text("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
});

// Visitas registradas pra cada link. Cada visita é uma linha (IP + UA +
// cidade aproximada). Não conta acessos do criador/admin (filtrados antes
// de gravar). Permite ver "X visitas, 3 dispositivos, última de BH".
export const contractorLinkVisits = sqliteTable("contractor_link_visits", {
  id: id(),
  linkId: text("link_id")
    .notNull()
    .references(() => contractorLinks.id, { onDelete: "cascade" }),
  ip: text("ip"),
  userAgent: text("user_agent"),
  city: text("city"),
  country: text("country"),
  visitedAt: integer("visited_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Visitas à página pública fixa /show. Sem token, sem expiração — link
// único pra todos os contratantes. Cada linha é uma visita anônima
// (admin/músico logado NÃO conta).
export const siteVisits = sqliteTable("site_visits", {
  id: id(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  city: text("city"),
  country: text("country"),
  visitedAt: integer("visited_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// ---------------- DIVULGAÇÃO / PRESS KIT ----------------

// Materiais de divulgação: vídeos, fotos, logo e press kit. Apenas links
// externos (Drive, Instagram, YouTube, PDF público).
export const promoItems = sqliteTable("promo_items", {
  id: id(),
  tipo: text("tipo", {
    enum: ["video", "foto", "logo", "presskit", "rider", "instagram"],
  }).notNull(),
  titulo: text("titulo").notNull(),
  url: text("url").notNull(),
  descricao: text("descricao"),
  // capa custom (data URL) — usada hoje só pra vídeos no card do contratante
  cover: text("cover"),
  ordem: integer("ordem").notNull().default(0),
  // "Enviar sempre": material incluído automaticamente em toda divulgação
  // pras casas (ex.: teaser principal, press kit), mesmo sem seleção manual.
  obrigatorio: integer("obrigatorio", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: createdAt(),
});

// ---------------- ANÚNCIOS (MURAL DA BANDA) ----------------

// Avisos internos da banda, mostrados em destaque no painel pra todos.
// Ex.: "5 músicas novas no repertório", "ensaio extra sábado". Admin cria/apaga.
// O disparo no WhatsApp é opcional e feito na hora (não persiste aqui).
export const announcements = sqliteTable("announcements", {
  id: id(),
  titulo: text("titulo").notNull(),
  corpo: text("corpo"),
  createdById: text("created_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: createdAt(),
});

export const announcementsRelations = relations(announcements, ({ one }) => ({
  autor: one(users, {
    fields: [announcements.createdById],
    references: [users.id],
  }),
}));

// Preferências fixas da banda pra geração de setlist (singleton). Texto livre
// que a IA sempre obedece (ex.: "guardar catarse pro final", "não abrir lenta").
export const bandSetlistPrefs = sqliteTable("band_setlist_prefs", {
  id: id(),
  regras: text("regras"),
  updatedAt: updatedAt(),
});

// ---------------- POSIÇÕES DA BANDA (customizáveis) ----------------

// Posições/instrumentos da banda, geridas pelo admin (add Tecladista, Gaita…).
// Substitui a const fixa POSICOES (que vira só seed/fallback). Vários músicos
// podem ter a mesma posição (sem regra de slot único).
export const bandPositions = sqliteTable("band_positions", {
  id: id(),
  nome: text("nome").notNull(),
  ordem: integer("ordem").notNull().default(0),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

// ---------------- TYPES ----------------

export type User = typeof users.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type Song = typeof songs.$inferSelect;
export type Setlist = typeof setlists.$inferSelect;
export type SetlistItem = typeof setlistItems.$inferSelect;
export type Show = typeof shows.$inferSelect;
export type VenueEvaluation = typeof venueEvaluations.$inferSelect;
export type ShowSongFeedback = typeof showSongFeedback.$inferSelect;
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type ChecklistTemplateItem = typeof checklistTemplateItems.$inferSelect;
export type ShowChecklist = typeof showChecklists.$inferSelect;
export type ShowChecklistItem = typeof showChecklistItems.$inferSelect;
export type ShowDayTask = typeof showDayTasks.$inferSelect;
export type CostCalculation = typeof costCalculations.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type ShowProposta = typeof showPropostas.$inferSelect;
export type MemberUnavailability = typeof memberUnavailability.$inferSelect;
export type Rehearsal = typeof rehearsals.$inferSelect;
export type RehearsalMemberPresence = typeof rehearsalMemberPresence.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;
export type InviteToken = typeof inviteTokens.$inferSelect;
export type ShowMemberPresence = typeof showMemberPresence.$inferSelect;
export type SpotifyAuth = typeof spotifyAuth.$inferSelect;
export type SongMemberReadiness = typeof songMemberReadiness.$inferSelect;
export type ShowMemberPayment = typeof showMemberPayment.$inferSelect;
export type ShowMemberPaid = typeof showMemberPaid.$inferSelect;
export type Gasto = typeof gastos.$inferSelect;
export type Reembolso = typeof reembolsos.$inferSelect;
export type Equipamento = typeof equipamentos.$inferSelect;
export type ImagemDivulgacao = typeof imagensDivulgacao.$inferSelect;
export type ContractorLink = typeof contractorLinks.$inferSelect;
export type ContractorLinkVisit = typeof contractorLinkVisits.$inferSelect;
export type SiteVisit = typeof siteVisits.$inferSelect;
export type PromoItem = typeof promoItems.$inferSelect;
export type Announcement = typeof announcements.$inferSelect;
export type BandPosition = typeof bandPositions.$inferSelect;
export type BandSetlistPrefs = typeof bandSetlistPrefs.$inferSelect;
export type VenueContact = typeof venueContacts.$inferSelect;
