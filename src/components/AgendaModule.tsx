import React, { useEffect, useState } from "react";
import { appDb } from "../firebase";
import { AgendaEvent } from "../types";
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Calendar, 
  Clock, 
  Eye, 
  DollarSign, 
  Sliders, 
  PlusCircle, 
  Check, 
  X,
  SlidersHorizontal,
  Info,
  FileDown,
  Pencil
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { formatDateBR } from "../utils";

export default function AgendaModule() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errAgenda, setErrAgenda] = useState<string | null>(null);

  // Focus View Detail Modal states
  const [activeDetailEvent, setActiveDetailEvent] = useState<AgendaEvent | null>(null);

  // Add Event Modal form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [tipoEvento, setTipoEvento] = useState<AgendaEvent["tipoEvento"]>("Música ao Vivo");
  const [artistaNome, setArtistaNome] = useState("");
  const [horarioPassagemSom, setHorarioPassagemSom] = useState("17:30");
  const [horarioInicio, setHorarioInicio] = useState("19:30");
  const [horarioTermino, setHorarioTermino] = useState("23:00");
  const [cacheCusto, setCacheCusto] = useState<number>(500);
  const [necessidadesTecnicas, setNecessidadesTecnicas] = useState("");
  const [chavePix, setChavePix] = useState("");
  const [status, setStatus] = useState<AgendaEvent["status"]>("A Confirmar");

  useEffect(() => {
    const unsubscribe = appDb.subscribe("agenda_eventos", 
      (data) => {
        setEvents(data as AgendaEvent[]);
        setLoading(false);
      },
      (err) => {
        setErrAgenda("Erro ao carregar a agenda de eventos: " + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleOpenAdd = () => {
    setEditEventId(null);
    setData(new Date().toISOString().split("T")[0]);
    setTipoEvento("Música ao Vivo");
    setArtistaNome("");
    setHorarioPassagemSom("17:30");
    setHorarioInicio("19:30");
    setHorarioTermino("23:00");
    setCacheCusto(500);
    setNecessidadesTecnicas("");
    setChavePix("");
    setStatus("A Confirmar");
    setShowAddModal(true);
  };

  const handleOpenEdit = (evt: AgendaEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditEventId(evt.id);
    setData(evt.data);
    setTipoEvento(evt.tipoEvento);
    setArtistaNome(evt.artistaNome);
    setHorarioPassagemSom(evt.horarioPassagemSom);
    setHorarioInicio(evt.horarioInicio);
    setHorarioTermino(evt.horarioTermino);
    setCacheCusto(evt.cacheCusto);
    setNecessidadesTecnicas(evt.necessidadesTecnicas || "");
    setChavePix(evt.chavePix || "");
    setStatus(evt.status);
    setShowAddModal(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artistaNome.trim() || cacheCusto < 0) {
      alert("Por favor insira um nome de artista/atração válido.");
      return;
    }

    try {
      const dataPayload = {
        data,
        tipoEvento,
        artistaNome: artistaNome.trim(),
        horarioPassagemSom,
        horarioInicio,
        horarioTermino,
        cacheCusto: Number(cacheCusto),
        necessidadesTecnicas: necessidadesTecnicas.trim(),
        chavePix: chavePix.trim(),
        status
      };

      if (editEventId) {
        await appDb.update("agenda_eventos", editEventId, dataPayload);
      } else {
        await appDb.add("agenda_eventos", dataPayload);
      }
      appDb.dispatchUpdate();

      setArtistaNome("");
      setNecessidadesTecnicas("");
      setChavePix("");
      setCacheCusto(500);
      setEditEventId(null);
      setShowAddModal(false);
    } catch (err: any) {
      alert("Erro ao salvar atração: " + err.message);
    }
  };

  const handleDeleteEvent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid opening the expanding details dialog
    if (window.confirm("Remover esta atração da agenda do rooftop?")) {
      try {
        await appDb.delete("agenda_eventos", id);
        appDb.dispatchUpdate();
        if (activeDetailEvent?.id === id) {
          setActiveDetailEvent(null);
        }
      } catch (err: any) {
        alert("Erro ao deletar: " + err.message);
      }
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: AgendaEvent["status"]) => {
    try {
      await appDb.update("agenda_eventos", id, { status: newStatus });
      appDb.dispatchUpdate();
      
      // Update local modal view references if expanded
      if (activeDetailEvent && activeDetailEvent.id === id) {
        setActiveDetailEvent(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err: any) {
      alert("Erro ao atualizar status: " + err.message);
    }
  };

  const getEventBadgeClass = (tipo: AgendaEvent["tipoEvento"]) => {
    switch (tipo) {
      case "Música ao Vivo": return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
      case "DJ": return "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20";
      case "Transmissão Esportiva": return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
      case "Evento Fechado": return "bg-rose-500/10 text-rose-450 border border-rose-500/20";
      default: return "bg-slate-950 text-slate-400 border border-slate-850";
    }
  };

  // Group events by date (sorted)
  const sortedEvents = [...events].sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Relatório da Agenda de Eventos", 14, 15);
    
    const tableColumn = ["Data", "Atração", "Tipo", "Chave PIX", "Cachê", "Status"];
    const tableRows: any[] = [];
    
    sortedEvents.forEach(evt => {
      const rowData = [
        formatDateBR(evt.data),
        evt.artistaNome,
        evt.tipoEvento,
        evt.chavePix || "N/A",
        `R$ ${(evt.cacheCusto || 0).toFixed(2)}`,
        evt.status
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });
    
    doc.save("agenda-export.pdf");
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-cyan-400 animate-pulse" />
            Agenda de Eventos & Artistas
          </h2>
          <p className="text-sm text-slate-400">
            Escalar atrações, controlar cachês e gerenciar necessidades técnicas de som e luz integradas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 font-medium text-sm px-4 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <FileDown className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg hover:shadow-cyan-500/10 transition cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            Agendar Atração
          </button>
        </div>
      </div>

      {errAgenda && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm rounded-lg">
          {errAgenda}
        </div>
      )}

      {/* Grid listing */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="h-8 w-8 border-t-2 border-r-2 border-cyan-400 rounded-full animate-spin" />
        </div>
      ) : sortedEvents.length === 0 ? (
        <div className="text-center p-12 bg-slate-900 border border-slate-850 rounded-xl">
          <p className="text-slate-400">Nenhum evento agendado nos próximos dias.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sortedEvents.map((evt) => (
            <div
              key={evt.id}
              onClick={() => setActiveDetailEvent(evt)}
              className="p-5 rounded-xl border border-slate-800 bg-slate-900/65 flex flex-col justify-between hover:border-slate-700 transition cursor-pointer group relative"
            >
              {/* Event Date Block */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  {/* Category */}
                  <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-bold uppercase font-mono ${getEventBadgeClass(evt.tipoEvento)}`}>
                    {evt.tipoEvento}
                  </span>

                  <span className={`inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400`}>
                    <Calendar className="h-3.5 w-3.5 text-slate-505" />
                    {formatDateBR(evt.data)}
                  </span>
                </div>

                {/* Artist Name */}
                <div>
                  <h4 className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition duration-150 tracking-tight leading-snug">
                    {evt.artistaNome}
                  </h4>
                  <div className="flex items-center space-x-1 mt-1 text-xs text-slate-400">
                    <Clock className="h-3.5 w-3.5 text-slate-550" />
                    <span>Início às {evt.horarioInicio} h</span>
                  </div>
                </div>
              </div>

              {/* Bottom Row specs */}
              <div className="mt-6 pt-3.5 border-t border-slate-800/80 flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-[9px] font-mono text-slate-550 uppercase">Investimento</p>
                  <span className="font-bold font-mono text-slate-200 text-sm">
                    R$ {evt.cacheCusto.toLocaleString("pt-BR")}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                    evt.status === "Confirmado"
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                      : evt.status === "Cancelado"
                      ? "bg-slate-950 text-slate-500 border-slate-850"
                      : "bg-amber-500/10 text-amber-400 border-amber-500/25"
                  }`}>
                    {evt.status}
                  </span>
                  
                  {/* Edit button wrapper */}
                  <button
                    onClick={(e) => handleOpenEdit(evt, e)}
                    className="p-1 border border-slate-850 rounded hover:bg-slate-800 text-slate-500 hover:text-cyan-400 transition"
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>

                  {/* Delete button wrapper */}
                  <button
                    onClick={(e) => handleDeleteEvent(evt.id, e)}
                    className="p-1 border border-slate-850 rounded hover:bg-rose-500/10 text-slate-500 hover:text-rose-450 transition"
                    title="Excluir"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETAIL MODAL DRAWER OVERLAY */}
      {activeDetailEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-150">
            
            {/* Header info */}
            <div className="p-6 bg-slate-950/65 border-b border-slate-800 flex items-center justify-between">
              <div>
                <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${getEventBadgeClass(activeDetailEvent.tipoEvento)}`}>
                  {activeDetailEvent.tipoEvento}
                </span>
                <h3 className="text-lg font-bold text-white mt-2 leading-tight tracking-tight">
                  {activeDetailEvent.artistaNome}
                </h3>
              </div>
              <button
                onClick={() => setActiveDetailEvent(null)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg mt-[-20px]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Specifications */}
            <div className="p-6 space-y-5">
              
              {/* Financial status panel block */}
              <div className="grid grid-cols-2 gap-4 bg-slate-950/30 p-4 border border-slate-850 rounded-xl font-mono text-xs">
                <div>
                  <p className="text-slate-500 uppercase text-[9px]">Data da Atração</p>
                  <p className="text-sm font-semibold text-slate-200 mt-0.5">{formatDateBR(activeDetailEvent.data)}</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase text-[9px]">Custo / Cachê Estimado</p>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5">
                    R$ {activeDetailEvent.cacheCusto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {activeDetailEvent.chavePix && (
                  <div className="col-span-2 mt-2">
                    <p className="text-slate-500 uppercase text-[9px]">Chave PIX do Artista</p>
                    <p className="text-sm font-mono text-slate-300 mt-0.5">
                      {activeDetailEvent.chavePix}
                    </p>
                  </div>
                )}
              </div>

              {/* Timing schedule specifications */}
              <div className="space-y-2">
                <h5 className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Cronograma do Evento</h5>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-950/45 border border-slate-850/70 rounded-lg text-center">
                    <p className="text-[10px] text-slate-500 font-mono">SOMCHECK</p>
                    <p className="text-sm font-bold text-slate-200 tracking-tight mt-0.5">{activeDetailEvent.horarioPassagemSom} h</p>
                  </div>
                  <div className="p-3 bg-slate-950/45 border border-slate-850/70 rounded-lg text-center">
                    <p className="text-[10px] text-slate-505 font-mono">SHOWTIME</p>
                    <p className="text-sm font-bold text-slate-200 tracking-tight mt-0.5">{activeDetailEvent.horarioInicio} h</p>
                  </div>
                  <div className="p-3 bg-slate-950/45 border border-slate-850/70 rounded-lg text-center">
                    <p className="text-[10px] text-slate-505 font-mono">FINISH</p>
                    <p className="text-sm font-bold text-slate-200 tracking-tight mt-0.5">{activeDetailEvent.horarioTermino} h</p>
                  </div>
                </div>
              </div>

              {/* Technical needs text output */}
              <div className="space-y-2">
                <h5 className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-slate-500" /> Necessidades Técnicas (Rider)
                </h5>
                <div className="bg-slate-950/80 p-4 border border-slate-850 rounded-xl max-h-[140px] overflow-y-auto">
                  {activeDetailEvent.necessidadesTecnicas ? (
                    <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-line">
                      {activeDetailEvent.necessidadesTecnicas}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-505 italic text-center py-2">Nenhum rider de som ou luz registrado.</p>
                  )}
                </div>
              </div>

              {/* Quick inline status update controls inside expanded dialog */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-mono uppercase text-slate-505">Confirmar status</span>
                  <div className="flex bg-slate-950 p-1 border border-slate-850 rounded-lg space-x-1">
                    {(["A Confirmar", "Confirmado", "Cancelado"] as const).map(st => (
                      <button
                        key={st}
                        onClick={() => handleUpdateStatus(activeDetailEvent.id, st)}
                        className={`px-2.5 py-1 text-[10px] font-semibold rounded-md leading-tight border transition ${
                          activeDetailEvent.status === st
                            ? "bg-slate-800 text-white border-slate-700 font-bold"
                            : "text-slate-500 border-transparent hover:text-white"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveDetailEvent(null)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white text-sm rounded-lg font-medium transition"
                >
                  Fechar Detalhes
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT AGENDA ITEM MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {editEventId ? "Editar Atração" : "Escalar Atração na Agenda"}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEvent} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Data da Atração
                  </label>
                  <input
                    type="date"
                    required
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-100 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Tipo de Apresentação
                  </label>
                  <select
                    value={tipoEvento}
                    onChange={(e) => setTipoEvento(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Música ao Vivo">Música ao Vivo (Banda/Voz)</option>
                    <option value="DJ">DJ Sunset</option>
                    <option value="Transmissão Esportiva">Transmissão de Jogo</option>
                    <option value="Evento Fechado">Evento Corporativo Fechado</option>
                    <option value="Outros">Outras Atividades</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Atração / Nome do Artista
                </label>
                <input
                  type="text"
                  required
                  value={artistaNome}
                  onChange={(e) => setArtistaNome(e.target.value)}
                  placeholder="Ex: Sexteto de Jazz Marina & Trio"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Sound timings layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Somcheck
                  </label>
                  <input
                    type="text"
                    required
                    value={horarioPassagemSom}
                    onChange={(e) => setHorarioPassagemSom(e.target.value)}
                    placeholder="17:00"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Início
                  </label>
                  <input
                    type="text"
                    required
                    value={horarioInicio}
                    onChange={(e) => setHorarioInicio(e.target.value)}
                    placeholder="19:30"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Término
                  </label>
                  <input
                    type="text"
                    required
                    value={horarioTermino}
                    onChange={(e) => setHorarioTermino(e.target.value)}
                    placeholder="23:00"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Valor do Cachê (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={cacheCusto}
                    onChange={(e) => setCacheCusto(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-100 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Status da Atração
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-100 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="A Confirmar">A Confirmar</option>
                    <option value="Confirmado">Confirmado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Necessidades Técnicas (Rider de Palco / Caixa de Som / Cabos)
                </label>
                <textarea
                  value={necessidadesTecnicas}
                  onChange={(e) => setNecessidadesTecnicas(e.target.value)}
                  placeholder="Liste amplificadores, tomadas, pedestais de microfone ou mesas Pioneer requisitadas..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-3 text-slate-200 text-xs leading-relaxed focus:border-cyan-500 focus:outline-none resize-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Chave PIX do Artista (Opcional)
                </label>
                <input
                  type="text"
                  value={chavePix}
                  onChange={(e) => setChavePix(e.target.value)}
                  placeholder="E-mail, CPF, CNPJ ou Telefone..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-sm font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg text-sm font-medium shadow-md transition cursor-pointer min-h-[44px]"
                >
                  {editEventId ? "Salvar Alterações" : "Escalar Show"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
