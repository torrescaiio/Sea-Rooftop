import React, { useEffect, useMemo, useState } from "react";
import { appDb } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Megaphone, Send, Copy, Check, History, AlertTriangle, X, Plus } from "lucide-react";
import { dataLocal, parseDataLocal } from "../rotinaUtils";

// Cada seção precisa estar preenchida OU marcada como "nada hoje".
// É isso que impede de esquecer de avisar alguma coisa.
type Secao = "horarios" | "atracao" | "reservas" | "falta" | "vender" | "recados";

interface Briefing {
  id?: string;
  data: string;
  turno: string;
  chegadaEquipe: string;
  abertura: string;
  atracao: string;
  reservas: string;
  emFalta: string[];
  vender: string;
  recados: string;
  nadaHoje: Secao[];
  texto?: string;
  enviado?: boolean;
  enviadoPor?: string;
  createdAt?: string;
}

const card = "bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5";
const inputCls = "bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50";
const btnPrim = "inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition cursor-pointer disabled:opacity-50";
const btnSec = "inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-sm px-3 py-2 rounded-lg transition cursor-pointer";

const NOMES: Record<Secao, string> = {
  horarios: "Horários", atracao: "Atração", reservas: "Reservas e eventos",
  falta: "Itens em falta", vender: "O que vender", recados: "Recados",
};

const vazio = (data: string): Briefing => ({
  data, turno: "Noite", chegadaEquipe: "", abertura: "", atracao: "", reservas: "",
  emFalta: [], vender: "", recados: "", nadaHoje: [],
});

export const montarTexto = (b: Briefing): string => {
  const d = parseDataLocal(b.data);
  const dia = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const nada = (s: Secao) => b.nadaHoje.includes(s);
  const linhas: string[] = [`*📋 BRIEFING · ${dia.charAt(0).toUpperCase() + dia.slice(1)} (${b.turno})*`, ""];

  if (!nada("horarios") && (b.chegadaEquipe || b.abertura)) {
    linhas.push("*⏰ Horários*");
    if (b.chegadaEquipe) linhas.push(`• Chegada da equipe: *${b.chegadaEquipe}*`);
    if (b.abertura) linhas.push(`• Abertura da casa: *${b.abertura}*`);
    linhas.push("");
  }
  if (!nada("atracao") && b.atracao.trim()) linhas.push("*🎵 Atração*", b.atracao.trim(), "");
  linhas.push("*📅 Reservas e eventos*", nada("reservas") || !b.reservas.trim() ? "Sem reservas grandes ou eventos." : b.reservas.trim(), "");
  linhas.push("*🚫 Em falta hoje (não vender)*", nada("falta") || !b.emFalta.length ? "Nada em falta. Cardápio completo." : b.emFalta.map(i => `• ${i}`).join("\n"), "");
  if (!nada("vender") && b.vender.trim()) linhas.push("*⭐ Foco de venda*", b.vender.trim(), "");
  if (!nada("recados") && b.recados.trim()) linhas.push("*📢 Recados*", b.recados.trim(), "");
  linhas.push("Bom serviço a todos.");
  return linhas.join("\n");
};

