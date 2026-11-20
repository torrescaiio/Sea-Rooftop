import React, { useEffect, useMemo, useState } from "react";
import { appDb } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  Sun, CheckCircle2, Circle, Plus, Trash2, Inbox, Target, AlertTriangle, Wrench,
  ShoppingCart, Calendar, Megaphone, Settings2, ChevronRight, Clock, X, Sparkles
} from "lucide-react";
import {
  TarefaRotina, ExecucaoRotina, Frequencia, DIAS_SEMANA, ROTINA_SUGERIDA,
  dataLocal, tarefasDoDia, descreverFrequencia
} from "../rotinaUtils";

interface Props {
  onNavigate: (modulo: string) => void;
}

interface Prioridade { texto: string; feito: boolean }

const card = "bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5";
const inputCls = "bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50";
const btnPrim = "inline-flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition cursor-pointer disabled:opacity-50";
const btnSec = "inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm px-3 py-2 rounded-lg transition cursor-pointer";

const saudacao = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

export default function MeuDiaModule({ onNavigate }: Props) {
  const { user } = useAuth();
  const hoje = dataLocal();

  const [tarefas, setTarefas] = useState<TarefaRotina[]>([]);
  const [execucoes, setExecucoes] = useState<ExecucaoRotina[]>([]);
  const [prioridades, setPrioridades] = useState<Prioridade[]>([]);
  const [briefingHoje, setBriefingHoje] = useState(false);

  // Pendências de outros módulos
  const [checklist, setChecklist] = useState<any[]>([]);
  const [reparos, setReparos] = useState<any[]>([]);
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [requisicoes, setRequisicoes] = useState<any[]>([]);
  const [agenda, setAgenda] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [capturaTexto, setCapturaTexto] = useState("");
  const [novaPrioridade, setNovaPrioridade] = useState("");
  const [editarRotina, setEditarRotina] = useState(false);

  useEffect(() => {
    const unsubs = [
      appDb.subscribe("rotina_tarefas", d => { setTarefas(d); setLoading(false); }, () => setLoading(false)),
      appDb.subscribe("rotina_execucoes", setExecucoes),
      appDb.subscribe("checklist_gerencial", setChecklist),
      appDb.subscribe("manutencao_reparos", setReparos),
      appDb.subscribe("ocorrencias", setOcorrencias),
      appDb.subscribe("requisicoes", setRequisicoes),
      appDb.subscribe("agenda_eventos", setAgenda),
      appDb.subscribe("briefings", d => setBriefingHoje(d.some((b: any) => b.data === hoje && b.enviado))),
      appDb.subscribe("prioridades_dia", d => {
        const doc = d.find((p: any) => p.id === hoje);
        setPrioridades(doc?.itens || []);
      }),
    ];
    return () => unsubs.forEach(fn => fn());
  }, [hoje]);

  const feitasSet = useMemo(() => new Set(execucoes.map(e => e.id || "")), [execucoes]);
  const { pendentes, feitas } = useMemo(() => tarefasDoDia(tarefas, feitasSet), [tarefas, feitasSet]);
  const totalHoje = pendentes.length + feitas.length;
  const progresso = totalHoje ? Math.round((feitas.length / totalHoje) * 100) : 0;

  // ---- Pendências espalhadas pelo app ----
  const caixaEntrada = checklist.filter(c => c.categoria === "Caixa de entrada" && c.status !== "Concluído");
  const checklistVencido = checklist.filter(c =>
    c.status !== "Concluído" && c.categoria !== "Caixa de entrada" &&
    ((c.dataLimite && c.dataLimite <= hoje) || c.prioridade === "Alta"));
  const reparosAbertos = reparos.filter(r => r.status !== "Resolvido");
  const reparosUrgentes = reparosAbertos.filter(r => r.prioridade === "Urgente");
  const ocorrenciasAbertas = ocorrencias.filter(o => o.status === "Aberto");
  const requisicoesPendentes = requisicoes.filter(r => r.status === "pendente");
  const em7dias = dataLocal(new Date(Date.now() + 7 * 86400000));
  const eventosAConfirmar = agenda.filter(a => a.status === "A Confirmar" && a.data >= hoje && a.data <= em7dias);
  const eventosHoje = agenda.filter(a => a.data === hoje && a.status !== "Cancelado");

  const alertas = [
    { n: requisicoesPendentes.length, txt: "requisição(ões) de compra esperando tua aprovação", mod: "gestao_compras", icon: ShoppingCart, cor: "text-amber-400" },
    { n: reparosUrgentes.length, txt: "reparo(s) URGENTE(S) em aberto", mod: "manutencao", icon: Wrench, cor: "text-rose-400" },
    { n: checklistVencido.length, txt: "tarefa(s) do checklist vencida(s) ou de prioridade alta", mod: "checklist", icon: AlertTriangle, cor: "text-rose-400" },
    { n: ocorrenciasAbertas.length, txt: "ocorrência(s) sem resolução", mod: "ocorrencias", icon: AlertTriangle, cor: "text-amber-400" },
    { n: eventosAConfirmar.length, txt: "atração(ões) dos próximos 7 dias ainda a confirmar", mod: "agenda", icon: Calendar, cor: "text-amber-400" },
    { n: reparosAbertos.length - reparosUrgentes.length, txt: "outro(s) reparo(s) pendente(s)", mod: "manutencao", icon: Wrench, cor: "text-slate-400" },
  ].filter(a => a.n > 0);

  // ---- Ações ----
  const marcar = async (chave: string, tarefaId: string, ocorrencia: string, feito: boolean) => {
    try {
      if (feito) {
        await appDb.set("rotina_execucoes", chave, {
          tarefaId, data: ocorrencia,
          feitoPor: user?.displayName || user?.email || "",
          feitoEm: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        });
      } else {
        await appDb.delete("rotina_execucoes", chave);
      }
    } catch (err: any) {
      alert("Não consegui salvar: " + err.message);
    }
  };

  const capturar = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = capturaTexto.trim();
    if (!t) return;
    try {
      await appDb.add("checklist_gerencial", {
        tarefa: t, categoria: "Caixa de entrada", status: "Pendente", prioridade: "Média",
      });
      setCapturaTexto("");
    } catch (err: any) {
      alert("Não consegui salvar: " + err.message);
    }
  };

  const concluirCaixa = (id: string) => appDb.update("checklist_gerencial", id, { status: "Concluído" });

  const salvarPrioridades = async (itens: Prioridade[]) => {
    setPrioridades(itens);
    try {
      await appDb.set("prioridades_dia", hoje, { itens, data: hoje, createdAt: new Date().toISOString() });
    } catch (err: any) {
      alert("Não consegui salvar: " + err.message);
    }
  };

  const addPrioridade = (e: React.FormEvent) => {
    e.preventDefault();
    const t = novaPrioridade.trim();
    if (!t || prioridades.length >= 3) return;
    salvarPrioridades([...prioridades, { texto: t, feito: false }]);
    setNovaPrioridade("");
  };

  const carregarSugerida = async () => {
    if (!confirm("Carregar a rotina sugerida? Depois tu pode editar ou apagar qualquer tarefa.")) return;
    try {
      for (const t of ROTINA_SUGERIDA) await appDb.add("rotina_tarefas", { ...t, ativo: true });
    } catch (err: any) {
      alert("Erro ao carregar rotina: " + err.message);
    }
  };

  const dataExtenso = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="h-8 w-8 border-t-2 border-r-2 border-cyan-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 font-sans max-w-5xl">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sun className="h-6 w-6 text-amber-400" />
            {saudacao()}, {user?.displayName?.split(" ")[0] || "gerente"}
          </h2>
          <p className="text-sm text-slate-400 first-letter:uppercase">{dataExtenso}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNavigate("briefing")} className={briefingHoje ? btnSec : btnPrim}>
            <Megaphone className="h-4 w-4" />
            {briefingHoje ? "Briefing enviado ✓" : "Fazer briefing do turno"}
          </button>
          <button onClick={() => setEditarRotina(true)} className={btnSec} title="Editar rotina">
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Captura rápida */}
      <form onSubmit={capturar} className="flex gap-2">
        <div className="relative flex-1">
          <Inbox className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={capturaTexto}
            onChange={e => setCapturaTexto(e.target.value)}
            placeholder="Lembrou de algo? Anota aqui e tira da cabeça…"
            className={`${inputCls} w-full pl-9 py-2.5`}
          />
        </div>
        <button type="submit" className={btnPrim} disabled={!capturaTexto.trim()}>
          <Plus className="h-4 w-4" /><span className="hidden sm:inline">Anotar</span>
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Coluna principal: rotina */}
        <div className="lg:col-span-3 space-y-5">
          {/* Prioridades */}
          <div className={card}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Target className="h-4 w-4 text-cyan-400" /> As 3 coisas que importam hoje
              </h3>
              <span className="text-[11px] text-slate-500">{prioridades.filter(p => p.feito).length}/{prioridades.length || 3}</span>
            </div>
            <div className="space-y-2">
              {prioridades.map((p, i) => (
                <div key={i} className="flex items-center gap-3 group">
                  <button onClick={() => salvarPrioridades(prioridades.map((x, j) => j === i ? { ...x, feito: !x.feito } : x))} className="shrink-0 cursor-pointer">
                    {p.feito ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <Circle className="h-5 w-5 text-slate-600" />}
                  </button>
                  <span className={`flex-1 text-sm ${p.feito ? "line-through text-slate-500" : "text-slate-200"}`}>{p.texto}</span>
                  <button onClick={() => salvarPrioridades(prioridades.filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {prioridades.length < 3 && (
                <form onSubmit={addPrioridade} className="flex gap-2 pt-1">
                  <input value={novaPrioridade} onChange={e => setNovaPrioridade(e.target.value)}
                    placeholder={prioridades.length === 0 ? "Se só der pra fazer uma coisa hoje, qual é?" : "Próxima prioridade…"}
                    className={`${inputCls} flex-1`} />
                  <button type="submit" className={btnSec} disabled={!novaPrioridade.trim()}><Plus className="h-4 w-4" /></button>
                </form>
              )}
            </div>
          </div>

          {/* Rotina do dia */}
          <div className={card}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="h-4 w-4 text-cyan-400" /> Rotina de hoje
              </h3>
              {totalHoje > 0 && <span className="text-[11px] text-slate-400 font-mono">{feitas.length}/{totalHoje} · {progresso}%</span>}
            </div>
            {totalHoje > 0 && (
              <div className="h-1.5 bg-slate-800 rounded-full mb-4 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all" style={{ width: `${progresso}%` }} />
              </div>
            )}

            {tarefas.length === 0 ? (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-slate-400">Tua rotina ainda tá vazia.</p>
                <button onClick={carregarSugerida} className={btnPrim}>
                  <Sparkles className="h-4 w-4" /> Carregar rotina sugerida de gerente
                </button>
                <p className="text-[11px] text-slate-500">Diárias, semanais e mensais. Tu edita do teu jeito depois.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {pendentes.length === 0 && <p className="text-sm text-emerald-400 py-2">Rotina de hoje concluída. 👊</p>}
                {pendentes.map(({ tarefa, chave, ocorrencia, atrasada }) => (
                  <button key={chave} onClick={() => marcar(chave, tarefa.id!, ocorrencia, true)}
                    className="w-full flex items-start gap-3 text-left p-2 rounded-lg hover:bg-white/[0.03] transition cursor-pointer">
                    <Circle className={`h-5 w-5 shrink-0 mt-0.5 ${atrasada ? "text-rose-400" : "text-slate-600"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200">{tarefa.titulo}</div>
                      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-2">
                        {tarefa.horario && <span>{tarefa.horario}</span>}
                        {tarefa.frequencia !== "diaria" && <span>{descreverFrequencia(tarefa)}</span>}
                        {tarefa.responsavel && <span>· {tarefa.responsavel}</span>}
                        {atrasada && <span className="text-rose-400 font-semibold">atrasada desde {ocorrencia.split("-").reverse().slice(0, 2).join("/")}</span>}
                      </div>
                    </div>
                  </button>
                ))}
                {feitas.map(({ tarefa, chave, ocorrencia }) => (
                  <button key={chave} onClick={() => marcar(chave, tarefa.id!, ocorrencia, false)}
                    className="w-full flex items-start gap-3 text-left p-2 rounded-lg hover:bg-white/[0.03] transition cursor-pointer">
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-500" />
                    <span className="text-sm text-slate-500 line-through">{tarefa.titulo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coluna lateral: o que tá pegando */}
        <div className="lg:col-span-2 space-y-5">
          {eventosHoje.length > 0 && (
            <div className={`${card} border-cyan-500/30`}>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-cyan-400" /> Hoje na casa
              </h3>
              {eventosHoje.map(ev => (
                <div key={ev.id} className="text-sm text-slate-300">
                  <span className="font-semibold text-white">{ev.artistaNome}</span> · {ev.tipoEvento}
                  <div className="text-[11px] text-slate-500">
                    Passagem {ev.horarioPassagemSom || "—"} · {ev.horarioInicio || "—"} às {ev.horarioTermino || "—"} · {ev.status}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={card}>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-400" /> O que tá pegando
            </h3>
            {alertas.length === 0 ? (
              <p className="text-sm text-slate-500">Nada parado nos outros módulos. 🎉</p>
            ) : (
              <div className="space-y-1">
                {alertas.map((a, i) => {
                  const Icon = a.icon;
                  return (
                    <button key={i} onClick={() => onNavigate(a.mod)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.04] text-left transition cursor-pointer">
                      <Icon className={`h-4 w-4 shrink-0 ${a.cor}`} />
                      <span className="flex-1 text-sm text-slate-300"><b className="text-white">{a.n}</b> {a.txt}</span>
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className={card}>
            <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
              <Inbox className="h-4 w-4 text-cyan-400" /> Caixa de entrada
              <span className="text-[11px] text-slate-500 font-normal">({caixaEntrada.length})</span>
            </h3>
            {caixaEntrada.length === 0 ? (
              <p className="text-sm text-slate-500">Vazia. O que tu anotar lá em cima aparece aqui.</p>
            ) : (
              <div className="space-y-1">
                {caixaEntrada.map(c => (
                  <div key={c.id} className="flex items-start gap-3 p-1.5">
                    <button onClick={() => concluirCaixa(c.id)} className="shrink-0 mt-0.5 cursor-pointer" title="Resolvido">
                      <Circle className="h-4 w-4 text-slate-600 hover:text-emerald-400" />
                    </button>
                    <span className="flex-1 text-sm text-slate-300">{c.tarefa}</span>
                  </div>
                ))}
                <button onClick={() => onNavigate("checklist")} className="text-[11px] text-cyan-400 hover:underline pt-1 cursor-pointer">
                  Organizar no Checklist (dar dono e prazo) →
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {editarRotina && <EditorRotina tarefas={tarefas} onClose={() => setEditarRotina(false)} onCarregarSugerida={carregarSugerida} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor da rotina
// ---------------------------------------------------------------------------
function EditorRotina({ tarefas, onClose, onCarregarSugerida }: { tarefas: TarefaRotina[]; onClose: () => void; onCarregarSugerida: () => void }) {
  const vazio = { titulo: "", frequencia: "diaria" as Frequencia, diaSemana: 1, diaMes: 1, horario: "", responsavel: "" };
  const [form, setForm] = useState(vazio);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    const dados: any = {
      titulo: form.titulo.trim(), frequencia: form.frequencia, horario: form.horario,
      responsavel: form.responsavel.trim(), ativo: true,
    };
    if (form.frequencia === "semanal") dados.diaSemana = Number(form.diaSemana);
    if (form.frequencia === "mensal") dados.diaMes = Number(form.diaMes);
    try {
      await appDb.add("rotina_tarefas", dados);
      setForm(vazio);
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    }
  };

  const remover = async (t: TarefaRotina) => {
    if (!t.id || !confirm(`Apagar "${t.titulo}" da rotina?`)) return;
    await appDb.delete("rotina_tarefas", t.id);
  };

  const grupos: { f: Frequencia; nome: string }[] = [
    { f: "diaria", nome: "Todo dia" }, { f: "semanal", nome: "Toda semana" }, { f: "mensal", nome: "Todo mês" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-[#0b0b0b] border border-slate-800 w-full sm:max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Minha rotina</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={salvar} className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
          <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder="Nova tarefa da rotina"
            className={`${inputCls} col-span-2 sm:col-span-6`} />
          <select value={form.frequencia} onChange={e => setForm({ ...form, frequencia: e.target.value as Frequencia })} className={`${inputCls} sm:col-span-2`}>
            <option value="diaria">Todo dia</option>
            <option value="semanal">Toda semana</option>
            <option value="mensal">Todo mês</option>
          </select>
          {form.frequencia === "semanal" && (
            <select value={form.diaSemana} onChange={e => setForm({ ...form, diaSemana: Number(e.target.value) })} className={inputCls}>
              {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          )}
          {form.frequencia === "mensal" && (
            <input type="number" min={1} max={31} value={form.diaMes} onChange={e => setForm({ ...form, diaMes: Number(e.target.value) })} className={inputCls} title="Dia do mês" />
          )}
          <input type="time" value={form.horario} onChange={e => setForm({ ...form, horario: e.target.value })} className={inputCls} />
          <input value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} placeholder="Responsável" className={`${inputCls} ${form.frequencia === "diaria" ? "sm:col-span-3" : "sm:col-span-2"}`} />
          <button type="submit" className={`${btnPrim} col-span-2 sm:col-span-6`} disabled={!form.titulo.trim()}><Plus className="h-4 w-4" /> Adicionar à rotina</button>
        </form>

        {tarefas.length === 0 && (
          <button onClick={onCarregarSugerida} className={`${btnSec} w-full`}><Sparkles className="h-4 w-4" /> Carregar rotina sugerida</button>
        )}

        {grupos.map(g => {
          const lista = tarefas.filter(t => t.frequencia === g.f)
            .sort((a, b) => ((a.diaSemana ?? a.diaMes ?? 0) - (b.diaSemana ?? b.diaMes ?? 0)) || (a.horario || "").localeCompare(b.horario || ""));
          if (!lista.length) return null;
          return (
            <div key={g.f}>
              <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-2">{g.nome}</p>
              <div className="space-y-1">
                {lista.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/40 border border-slate-800/60">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200">{t.titulo}</div>
                      <div className="text-[11px] text-slate-500">
                        {descreverFrequencia(t)}{t.horario ? ` · ${t.horario}` : ""}{t.responsavel ? ` · ${t.responsavel}` : ""}
                      </div>
                    </div>
                    <button onClick={() => remover(t)} className="text-slate-600 hover:text-rose-400 cursor-pointer"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
