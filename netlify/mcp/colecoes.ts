// ---------------------------------------------------------------------------
// Coleções que o Claude pode usar e o formato de cada uma.
// Os campos seguem o que os módulos do app gravam (src/components/*Module.tsx,
// src/types.ts, src/eventosUtils.ts, src/reembolsosUtils.ts, src/cotacoesUtils.ts).
// ---------------------------------------------------------------------------
import { TIPOS_EVENTO, STATUS_EVENTO } from "../../src/eventosUtils.ts";

type TipoCampo = "texto" | "numero" | "data" | "hora" | "booleano" | "lista" | "objeto" | "iso";

export interface Campo {
  tipo: TipoCampo;
  obrigatorio?: boolean;
  opcoes?: readonly string[];
  padrao?: any;
  min?: number;
  max?: number;
  desc?: string;
}

export interface Colecao {
  nome: string;
  modulo: string;          // nome do módulo no app
  descricao: string;
  escrita: boolean;        // false = só leitura pelo Claude
  campos: Record<string, Campo>;
}

const CATEGORIAS_DESPESA = ["Compras", "Transporte", "Serviços", "Manutenção", "Eventos", "Outros"];

export const COLECOES: Record<string, Colecao> = {
  equipe: {
    nome: "equipe", modulo: "Equipe", escrita: true,
    descricao: "Colaboradores da casa.",
    campos: {
      nome: { tipo: "texto", obrigatorio: true },
      cargo: { tipo: "texto", padrao: "", desc: "ex.: Garçom, Cozinheiro, Bartender" },
      pontuacao: { tipo: "numero", min: 1, max: 10, padrao: 10, desc: "nota de 1 a 10" },
      situacaoAtual: { tipo: "texto", padrao: "", desc: "observação sobre o momento do colaborador" },
      status: { tipo: "texto", opcoes: ["Ativo", "Suspenso", "Desligado"], padrao: "Ativo" },
    },
  },
  eventos: {
    nome: "eventos", modulo: "Planejador de Eventos", escrita: true,
    descricao: "Eventos e reservas de grupo, com checklist de tarefas embutido (campo tarefas). Ao criar, o checklist do modelo é gerado automaticamente a partir de tipo e formato. Para marcar ou incluir tarefas use evento_marcar_tarefa e evento_adicionar_tarefa.",
    campos: {
      nome: { tipo: "texto", obrigatorio: true },
      data: { tipo: "data", obrigatorio: true },
      tipo: { tipo: "texto", opcoes: TIPOS_EVENTO, padrao: "Aniversário" },
      formato: { tipo: "texto", opcoes: ["Exclusivo", "Reserva"], padrao: "Reserva", desc: "Exclusivo = casa fechada; Reserva = grupo com a casa aberta" },
      status: { tipo: "texto", opcoes: STATUS_EVENTO, padrao: "Confirmado" },
      horarioInicio: { tipo: "hora" },
      horarioFim: { tipo: "hora" },
      convidados: { tipo: "numero", min: 0 },
      espaco: { tipo: "texto" },
      clienteNome: { tipo: "texto" },
      clienteTelefone: { tipo: "texto" },
      clienteEmail: { tipo: "texto" },
      cardapio: { tipo: "texto" },
      bebidas: { tipo: "texto" },
      fornecedoresExternos: { tipo: "texto" },
      valorTotal: { tipo: "numero", min: 0 },
      valorPago: { tipo: "numero", min: 0 },
      responsavel: { tipo: "texto" },
      observacoes: { tipo: "texto" },
      tarefas: { tipo: "lista", desc: "gerado automaticamente; itens {id, titulo, prazoDias, responsavel?, feito, feitoPor?, feitoEm?}" },
    },
  },
  extras_semana: {
    nome: "extras_semana", modulo: "Extras (diárias)", escrita: true,
    descricao: "Diárias de extras (freelancers) por dia. Também entram no relatório de Reembolsos.",
    campos: {
      data: { tipo: "data", obrigatorio: true },
      nome: { tipo: "texto", obrigatorio: true },
      funcao: { tipo: "texto", obrigatorio: true, desc: "ex.: Garçom, ASG, Cumim" },
      valor: { tipo: "numero", obrigatorio: true, min: 0 },
      contato: { tipo: "texto", padrao: "" },
      motivo: { tipo: "texto", padrao: "" },
      statusPagamento: { tipo: "texto", opcoes: ["A Pagar", "Pago"], padrao: "A Pagar" },
      enviadoFinanceiroEm: { tipo: "iso", padrao: null, desc: "data ISO em que foi enviada ao financeiro; null = ainda não enviada" },
    },
  },
  reembolsos: {
    nome: "reembolsos", modulo: "Reembolsos", escrita: true,
    descricao: "Despesas pagas do próprio bolso para reembolso (as diárias vêm de extras_semana). Comprovante com foto só pelo app.",
    campos: {
      data: { tipo: "data", obrigatorio: true },
      descricao: { tipo: "texto", obrigatorio: true },
      valor: { tipo: "numero", obrigatorio: true, min: 0 },
      categoria: { tipo: "texto", opcoes: CATEGORIAS_DESPESA, padrao: "Outros" },
      pagoPor: { tipo: "texto", padrao: "Amauri" },
      observacao: { tipo: "texto", padrao: "" },
      temComprovante: { tipo: "booleano", padrao: false },
      enviadoFinanceiroEm: { tipo: "iso", padrao: null, desc: "data ISO de envio ao financeiro; null = pendente" },
    },
  },
  rotina_tarefas: {
    nome: "rotina_tarefas", modulo: "Meu Dia (rotina)", escrita: true,
    descricao: "Tarefas recorrentes da gerência. Para marcar como feita use rotina_marcar.",
    campos: {
      titulo: { tipo: "texto", obrigatorio: true },
      frequencia: { tipo: "texto", obrigatorio: true, opcoes: ["diaria", "semanal", "mensal"] },
      diaSemana: { tipo: "numero", min: 0, max: 6, desc: "só para semanal: 0 = domingo ... 6 = sábado" },
      diaMes: { tipo: "numero", min: 1, max: 31, desc: "só para mensal" },
      horario: { tipo: "hora", padrao: "" },
      responsavel: { tipo: "texto", padrao: "" },
      ativo: { tipo: "booleano", padrao: true },
    },
  },
  rotina_execucoes: {
    nome: "rotina_execucoes", modulo: "Meu Dia (rotina)", escrita: false,
    descricao: "Registro de tarefas da rotina já feitas (ID = tarefaId_AAAA-MM-DD). Gravar com rotina_marcar.",
    campos: {
      tarefaId: { tipo: "texto" }, data: { tipo: "data" }, feitoPor: { tipo: "texto" }, feitoEm: { tipo: "iso" },
    },
  },
  checklist_gerencial: {
    nome: "checklist_gerencial", modulo: "Checklist gerencial", escrita: true,
    descricao: "Tarefas avulsas da gerência (a 'Caixa de entrada' do Meu Dia também fica aqui).",
    campos: {
      tarefa: { tipo: "texto", obrigatorio: true },
      categoria: { tipo: "texto", padrao: "Caixa de entrada" },
      status: { tipo: "texto", opcoes: ["Pendente", "Em Andamento", "Concluído"], padrao: "Pendente" },
      prioridade: { tipo: "texto", opcoes: ["Baixa", "Média", "Alta"], padrao: "Média" },
      responsavel: { tipo: "texto" },
      dataLimite: { tipo: "data" },
      link: { tipo: "texto" },
      observacoes: { tipo: "texto" },
    },
  },
  fornecedores: {
    nome: "fornecedores", modulo: "Cotações", escrita: true,
    descricao: "Fornecedores usados nas cotações.",
    campos: {
      nome: { tipo: "texto", obrigatorio: true },
      whatsapp: { tipo: "texto", desc: "só números, com DDD" },
      pedidoMinimo: { tipo: "numero", min: 0 },
      diasEntrega: { tipo: "texto" },
      obs: { tipo: "texto" },
    },
  },
  produtos_compra: {
    nome: "produtos_compra", modulo: "Cotações", escrita: true,
    descricao: "Catálogo de produtos comprados. O preço é comparado por unidade-base (KG, L ou UN).",
    campos: {
      nome: { tipo: "texto", obrigatorio: true },
      unidadeBase: { tipo: "texto", obrigatorio: true, opcoes: ["KG", "L", "UN"] },
      categoria: { tipo: "texto" },
      fornecedorIds: { tipo: "lista", padrao: [] },
      aliases: { tipo: "lista" },
      precoReferencia: { tipo: "numero", min: 0 },
    },
  },
  cotacoes: {
    nome: "cotacoes", modulo: "Cotações", escrita: true,
    descricao: "Preço cotado de um produto em um fornecedor. preco = valor da embalagem; conteudo = quantas unidades-base vêm na embalagem (ex.: caixa com 12 UN -> 12; saco de 5 kg -> 5). Ao criar, o fornecedor é ligado ao produto automaticamente.",
    campos: {
      produtoId: { tipo: "texto", obrigatorio: true },
      fornecedorId: { tipo: "texto", obrigatorio: true },
      preco: { tipo: "numero", obrigatorio: true, min: 0 },
      conteudo: { tipo: "numero", min: 0, padrao: 1 },
      descricaoOriginal: { tipo: "texto" },
      origem: { tipo: "texto", opcoes: ["whatsapp", "pdf", "planilha", "site", "manual"], padrao: "manual" },
      data: { tipo: "iso", desc: "data da cotação; aceita AAAA-MM-DD (padrão: hoje)" },
    },
  },
  agenda_eventos: {
    nome: "agenda_eventos", modulo: "Agenda (atrações)", escrita: true,
    descricao: "Agenda de atrações: música ao vivo, DJ, transmissões.",
    campos: {
      data: { tipo: "data", obrigatorio: true },
      artistaNome: { tipo: "texto", obrigatorio: true },
      tipoEvento: { tipo: "texto", opcoes: ["Música ao Vivo", "DJ", "Transmissão Esportiva", "Evento Fechado", "Outros"], padrao: "Música ao Vivo" },
      horarioPassagemSom: { tipo: "hora", padrao: "" },
      horarioInicio: { tipo: "hora", padrao: "" },
      horarioTermino: { tipo: "hora", padrao: "" },
      cacheCusto: { tipo: "numero", min: 0, padrao: 0 },
      necessidadesTecnicas: { tipo: "texto", padrao: "" },
      chavePix: { tipo: "texto", padrao: "" },
      status: { tipo: "texto", opcoes: ["A Confirmar", "Confirmado", "Cancelado"], padrao: "A Confirmar" },
    },
  },
  ocorrencias: {
    nome: "ocorrencias", modulo: "Ocorrências", escrita: true,
    descricao: "Ocorrências do dia a dia (faltas, problemas de sistema, clientes).",
    campos: {
      data: { tipo: "data", obrigatorio: true },
      categoria: { tipo: "texto", opcoes: ["Sistema", "Funcionários", "Logística", "Falta", "Atestados", "Cliente"], padrao: "Sistema" },
      descricaoDetalhada: { tipo: "texto", obrigatorio: true },
      responsavelResolucao: { tipo: "texto", padrao: "" },
      funcionarioEnvolvidoId: { tipo: "texto", desc: "ID do colaborador em equipe" },
      status: { tipo: "texto", opcoes: ["Aberto", "Resolvido"], padrao: "Aberto" },
    },
  },
  manutencao_reparos: {
    nome: "manutencao_reparos", modulo: "Manutenção", escrita: true,
    descricao: "Reparos pendentes na casa.",
    campos: {
      item: { tipo: "texto", obrigatorio: true },
      local: { tipo: "texto", padrao: "" },
      prioridade: { tipo: "texto", opcoes: ["Baixa", "Média", "Urgente"], padrao: "Média" },
      status: { tipo: "texto", opcoes: ["Pendente", "Em Andamento", "Resolvido"], padrao: "Pendente" },
    },
  },
  contatos: {
    nome: "contatos", modulo: "Contatos", escrita: true,
    descricao: "Agenda de contatos (músicos, extras, prestadores).",
    campos: {
      nome: { tipo: "texto", obrigatorio: true },
      categoria: { tipo: "texto", opcoes: ["Músicos", "Extras", "Prestador de Serviços", "Hotel", "Outros"], padrao: "Outros" },
      telefone: { tipo: "texto", padrao: "" },
      detalhes: { tipo: "texto" },
    },
  },
  requisicoes: {
    nome: "requisicoes", modulo: "Gestão de Compras", escrita: false,
    descricao: "Requisições de compra da cozinha, do bar e da limpeza (só leitura pelo Claude; aprovar pelo app).",
    campos: {},
  },
  briefings: {
    nome: "briefings", modulo: "Briefing do Turno", escrita: false,
    descricao: "Briefings do turno já montados (só leitura).",
    campos: {},
  },
};

