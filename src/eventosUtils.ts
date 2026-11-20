// ---------------------------------------------------------------------------
// Planejador de Eventos: modelos de checklist e cálculos (sem React).
// ---------------------------------------------------------------------------
import { dataLocal, parseDataLocal } from "./rotinaUtils";

export const TIPOS_EVENTO = [
  "Casamento", "Recepção de casamento", "Corporativo", "Confraternização", "Aniversário", "Outro",
] as const;
export type TipoEvento = typeof TIPOS_EVENTO[number];

export type FormatoEvento = "Exclusivo" | "Reserva";
export const FORMATOS: { id: FormatoEvento; nome: string; descricao: string }[] = [
  { id: "Exclusivo", nome: "Casa fechada (exclusivo)", descricao: "A casa fecha para o evento" },
  { id: "Reserva", nome: "Reserva de grupo", descricao: "Mesa ou área reservada com a casa aberta" },
];

export const STATUS_EVENTO = ["Orçamento", "Confirmado", "Realizado", "Cancelado"] as const;
export type StatusEvento = typeof STATUS_EVENTO[number];

export interface TarefaEvento {
  id: string;
  titulo: string;
  prazoDias: number; // dias em relação à data do evento (-7 = uma semana antes, 0 = no dia, 1 = dia seguinte)
  responsavel?: string;
  feito: boolean;
  feitoPor?: string;
  feitoEm?: string;
}

export interface Evento {
  id?: string;
  nome: string;
  tipo: TipoEvento;
  formato: FormatoEvento;
  status: StatusEvento;
  data: string;            // YYYY-MM-DD
  horarioInicio?: string;
  horarioFim?: string;
  convidados?: number;
  espaco?: string;
  clienteNome?: string;
  clienteTelefone?: string;
  clienteEmail?: string;
  cardapio?: string;
  bebidas?: string;
  fornecedoresExternos?: string;
  valorTotal?: number;
  valorPago?: number;
  responsavel?: string;
  observacoes?: string;
  tarefas: TarefaEvento[];
  createdAt?: string;
}

type Modelo = { titulo: string; prazoDias: number };

// ---- Casa fechada ----
const BASE_EXCLUSIVO: Modelo[] = [
  { titulo: "Enviar proposta e fechar valor com o cliente", prazoDias: -45 },
  { titulo: "Contrato assinado e sinal recebido", prazoDias: -30 },
  { titulo: "Bloquear a data: sem reservas e sem atração da casa", prazoDias: -30 },
  { titulo: "Definir cardápio e bebidas com o cliente", prazoDias: -21 },
  { titulo: "Definir layout do espaço e decoração (quem fornece o quê)", prazoDias: -21 },
  { titulo: "Confirmar fornecedores externos (som, decoração, bolo, foto)", prazoDias: -15 },
  { titulo: "Comunicar o fechamento da casa nas redes e no app de reservas", prazoDias: -14 },
  { titulo: "Fechar o número final de convidados", prazoDias: -10 },
  { titulo: "Escala da equipe e contratação de extras", prazoDias: -7 },
  { titulo: "Lançar a requisição de compras do evento", prazoDias: -7 },
  { titulo: "Receber o saldo restante do cliente", prazoDias: -5 },
  { titulo: "Enviar a ficha do evento para cozinha e bar (horários de serviço)", prazoDias: -3 },
  { titulo: "Reconfirmar horários com fornecedores e cliente", prazoDias: -2 },
  { titulo: "Briefing do evento com toda a equipe", prazoDias: -1 },
  { titulo: "Montagem e conferência do espaço", prazoDias: 0 },
  { titulo: "Receber fornecedores e testar o som", prazoDias: 0 },
  { titulo: "Pagar extras e fornecedores", prazoDias: 1 },
  { titulo: "Lançar o balanço do evento", prazoDias: 2 },
  { titulo: "Pedir feedback e avaliação ao cliente", prazoDias: 3 },
];

// ---- Reserva de grupo ----
const BASE_RESERVA: Modelo[] = [
  { titulo: "Confirmar número de pessoas, horário e área", prazoDias: -7 },
  { titulo: "Definir sinal ou garantia (se aplicável)", prazoDias: -5 },
  { titulo: "Definir se será cardápio fechado ou à la carte e avisar a cozinha", prazoDias: -3 },
  { titulo: "Reservar e planejar a montagem das mesas", prazoDias: -3 },
  { titulo: "Reconfirmar com o cliente", prazoDias: -1 },
  { titulo: "Incluir no Briefing do Turno", prazoDias: 0 },
  { titulo: "Montar as mesas antes da chegada", prazoDias: 0 },
  { titulo: "Agradecer o cliente e pedir avaliação", prazoDias: 1 },
];

