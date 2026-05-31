export const TIPO_LABEL: Record<string, string> = {
  mesa_som: "Mesa de som",
  pa: "PA / Caixas",
  retorno_palco: "Retorno de palco",
  in_ear: "In-Ear",
  microfone: "Microfone",
  periferico: "Periférico",
  outro: "Outro",
};

export const TIPOS = [
  "mesa_som",
  "pa",
  "retorno_palco",
  "in_ear",
  "microfone",
  "periferico",
  "outro",
] as const;

// Dicionário de itens comuns em banda de rock de bar — cadastro com 1 clique.
export const DICIONARIO: {
  nome: string;
  tipo: string;
  categoria: "individual" | "infraestrutura_coletiva";
}[] = [
  { nome: "Mesa Digital Behringer XR18", tipo: "mesa_som", categoria: "infraestrutura_coletiva" },
  { nome: "PA (caixas + subgrave)", tipo: "pa", categoria: "infraestrutura_coletiva" },
  { nome: "Caixa de Retorno Ativa", tipo: "retorno_palco", categoria: "infraestrutura_coletiva" },
  { nome: "Sistema In-Ear", tipo: "in_ear", categoria: "individual" },
  { nome: "Microfone Shure SM58", tipo: "microfone", categoria: "individual" },
  { nome: "Direct Box (DI)", tipo: "periferico", categoria: "infraestrutura_coletiva" },
];
