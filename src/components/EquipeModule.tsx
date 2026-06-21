import React, { useEffect, useState } from "react";
import { appDb } from "../firebase";
import { StaffMember } from "../types";
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit, 
  Star, 
  AlertCircle, 
  CheckCircle2, 
  X,
  Search,
  Filter,
  UserPlus
} from "lucide-react";

export default function EquipeModule() {
  const [colaboradores, setColaboradores] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("Garçom Sênior");
  const [pontuacao, setPontuacao] = useState(8);
  const [situacaoAtual, setSituacaoAtual] = useState("");
  const [status, setStatus] = useState<"Ativo" | "Suspenso" | "Desligado">("Ativo");

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [cargoFilter, setCargoFilter] = useState<string>("todos");

  // Load from database / simulation
  useEffect(() => {
    const unsubscribe = appDb.subscribe("equipe", 
      (data) => {
        setColaboradores(data as StaffMember[]);
        setLoading(false);
      },
      (err) => {
        setError("Erro ao escutar dados da Equipe: " + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleOpenAdd = () => {
    setEditingId(null);
    setNome("");
    setCargo("Garçom");
    setPontuacao(8);
    setSituacaoAtual("");
    setStatus("Ativo");
    setShowModal(true);
  };

  const handleOpenEdit = (colab: StaffMember) => {
    setEditingId(colab.id);
    setNome(colab.nome);
    setCargo(colab.cargo);
    setPontuacao(colab.pontuacao);
    setSituacaoAtual(colab.situacaoAtual);
    setStatus(colab.status);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert("Por favor, preencha o Nome.");
      return;
    }

    try {
      const data = {
        nome: nome.trim(),
        cargo,
        pontuacao: Number(pontuacao),
        situacaoAtual: situacaoAtual.trim(),
        status
      };

      if (editingId) {
        await appDb.update("equipe", editingId, data);
      } else {
        await appDb.add("equipe", data);
      }
      
      appDb.dispatchUpdate();
      setShowModal(false);
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja mesmo remover este colaborador?")) {
      try {
        await appDb.delete("equipe", id);
        appDb.dispatchUpdate();
      } catch (err: any) {
        alert("Erro ao deletar: " + err.message);
      }
    }
  };

  const handleQuickStatus = async (id: string, newStatus: "Ativo" | "Suspenso" | "Desligado") => {
    try {
      await appDb.update("equipe", id, { status: newStatus });
      appDb.dispatchUpdate();
    } catch (err: any) {
      alert("Erro ao atualizar status: " + err.message);
    }
  };

  // Get unique list of positions for filter dropdown
  const uniqueCargos = Array.from(new Set(colaboradores.map(c => c.cargo))).filter(Boolean);

  // Filtered List
  const filteredColaboradores = colaboradores.filter((colab) => {
    const matchesSearch = colab.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          colab.cargo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "todos" || colab.status === statusFilter;
    const matchesCargo = cargoFilter === "todos" || colab.cargo === cargoFilter;
    return matchesSearch && matchesStatus && matchesCargo;
  });

  return (
    <div className="space-y-6">
      {/* Module Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-cyan-400" />
            Equipe Operacional
          </h2>
          <p className="text-sm text-slate-400">
            Acompanhe o desempenho, histórico de oitivas, e modifique status ou notas de serviço de todo o staff.
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg hover:shadow-cyan-500/10 transition-all cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          Adicionar Colaborador
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Pesquise por colaborador ou cargo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
          />
        </div>
        
        <div>
          <select
            value={cargoFilter}
            onChange={(e) => setCargoFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-slate-300 text-sm focus:border-cyan-500 focus:outline-none"
          >
            <option value="todos">Todos os Cargos</option>
            {uniqueCargos.map(cargo => (
              <option key={cargo} value={cargo}>{cargo}</option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-slate-300 text-sm focus:border-cyan-500 focus:outline-none"
          >
            <option value="todos">Todos os Status</option>
            <option value="Ativo">Ativo</option>
            <option value="Suspenso">Suspenso</option>
            <option value="Desligado">Desligado</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-lg text-rose-400 text-sm">
          {error}
        </div>
      )}

      {/* Data Section */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 border-t-2 border-r-2 border-cyan-400 rounded-full animate-spin" />
        </div>
      ) : filteredColaboradores.length === 0 ? (
        <div className="text-center p-12 bg-slate-900 border border-slate-850 rounded-xl">
          <p className="text-slate-400">Nenhum colaborador corresponde aos filtros aplicados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/65 border-b border-slate-800/80 text-slate-400 text-xs font-mono tracking-wider uppercase">
                <th className="p-4 font-semibold">Staff / Cargo</th>
                <th className="p-4 font-semibold w-32">Pontuação</th>
                <th className="p-4 font-semibold min-w-[250px]">Direcionamento / Situação Atual</th>
                <th className="p-4 font-semibold w-36">Situação</th>
                <th className="p-4 font-semibold w-28 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300 text-sm">
              {filteredColaboradores.map((colab) => (
                <tr key={colab.id} className="hover:bg-slate-850/30 transition-colors">
                  {/* Name and Role */}
                  <td className="p-4">
                    <div className="font-semibold text-slate-100">{colab.nome}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{colab.cargo}</div>
                  </td>
                  
                  {/* Score */}
                  <td className="p-4 text-center">
                    <span className="font-mono font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 inline-block rounded-md border border-cyan-500/20">{colab.pontuacao}</span>
                  </td>

                  {/* Operational Notes / Situacao */}
                  <td className="p-4 max-w-sm">
                    {colab.situacaoAtual ? (
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/30 border border-slate-850 p-2.5 rounded-lg font-mono">
                        {colab.situacaoAtual}
                      </p>
                    ) : (
                      <span className="text-slate-500 italic text-xs">Sem observações.</span>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="p-4">
                    <div className="flex flex-col gap-1.5">
                      <select
                        value={colab.status}
                        onChange={(e) => handleQuickStatus(colab.id, e.target.value as any)}
                        className={`w-full py-1 px-2.5 rounded-md text-xs font-semibold uppercase leading-tight bg-slate-950 font-mono border ${
                          colab.status === 'Ativo' 
                            ? 'text-emerald-400 border-emerald-500/20' 
                            : colab.status === 'Suspenso' 
                            ? 'text-amber-400 border-amber-500/20' 
                            : 'text-rose-400 border-rose-500/20'
                        }`}
                      >
                        <option value="Ativo" className="bg-slate-900 text-emerald-400">Ativo</option>
                        <option value="Suspenso" className="bg-slate-900 text-amber-400">Suspenso</option>
                        <option value="Desligado" className="bg-slate-900 text-rose-400">Desligado</option>
                      </select>
                    </div>
                  </td>

                  {/* Quick CRUD actions */}
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(colab)}
                        title="Editar completo"
                        className="p-1.5 border border-slate-800 rounded-md hover:bg-slate-800 hover:text-white transition text-slate-400"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(colab.id)}
                        title="Deletar"
                        className="p-1.5 border border-slate-800 rounded-md hover:bg-rose-500/10 hover:text-rose-400 transition text-slate-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over Form Overlay Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {editingId ? "Editar Colaborador" : "Registrar Novo Staff"}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Carlos Eduardo"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Cargo / Função
                  </label>
                  <input
                    type="text"
                    required
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                    placeholder="Ex: Sommelier, Garçom, Barman"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Pontuação (1 a 10)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={pontuacao}
                    onChange={(e) => setPontuacao(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Situação Atual & Histórico de Ocorrência
                </label>
                <textarea
                  value={situacaoAtual}
                  onChange={(e) => setSituacaoAtual(e.target.value)}
                  placeholder="Relatório de desempenho, registro de atrasos, advertências ou excelente comportamento..."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-3 text-slate-200 text-xs leading-relaxed focus:border-cyan-500 focus:outline-none focus:ring-0 resize-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Status Inicial
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Ativo", "Suspenso", "Desligado"] as const).map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setStatus(opt)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold leading-tight border transition-colors ${
                        status === opt
                          ? opt === "Ativo"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500"
                            : opt === "Suspenso"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500"
                            : "bg-rose-500/20 text-rose-300 border-rose-500"
                          : "bg-slate-950/40 text-slate-400 border-slate-850 hover:bg-slate-800"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
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
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg text-sm font-medium shadow-md shadow-cyan-500/5 transition cursor-pointer"
                >
                  Salvar Mudanças
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