const EXTRAS: Partial<Record<TipoEvento, { Exclusivo?: Modelo[]; Reserva?: Modelo[] }>> = {
  "Casamento": {
    Exclusivo: [
      { titulo: "Degustação com os noivos", prazoDias: -21 },
      { titulo: "Cronograma da cerimônia e da festa (entrada, brinde, bolo, valsa)", prazoDias: -7 },
      { titulo: "Alinhar com o cerimonialista (se houver)", prazoDias: -7 },
    ],
  },
  "Recepção de casamento": {
    Exclusivo: [
      { titulo: "Degustação com os noivos", prazoDias: -21 },
      { titulo: "Cronograma da recepção (chegada, brinde, bolo)", prazoDias: -7 },
      { titulo: "Alinhar com o cerimonialista (se houver)", prazoDias: -7 },
    ],
    Reserva: [{ titulo: "Combinar bolo, brinde e decoração com os noivos", prazoDias: -3 }],
  },
  "Corporativo": {
    Exclusivo: [
      { titulo: "Coletar dados da empresa para nota fiscal", prazoDias: -10 },
      { titulo: "Equipamentos: projetor, microfone, telão", prazoDias: -3 },
    ],
    Reserva: [{ titulo: "Coletar dados da empresa para nota fiscal", prazoDias: -3 }],
  },
  "Confraternização": {
    Exclusivo: [{ titulo: "Definir forma de pagamento (valor fechado ou por pessoa)", prazoDias: -10 }],
    Reserva: [{ titulo: "Definir divisão da conta (única ou individual)", prazoDias: -2 }],
  },
  "Aniversário": {
    Exclusivo: [{ titulo: "Bolo e decoração do cliente: horário de chegada e montagem", prazoDias: -3 }],
    Reserva: [{ titulo: "Bolo e decoração do cliente: horário de chegada e taxa de bolo", prazoDias: -2 }],
  },
};

const novoId = () => Math.random().toString(36).slice(2, 10);

export const gerarTarefas = (tipo: TipoEvento, formato: FormatoEvento): TarefaEvento[] => {
  const base = formato === "Exclusivo" ? BASE_EXCLUSIVO : BASE_RESERVA;
  const extras = EXTRAS[tipo]?.[formato] || [];
  return [...base, ...extras]
    .sort((a, b) => a.prazoDias - b.prazoDias)
    .map(m => ({ id: novoId(), titulo: m.titulo, prazoDias: m.prazoDias, feito: false }));
};

export const novaTarefa = (titulo: string, prazoDias: number, responsavel?: string): TarefaEvento =>
  ({ id: novoId(), titulo, prazoDias, responsavel, feito: false });

// Data limite da tarefa (YYYY-MM-DD)
export const dataDaTarefa = (dataEvento: string, prazoDias: number): string => {
  const d = parseDataLocal(dataEvento);
  d.setDate(d.getDate() + prazoDias);
  return dataLocal(d);
};

export const diasAte = (data: string, hoje: string = dataLocal()): number =>
  Math.round((parseDataLocal(data).getTime() - parseDataLocal(hoje).getTime()) / 86400000);

export const rotuloPrazo = (prazoDias: number): string => {
  if (prazoDias === 0) return "No dia";
  if (prazoDias < 0) return `${-prazoDias} dia${prazoDias === -1 ? "" : "s"} antes`;
  return `${prazoDias} dia${prazoDias === 1 ? "" : "s"} depois`;
};

export const rotuloContagem = (dias: number): string => {
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  if (dias === -1) return "Ontem";
  if (dias < 0) return `Há ${-dias} dias`;
  return `Em ${dias} dias`;
};

export interface ResumoEvento {
  total: number;
  feitas: number;
  atrasadas: TarefaEvento[];
  paraHoje: TarefaEvento[];
}

export const resumoEvento = (ev: Evento, hoje: string = dataLocal()): ResumoEvento => {
  const ativo = ev.status === "Orçamento" || ev.status === "Confirmado" || ev.status === "Realizado";
  const tarefas = ev.tarefas || [];
  const pend = ativo ? tarefas.filter(t => !t.feito) : [];
  return {
    total: tarefas.length,
    feitas: tarefas.filter(t => t.feito).length,
    atrasadas: pend.filter(t => dataDaTarefa(ev.data, t.prazoDias) < hoje),
    paraHoje: pend.filter(t => dataDaTarefa(ev.data, t.prazoDias) === hoje),
  };
};

export const formatBRL = (n?: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Linha usada no Briefing do Turno
export const linhaBriefing = (ev: Evento): string => {
  const partes = [
    ev.horarioInicio ? `${ev.horarioInicio}` : "",
    ev.nome,
    ev.convidados ? `${ev.convidados} pessoas` : "",
    ev.espaco || "",
    ev.formato === "Exclusivo" ? "CASA FECHADA" : "",
  ].filter(Boolean);
  return `• ${partes.join(" · ")}${ev.observacoes ? `\n  Obs.: ${ev.observacoes}` : ""}`;
};

// Mensagem de confirmação para o cliente
export const mensagemCliente = (ev: Evento): string => {
  const d = parseDataLocal(ev.data).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const linhas = [
    `Olá${ev.clienteNome ? `, ${ev.clienteNome.split(" ")[0]}` : ""}! Tudo bem?`,
    "",
    `Aqui é do Sea Rooftop. Passando para confirmar os detalhes do seu evento:`,
    "",
    `📅 ${d.charAt(0).toUpperCase() + d.slice(1)}${ev.horarioInicio ? `, a partir das ${ev.horarioInicio}` : ""}${ev.horarioFim ? ` até ${ev.horarioFim}` : ""}`,
  ];
  if (ev.convidados) linhas.push(`👥 ${ev.convidados} convidados`);
  if (ev.espaco) linhas.push(`📍 ${ev.espaco}`);
  if (ev.cardapio) linhas.push(`🍽️ ${ev.cardapio}`);
  const saldo = (ev.valorTotal || 0) - (ev.valorPago || 0);
  if (ev.valorTotal) linhas.push(`💳 Valor total: ${formatBRL(ev.valorTotal)}${saldo > 0 ? ` (saldo a pagar: ${formatBRL(saldo)})` : " (quitado)"}`);
  linhas.push("", "Qualquer ajuste, é só nos avisar por aqui. Será um prazer receber vocês!");
  return linhas.join("\n");
};
