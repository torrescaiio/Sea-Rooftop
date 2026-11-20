import React, { useEffect, useMemo, useState } from "react";
import { appDb } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  PartyPopper, Plus, ArrowLeft, CheckCircle2, Circle, Users, Clock, MapPin, Phone,
  Send, Pencil, Trash2, AlertTriangle, X, Wallet, Lock
} from "lucide-react";
import {
  Evento, TarefaEvento, TipoEvento, FormatoEvento, StatusEvento,
  TIPOS_EVENTO, FORMATOS, STATUS_EVENTO,
  gerarTarefas, novaTarefa, dataDaTarefa, diasAte, rotuloPrazo, rotuloContagem,
  resumoEvento, formatBRL, mensagemCliente
} from "../eventosUtils";
import { dataLocal } from "../rotinaUtils";
import { linkWhatsApp } from "../cotacoesUtils";

interface Props {
  onNavigate?: (modulo: string) => void;
}

const card = "bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5";
const inputCls = "bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 w-full";
const labelCls = "text-[11px] text-slate-400 block mb-1";
const btnPrim = "inline-flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition cursor-pointer disabled:opacity-50";
const btnSec = "inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm px-3 py-2 rounded-lg transition cursor-pointer";

const corStatus: Record<StatusEvento, string> = {
  "Orçamento": "bg-amber-500/10 text-amber-300 border-amber-500/30",
  "Confirmado": "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  "Realizado": "bg-slate-500/10 text-slate-300 border-slate-500/30",
  "Cancelado": "bg-rose-500/10 text-rose-300 border-rose-500/30",
};

const dataBR = (s: string) => s.split("-").reverse().join("/");
const dataCurta = (s: string) => dataBR(s).slice(0, 5);