export default function BriefingModule() {
  const { user } = useAuth();
  const [historico, setHistorico] = useState<Briefing[]>([]);
  const [agenda, setAgenda] = useState<any[]>([]);
  const [b, setB] = useState<Briefing>(vazio(dataLocal()));
  const [novoItem, setNovoItem] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [verHistorico, setVerHistorico] = useState(false);

  useEffect(() => {
    const u1 = appDb.subscribe("briefings", setHistorico);
    const u2 = appDb.subscribe("agenda_eventos", setAgenda);
    return () => { u1(); u2(); };
  }, []);

  // Puxa a atração da Agenda para a data escolhida
  const atracoesDoDia = useMemo(
    () => agenda.filter(a => a.data === b.data && a.status !== "Cancelado"),
    [agenda, b.data]
  );
  useEffect(() => {
    if (b.atracao || !atracoesDoDia.length) return;
    const txt = atracoesDoDia.map(a =>
      `${a.artistaNome} (${a.tipoEvento})${a.horarioPassagemSom ? ` · passagem de som ${a.horarioPassagemSom}` : ""}${a.horarioInicio ? ` · ${a.horarioInicio}${a.horarioTermino ? ` às ${a.horarioTermino}` : ""}` : ""}${a.status === "A Confirmar" ? " ⚠️ a confirmar" : ""}`
    ).join("\n");
    setB(prev => ({ ...prev, atracao: txt }));
  }, [atracoesDoDia]); // eslint-disable-line react-hooks/exhaustive-deps

  const ultimo = historico.find(h => h.data < b.data) || historico[0];
  const jaEnviadoHoje = historico.find(h => h.data === b.data && h.enviado);

  const nada = (s: Secao) => b.nadaHoje.includes(s);
  const toggleNada = (s: Secao) =>
    setB(prev => ({ ...prev, nadaHoje: nada(s) ? prev.nadaHoje.filter(x => x !== s) : [...prev.nadaHoje, s] }));

  const preenchida: Record<Secao, boolean> = {
    horarios: !!(b.chegadaEquipe || b.abertura),
    atracao: !!b.atracao.trim(),
    reservas: !!b.reservas.trim(),
    falta: b.emFalta.length > 0,
    vender: !!b.vender.trim(),
    recados: !!b.recados.trim(),
  };
  const faltando = (Object.keys(NOMES) as Secao[]).filter(s => !preenchida[s] && !nada(s));
  const texto = montarTexto(b);

  const addFalta = (e?: React.FormEvent) => {
    e?.preventDefault();
    const itens = novoItem.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    if (!itens.length) return;
    setB(prev => ({ ...prev, emFalta: [...prev.emFalta, ...itens.filter(i => !prev.emFalta.includes(i))], nadaHoje: prev.nadaHoje.filter(x => x !== "falta") }));
    setNovoItem("");
  };

  const usarUltimo = () => {
    if (!ultimo) return;
    setB(prev => ({
      ...prev,
      turno: ultimo.turno, chegadaEquipe: ultimo.chegadaEquipe, abertura: ultimo.abertura,
      vender: ultimo.vender, emFalta: ultimo.emFalta || [],
    }));
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      const { id, ...dados } = b;
      const docId = `${b.data}_${b.turno}`;
      await appDb.set("briefings", docId, {
        ...dados, texto, enviado: true,
        enviadoPor: user?.displayName || user?.email || "",
        createdAt: new Date().toISOString(),
      });
    } finally {
      setSalvando(false);
    }
  };

  // Com seções pendentes, o 1º toque só avisa; o 2º envia mesmo assim
  const [confirmarEnvio, setConfirmarEnvio] = useState(false);
  useEffect(() => { if (!faltando.length) setConfirmarEnvio(false); }, [faltando.length]);

  const enviarWhatsApp = async () => {
    if (faltando.length && !confirmarEnvio) { setConfirmarEnvio(true); return; }
    setConfirmarEnvio(false);
    // abre a janela antes do await para o navegador do celular não bloquear
    const janela = window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
    try {
      await salvar();
    } catch (err: any) {
      alert("A mensagem foi aberta no WhatsApp, mas não foi possível salvar no histórico: " + err.message);
    }
    if (!janela) window.location.href = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      await salvar();
    } catch (err: any) {
      alert("Não foi possível copiar ou salvar: " + err.message);
    }
  };

  const BotaoNada = ({ s }: { s: Secao }) => (
    <button type="button" onClick={() => toggleNada(s)}
      className={`text-[11px] px-2 py-0.5 rounded-full border transition cursor-pointer ${nada(s) ? "bg-slate-700 border-slate-600 text-slate-200" : "border-slate-700 text-slate-500 hover:text-slate-300"}`}>
      {nada(s) ? "✓ Nada hoje" : "Nada hoje"}
    </button>
  );

  const Titulo = ({ s, children }: { s: Secao; children?: React.ReactNode }) => (
    <div className="flex items-center justify-between mb-2">
      <label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
        <span className={preenchida[s] || nada(s) ? "text-emerald-400" : "text-amber-400"}>{preenchida[s] || nada(s) ? "●" : "○"}</span>
        <span className="text-slate-300">{NOMES[s]}</span>
        {children}
      </label>
      {!preenchida[s] && <BotaoNada s={s} />}
    </div>
  );

  return (
    <div className="space-y-5 font-sans max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-cyan-400" /> Briefing do Turno
          </h2>
          <p className="text-sm text-slate-400">Comunicado único para a equipe. Cada seção deve ser preenchida ou marcada como "Nada hoje".</p>
        </div>
        <div className="flex gap-2">
          {ultimo && <button onClick={usarUltimo} className={btnSec} title="Copia horários, foco de venda e itens em falta do último briefing">Usar o anterior como base</button>}
          <button onClick={() => setVerHistorico(true)} className={btnSec}><History className="h-4 w-4" /></button>
        </div>
      </div>

      {jaEnviadoHoje && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
          O briefing de {b.data.split("-").reverse().join("/")} ({jaEnviadoHoje.turno}) já foi enviado por {jaEnviadoHoje.enviadoPor || "outro usuário"}. Um novo envio substitui o registro.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Formulário */}
        <div className="space-y-4">
          <div className={`${card} grid grid-cols-2 gap-3`}>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Data</label>
              <input type="date" value={b.data} onChange={e => setB({ ...vazio(e.target.value), turno: b.turno })} className={`${inputCls} w-full`} />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Turno</label>
              <select value={b.turno} onChange={e => setB({ ...b, turno: e.target.value })} className={`${inputCls} w-full`}>
                <option>Noite</option><option>Tarde</option><option>Almoço</option><option>Dia todo</option>
              </select>
            </div>
          </div>

          <div className={card}>
            <Titulo s="horarios" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Chegada da equipe</label>
                <input type="time" value={b.chegadaEquipe} onChange={e => setB({ ...b, chegadaEquipe: e.target.value })} className={`${inputCls} w-full`} />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Abertura da casa</label>
                <input type="time" value={b.abertura} onChange={e => setB({ ...b, abertura: e.target.value })} className={`${inputCls} w-full`} />
              </div>
            </div>
          </div>

          <div className={card}>
            <Titulo s="atracao">{atracoesDoDia.length > 0 && <span className="text-[10px] normal-case text-cyan-400 font-normal">(puxado da Agenda)</span>}</Titulo>
            <textarea value={b.atracao} onChange={e => setB({ ...b, atracao: e.target.value })} rows={2}
              placeholder="Ex.: Banda X · passagem de som 16h · 19h às 22h" className={`${inputCls} w-full`} />
          </div>

          <div className={card}>
            <Titulo s="reservas" />
            <textarea value={b.reservas} onChange={e => setB({ ...b, reservas: e.target.value })} rows={3}
              placeholder={"Ex.:\n• 20h · Aniversário da Ana · 15 pessoas · área externa · bolo próprio\n• 21h · Mesa 8 · cliente VIP"} className={`${inputCls} w-full`} />
          </div>

          <div className={card}>
            <Titulo s="falta" />
            <form onSubmit={addFalta} className="flex gap-2">
              <input value={novoItem} onChange={e => setNovoItem(e.target.value)} placeholder="Ex.: camarão, gin tônica de frutas vermelhas" className={`${inputCls} flex-1`} />
              <button type="submit" className={btnSec} disabled={!novoItem.trim()}><Plus className="h-4 w-4" /></button>
            </form>
            {b.emFalta.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {b.emFalta.map(i => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-full pl-2.5 pr-1 py-0.5">
                    {i}
                    <button onClick={() => setB({ ...b, emFalta: b.emFalta.filter(x => x !== i) })} className="hover:text-white cursor-pointer"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={card}>
            <Titulo s="vender" />
            <textarea value={b.vender} onChange={e => setB({ ...b, vender: e.target.value })} rows={2}
              placeholder="Ex.: Oferecer o espumante da semana em toda mesa de casal; meta de 10 porções de camarão" className={`${inputCls} w-full`} />
          </div>

          <div className={card}>
            <Titulo s="recados" />
            <textarea value={b.recados} onChange={e => setB({ ...b, recados: e.target.value })} rows={3}
              placeholder="Ex.: Uniforme completo; ar-condicionado do salão em manutenção; João de folga, Maria cobre o bar" className={`${inputCls} w-full`} />
          </div>
        </div>

        {/* Prévia */}
        <div className="lg:sticky lg:top-0 self-start space-y-3">
          <div className={card}>
            <p className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase mb-2">Prévia da mensagem</p>
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-200 bg-[#0b141a] border border-[#1f2c33] rounded-xl p-4 leading-relaxed">{texto}</pre>
          </div>

          {faltando.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Seções pendentes: <b>{faltando.map(s => NOMES[s]).join(", ")}</b>. Preencha ou marque "Nada hoje".
                {confirmarEnvio && <><br /><b>Toque em "Enviar mesmo assim" para enviar com essas seções em branco.</b></>}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={enviarWhatsApp} className={btnPrim} disabled={salvando}><Send className="h-4 w-4" /> {confirmarEnvio ? "Enviar mesmo assim" : "Enviar no WhatsApp"}</button>
            <button onClick={copiar} className={btnSec} disabled={salvando}>{copiado ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar texto</>}</button>
          </div>
          <p className="text-[11px] text-slate-500">Ao enviar ou copiar, o briefing é salvo no histórico e marcado como enviado no Meu Dia.</p>
        </div>
      </div>

      {verHistorico && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setVerHistorico(false)}>
          <div className="bg-[#0b0b0b] border border-slate-800 w-full sm:max-w-xl max-h-[85dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Briefings enviados</h3>
              <button onClick={() => setVerHistorico(false)} className="text-slate-400 hover:text-white cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            {historico.length === 0 && <p className="text-sm text-slate-500">Nenhum ainda.</p>}
            {historico.slice(0, 30).map(h => (
              <details key={h.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
                <summary className="text-sm text-slate-200 cursor-pointer">
                  {h.data.split("-").reverse().join("/")} · {h.turno} <span className="text-slate-500 text-xs">· {h.enviadoPor}</span>
                </summary>
                <pre className="whitespace-pre-wrap font-sans text-xs text-slate-300 mt-2">{h.texto}</pre>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
