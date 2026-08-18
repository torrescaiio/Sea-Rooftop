import React, { useState, useEffect } from "react";
import { appDb } from "../firebase";
import { ExtraSemana } from "../types";
import { 
  Briefcase, 
  PlusCircle, 
  Trash2, 
  X, 
  FileDown, 
  Calendar,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ExtrasModule() {
  const [extras, setExtras] = useState<ExtraSemana[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de adição
  const [showAddModal, setShowAddModal] = useState(false);
  const [data, setData] = useState(new Date().toISOString().split("T")[0]);
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [funcao, setFuncao] = useState("");
  const [valor, setValor] = useState<number | "">("");
  const [motivo, setMotivo] = useState("");
  const [statusPagamento, setStatusPagamento] = useState<"Pago" | "A Pagar">("A Pagar");

  // Modal de Relatório
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split("T")[0]);

  // Filtro na tela principal
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const handlePrevMonth = () => {
    if (!filterMonth) return;
    const [year, month] = filterMonth.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 2, 1);
    setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    if (!filterMonth) return;
    const [year, month] = filterMonth.split('-');
    const d = new Date(parseInt(year), parseInt(month), 1);
    setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const getMonthLabel = (m: string) => {
    if (!m) return "Todos";
    const [year, month] = m.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;
  };

  useEffect(() => {
    const unsub = appDb.subscribe("extras_semana", (data) => {
      // Sort by date descending
      const sorted = (data as ExtraSemana[]).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setExtras(sorted);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openAddModal = () => {
    setData(new Date().toISOString().split("T")[0]);
    setNome("");
    setContato("");
    setFuncao("");
    setValor("");
    setMotivo("");
    setStatusPagamento("A Pagar");
    setShowAddModal(true);
  };

  const handleSaveExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !funcao.trim() || !valor) {
      alert("Preencha nome, função e valor.");
      return;
    }

    try {
      await appDb.add("extras_semana", {
        data,
        nome: nome.trim(),
        contato: contato.trim(),
        funcao: funcao.trim(),
        valor: Number(valor),
        motivo: motivo.trim(),
        statusPagamento
      });

      if (contato.trim()) {
        try {
          await appDb.add("contatos", {
            nome: nome.trim(),
            categoria: "Extras",
            telefone: contato.trim(),
            detalhes: `Cadastrado automaticamente (Diárias). Função: ${funcao.trim()}`
          });
        } catch (contactErr) {
          console.warn("Erro ao salvar contato automático:", contactErr);
        }
      }

      setShowAddModal(false);
    } catch (err: any) {
      alert("Erro ao salvar diária: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Deseja realmente excluir este registro?")) {
      try {
        await appDb.delete("extras_semana", id);
      } catch (err: any) {
        alert("Erro ao excluir: " + err.message);
      }
    }
  };

  const gerarRelatorio = () => {
    if (!reportStartDate || !reportEndDate) {
      alert("Selecione as datas de início e fim.");
      return;
    }

    const sDate = new Date(reportStartDate);
    const eDate = new Date(reportEndDate);
    eDate.setHours(23, 59, 59, 999);

    const filtered = extras.filter(ex => {
      const exDate = new Date(ex.data);
      // For string dates YYYY-MM-DD, parsing might give UTC, which is fine for direct comparison if done consistently
      // Let's use string comparison for simplicity, as format is YYYY-MM-DD
      return ex.data >= reportStartDate && ex.data <= reportEndDate;
    });

    if (filtered.length === 0) {
      alert("Nenhuma diária encontrada nesse período.");
      return;
    }

    // Sort ascending for the report
    filtered.sort((a, b) => a.data.localeCompare(b.data));

    const totalGasto = filtered.reduce((acc, curr) => acc + curr.valor, 0);

    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Relatório de Diárias - Sea Rooftop", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${reportStartDate.split("-").reverse().join("/")} a ${reportEndDate.split("-").reverse().join("/")}`, 14, 28);

    const tableColumn = ["Data", "Nome", "Função", "Motivo", "Valor", "Status"];
    const tableRows: any[] = [];
    
    filtered.forEach(ex => {
      tableRows.push([
        ex.data.split("-").reverse().join("/"),
        ex.nome,
        ex.funcao,
        ex.motivo || "-",
        `R$ ${ex.valor.toFixed(2)}`,
        ex.statusPagamento || "A Pagar"
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [40, 40, 40] }
    });

    // @ts-ignore
    const finalY = doc.lastAutoTable.finalY || 35;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Gasto no Período: R$ ${totalGasto.toFixed(2)}`, 14, finalY + 10);

    doc.save(`relatorio_diarias_${reportStartDate}_a_${reportEndDate}.pdf`);
    setShowReportModal(false);
  };

  const filteredList = extras.filter(ex => ex.data.startsWith(filterMonth));

  const totalMes = filteredList.reduce((acc, curr) => acc + curr.valor, 0);

  if (loading) {
    return <div className="p-8 text-slate-400">Carregando módulo...</div>;
  }

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-amber-500" />
            Diárias
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Controle de diárias, funções extras e pagamentos temporários.
          </p>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setShowReportModal(true)}
            className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm px-4 py-2.5 rounded-lg border border-slate-700 transition cursor-pointer"
          >
            <FileDown className="h-4 w-4" />
            Exportar Relatório
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg transition cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            Adicionar Diária
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-col items-center min-w-[140px]">
            <span className="text-sm font-semibold text-white capitalize">
              {getMonthLabel(filterMonth)}
            </span>
          </div>
          <button
            onClick={handleNextMonth}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">Total Gasto no Mês Exibido</p>
          <p className="text-xl font-bold font-mono text-amber-400">R$ {totalMes.toFixed(2)}</p>
        </div>
      </div>

      {/* LISTA */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 font-mono">
                <th className="p-4 font-semibold w-28">Data</th>
                <th className="p-4 font-semibold">Profissional</th>
                <th className="p-4 font-semibold">Função</th>
                <th className="p-4 font-semibold">Motivo</th>
                <th className="p-4 font-semibold w-32">Valor</th>
                <th className="p-4 font-semibold w-24 text-center">Status</th>
                <th className="p-4 font-semibold text-right w-16">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300 text-sm">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-mono text-xs">
                    NENHUM REGISTRO NESTE MÊS
                  </td>
                </tr>
              ) : (
                filteredList.map((ex) => (
                  <tr key={ex.id} className="hover:bg-slate-800/30 transition">
                    <td className="p-4 font-mono text-slate-400">
                      {ex.data.split("-").reverse().join("/")}
                    </td>
                    <td className="p-4">
                      <p className="font-semibold text-slate-100">{ex.nome}</p>
                      {ex.contato && <p className="text-xs text-slate-500 mt-0.5">{ex.contato}</p>}
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-medium font-mono uppercase border border-slate-700 bg-slate-800 text-slate-300">
                        {ex.funcao}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 text-xs leading-relaxed max-w-xs truncate">
                      {ex.motivo || "-"}
                    </td>
                    <td className="p-4 font-mono font-medium text-amber-400">
                      R$ {ex.valor.toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={async () => {
                          const newStatus = ex.statusPagamento === 'Pago' ? 'A Pagar' : 'Pago';
                          try {
                            await appDb.update('extras_semana', ex.id, { statusPagamento: newStatus });
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className={`px-2 py-1 text-[10px] font-bold font-mono uppercase rounded border transition ${
                          ex.statusPagamento === 'Pago' 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                        }`}
                      >
                        {ex.statusPagamento || 'A Pagar'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleDelete(ex.id)}
                        className="p-2 border border-slate-800 rounded hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-500 hover:text-rose-400 transition"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL ADICIONAR */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-amber-500" />
                Registrar Diária
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveExtra} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Data
                  </label>
                  <input
                    type="date"
                    required
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Valor da Diária (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={valor}
                    onChange={(e) => setValor(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-amber-500 focus:outline-none font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Nome do Profissional
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-amber-500 focus:outline-none"
                  placeholder="Nome completo..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Função
                  </label>
                  <input
                    type="text"
                    required
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-amber-500 focus:outline-none"
                    placeholder="Ex: Bartender, Garçom..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Contato (Telefone/Opcional)
                  </label>
                  <input
                    type="text"
                    value={contato}
                    onChange={(e) => setContato(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-amber-500 focus:outline-none"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Motivo / Descrição
                  </label>
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-amber-500 focus:outline-none min-h-[80px]"
                    placeholder="Por que foi contratado? Ex: Cobertura de folga, evento corporativo..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Status de Pagamento
                  </label>
                  <select
                    value={statusPagamento}
                    onChange={(e) => setStatusPagamento(e.target.value as "Pago" | "A Pagar")}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-amber-500 focus:outline-none"
                  >
                    <option value="A Pagar">A Pagar</option>
                    <option value="Pago">Pago</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-lg text-sm font-medium shadow-md transition"
                >
                  Salvar Diária
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RELATÓRIO */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileDown className="h-5 w-5 text-slate-400" />
                Exportar PDF
              </h3>
              <button 
                onClick={() => setShowReportModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-400 mb-4">
                Selecione o período para gerar o relatório consolidado de diárias.
              </p>
              
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Data Inicial
                </label>
                <input
                  type="date"
                  required
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Data Final
                </label>
                <input
                  type="date"
                  required
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={gerarRelatorio}
                  className="w-full px-5 py-2.5 bg-slate-100 hover:bg-white text-slate-900 rounded-lg text-sm font-medium shadow-md transition flex items-center justify-center gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Baixar Relatório
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
