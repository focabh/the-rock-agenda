// Mensagens pré-preenchidas pro contato com as casas (editáveis antes de enviar).
// `tipo` casa com venue_contacts.tipo e dispara as automações de registro.

export type VenueMsgTipo =
  | "divulgacao"
  | "followup"
  | "agradecimento"
  | "nova_data"
  | "contato";

export type VenueMessageTemplate = {
  key: string;
  label: string;
  tipo: VenueMsgTipo;
  texto: string;
  /** Anexa os links de material da banda (vídeo, PDF, página) à mensagem. */
  incluiMaterial?: boolean;
};

export const VENUE_MESSAGES: VenueMessageTemplate[] = [
  {
    key: "divulgacao",
    label: "Divulgação inicial",
    tipo: "divulgacao",
    incluiMaterial: true,
    texto:
      "Fala, pessoal! Tudo bem? Aqui é o Foca, da banda The Rock. Somos uma banda de Belo Horizonte focada em rock alternativo dos anos 90 e 2000. Estou enviando nosso material para vocês conhecerem a banda. Bora conversar para marcar uma data?",
  },
  {
    key: "feedback",
    label: "Pedir feedback do material",
    tipo: "followup",
    texto:
      "Fala, pessoal! Tudo bem? Passando para saber se vocês conseguiram dar uma olhada no material da The Rock. A gente toca rock alternativo dos anos 90 e 2000 e seria muito legal marcar uma data com vocês.",
  },
  {
    key: "followup",
    label: "Follow-up após envio",
    tipo: "followup",
    texto:
      "Fala, pessoal! Tudo bem? Aqui é o Foca, da The Rock. Mandei nosso material há um tempo e queria saber se vocês conseguiram dar uma olhada. A gente gostaria muito de tocar aí. Bora tentar marcar uma data?",
  },
  {
    key: "agradecimento",
    label: "Agradecer após show",
    tipo: "agradecimento",
    texto:
      "Fala, pessoal! Passando aqui em nome de toda a banda The Rock para agradecer demais pela oportunidade de tocar na casa. Foi muito massa para a gente. Obrigado pela recepção e pela energia da galera. Esperamos voltar em breve.",
  },
  {
    key: "nova_data",
    label: "Marcar nova data",
    tipo: "nova_data",
    texto:
      "Fala, pessoal! Aqui é o Foca, da banda The Rock. A gente está com saudade de tocar aí de novo. Bora marcar uma nova data com a banda?",
  },
];

export const TIPO_LABEL: Record<VenueMsgTipo, string> = {
  divulgacao: "Divulgação",
  followup: "Follow-up",
  agradecimento: "Agradecimento",
  nova_data: "Marcar nova data",
  contato: "Contato",
};
