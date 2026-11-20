// ---------------------------------------------------------------------------
// Rotina do gerente (Meu Dia): lógica pura, sem React.
// ---------------------------------------------------------------------------

export type Frequencia = "diaria" | "semanal" | "mensal";

export interface TarefaRotina {
  id?: string;
  titulo: string;
  frequencia: Frequencia;
  diaSemana?: number; // 0 = domingo ... 6 = sábado (semanal)
  diaMes?: number;    // 1..31 (mensal; se o mês for menor, vale o último dia)
  horario?: string;   // "HH:MM" (opcional, só para ordenar e lembrar)
  responsavel?: string;
  ativo?: boolean;
  createdAt?: string;
}

export interface ExecucaoRotina {
  id?: string;
  tarefaId: string;
  data: string; // data da ocorrência (YYYY-MM-DD)
  feitoPor?: string;
  feitoEm?: string;
  createdAt?: string;
}

export interface TarefaDoDia {
  tarefa: TarefaRotina;
  ocorrencia: string; // YYYY-MM-DD
  chave: string;      // id do documento de execução
  atrasada: boolean;
}

export const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const pad = (n: number) => String(n).padStart(2, "0");

// Data local (fuso do aparelho) no formato YYYY-MM-DD
export const dataLocal = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseDataLocal = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const ultimoDiaDoMes = (ano: number, mes: number) => new Date(ano, mes + 1, 0).getDate();

// Última ocorrência da tarefa que já chegou (<= hoje)
export const ultimaOcorrencia = (t: TarefaRotina, hoje: Date): Date => {
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (t.frequencia === "semanal") {
    const alvo = t.diaSemana ?? 1;
    const diff = (base.getDay() - alvo + 7) % 7;
    return new Date(base.getFullYear(), base.getMonth(), base.getDate() - diff);
  }
  if (t.frequencia === "mensal") {
    const alvo = t.diaMes ?? 1;
    const desteMes = Math.min(alvo, ultimoDiaDoMes(base.getFullYear(), base.getMonth()));
    if (base.getDate() >= desteMes) return new Date(base.getFullYear(), base.getMonth(), desteMes);
    const ano = base.getMonth() === 0 ? base.getFullYear() - 1 : base.getFullYear();
    const mes = base.getMonth() === 0 ? 11 : base.getMonth() - 1;
    return new Date(ano, mes, Math.min(alvo, ultimoDiaDoMes(ano, mes)));
  }
  return base;
};

export const chaveExecucao = (tarefaId: string, ocorrencia: string) => `${tarefaId}_${ocorrencia}`;

// Lista do que precisa ser feito hoje: tarefas de hoje + semanais/mensais que passaram e não foram feitas.
export const tarefasDoDia = (
  tarefas: TarefaRotina[],
  execucoesFeitas: Set<string>,
  hoje: Date = new Date()
): { pendentes: TarefaDoDia[]; feitas: TarefaDoDia[] } => {
  const hojeStr = dataLocal(hoje);
  const pendentes: TarefaDoDia[] = [];
  const feitas: TarefaDoDia[] = [];

  for (const t of tarefas) {
    if (!t.id || t.ativo === false) continue;
    const occ = dataLocal(ultimaOcorrencia(t, hoje));
    // não cobra atraso de antes da tarefa existir
    const criada = t.createdAt ? dataLocal(new Date(t.createdAt)) : occ;
    if (occ < hojeStr && occ < criada) continue;

    const chave = chaveExecucao(t.id, occ);
    const item: TarefaDoDia = { tarefa: t, ocorrencia: occ, chave, atrasada: occ < hojeStr };
    if (execucoesFeitas.has(chave)) {
      // feita: aparece como concluída só no dia da ocorrência; depois some até a próxima
      if (occ === hojeStr) feitas.push(item);
    } else {
      pendentes.push(item);
    }
  }

  const ordem = (a: TarefaDoDia, b: TarefaDoDia) => {
    if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
    return (a.tarefa.horario || "99:99").localeCompare(b.tarefa.horario || "99:99");
  };
  pendentes.sort(ordem);
  feitas.sort(ordem);
  return { pendentes, feitas };
};

export const descreverFrequencia = (t: TarefaRotina): string => {
  if (t.frequencia === "semanal") return `Toda ${DIAS_SEMANA[t.diaSemana ?? 1].toLowerCase()}`;
  if (t.frequencia === "mensal") return `Todo dia ${t.diaMes ?? 1}`;
  return "Todo dia";
};

// Rotina sugerida para a gerência do Sea Rooftop (pode editar/apagar depois)
export const ROTINA_SUGERIDA: Omit<TarefaRotina, "id" | "createdAt">[] = [
  // Diárias (turno começa por volta das 14h)
  { titulo: "Ler ocorrências e recados do turno anterior", frequencia: "diaria", horario: "14:00" },
  { titulo: "Aprovar requisições de compra da cozinha e do bar", frequencia: "diaria", horario: "14:30" },
  { titulo: "Mandar pedidos e cobrar fornecedores que não responderam a cotação", frequencia: "diaria", horario: "15:00" },
  { titulo: "Ronda de abertura: salão, banheiros, bar e cozinha", frequencia: "diaria", horario: "16:30" },
  { titulo: "Enviar o Briefing do Turno no grupo da equipe", frequencia: "diaria", horario: "17:00" },
  { titulo: "Conferir as reservas do dia com o caixa", frequencia: "diaria", horario: "17:30" },
  { titulo: "Conferir fechamento: checklist dos setores e caixa", frequencia: "diaria", horario: "23:30" },
  // Semanais
  { titulo: "Lançar vendas e entradas da semana nas planilhas", frequencia: "semanal", diaSemana: 1, horario: "14:30" },
  { titulo: "Analisar os KPIs da semana (vendas, ticket médio, CMV)", frequencia: "semanal", diaSemana: 1, horario: "15:30" },
  { titulo: "Relatório da nutricionista: transformar cada falha em tarefa com dono", frequencia: "semanal", diaSemana: 2, horario: "15:00" },
  { titulo: "Revisar a manutenção pendente e cobrar os prestadores", frequencia: "semanal", diaSemana: 2, horario: "16:00" },
  { titulo: "Treinamento rápido com a equipe (15 min antes do serviço)", frequencia: "semanal", diaSemana: 3, horario: "17:00" },
  { titulo: "Conferir a escala e os extras do fim de semana", frequencia: "semanal", diaSemana: 4, horario: "15:00" },
  { titulo: "Revisar com o salão as metas de venda da semana", frequencia: "semanal", diaSemana: 5, horario: "17:00" },
  // Mensais
  { titulo: "Analisar o resultado do mês anterior (KPIs e CMV)", frequencia: "mensal", diaMes: 2, horario: "15:00" },
  { titulo: "Balanço de estoque de todos os setores (PrecificAI)", frequencia: "mensal", diaMes: 5, horario: "14:00" },
  { titulo: "Parte fiscal: enviar notas e documentos para a contabilidade", frequencia: "mensal", diaMes: 5, horario: "16:00" },
  { titulo: "Fechar a agenda de músicos do próximo mês", frequencia: "mensal", diaMes: 20, horario: "15:00" },
];
