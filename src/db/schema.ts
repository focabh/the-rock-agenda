import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

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
  createdAt: createdAt(),
});

// ---------------- BAND MEMBERS ----------------

export const members = sqliteTable("members", {
  id: id(),
  nome: text("nome").notNull(),
  funcao: text("funcao").notNull(), // vocal, guitarra, baixo, bateria, etc.
  telefone: text("telefone"),
  equipamentos: text("equipamentos"),
  disponibilidade: text("disponibilidade"),
  percentualDivisao: real("percentual_divisao").default(0),
  observacoes: text("observacoes"),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  isManager: integer("is_manager", { mode: "boolean" }).notNull().default(false),
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
  updatedAt: updatedAt(),
});

// ---------------- VENUES (CASAS) ----------------

export const venues = sqliteTable("venues", {
  id: id(),
  nome: text("nome").notNull(),
  endereco: text("endereco"),
  cidade: text("cidade"),
  bairro: text("bairro"),
  contatoPrincipal: text("contato_principal"),
  telefone: text("telefone"),
  observacoes: text("observacoes"),
  ativo: integer("ativo", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------- SONGS (REPERTÓRIO) ----------------

export const songs = sqliteTable("songs", {
  id: id(),
  titulo: text("titulo").notNull(),
  artista: text("artista").notNull(),
  status: text("status", {
    enum: ["pronta", "precisa_ensaiar", "aprendendo", "ideia_futura", "aposentada"],
  })
    .notNull()
    .default("aprendendo"),
  favorita: integer("favorita", { mode: "boolean" }).notNull().default(false),
  observacoes: text("observacoes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---------------- SETLISTS ----------------

export const setlists = sqliteTable("setlists", {
  id: id(),
  nome: text("nome").notNull(),
  showId: text("show_id").references(() => shows.id, { onDelete: "set null" }),
  duracaoEstimadaSeg: integer("duracao_estimada_seg").default(0),
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
});

// ---------------- SHOWS ----------------

export const shows = sqliteTable("shows", {
  id: id(),
  casaId: text("casa_id")
    .notNull()
    .references(() => venues.id, { onDelete: "restrict" }),
  data: integer("data", { mode: "timestamp_ms" }).notNull(),
  inicio: text("inicio"), // HH:mm
  termino: text("termino"), // HH:mm
  contatoNome: text("contato_nome"),
  contatoTelefone: text("contato_telefone"),
  cacheCentavos: integer("cache_centavos").default(0), // valor em centavos
  pagamentoStatus: text("pagamento_status", {
    enum: ["pendente", "parcial", "pago", "atrasado"],
  })
    .notNull()
    .default("pendente"),
  passagemSom: text("passagem_som"), // HH:mm
  publicoEsperado: integer("publico_esperado"),
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
      t.memberId
    ),
  })
);

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
  })
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
  responsavelMemberId: text("responsavel_member_id").references(() => members.id, {
    onDelete: "set null",
  }),
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
  items: many(setlistItems),
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
  })
);

export const checklistTemplateItemsRelations = relations(
  checklistTemplateItems,
  ({ one }) => ({
    template: one(checklistTemplates, {
      fields: [checklistTemplateItems.templateId],
      references: [checklistTemplates.id],
    }),
  })
);

export const showChecklistsRelations = relations(showChecklists, ({ one, many }) => ({
  show: one(shows, { fields: [showChecklists.showId], references: [shows.id] }),
  template: one(checklistTemplates, {
    fields: [showChecklists.templateId],
    references: [checklistTemplates.id],
  }),
  items: many(showChecklistItems),
}));

export const showChecklistItemsRelations = relations(showChecklistItems, ({ one }) => ({
  checklist: one(showChecklists, {
    fields: [showChecklistItems.showChecklistId],
    references: [showChecklists.id],
  }),
  responsavel: one(members, {
    fields: [showChecklistItems.responsavelMemberId],
    references: [members.id],
  }),
}));

export const showDayTasksRelations = relations(showDayTasks, ({ one }) => ({
  show: one(shows, { fields: [showDayTasks.showId], references: [shows.id] }),
}));

export const venueEvaluationsRelations = relations(venueEvaluations, ({ one }) => ({
  show: one(shows, { fields: [venueEvaluations.showId], references: [shows.id] }),
}));

export const memberUnavailabilityRelations = relations(
  memberUnavailability,
  ({ one }) => ({
    member: one(members, {
      fields: [memberUnavailability.memberId],
      references: [members.id],
    }),
  })
);

export const showMemberPresenceRelations = relations(showMemberPresence, ({ one }) => ({
  show: one(shows, { fields: [showMemberPresence.showId], references: [shows.id] }),
  member: one(members, {
    fields: [showMemberPresence.memberId],
    references: [members.id],
  }),
}));

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

// ---------------- TYPES ----------------

export type User = typeof users.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Venue = typeof venues.$inferSelect;
export type Song = typeof songs.$inferSelect;
export type Setlist = typeof setlists.$inferSelect;
export type SetlistItem = typeof setlistItems.$inferSelect;
export type Show = typeof shows.$inferSelect;
export type VenueEvaluation = typeof venueEvaluations.$inferSelect;
export type ChecklistTemplate = typeof checklistTemplates.$inferSelect;
export type ShowChecklist = typeof showChecklists.$inferSelect;
export type ShowDayTask = typeof showDayTasks.$inferSelect;
export type CostCalculation = typeof costCalculations.$inferSelect;
export type Contract = typeof contracts.$inferSelect;
export type ShowProposta = typeof showPropostas.$inferSelect;
export type MemberUnavailability = typeof memberUnavailability.$inferSelect;
export type ShowMemberPresence = typeof showMemberPresence.$inferSelect;
export type SpotifyAuth = typeof spotifyAuth.$inferSelect;
export type SongMemberReadiness = typeof songMemberReadiness.$inferSelect;
export type ShowMemberPayment = typeof showMemberPayment.$inferSelect;
