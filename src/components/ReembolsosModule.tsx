import React, { useEffect, useMemo, useState } from "react";
import { appDb } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  Receipt, Plus, FileDown, Copy, Check, Trash2, Camera, Paperclip, CheckCircle2, Circle, X, Send
} from "lucide-react";
import { dataLocal } from "../rotinaUtils";
import {
  Despesa, Diaria, CATEGORIAS_DESPESA, brl, dataBR, diaSemana,
  montarItens, totais, montarTexto, gerarPDF, comprimirImagem
} from "../reembolsosUtils";

interface Props { onNavigate?: (m: string) => void }

const card = "bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5";
const inputCls = "bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 w-full";
const labelCls = "text-[11px] text-slate-400 block mb-1";
const btnPrim = "inline-flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm px-4 py-2 rounded-lg transition cursor-pointer disabled:opacity-50";
const btnSec = "inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm px-3 py-2 rounded-lg transition cursor-pointer disabled:opacity-50";

const lerPreferencia = (chave: string, padrao: string) => {
  try { return localStorage.getItem(chave) || padrao; } catch { return padrao; }
};
const salvarPreferencia = (chave: string, valor: string) => {
  try { localStorage.setItem(chave, valor); } catch { /* sem armazenamento local */ }
};

const paraNumero = (s: string): number | null => {
  const t = s.trim().replace(/[R$\s]/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return isFinite(n) && n > 0 ? n : null;
};

export default function ReembolsosModule({ onNavigate }: Props) {
  const { user } = useAuth();
  const hoje = dataLocal();
  const [inicio, setInicio] = useState(dataLocal(new Date(Date.now() - 7 * 86400000)));
  const [fim, setFim] = useState(hoje);
  const [reembolsarA, setReembolsarA] = useState(() => lerPreferencia("reembolsos_reembolsarA", "Amauri"));

  const [diariasTodas, setDiariasTodas] = useState<Diaria[]>([]);
  const [despesasTodas, setDespesasTodas] = useState<Despesa[]>([]);
  const [loading, setLoading] = useState(true);

  const [mostrarForm, setMostrarForm] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [confirmarEnvio, setConfirmarEnvio] = useState(false);
  const [apagando, setApagando] = useState<string | null>(null);

  useEffect(() => {
    const u1 = appDb.subscribe("extras_semana", d => { setDiariasTodas(d); setLoading(false); }, () => setLoading(false));
    const u2 = appDb.subscribe("reembolsos", setDespesasTodas);
    return () => { u1(); u2(); };
  }, []);

  useEffect(() => { salvarPreferencia("reembolsos_reembolsarA", reembolsarA); }, [reembolsarA]);

  const noPeriodo = (d: string) => d >= inicio && d <= fim;
  const diarias = useMemo(() => diariasTodas.filter(x => noPeriodo(x.data)), [diariasTodas, inicio, fim]); // eslint-disable-line react-hooks/exhaustive-deps
  const despesas = useMemo(() => despesasTodas.filter(x => noPeriodo(x.data)), [despesasTodas, inicio, fim]); // eslint-disable-line react-hooks/exhaustive-deps
  const itens = useMemo(() => montarItens(diarias, despesas, reembolsarA || "Amauri"), [diarias, despesas, reembolsarA]);
  const t = totais(itens);
  const numeroDe = (tipo: string, id?: string) => itens.find(i => i.tipo === tipo && i.id === id)?.n;

  // ---------------- ações ----------------
  const alternarEnviado = async (colecao: "extras_semana" | "reembolsos", id: string, enviado: boolean) => {
    try {
      await appDb.update(colecao, id, { enviadoFinanceiroEm: enviado ? null : new Date().toISOString() });
    } catch (err: any) {
      alert("Não foi possível atualizar: " + err.message);
    }
  };

  const marcarPendentesComoEnviados = async () => {
    if (!confirmarEnvio) { setConfirmarEnvio(true); return; }
    setConfirmarEnvio(false);
    const agora = new Date().toISOString();
    try {
      for (const it of itens.filter(i => !i.enviado)) {
        await appDb.update(it.tipo === "diaria" ? "extras_semana" : "reembolsos", it.id, { enviadoFinanceiroEm: agora });
      }
    } catch (err: any) {
      alert("Não foi possível marcar todos os itens: " + err.message);
    }
  };

  const excluirDespesa = async (d: Despesa) => {
    if (!d.id) return;
    if (apagando !== d.id) { setApagando(d.id); return; }
    setApagando(null);
    try {
      await appDb.delete("reembolsos", d.id);
      if (d.temComprovante) await appDb.delete("reembolsos_comprovantes", d.id);
    } catch (err: any) {
      alert("Não foi possível excluir: " + err.message);
    }
  };

  const copiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(montarTexto(itens, inicio, fim, reembolsarA || "Amauri"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err: any) {
      alert("Não foi possível copiar: " + err.message);
    }
  };

  const baixarPDF = async () => {
    setGerando(true);
    try {
      await gerarPDF(itens, inicio, fim, reembolsarA || "Amauri", user?.displayName || user?.email || "",
        async id => (await appDb.get("reembolsos_comprovantes", id))?.imagem || null);
    } catch (err: any) {
      alert("Não foi possível gerar o PDF: " + err.message);
    } finally {
      setGerando(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-48"><div className="h-8 w-8 border-t-2 border-r-2 border-cyan-400 rounded-full animate-spin" /></div>;
  }

  const diariasPorDia = new Map<string, Diaria[]>();
  [...diarias].sort((a, b) => a.data.localeCompare(b.data)).forEach(d => diariasPorDia.set(d.data, [...(diariasPorDia.get(d.data) || []), d]));

  return (
    <div className="space-y-5 font-sans max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Receipt className="h-6 w-6 text-cyan-400" /> Reembolsos
          </h2>
          <p className="text-sm text-slate-400">Diárias e despesas pagas do próprio bolso, organizadas para envio ao financeiro.</p>
        </div>
        <button onClick={() => setMostrarForm(true)} className={btnPrim}><Plus className="h-4 w-4" /> Lançar despesa</button>
      </div>

      {/* Período */}
      <div className={`${card} grid grid-cols-2 sm:grid-cols-3 gap-3`}>
        <div><label className={labelCls}>De</label><input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Até</label><input type="date" value={fim} onChange={e => setFim(e.target.value)} className={inputCls} /></div>
        <div className="col-span-2 sm:col-span-1"><label className={labelCls}>Reembolso a</label><input value={reembolsarA} onChange={e => setReembolsarA(e.target.value)} className={inputCls} /></div>
      </div>

      {/* Totais */}
      <div className="grid grid-cols-3 gap-3">
        <div className={card}><p className="text-[10px] uppercase tracking-wider text-slate-500">Já enviado</p><p className="text-lg sm:text-2xl font-bold text-slate-300">{brl(t.enviado)}</p></div>
        <div className={`${card} border-amber-500/30`}><p className="text-[10px] uppercase tracking-wider text-amber-400">A enviar</p><p className="text-lg sm:text-2xl font-bold text-amber-300">{brl(t.pendente)}</p></div>
        <div className={card}><p className="text-[10px] uppercase tracking-wider text-slate-500">Total do período</p><p className="text-lg sm:text-2xl font-bold text-white">{brl(t.total)}</p></div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        <button onClick={baixarPDF} className={btnPrim} disabled={gerando || !itens.length}><FileDown className="h-4 w-4" /> {gerando ? "Gerando…" : "Baixar PDF"}</button>
        <button onClick={copiarTexto} className={btnSec} disabled={!itens.length}>{copiado ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar texto (WhatsApp)</>}</button>
        {t.pendente > 0 && (
          <button onClick={marcarPendentesComoEnviados} className={`${btnSec} ${confirmarEnvio ? "!bg-emerald-700 !border-emerald-600 text-white" : ""}`}>
            <Send className="h-4 w-4" /> {confirmarEnvio ? `Confirmar: marcar ${itens.filter(i => !i.enviado).length} itens como enviados` : "Marcar pendentes como enviados"}
          </button>
        )}
        {confirmarEnvio && <button onClick={() => setConfirmarEnvio(false)} className="text-sm text-slate-400 hover:text-white px-2 cursor-pointer">Cancelar</button>}
      </div>
      <p className="text-[11px] text-slate-500 -mt-3">Os itens são numerados na mesma ordem do PDF e do texto. Comprovantes anexados saem no fim do PDF, 6 por folha.</p>

      {/* Diárias */}
      <div className={card}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">Diárias do período <span className="text-slate-500 font-normal">({diarias.length} · {brl(diarias.reduce((s, d) => s + (Number(d.valor) || 0), 0))})</span></h3>
          {onNavigate && <button onClick={() => onNavigate("extras")} className="text-[11px] text-cyan-400 hover:underline cursor-pointer">Lançar diárias →</button>}
        </div>
        {diarias.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma diária lançada no período.</p>
        ) : (
          <div className="space-y-4">
            {[...diariasPorDia.entries()].map(([dia, lista]) => (
              <div key={dia}>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  {dataBR(dia)} · {diaSemana(dia)} · {lista.length} diária{lista.length > 1 ? "s" : ""} · {brl(lista.reduce((s, d) => s + (Number(d.valor) || 0), 0))}
                </p>
                {lista.map(d => {
                  const enviado = !!d.enviadoFinanceiroEm;
                  return (
                    <div key={d.id} className="flex items-center gap-3 py-1.5 border-b border-slate-800/60 last:border-0">
                      <span className="text-[11px] text-slate-500 font-mono w-6 text-right">{numeroDe("diaria", d.id)}</span>
                      <div className="flex-1 min-w-0 text-sm text-slate-200 truncate">{d.nome} <span className="text-slate-500">· {d.funcao}{d.motivo ? ` · ${d.motivo}` : ""}</span></div>
                      <span className="text-sm font-mono text-slate-200">{brl(Number(d.valor) || 0)}</span>
                      <BotaoEnviado enviado={enviado} onClick={() => alternarEnviado("extras_semana", d.id!, enviado)} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Despesas */}
      <div className={card}>
        <h3 className="text-sm font-bold text-white mb-3">Outras despesas <span className="text-slate-500 font-normal">({despesas.length} · {brl(despesas.reduce((s, d) => s + (Number(d.valor) || 0), 0))})</span></h3>
        {despesas.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma despesa lançada no período.</p>
        ) : (
          [...despesas].sort((a, b) => a.data.localeCompare(b.data)).map(d => {
            const enviado = !!d.enviadoFinanceiroEm;
            return (
              <div key={d.id} className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0">
                <span className="text-[11px] text-slate-500 font-mono w-6 text-right">{numeroDe("despesa", d.id)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-200 flex items-center gap-1.5">
                    <span className="truncate">{d.descricao}</span>
                    {d.temComprovante && <Paperclip className="h-3.5 w-3.5 text-cyan-400 shrink-0" />}
                  </div>
                  <div className="text-[11px] text-slate-500">{dataBR(d.data)} · {d.categoria} · pago por {d.pagoPor}{d.observacao ? ` · ${d.observacao}` : ""}</div>
                </div>
                <span className="text-sm font-mono text-slate-200">{brl(Number(d.valor) || 0)}</span>
                <BotaoEnviado enviado={enviado} onClick={() => alternarEnviado("reembolsos", d.id!, enviado)} />
                {apagando === d.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => excluirDespesa(d)} className="text-[11px] font-semibold bg-rose-600 hover:bg-rose-500 text-white px-2 py-1 rounded cursor-pointer">Excluir</button>
                    <button onClick={() => setApagando(null)} className="text-[11px] text-slate-400 hover:text-white px-1 cursor-pointer">Cancelar</button>
                  </div>
                ) : (
                  <button onClick={() => excluirDespesa(d)} className="text-slate-600 hover:text-rose-400 cursor-pointer" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            );
          })
        )}
      </div>

      {mostrarForm && <FormDespesa padraoPagoPor={reembolsarA || "Amauri"} onClose={() => setMostrarForm(false)} />}
    </div>
  );
}

function BotaoEnviado({ enviado, onClick }: { enviado: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={enviado ? "Enviado ao financeiro (toque para desfazer)" : "Pendente de envio (toque para marcar como enviado)"}
      className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border cursor-pointer ${enviado ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" : "bg-amber-500/10 text-amber-300 border-amber-500/30"}`}>
      {enviado ? <CheckCircle2 className="h-3 w-3" /> : <Circle className="h-3 w-3" />}
      <span className="hidden sm:inline">{enviado ? "Enviado" : "Pendente"}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Lançar despesa
// ---------------------------------------------------------------------------
function FormDespesa({ padraoPagoPor, onClose }: { padraoPagoPor: string; onClose: () => void }) {
  const [f, setF] = useState({ data: dataLocal(), descricao: "", categoria: "Compras", valor: "", pagoPor: padraoPagoPor, observacao: "", jaEnviado: false });
  const [foto, setFoto] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const escolherFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arq = e.target.files?.[0];
    if (!arq) return;
    setErro("");
    try { setFoto(await comprimirImagem(arq)); } catch (err: any) { setErro(err.message); }
  };

  const valor = paraNumero(f.valor);
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.descricao.trim() || !valor) { setErro("Preencha a descrição e um valor válido."); return; }
    setSalvando(true);
    try {
      const novo = await appDb.add("reembolsos", {
        data: f.data, descricao: f.descricao.trim(), categoria: f.categoria, valor,
        pagoPor: f.pagoPor.trim() || padraoPagoPor, observacao: f.observacao.trim(),
        temComprovante: !!foto, enviadoFinanceiroEm: f.jaEnviado ? new Date().toISOString() : null,
      });
      if (foto) {
        await appDb.set("reembolsos_comprovantes", novo.id, { imagem: foto, reembolsoId: novo.id, createdAt: new Date().toISOString() });
      }
      onClose();
    } catch (err: any) {
      setErro("Não foi possível salvar: " + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form onSubmit={salvar} onClick={e => e.stopPropagation()}
        className="bg-[#0b0b0b] border border-slate-800 w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white">Lançar despesa</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
        </div>
        <div><label className={labelCls}>Descrição *</label><input value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} placeholder="Ex.: Pães para torradas · Uber para compra de ossos" className={inputCls} autoFocus /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Data *</label><input type="date" value={f.data} onChange={e => setF({ ...f, data: e.target.value })} className={inputCls} /></div>
          <div><label className={labelCls}>Valor (R$) *</label><input inputMode="decimal" value={f.valor} onChange={e => setF({ ...f, valor: e.target.value })} placeholder="0,00" className={inputCls} /></div>
          <div><label className={labelCls}>Categoria</label>
            <select value={f.categoria} onChange={e => setF({ ...f, categoria: e.target.value })} className={inputCls}>
              {CATEGORIAS_DESPESA.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label className={labelCls}>Pago por</label><input value={f.pagoPor} onChange={e => setF({ ...f, pagoPor: e.target.value })} className={inputCls} /></div>
        </div>
        <div><label className={labelCls}>Observação (aparece no relatório)</label><input value={f.observacao} onChange={e => setF({ ...f, observacao: e.target.value })} placeholder="Ex.: para o casamento de 20/11" className={inputCls} /></div>

        <div>
          <label className={labelCls}>Comprovante (opcional)</label>
          {foto ? (
            <div className="flex items-center gap-3">
              <img src={foto} alt="Comprovante" className="h-20 rounded-lg border border-slate-700" />
              <button type="button" onClick={() => setFoto(null)} className="text-xs text-slate-400 hover:text-rose-400 cursor-pointer">Remover</button>
            </div>
          ) : (
            <label className={`${btnSec} w-full`}>
              <Camera className="h-4 w-4" /> Foto ou imagem do comprovante
              <input type="file" accept="image/*" onChange={escolherFoto} className="hidden" />
            </label>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={f.jaEnviado} onChange={e => setF({ ...f, jaEnviado: e.target.checked })} />
          Já foi enviado ao financeiro
        </label>

        {erro && <p className="text-sm text-rose-400">{erro}</p>}
        <div className="flex gap-2">
          <button type="submit" className={btnPrim} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</button>
          <button type="button" onClick={onClose} className={btnSec}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}