export default function EventosModule({ onNavigate }: Props) {
  const { user } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [form, setForm] = useState<Evento | null>(null);
  const [filtro, setFiltro] = useState<"proximos" | "passados" | "todos">("proximos");
  const hoje = dataLocal();

  useEffect(() => appDb.subscribe("eventos", d => { setEventos(d); setLoading(false); }, () => setLoading(false)), []);

  const aberto = eventos.find(e => e.id === abertoId) || null;

  const lista = useMemo(() => {
    const ordenados = [...eventos].sort((a, b) => a.data.localeCompare(b.data));
    if (filtro === "proximos") return ordenados.filter(e => e.data >= hoje && e.status !== "Cancelado");
    if (filtro === "passados") return ordenados.filter(e => e.data < hoje).reverse();
    return ordenados;
  }, [eventos, filtro, hoje]);

  const salvarTarefas = async (ev: Evento, tarefas: TarefaEvento[]) => {
    try {
      await appDb.update("eventos", ev.id!, { tarefas });
    } catch (err: any) {
      alert("Não foi possível salvar: " + err.message);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-48"><div className="h-8 w-8 border-t-2 border-r-2 border-cyan-400 rounded-full animate-spin" /></div>;
  }

  if (form) {
    return <FormEvento inicial={form} onCancel={() => setForm(null)} onSaved={id => { setForm(null); setAbertoId(id); }} />;
  }

  if (aberto) {
    return (
      <DetalheEvento
        ev={aberto}
        usuario={user?.displayName || user?.email || ""}
        onVoltar={() => setAbertoId(null)}
        onEditar={() => setForm(aberto)}
        onSalvarTarefas={t => salvarTarefas(aberto, t)}
        onNavigate={onNavigate}
        onExcluido={() => setAbertoId(null)}
      />
    );
  }

  // ---------------- Lista ----------------
  return (
    <div className="space-y-5 font-sans max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <PartyPopper className="h-6 w-6 text-cyan-400" /> Planejador de Eventos
          </h2>
          <p className="text-sm text-slate-400">Casamentos, eventos corporativos, confraternizações, aniversários e reservas de grupo, cada um com seu checklist e prazos.</p>
        </div>
        <button onClick={() => setForm({ nome: "", tipo: "Aniversário", formato: "Reserva", status: "Confirmado", data: hoje, tarefas: [] })} className={btnPrim}>
          <Plus className="h-4 w-4" /> Novo evento
        </button>
      </div>

      <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1 w-fit text-sm">
        {([["proximos", "Próximos"], ["passados", "Realizados"], ["todos", "Todos"]] as const).map(([id, nome]) => (
          <button key={id} onClick={() => setFiltro(id)}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${filtro === id ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"}`}>{nome}</button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div className={`${card} text-center py-10`}>
          <p className="text-sm text-slate-400">Nenhum evento {filtro === "proximos" ? "agendado" : "nesta lista"}.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lista.map(ev => {
            const r = resumoEvento(ev, hoje);
            const dias = diasAte(ev.data, hoje);
            const pct = r.total ? Math.round((r.feitas / r.total) * 100) : 0;
            return (
              <button key={ev.id} onClick={() => setAbertoId(ev.id!)}
                className={`${card} text-left hover:border-slate-700 transition cursor-pointer space-y-3`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-bold text-white truncate">{ev.nome}</div>
                    <div className="text-xs text-slate-400">{ev.tipo} · {ev.formato === "Exclusivo" ? "Casa fechada" : "Reserva de grupo"}</div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${corStatus[ev.status]}`}>{ev.status}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span className="text-slate-200 font-semibold">{dataBR(ev.data)} · {rotuloContagem(dias)}</span>
                  {ev.horarioInicio && <span>{ev.horarioInicio}</span>}
                  {ev.convidados ? <span>{ev.convidados} pessoas</span> : null}
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>Checklist {r.feitas}/{r.total}</span><span>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {(r.atrasadas.length > 0 || r.paraHoje.length > 0) && (
                  <div className="text-xs flex flex-wrap gap-3">
                    {r.atrasadas.length > 0 && <span className="text-rose-400 font-semibold">{r.atrasadas.length} tarefa{r.atrasadas.length > 1 ? "s" : ""} atrasada{r.atrasadas.length > 1 ? "s" : ""}</span>}
                    {r.paraHoje.length > 0 && <span className="text-amber-300">{r.paraHoje.length} para hoje</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detalhe do evento + checklist em linha do tempo
// ---------------------------------------------------------------------------
function DetalheEvento({ ev, usuario, onVoltar, onEditar, onSalvarTarefas, onNavigate, onExcluido }: {
  ev: Evento; usuario: string; onVoltar: () => void; onEditar: () => void;
  onSalvarTarefas: (t: TarefaEvento[]) => void; onNavigate?: (m: string) => void; onExcluido: () => void;
}) {
  const hoje = dataLocal();
  const [nova, setNova] = useState({ titulo: "", prazoDias: -1, responsavel: "" });
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const r = resumoEvento(ev, hoje);
  const dias = diasAte(ev.data, hoje);
  const saldo = (ev.valorTotal || 0) - (ev.valorPago || 0);

  const tarefas = [...(ev.tarefas || [])].sort((a, b) => a.prazoDias - b.prazoDias);
  const alternar = (t: TarefaEvento) => onSalvarTarefas((ev.tarefas || []).map(x => x.id === t.id
    ? { ...x, feito: !x.feito, feitoPor: !x.feito ? usuario : "", feitoEm: !x.feito ? new Date().toISOString() : "" }
    : x));
  const mudarResponsavel = (t: TarefaEvento, responsavel: string) =>
    onSalvarTarefas((ev.tarefas || []).map(x => x.id === t.id ? { ...x, responsavel } : x));
  const remover = (t: TarefaEvento) => onSalvarTarefas((ev.tarefas || []).filter(x => x.id !== t.id));
  const adicionar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nova.titulo.trim()) return;
    onSalvarTarefas([...(ev.tarefas || []), novaTarefa(nova.titulo.trim(), Number(nova.prazoDias), nova.responsavel.trim() || undefined)]);
    setNova({ titulo: "", prazoDias: nova.prazoDias, responsavel: "" });
  };

  const excluir = async () => {
    if (!confirmarExclusao) { setConfirmarExclusao(true); return; }
    try {
      await appDb.delete("eventos", ev.id!);
      onExcluido();
    } catch (err: any) {
      alert("Não foi possível excluir: " + err.message);
    }
  };

  const mudarStatus = (status: StatusEvento) => appDb.update("eventos", ev.id!, { status });

  return (
    <div className="space-y-5 font-sans max-w-5xl">
      <button onClick={onVoltar} className="text-sm text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer">
        <ArrowLeft className="h-4 w-4" /> Todos os eventos
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-white">{ev.nome}</h2>
          <p className="text-sm text-slate-400">
            {ev.tipo} · {ev.formato === "Exclusivo" ? "Casa fechada" : "Reserva de grupo"} · <span className="text-slate-200 font-semibold">{dataBR(ev.data)} ({rotuloContagem(dias)})</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={ev.status} onChange={e => mudarStatus(e.target.value as StatusEvento)} className={`${inputCls} !w-auto`}>
            {STATUS_EVENTO.map(s => <option key={s}>{s}</option>)}
          </select>
          {ev.clienteTelefone && (
            <a href={linkWhatsApp(ev.clienteTelefone, mensagemCliente(ev))} target="_blank" rel="noreferrer" className={btnSec} title="Abre o WhatsApp do cliente com a mensagem de confirmação">
              <Send className="h-4 w-4" /> Confirmar com o cliente
            </a>
          )}
          <button onClick={onEditar} className={btnSec}><Pencil className="h-4 w-4" /> Editar</button>
        </div>
      </div>

      {ev.formato === "Exclusivo" && ev.status !== "Cancelado" && (
        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-sm flex gap-2">
          <Lock className="h-4 w-4 shrink-0 mt-0.5" /> Casa fechada nesta data. Confirme o bloqueio de reservas e de atrações da casa.
        </div>
      )}
      {r.atrasadas.length > 0 && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {r.atrasadas.length} tarefa{r.atrasadas.length > 1 ? "s" : ""} com prazo vencido.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Checklist */}
        <div className={`${card} lg:col-span-3`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white">Checklist do evento</h3>
            <span className="text-[11px] text-slate-400 font-mono">{r.feitas}/{r.total}</span>
          </div>
          <div className="space-y-1">
            {tarefas.map(t => {
              const prazo = dataDaTarefa(ev.data, t.prazoDias);
              const atrasada = !t.feito && prazo < hoje;
              const deHoje = !t.feito && prazo === hoje;
              return (
                <div key={t.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.03] group">
                  <button onClick={() => alternar(t)} className="shrink-0 mt-0.5 cursor-pointer">
                    {t.feito ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className={`h-5 w-5 ${atrasada ? "text-rose-400" : deHoje ? "text-amber-300" : "text-slate-600"}`} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm ${t.feito ? "text-slate-500 line-through" : "text-slate-200"}`}>{t.titulo}</div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2">
                      <span className={atrasada ? "text-rose-400 font-semibold" : deHoje ? "text-amber-300 font-semibold" : ""}>
                        {dataCurta(prazo)} · {rotuloPrazo(t.prazoDias)}{atrasada ? " · atrasada" : deHoje ? " · hoje" : ""}
                      </span>
                      {t.feito && t.feitoPor && <span>· feito por {t.feitoPor}</span>}
                      {!t.feito && (
                        <input defaultValue={t.responsavel || ""} placeholder="+ responsável"
                          onBlur={e => { if (e.target.value.trim() !== (t.responsavel || "")) mudarResponsavel(t, e.target.value.trim()); }}
                          className="bg-transparent border-b border-transparent hover:border-slate-700 focus:border-cyan-500/50 focus:outline-none text-[11px] text-cyan-300 placeholder:text-slate-600 w-28" />
                      )}
                    </div>
                  </div>
                  <button onClick={() => remover(t)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 cursor-pointer" title="Remover tarefa"><X className="h-4 w-4" /></button>
                </div>
              );
            })}
          </div>
          <form onSubmit={adicionar} className="grid grid-cols-2 sm:grid-cols-6 gap-2 mt-4 pt-4 border-t border-slate-800">
            <input value={nova.titulo} onChange={e => setNova({ ...nova, titulo: e.target.value })} placeholder="Adicionar tarefa" className={`${inputCls} col-span-2 sm:col-span-3`} />
            <select value={nova.prazoDias} onChange={e => setNova({ ...nova, prazoDias: Number(e.target.value) })} className={inputCls}>
              {[-30, -21, -15, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3].map(d => <option key={d} value={d}>{rotuloPrazo(d)}</option>)}
            </select>
            <input value={nova.responsavel} onChange={e => setNova({ ...nova, responsavel: e.target.value })} placeholder="Responsável" className={inputCls} />
            <button type="submit" className={`${btnSec} col-span-2 sm:col-span-1`} disabled={!nova.titulo.trim()}><Plus className="h-4 w-4" /></button>
          </form>
        </div>

        {/* Ficha */}
        <div className="lg:col-span-2 space-y-5">
          <div className={card}>
            <h3 className="text-sm font-bold text-white mb-3">Ficha do evento</h3>
            <div className="space-y-2 text-sm text-slate-300">
              {(ev.horarioInicio || ev.horarioFim) && <p className="flex gap-2"><Clock className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />{ev.horarioInicio || "—"} às {ev.horarioFim || "—"}</p>}
              {ev.convidados ? <p className="flex gap-2"><Users className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />{ev.convidados} convidados</p> : null}
              {ev.espaco && <p className="flex gap-2"><MapPin className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />{ev.espaco}</p>}
              {(ev.clienteNome || ev.clienteTelefone) && <p className="flex gap-2"><Phone className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />{ev.clienteNome}{ev.clienteTelefone ? ` · ${ev.clienteTelefone}` : ""}</p>}
              {ev.responsavel && <p className="text-xs text-slate-400">Responsável pelo evento: <span className="text-slate-200">{ev.responsavel}</span></p>}
            </div>
            {[["Cardápio", ev.cardapio], ["Bebidas", ev.bebidas], ["Fornecedores externos", ev.fornecedoresExternos], ["Observações", ev.observacoes]].map(([titulo, txt]) => txt ? (
              <div key={titulo} className="mt-3">
                <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">{titulo}</p>
                <p className="text-sm text-slate-300 whitespace-pre-wrap">{txt}</p>
              </div>
            ) : null)}
          </div>

          {(ev.valorTotal || ev.valorPago) ? (
            <div className={card}>
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3"><Wallet className="h-4 w-4 text-emerald-400" /> Financeiro</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-[10px] text-slate-500 uppercase">Total</p><p className="text-sm font-bold text-white">{formatBRL(ev.valorTotal)}</p></div>
                <div><p className="text-[10px] text-slate-500 uppercase">Recebido</p><p className="text-sm font-bold text-emerald-400">{formatBRL(ev.valorPago)}</p></div>
                <div><p className="text-[10px] text-slate-500 uppercase">Saldo</p><p className={`text-sm font-bold ${saldo > 0 ? "text-amber-300" : "text-emerald-400"}`}>{formatBRL(saldo)}</p></div>
              </div>
              {ev.status === "Realizado" && onNavigate && (
                <button onClick={() => onNavigate("balanco_eventos")} className="text-[11px] text-cyan-400 hover:underline mt-3 cursor-pointer">Lançar o balanço deste evento →</button>
              )}
            </div>
          ) : null}

          <button onClick={excluir} className={`text-xs flex items-center gap-1 cursor-pointer ${confirmarExclusao ? "text-rose-400 font-semibold" : "text-slate-500 hover:text-rose-400"}`}>
            <Trash2 className="h-3.5 w-3.5" /> {confirmarExclusao ? "Toque de novo para excluir definitivamente" : "Excluir evento"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulário de criação/edição
// ---------------------------------------------------------------------------
function FormEvento({ inicial, onCancel, onSaved }: { inicial: Evento; onCancel: () => void; onSaved: (id: string) => void }) {
  const [f, setF] = useState<Evento>(inicial);
  const [salvando, setSalvando] = useState(false);
  const editando = !!inicial.id;
  const mudouModelo = editando && (f.tipo !== inicial.tipo || f.formato !== inicial.formato);
  const [refazerChecklist, setRefazerChecklist] = useState(false);

  const set = (campo: keyof Evento, valor: any) => setF(prev => ({ ...prev, [campo]: valor }));
  // null (e não undefined) para que apagar um valor também apague no banco ao editar
  const num = (v: string): any => (v.trim() === "" ? null : Number(v));
  // Valores em R$ ficam como texto enquanto digita ("1.500,50") e viram número ao salvar
  const paraTexto = (n?: number | null) => (n || n === 0 ? n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");
  const paraNumero = (s: string): any => {
    const t = s.trim().replace(/[R$\s]/g, "");
    if (!t) return null;
    const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
    return isFinite(n) ? n : null;
  };
  const [valorTotalTxt, setValorTotalTxt] = useState(paraTexto(inicial.valorTotal));
  const [valorPagoTxt, setValorPagoTxt] = useState(paraTexto(inicial.valorPago));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.nome.trim() || !f.data) return;
    setSalvando(true);
    try {
      const { id, createdAt, ...dados } = f;
      dados.nome = f.nome.trim();
      dados.valorTotal = paraNumero(valorTotalTxt);
      dados.valorPago = paraNumero(valorPagoTxt);
      if (!editando || (mudouModelo && refazerChecklist)) {
        // mantém tarefas personalizadas já concluídas? Não: checklist novo do modelo escolhido
        dados.tarefas = gerarTarefas(f.tipo, f.formato);
      }
      if (editando) {
        await appDb.update("eventos", id!, dados);
        onSaved(id!);
      } else {
        const novo = await appDb.add("eventos", dados);
        onSaved(novo.id);
      }
    } catch (err: any) {
      alert("Não foi possível salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar} className="space-y-5 font-sans max-w-3xl">
      <button type="button" onClick={onCancel} className="text-sm text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer">
        <ArrowLeft className="h-4 w-4" /> Cancelar
      </button>
      <h2 className="text-2xl font-bold tracking-tight text-white">{editando ? "Editar evento" : "Novo evento"}</h2>

      <div className={`${card} space-y-4`}>
        <div>
          <label className={labelCls}>Nome do evento *</label>
          <input value={f.nome} onChange={e => set("nome", e.target.value)} placeholder="Ex.: Aniversário da Ana · Confraternização Empresa X" className={inputCls} required />
        </div>
        <div>
          <label className={labelCls}>Formato *</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FORMATOS.map(fm => (
              <button type="button" key={fm.id} onClick={() => set("formato", fm.id as FormatoEvento)}
                className={`text-left p-3 rounded-xl border transition cursor-pointer ${f.formato === fm.id ? "border-cyan-500/60 bg-cyan-500/10" : "border-slate-800 hover:border-slate-700"}`}>
                <div className="text-sm font-semibold text-white">{fm.nome}</div>
                <div className="text-[11px] text-slate-400">{fm.descricao}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className={labelCls}>Tipo *</label>
            <select value={f.tipo} onChange={e => set("tipo", e.target.value as TipoEvento)} className={inputCls}>
              {TIPOS_EVENTO.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Status</label>
            <select value={f.status} onChange={e => set("status", e.target.value as StatusEvento)} className={inputCls}>
              {STATUS_EVENTO.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-span-2 sm:col-span-2">
            <label className={labelCls}>Data *</label>
            <input type="date" value={f.data} onChange={e => set("data", e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label className={labelCls}>Início</label>
            <input type="time" value={f.horarioInicio || ""} onChange={e => set("horarioInicio", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Término</label>
            <input type="time" value={f.horarioFim || ""} onChange={e => set("horarioFim", e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Convidados</label>
            <input type="number" min={1} value={f.convidados ?? ""} onChange={e => set("convidados", num(e.target.value))} className={inputCls} />
          </div>
          <div className="col-span-1 sm:col-span-3">
            <label className={labelCls}>Espaço / área</label>
            <input value={f.espaco || ""} onChange={e => set("espaco", e.target.value)} placeholder="Ex.: Área externa · Deck" className={inputCls} />
          </div>
        </div>
        {mudouModelo && (
          <label className="flex items-start gap-2 text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <input type="checkbox" checked={refazerChecklist} onChange={e => setRefazerChecklist(e.target.checked)} className="mt-1" />
            Recriar o checklist com o modelo do novo tipo/formato (as tarefas atuais e o que já foi marcado serão substituídos).
          </label>
        )}
        {!editando && <p className="text-[11px] text-slate-500">O checklist com prazos é criado automaticamente conforme o formato e o tipo. Depois você ajusta, inclui ou remove tarefas.</p>}
      </div>

      <div className={`${card} space-y-4`}>
        <h3 className="text-sm font-bold text-white">Cliente</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label className={labelCls}>Nome</label><input value={f.clienteNome || ""} onChange={e => set("clienteNome", e.target.value)} className={inputCls} /></div>
          <div><label className={labelCls}>WhatsApp</label><input value={f.clienteTelefone || ""} onChange={e => set("clienteTelefone", e.target.value)} placeholder="(83) 99999-0000" className={inputCls} /></div>
          <div><label className={labelCls}>E-mail</label><input type="email" value={f.clienteEmail || ""} onChange={e => set("clienteEmail", e.target.value)} className={inputCls} /></div>
        </div>
      </div>

      <div className={`${card} space-y-4`}>
        <h3 className="text-sm font-bold text-white">Serviço e financeiro</h3>
        <div><label className={labelCls}>Cardápio</label><textarea rows={2} value={f.cardapio || ""} onChange={e => set("cardapio", e.target.value)} placeholder="Ex.: Menu fechado de 3 tempos · À la carte" className={inputCls} /></div>
        <div><label className={labelCls}>Bebidas</label><textarea rows={2} value={f.bebidas || ""} onChange={e => set("bebidas", e.target.value)} placeholder="Ex.: Open bar 4h · Consumo na comanda" className={inputCls} /></div>
        <div><label className={labelCls}>Fornecedores externos</label><textarea rows={2} value={f.fornecedoresExternos || ""} onChange={e => set("fornecedoresExternos", e.target.value)} placeholder="Ex.: DJ do cliente · Decoração Flores X · Bolo trazido pelo cliente" className={inputCls} /></div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><label className={labelCls}>Valor total (R$)</label><input inputMode="decimal" value={valorTotalTxt} onChange={e => setValorTotalTxt(e.target.value)} placeholder="0,00" className={inputCls} /></div>
          <div><label className={labelCls}>Valor recebido (R$)</label><input inputMode="decimal" value={valorPagoTxt} onChange={e => setValorPagoTxt(e.target.value)} placeholder="0,00" className={inputCls} /></div>
          <div className="col-span-2 sm:col-span-1"><label className={labelCls}>Responsável pelo evento</label><input value={f.responsavel || ""} onChange={e => set("responsavel", e.target.value)} className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Observações (vão para o Briefing do Turno)</label><textarea rows={2} value={f.observacoes || ""} onChange={e => set("observacoes", e.target.value)} placeholder="Ex.: Cliente com restrição a glúten · Mesa do aniversariante ao centro" className={inputCls} /></div>
      </div>

      <div className="flex gap-2">
        <button type="submit" className={btnPrim} disabled={salvando || !f.nome.trim() || !f.data}>{salvando ? "Salvando…" : editando ? "Salvar alterações" : "Criar evento"}</button>
        <button type="button" onClick={onCancel} className={btnSec}>Cancelar</button>
      </div>
    </form>
  );
}
