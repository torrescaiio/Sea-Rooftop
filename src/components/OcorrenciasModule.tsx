import React, { useEffect, useState } from "react";
import { appDb } from "../firebase";
import { Occurrence } from "../types";
import { 
  AlertTriangle, 
  Plus, 
  Trash2, 
  Check, 
  ChevronDown, 
  Info, 
  User, 
  Calendar,
  X,
  PlusCircle,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export default function OcorrenciasModule() {
  const [ocorrencias, setOcorrencias] = useState<Occurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [categoria, setCategoria] = useState<Occurrence["categoria"]>("Sistema");
  const [descricaoDetalhada, setDescricaoDetalhada] = useState("");
  const [responsavelResolucao, setResponsavelResolucao] = useState("");
  const [status, setStatus] = useState<"Aberto" | "Resolvido">("Aberto");

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [catFilter, setCatFilter] = useState<string>("todos");
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  useEffect(() => {
    const unsubscribe = appDb.subscribe("ocorrencias", 
      (data) => {
        setOcorrencias(data as Occurrence[]);
        setLoading(false);
      },
      (err) => {
        setError("Erro ao ler ocorrências: " + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricaoDetalhada.trim() || !responsavelResolucao.trim()) {
      alert("Por favor, preencha a descrição detalhada e o responsável.");
      return;
    }

    try {
      const data = {
        data: new Date().toISOString().split("T")[0],
        categoria,
        descricaoDetalhada: descricaoDetalhada.trim(),
        responsavelResolucao: responsavelResolucao.trim(),
        status
      };

      await appDb.add("ocorrencias", data);
      appDb.dispatchUpdate();

      setDescricaoDetalhada("");
      setResponsavelResolucao("");
      setShowModal(false);
    } catch (err: any) {
      alert("Erro ao adicionar ocorrência: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja mesmo arquivar/remover esta ocorrência de registro definitivo?")) {
      try {
        await appDb.delete("ocorrencias", id);
        appDb.dispatchUpdate();
      } catch (err: any) {
        alert("Erro ao remover: " + err.message);
      }
    }
  };

  const handleToggleResolve = async (id: string, currentStatus: "Aberto" | "Resolvido") => {
    try {
      const next = currentStatus === "Aberto" ? "Resolvido" : "Aberto";
      await appDb.update("ocorrencias", id, { status: next });
      appDb.dispatchUpdate();
    } catch (err: any) {
      alert("Erro ao alterar status: " + err.message);
    }
  };

  const getCategoryColor = (cat: Occurrence["categoria"]) => {
    switch (cat) {
      case "Sistema": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
      case "Funcionários": return "text-purple-400 bg-purple-500/10 border-purple-500/20";
      case "Logística": return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
      case "Falta": return "text-rose-400 bg-rose-500/15 border-rose-500/25";
      case "Atestados": return "text-pink-400 bg-pink-500/10 border-pink-500/20";
      case "Cliente": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      default: return "text-slate-400 bg-slate-500/10 border-slate-500/20";
    }
  };

  // Filtered
  const filteredLogs = ocorrencias.filter(log => {
    const matchesSearch = log.descricaoDetalhada.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.responsavelResolucao.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = catFilter === "todos" || log.categoria === catFilter;
    const matchesStatus = statusFilter === "todos" || log.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-rose-500" />
            Ocorrências no Salão (Log Operacional)
          </h2>
          <p className="text-sm text-slate-400">
            Documente desvios de processo, faltas, panes de TI ou reparos imediatos no rooftop.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg hover:shadow-rose-600/10 transition cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" />
          Registrar Ocorrência
        </button>
      </div>

      {/* Toolbar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Pesquise por descrição ou responsável..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-slate-200 text-sm focus:border-rose-500 focus:outline-none focus:ring-0"
          />
        </div>

        <div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2 px-3 text-slate-300 text-sm focus:border-rose-500 focus:outline-none"
          >
            <option value="todos">Todas as Categorias</option>
            <option value="Sistema">Sistemas / Wi-Fi</option>
            <option value="Funcionários">Funcionários / Escala</option>
            <option value="Logística">Logística / Insumo</option>
            <option value="Falta">Falta Injustificada</option>
            <option value="Atestados">Atestados Médicos</option>
            <option value="Cliente">Reclamação de Cliente</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2 px-3 text-slate-300 text-sm focus:border-rose-500 focus:outline-none"
          >
            <option value="todos">Todos os Status</option>
            <option value="Aberto">Aberto</option>
            <option value="Resolvido">Resolvido</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Feed listing */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="h-8 w-8 border-t-2 border-r-2 border-rose-500 rounded-full animate-spin" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center p-12 bg-slate-900 border border-slate-850 rounded-xl">
          <p className="text-slate-400">Nenhum registro de ocorrência corresponde aos termos especificados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => (
            <div 
              key={log.id}
              className={`p-5 rounded-xl border bg-slate-900/65 flex flex-col md:flex-row md:items-start justify-between gap-5 transition ${
                log.status === "Aberto"
                  ? "border-rose-500/25 bg-slate-900/80 shadow-md shadow-rose-500/[0.01]"
                  : "border-slate-850 opacity-80"
              }`}
            >
              <div className="flex items-start space-x-3.5">
                {/* Visual state warning icon */}
                <div className={`p-2.5 rounded-xl shrink-0 border ${
                  log.status === "Aberto" 
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse" 
                    : "bg-slate-950 border-slate-850 text-slate-500"
                }`}>
                  <AlertCircle className="h-5 w-5" />
                </div>
                
                {/* Details layout */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono border uppercase tracking-wider ${getCategoryColor(log.categoria)}`}>
                      {log.categoria}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-mono text-slate-400`}>
                      <Calendar className="h-3.5 w-3.5" />
                      {log.data}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-100 leading-relaxed font-mono whitespace-pre-line bg-slate-950/20 p-3 rounded-lg border border-slate-850/50">
                    {log.descricaoDetalhada}
                  </p>

                  <div className="flex items-center space-x-2 text-xs text-slate-400">
                    <User className="h-3.5 w-3.5 text-slate-500" />
                    <span>Resolvido por / Responsável:</span>
                    <span className="font-semibold text-slate-300 font-mono bg-slate-950 px-2 py-0.5 rounded-md">{log.responsavelResolucao}</span>
                  </div>
                </div>
              </div>

              {/* Feed Actions Side panel */}
              <div className="flex md:flex-col items-center justify-between md:justify-start gap-2 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5 shrink-0">
                <div className="text-left md:text-right md:w-full space-y-1">
                  <p className="text-[10px] font-mono text-slate-500 uppercase">Estado operacional</p>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase ${
                    log.status === "Aberto"
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}>
                    {log.status === "Aberto" ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-ping" />
                        ABERTO / PENDENTE
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        RESOLVIDO
                      </>
                    )}
                  </span>
                </div>

                <div className="flex gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-850 md:mt-2">
                  <button
                    onClick={() => handleToggleResolve(log.id, log.status)}
                    title={log.status === "Aberto" ? "Marcar como Resolvido" : "Reabrir registro"}
                    className={`p-1.5 rounded-md transition ${
                      log.status === "Resolvido"
                        ? "bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
                        : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white cursor-pointer"
                    }`}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(log.id)}
                    title="Remover definitivamente"
                    className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Lançar Registro de Ocorrência</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Setor / Categoria
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-rose-500 focus:outline-none"
                >
                  <option value="Sistema">Sistemas / Wi-Fi / TI</option>
                  <option value="Funcionários">Funcionário de Escala</option>
                  <option value="Logística">Logística de Insumos</option>
                  <option value="Falta">Falta Injustificada de Turno</option>
                  <option value="Atestados">Atestado Médico Entregue</option>
                  <option value="Cliente">Reclamação de Cliente Atendido</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Descrição Detalhada do Incidente
                </label>
                <textarea
                  required
                  value={descricaoDetalhada}
                  onChange={(e) => setDescricaoDetalhada(e.target.value)}
                  placeholder="Relate detalhadamente o ocorrido (Ex: Garrafa de gin premium quebrou na prateleira inferior devido a vibração do subwoofer traseiro)..."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-3 text-slate-200 text-xs leading-relaxed focus:border-rose-500 focus:outline-none resize-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Responsável pelo Acompanhamento / Resolução
                </label>
                <input
                  type="text"
                  required
                  value={responsavelResolucao}
                  onChange={(e) => setResponsavelResolucao(e.target.value)}
                  placeholder="Ex: Bartender Mary / Gerente Executivo"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Status Inicial
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus("Aberto")}
                    className={`py-2 rounded-lg text-xs font-semibold leading-tight border transition ${
                      status === "Aberto"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500"
                        : "bg-slate-950/40 text-slate-400 border-slate-850 hover:bg-slate-800"
                    }`}
                  >
                    Aberto / Urgente
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus("Resolvido")}
                    className={`py-2 rounded-lg text-xs font-semibold leading-tight border transition ${
                      status === "Resolvido"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500"
                        : "bg-slate-950/40 text-slate-400 border-slate-850 hover:bg-slate-800"
                    }`}
                  >
                    Resolvido
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-sm font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:bg-rose-700 text-white rounded-lg text-sm font-medium shadow-md transition cursor-pointer"
                >
                  Salvar Registro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
