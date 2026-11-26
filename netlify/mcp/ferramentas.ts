// ---------------------------------------------------------------------------
// Ferramentas MCP do Command Center.
// ---------------------------------------------------------------------------
import { db, Sessao } from "./firestore.ts";
import { COLECOES, NOMES_COLECOES, COLECOES_ESCRITA, guiaCampos, validar, ErroValidacao } from "./colecoes.ts";
import { gerarTarefas, novaTarefa, dataDaTarefa, resumoEvento, type Evento, type TarefaEvento } from "../../src/eventosUtils.ts";
import { dataLocal, tarefasDoDia, ultimaOcorrencia, chaveExecucao, type TarefaRotina } from "../../src/rotinaUtils.ts";

export interface Ferramenta {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, any>;
  annotations: Record<string, any>;
  executar: (s: Sessao, args: any) => Promise<any>;
}

const enumColecoes = { type: "string", enum: NOMES_COLECOES };
const enumEscrita = { type: "string", enum: COLECOES_ESCRITA };

const hoje = () => dataLocal(new Date());

// Remove textos muito grandes (fotos em base64 etc.) da resposta
const enxugar = (v: any): any => {
  if (typeof v === "string") return v.length > 3000 ? v.slice(0, 3000) + "… [cortado]" : v;
  if (Array.isArray(v)) return v.map(enxugar);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enxugar(x)]));
  return v;
};

const normal = (s: any) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const exigirColecao = (c: string, escrita = false) => {
  const def = COLECOES[c];
  if (!def) throw new ErroValidacao(`Coleção desconhecida: ${c}. Opções: ${NOMES_COLECOES.join(", ")}.`);
  if (escrita && !def.escrita) throw new ErroValidacao(`A coleção ${c} é só leitura pelo Claude. Use o app para alterar.`);
  return def;
};

const carimbo = (s: Sessao) => ({ createdAt: new Date().toISOString(), createdBy: s.email || "Claude", criadoVia: "Claude" });