export const NOMES_COLECOES = Object.keys(COLECOES);
export const COLECOES_ESCRITA = NOMES_COLECOES.filter(n => COLECOES[n].escrita);

// Texto curto com os campos de cada coleção (vai na descrição das ferramentas)
export const guiaCampos = (): string =>
  COLECOES_ESCRITA.map(n => {
    const c = COLECOES[n];
    const campos = Object.entries(c.campos).map(([k, f]) => {
      let s = k + (f.obrigatorio ? "*" : "");
      if (f.opcoes) s += ` (${f.opcoes.join("|")})`;
      else if (f.tipo === "data") s += " (AAAA-MM-DD)";
      else if (f.tipo === "hora") s += " (HH:MM)";
      else if (f.tipo === "numero") s += " (número)";
      return s;
    });
    return `- ${n}: ${campos.join(", ")}`;
  }).join("\n");

// ---- Validação ----
export class ErroValidacao extends Error {}

const reData = /^\d{4}-\d{2}-\d{2}$/;
const reHora = /^([01]\d|2[0-3]):[0-5]\d$/;

const converter = (nome: string, f: Campo, v: any): any => {
  if (v === null) {
    if (f.obrigatorio) throw new ErroValidacao(`O campo ${nome} é obrigatório.`);
    return null;
  }
  switch (f.tipo) {
    case "numero": {
      const n = typeof v === "number" ? v : Number(String(v).replace(/[R$\s]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."));
      if (!isFinite(n)) throw new ErroValidacao(`O campo ${nome} precisa ser um número.`);
      if (f.min !== undefined && n < f.min) throw new ErroValidacao(`O campo ${nome} deve ser no mínimo ${f.min}.`);
      if (f.max !== undefined && n > f.max) throw new ErroValidacao(`O campo ${nome} deve ser no máximo ${f.max}.`);
      return n;
    }
    case "booleano":
      if (typeof v === "boolean") return v;
      if (v === "true" || v === "sim") return true;
      if (v === "false" || v === "não" || v === "nao") return false;
      throw new ErroValidacao(`O campo ${nome} precisa ser verdadeiro ou falso.`);
    case "data":
      if (typeof v !== "string" || !reData.test(v)) throw new ErroValidacao(`O campo ${nome} precisa estar no formato AAAA-MM-DD.`);
      return v;
    case "hora":
      if (v === "") return "";
      if (typeof v !== "string" || !reHora.test(v)) throw new ErroValidacao(`O campo ${nome} precisa estar no formato HH:MM.`);
      return v;
    case "iso":
      if (typeof v !== "string" || isNaN(Date.parse(v))) throw new ErroValidacao(`O campo ${nome} precisa ser uma data válida.`);
      // AAAA-MM-DD vira meio-dia no horário local, como o app faz nas cotações
      return reData.test(v) ? new Date(v + "T12:00:00").toISOString() : new Date(v).toISOString();
    case "lista":
      if (!Array.isArray(v)) throw new ErroValidacao(`O campo ${nome} precisa ser uma lista.`);
      return v;
    case "objeto":
      if (typeof v !== "object" || Array.isArray(v)) throw new ErroValidacao(`O campo ${nome} precisa ser um objeto.`);
      return v;
    default: {
      const s = typeof v === "string" ? v.trim() : String(v);
      if (f.opcoes && !f.opcoes.includes(s)) {
        throw new ErroValidacao(`Valor inválido para ${nome}: "${s}". Opções: ${f.opcoes.join(", ")}.`);
      }
      return s;
    }
  }
};

const PROTEGIDOS = new Set(["id", "createdAt", "createdBy", "criadoVia"]);

// completo = criação (aplica padrões e obrigatórios); senão = atualização parcial
export const validar = (colecao: string, dados: Record<string, any>, completo: boolean): Record<string, any> => {
  const c = COLECOES[colecao];
  if (!c) throw new ErroValidacao(`Coleção desconhecida: ${colecao}.`);
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) throw new ErroValidacao("Os dados precisam ser um objeto.");
  const saida: Record<string, any> = {};
  for (const [k, v] of Object.entries(dados)) {
    if (PROTEGIDOS.has(k) || v === undefined) continue;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) throw new ErroValidacao(`Nome de campo inválido: ${k}`);
    const f = c.campos[k];
    saida[k] = f ? converter(k, f, v) : v; // campos extras passam como vieram
  }
  if (completo) {
    for (const [k, f] of Object.entries(c.campos)) {
      if (saida[k] === undefined && f.padrao !== undefined) saida[k] = Array.isArray(f.padrao) ? [...f.padrao] : f.padrao;
      if (f.obrigatorio && (saida[k] === undefined || saida[k] === "" || saida[k] === null)) {
        throw new ErroValidacao(`O campo ${k} é obrigatório em ${colecao}.`);
      }
    }
  }
  return saida;
};