export const FERRAMENTAS: Ferramenta[] = [
  // ------------------------------------------------------------------ leitura
  {
    name: "listar_colecoes",
    title: "Listar coleções",
    description: "Mostra as coleções do Command Center que o Claude pode usar, o módulo do app de cada uma e os campos aceitos.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    executar: async () =>
      NOMES_COLECOES.map(n => ({
        colecao: n,
        modulo: COLECOES[n].modulo,
        descricao: COLECOES[n].descricao,
        escrita: COLECOES[n].escrita,
        campos: Object.fromEntries(Object.entries(COLECOES[n].campos).map(([k, f]) => [k, {
          tipo: f.tipo, obrigatorio: !!f.obrigatorio, ...(f.opcoes ? { opcoes: f.opcoes } : {}),
          ...(f.padrao !== undefined ? { padrao: f.padrao } : {}), ...(f.desc ? { desc: f.desc } : {}),
        }])),
      })),
  },
  {
    name: "listar_registros",
    title: "Listar registros",
    description:
      "Lista registros de uma coleção do Command Center, dos mais recentes para os mais antigos. " +
      "Filtros opcionais: igualdade de campos (filtros), período pelo campo data (data_de/data_ate, AAAA-MM-DD) e busca por texto em qualquer campo.",
    inputSchema: {
      type: "object",
      properties: {
        colecao: enumColecoes,
        filtros: { type: "object", description: "Campos que devem ser iguais, ex.: {\"status\": \"Ativo\"}", additionalProperties: true },
        data_de: { type: "string", description: "AAAA-MM-DD (inclusive), aplicado ao campo data" },
        data_ate: { type: "string", description: "AAAA-MM-DD (inclusive), aplicado ao campo data" },
        busca: { type: "string", description: "Texto procurado em qualquer campo (sem diferenciar acentos)" },
        limite: { type: "integer", minimum: 1, maximum: 300, default: 50 },
      },
      required: ["colecao"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    executar: async (s, a) => {
      exigirColecao(a.colecao);
      let lista = await db.listar(s, a.colecao, 1000);
      const total = lista.length;
      if (a.filtros && typeof a.filtros === "object") {
        for (const [k, v] of Object.entries(a.filtros)) lista = lista.filter(x => normal(x[k]) === normal(v));
      }
      if (a.data_de) lista = lista.filter(x => typeof x.data === "string" && x.data.slice(0, 10) >= a.data_de);
      if (a.data_ate) lista = lista.filter(x => typeof x.data === "string" && x.data.slice(0, 10) <= a.data_ate);
      if (a.busca) {
        const b = normal(a.busca);
        lista = lista.filter(x => normal(JSON.stringify(x)).includes(b));
      }
      const limite = Math.min(Number(a.limite) || 50, 300);
      return { colecao: a.colecao, encontrados: lista.length, totalNaColecao: total, mostrando: Math.min(limite, lista.length), registros: enxugar(lista.slice(0, limite)) };
    },
  },
  {
    name: "obter_registro",
    title: "Abrir registro",
    description: "Abre um registro pelo ID.",
    inputSchema: {
      type: "object",
      properties: { colecao: enumColecoes, id: { type: "string" } },
      required: ["colecao", "id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    executar: async (s, a) => {
      exigirColecao(a.colecao);
      const r = await db.get(s, a.colecao, a.id);
      if (!r) throw new ErroValidacao("Registro não encontrado.");
      return enxugar(r);
    },
  },
  {
    name: "resumo_do_dia",
    title: "Resumo do dia",
    description:
      "Panorama de um dia (padrão: hoje, horário de João Pessoa): rotina pendente do Meu Dia, tarefas de eventos atrasadas ou do dia, eventos e atrações do dia, diárias de extras, checklist pendente, ocorrências e reparos em aberto.",
    inputSchema: {
      type: "object",
      properties: { data: { type: "string", description: "AAAA-MM-DD (padrão: hoje)" } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    executar: async (s, a) => {
      const dia = a.data || hoje();
      const [rotina, execs, eventos, agenda, extras, checklist, ocorr, reparos] = await Promise.all([
        db.listar(s, "rotina_tarefas"), db.listar(s, "rotina_execucoes"), db.listar(s, "eventos"),
        db.listar(s, "agenda_eventos"), db.listar(s, "extras_semana"), db.listar(s, "checklist_gerencial"),
        db.listar(s, "ocorrencias"), db.listar(s, "manutencao_reparos"),
      ]);
      const [y, m, d] = dia.split("-").map(Number);
      const { pendentes, feitas } = tarefasDoDia(rotina as TarefaRotina[], new Set(execs.map((e: any) => e.id)), new Date(y, m - 1, d, 12));
      const evs = eventos as Evento[];
      const tarefasEventos = evs.flatMap(ev => {
        const r = resumoEvento(ev, dia);
        return [...r.atrasadas.map(t => ({ ...t, situacao: "atrasada" })), ...r.paraHoje.map(t => ({ ...t, situacao: "para o dia" }))]
          .map(t => ({ eventoId: ev.id, evento: ev.nome, dataEvento: ev.data, tarefaId: t.id, titulo: t.titulo, prazo: dataDaTarefa(ev.data, t.prazoDias), situacao: t.situacao, responsavel: t.responsavel || "" }));
      });
      return {
        data: dia,
        rotina: {
          pendentes: pendentes.map(p => ({ tarefaId: p.tarefa.id, titulo: p.tarefa.titulo, horario: p.tarefa.horario || "", ocorrencia: p.ocorrencia, atrasada: p.atrasada })),
          feitas: feitas.map(p => p.tarefa.titulo),
        },
        eventosDoDia: evs.filter(e => e.data === dia && e.status !== "Cancelado").map(e => ({ id: e.id, nome: e.nome, horarioInicio: e.horarioInicio, convidados: e.convidados, formato: e.formato, status: e.status })),
        tarefasDeEventos: tarefasEventos,
        atracoes: agenda.filter((x: any) => x.data === dia).map((x: any) => ({ id: x.id, artistaNome: x.artistaNome, tipoEvento: x.tipoEvento, horarioInicio: x.horarioInicio, status: x.status })),
        diarias: extras.filter((x: any) => x.data === dia).map((x: any) => ({ id: x.id, nome: x.nome, funcao: x.funcao, valor: x.valor, statusPagamento: x.statusPagamento })),
        checklistPendente: checklist.filter((x: any) => x.status !== "Concluído").map((x: any) => ({ id: x.id, tarefa: x.tarefa, prioridade: x.prioridade, dataLimite: x.dataLimite || "", categoria: x.categoria })),
        ocorrenciasAbertas: ocorr.filter((x: any) => x.status !== "Resolvido").map((x: any) => ({ id: x.id, data: x.data, categoria: x.categoria, descricao: x.descricaoDetalhada })),
        reparosPendentes: reparos.filter((x: any) => x.status !== "Resolvido").map((x: any) => ({ id: x.id, item: x.item, local: x.local, prioridade: x.prioridade })),
      };
    },
  },

  // ------------------------------------------------------------------ escrita
  {
    name: "criar_registro",
    title: "Criar registro",
    description:
      "Cria um registro em uma coleção, no mesmo formato que o app grava (createdAt e createdBy são preenchidos sozinhos). " +
      "Campos com * são obrigatórios; os demais recebem o padrão do app. Em eventos, o checklist de tarefas é gerado pelo modelo do tipo e formato.\n" +
      guiaCampos(),
    inputSchema: {
      type: "object",
      properties: { colecao: enumEscrita, dados: { type: "object", additionalProperties: true } },
      required: ["colecao", "dados"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    executar: async (s, a) => {
      exigirColecao(a.colecao, true);
      const dados = validar(a.colecao, a.dados, true);
      if (a.colecao === "eventos" && (!Array.isArray(dados.tarefas) || dados.tarefas.length === 0)) {
        dados.tarefas = gerarTarefas(dados.tipo, dados.formato);
      }
      if (a.colecao === "cotacoes" && !dados.data) dados.data = new Date().toISOString();
      if (a.colecao === "cotacoes") {
        const [p, f] = await Promise.all([db.get(s, "produtos_compra", dados.produtoId), db.get(s, "fornecedores", dados.fornecedorId)]);
        if (!p) throw new ErroValidacao("Produto não encontrado em produtos_compra.");
        if (!f) throw new ErroValidacao("Fornecedor não encontrado em fornecedores.");
        if (!dados.descricaoOriginal) dados.descricaoOriginal = p.nome;
      }
      const novo = await db.criar(s, a.colecao, { ...dados, ...carimbo(s) });
      if (a.colecao === "cotacoes") {
        // como o app: liga o fornecedor ao produto no catálogo
        const p = await db.get(s, "produtos_compra", dados.produtoId);
        const ids: string[] = p?.fornecedorIds || [];
        if (p && !ids.includes(dados.fornecedorId)) await db.atualizar(s, "produtos_compra", p.id, { fornecedorIds: [...ids, dados.fornecedorId] });
      }
      return { criado: true, colecao: a.colecao, registro: enxugar(novo) };
    },
  },
  {
    name: "atualizar_registro",
    title: "Alterar registro",
    description: "Altera só os campos informados de um registro existente. Use listar_registros ou obter_registro antes para achar o ID.",
    inputSchema: {
      type: "object",
      properties: { colecao: enumEscrita, id: { type: "string" }, campos: { type: "object", additionalProperties: true } },
      required: ["colecao", "id", "campos"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    executar: async (s, a) => {
      exigirColecao(a.colecao, true);
      const campos = validar(a.colecao, a.campos, false);
      if (!Object.keys(campos).length) throw new ErroValidacao("Nenhum campo para alterar.");
      const r = await db.atualizar(s, a.colecao, a.id, campos);
      return { alterado: true, colecao: a.colecao, registro: enxugar(r) };
    },
  },
  {
    name: "apagar_registro",
    title: "Apagar registro",
    description: "Apaga um registro de vez (não há lixeira). Confirme com o usuário antes de usar.",
    inputSchema: {
      type: "object",
      properties: { colecao: enumEscrita, id: { type: "string" } },
      required: ["colecao", "id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    executar: async (s, a) => {
      exigirColecao(a.colecao, true);
      const r = await db.get(s, a.colecao, a.id);
      if (!r) throw new ErroValidacao("Registro não encontrado.");
      await db.apagar(s, a.colecao, a.id);
      if (a.colecao === "reembolsos" && r.temComprovante) await db.apagar(s, "reembolsos_comprovantes", a.id).catch(() => {});
      return { apagado: true, colecao: a.colecao, id: a.id };
    },
  },
  {
    name: "evento_marcar_tarefa",
    title: "Marcar tarefa de evento",
    description: "Marca (ou desmarca) uma tarefa do checklist de um evento. Informe tarefa_id ou parte do título.",
    inputSchema: {
      type: "object",
      properties: {
        evento_id: { type: "string" },
        tarefa_id: { type: "string" },
        titulo: { type: "string", description: "Parte do título da tarefa, se não souber o ID" },
        feito: { type: "boolean", default: true },
      },
      required: ["evento_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    executar: async (s, a) => {
      const ev = await db.get(s, "eventos", a.evento_id);
      if (!ev) throw new ErroValidacao("Evento não encontrado.");
      const tarefas: TarefaEvento[] = ev.tarefas || [];
      let alvo = a.tarefa_id ? tarefas.filter(t => t.id === a.tarefa_id) : [];
      if (!a.tarefa_id && a.titulo) alvo = tarefas.filter(t => normal(t.titulo).includes(normal(a.titulo)));
      if (alvo.length === 0) throw new ErroValidacao("Tarefa não encontrada neste evento.");
      if (alvo.length > 1) throw new ErroValidacao(`Mais de uma tarefa corresponde: ${alvo.map(t => `${t.id} (${t.titulo})`).join("; ")}. Informe o tarefa_id.`);
      const feito = a.feito !== false;
      const quem = s.email || "Claude";
      const novas = tarefas.map(t => t.id === alvo[0].id ? { ...t, feito, feitoPor: feito ? quem : "", feitoEm: feito ? new Date().toISOString() : "" } : t);
      await db.atualizar(s, "eventos", ev.id, { tarefas: novas });
      return { evento: ev.nome, tarefa: alvo[0].titulo, feito };
    },
  },
  {
    name: "evento_adicionar_tarefa",
    title: "Incluir tarefa em evento",
    description: "Inclui uma tarefa no checklist de um evento. prazo_dias é relativo à data do evento (-7 = uma semana antes, 0 = no dia, 1 = dia seguinte).",
    inputSchema: {
      type: "object",
      properties: {
        evento_id: { type: "string" },
        titulo: { type: "string" },
        prazo_dias: { type: "integer", default: 0 },
        responsavel: { type: "string" },
      },
      required: ["evento_id", "titulo"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    executar: async (s, a) => {
      const ev = await db.get(s, "eventos", a.evento_id);
      if (!ev) throw new ErroValidacao("Evento não encontrado.");
      const t = novaTarefa(String(a.titulo).trim(), Number(a.prazo_dias) || 0, a.responsavel?.trim() || undefined);
      if (!t.responsavel) delete t.responsavel;
      const tarefas = [...(ev.tarefas || []), t].sort((x: TarefaEvento, y: TarefaEvento) => x.prazoDias - y.prazoDias);
      await db.atualizar(s, "eventos", ev.id, { tarefas });
      return { evento: ev.nome, tarefa: t, dataLimite: dataDaTarefa(ev.data, t.prazoDias) };
    },
  },
  {
    name: "rotina_marcar",
    title: "Marcar tarefa da rotina",
    description: "Marca (ou desmarca) uma tarefa da rotina do Meu Dia como feita. Sem data, vale a ocorrência atual da tarefa (hoje, ou o último dia previsto para semanais e mensais).",
    inputSchema: {
      type: "object",
      properties: {
        tarefa_id: { type: "string", description: "ID em rotina_tarefas" },
        data: { type: "string", description: "Data da ocorrência AAAA-MM-DD (opcional)" },
        feito: { type: "boolean", default: true },
      },
      required: ["tarefa_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    executar: async (s, a) => {
      const t = await db.get(s, "rotina_tarefas", a.tarefa_id);
      if (!t) throw new ErroValidacao("Tarefa da rotina não encontrada.");
      const ocorrencia = a.data || dataLocal(ultimaOcorrencia(t as TarefaRotina, new Date()));
      const chave = chaveExecucao(t.id, ocorrencia);
      if (a.feito === false) {
        await db.apagar(s, "rotina_execucoes", chave);
        return { tarefa: t.titulo, ocorrencia, feito: false };
      }
      const agoraIso = new Date().toISOString();
      await db.definir(s, "rotina_execucoes", chave, { tarefaId: t.id, data: ocorrencia, feitoPor: s.email || "Claude", feitoEm: agoraIso, createdAt: agoraIso });
      return { tarefa: t.titulo, ocorrencia, feito: true };
    },
  },
];

export const ferramentaPorNome = new Map(FERRAMENTAS.map(f => [f.name, f]));
