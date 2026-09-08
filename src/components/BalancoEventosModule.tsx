import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, DollarSign, FileDown, Trash2, X, PlusCircle, Activity } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { appDb } from '../firebase';
import { BalancoEvento, DespesaEvento } from '../types';

export default function BalancoEventosModule() {
  const [balancos, setBalancos] = useState<BalancoEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterMonth, setFilterMonth] = useState(""); // "" means all months

  // Formulário
  const [nomeEvento, setNomeEvento] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [faturamentoBruto, setFaturamentoBruto] = useState<number | "">("");
  const [despesas, setDespesas] = useState<DespesaEvento[]>([]);
  const [observacoes, setObservacoes] = useState("");
  
  // Despesa atual
  const [categoriaDespesa, setCategoriaDespesa] = useState("");
  const [descricaoDespesa, setDescricaoDespesa] = useState("");
  const [valorDespesa, setValorDespesa] = useState<number | "">("");

  useEffect(() => {
    const unsub = appDb.subscribe("balanco_eventos", (data) => {
      setBalancos(data as BalancoEvento[]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const totalDespesas = despesas.reduce((acc, curr) => acc + curr.valor, 0);
  const lucroLiquido = (Number(faturamentoBruto) || 0) - totalDespesas;

  const handleAddDespesa = () => {
    if (!categoriaDespesa || !descricaoDespesa || !valorDespesa) return;
    
    const novaDespesa: DespesaEvento = {
      id: crypto.randomUUID(),
      categoria: categoriaDespesa,
      descricao: descricaoDespesa,
      valor: Number(valorDespesa)
    };

    setDespesas([...despesas, novaDespesa]);
    setCategoriaDespesa("");
    setDescricaoDespesa("");
    setValorDespesa("");
  };

  const handleRemoveDespesa = (id: string) => {
    setDespesas(despesas.filter(d => d.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeEvento || !dataEvento || faturamentoBruto === "") return;

    try {
      await appDb.add('balanco_eventos', {
        nomeEvento,
        dataEvento,
        faturamentoBruto: Number(faturamentoBruto),
        despesas,
        totalDespesas,
        lucroLiquido,
        observacoes
      });

      setNomeEvento("");
      setDataEvento("");
      setFaturamentoBruto("");
      setDespesas([]);
      setObservacoes("");
      setShowAddModal(false);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar relatório');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja excluir este relatório?")) {
      await appDb.delete('balanco_eventos', id);
    }
  };

  const gerarPDF = (balanco: BalancoEvento) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("Fechamento de Evento", 14, 22);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    const dataFormatada = balanco.dataEvento.split("-").reverse().join("/");
    doc.text(`Evento: ${balanco.nomeEvento}`, 14, 32);
    doc.text(`Data: ${dataFormatada}`, 14, 38);
    
    // Resumo Financeiro
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Resumo Financeiro", 14, 50);
    
    doc.setFontSize(11);
    doc.text(`Faturamento Bruto: R$ ${balanco.faturamentoBruto.toFixed(2)}`, 14, 58);
    doc.text(`Total de Despesas: R$ ${balanco.totalDespesas.toFixed(2)}`, 14, 64);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    if (balanco.lucroLiquido >= 0) {
      doc.setTextColor(0, 128, 0); // Green
    } else {
      doc.setTextColor(200, 0, 0); // Red
    }
    doc.text(`Lucro Líquido: R$ ${balanco.lucroLiquido.toFixed(2)}`, 14, 72);
    doc.setTextColor(0); // Reset
    doc.setFont("helvetica", "normal");

    // Tabela de Despesas
    if (balanco.despesas.length > 0) {
      doc.setFontSize(14);
      doc.text("Detalhamento de Despesas", 14, 85);
      
      const tableData = balanco.despesas.map(d => [
        d.categoria,
        d.descricao,
        `R$ ${d.valor.toFixed(2)}`
      ]);

      autoTable(doc, {
        head: [['Categoria', 'Descrição', 'Valor']],
        body: tableData,
        startY: 90,
      });
    }

    if (balanco.observacoes) {
      const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 85;
      doc.setFontSize(12);
      doc.text("Observações:", 14, finalY + 15);
      doc.setFontSize(10);
      doc.setTextColor(100);
      
      const splitText = doc.splitTextToSize(balanco.observacoes, 180);
      doc.text(splitText, 14, finalY + 22);
    }

    doc.save(`Fechamento-${balanco.nomeEvento.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${balanco.dataEvento}.pdf`);
  };

  const filteredBalancos = balancos.filter(b => {
    const matchSearch = b.nomeEvento.toLowerCase().includes(searchTerm.toLowerCase()) || b.dataEvento.includes(searchTerm);
    const matchMonth = filterMonth === "" || b.dataEvento.startsWith(filterMonth);
    return matchSearch && matchMonth;
  }).sort((a, b) => new Date(b.dataEvento).getTime() - new Date(a.dataEvento).getTime());

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-fuchsia-500"></div>
      </div>
    );
  }

  // Obter meses únicos para o filtro
  const uniqueMonths = Array.from(new Set(balancos.map(b => b.dataEvento.substring(0, 7)))).sort().reverse();

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Activity className="h-8 w-8 text-fuchsia-500" />
            Balanço de Eventos
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Relatórios financeiros, fechamentos e apuração de resultados de eventos.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Novo Balanço
        </button>
      </div>

      {/* Search & List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por nome do evento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 transition-colors"
            />
          </div>
          <div className="w-full sm:w-48">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 transition-colors"
            >
              <option value="">Todos os Meses</option>
              {uniqueMonths.map(m => {
                if (typeof m !== 'string') return null;
                const [year, month] = m.split('-');
                const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                const monthName = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                return (
                  <option key={m} value={m}>
                    {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 font-mono">
                <th className="p-4 font-semibold">Data</th>
                <th className="p-4 font-semibold">Evento</th>
                <th className="p-4 font-semibold">Faturamento Bruto</th>
                <th className="p-4 font-semibold">Despesas</th>
                <th className="p-4 font-semibold">Lucro Líquido</th>
                <th className="p-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-sm">
              {filteredBalancos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-mono text-xs">
                    NENHUM RELATÓRIO ENCONTRADO
                  </td>
                </tr>
              ) : (
                filteredBalancos.map((balanco) => (
                  <tr key={balanco.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="p-4 font-mono text-slate-400">
                      {balanco.dataEvento.split('-').reverse().join('/')}
                    </td>
                    <td className="p-4 font-medium text-slate-200">
                      {balanco.nomeEvento}
                    </td>
                    <td className="p-4 font-mono text-emerald-400">
                      R$ {balanco.faturamentoBruto.toFixed(2)}
                    </td>
                    <td className="p-4 font-mono text-rose-400">
                      R$ {balanco.totalDespesas.toFixed(2)}
                    </td>
                    <td className="p-4 font-mono">
                      <span className={`px-2 py-1 rounded bg-slate-950 border ${
                        balanco.lucroLiquido >= 0 
                          ? 'border-emerald-500/30 text-emerald-400' 
                          : 'border-rose-500/30 text-rose-400'
                      }`}>
                        R$ {balanco.lucroLiquido.toFixed(2)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => gerarPDF(balanco)}
                          className="p-2 text-slate-400 hover:text-fuchsia-400 bg-slate-800/50 hover:bg-slate-800 rounded transition"
                          title="Gerar PDF"
                        >
                          <FileDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(balanco.id)}
                          className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800/50 hover:bg-slate-800 rounded transition"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL ADICIONAR BALANÇO */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-fuchsia-500" />
                Novo Fechamento de Evento
              </h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Resumo do Evento */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Nome do Evento</label>
                  <input
                    type="text"
                    value={nomeEvento}
                    onChange={(e) => setNomeEvento(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500"
                    placeholder="Ex: Festa Junina"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Data do Evento</label>
                  <input
                    type="date"
                    value={dataEvento}
                    onChange={(e) => setDataEvento(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Faturamento Bruto (R$)</label>
                  <input
                    type="number"
                    value={faturamentoBruto}
                    onChange={(e) => setFaturamentoBruto(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-emerald-400 font-mono focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Seção de Despesas */}
              <div className="space-y-4 border border-slate-800 rounded-xl p-4 bg-slate-950/30">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                  <DollarSign className="h-4 w-4 text-rose-500" />
                  Despesas (Extras, Bebidas, etc.)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-xs text-slate-500">Categoria</label>
                    <select
                      value={categoriaDespesa}
                      onChange={(e) => setCategoriaDespesa(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-2 text-sm text-white focus:border-fuchsia-500"
                    >
                      <option value="">Selecione...</option>
                      <option value="Equipe Extra">Equipe Extra</option>
                      <option value="Bebidas">Bebidas (Aperol, Vodka, etc)</option>
                      <option value="Insumos">Insumos/Comida</option>
                      <option value="Atração">Atração Musical</option>
                      <option value="Marketing">Marketing/Tráfego</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>
                  <div className="md:col-span-5 space-y-1">
                    <label className="text-xs text-slate-500">Descrição</label>
                    <input
                      type="text"
                      value={descricaoDespesa}
                      onChange={(e) => setDescricaoDespesa(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-fuchsia-500"
                      placeholder="Ex: 3 Garçons extras"
                    />
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-xs text-slate-500">Valor (R$)</label>
                    <input
                      type="number"
                      value={valorDespesa}
                      onChange={(e) => setValorDespesa(e.target.value ? Number(e.target.value) : "")}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-rose-400 font-mono focus:border-fuchsia-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="md:col-span-1 flex items-end">
                    <button
                      type="button"
                      onClick={handleAddDespesa}
                      disabled={!categoriaDespesa || !descricaoDespesa || !valorDespesa}
                      className="w-full h-[38px] bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg flex justify-center items-center transition-colors"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Lista de Despesas Adicionadas */}
                {despesas.length > 0 && (
                  <div className="mt-4 border border-slate-800 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-900 text-slate-400 text-xs">
                        <tr>
                          <th className="px-3 py-2">Categoria</th>
                          <th className="px-3 py-2">Descrição</th>
                          <th className="px-3 py-2 text-right">Valor</th>
                          <th className="px-3 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {despesas.map(d => (
                          <tr key={d.id} className="bg-slate-900/50">
                            <td className="px-3 py-2 text-slate-300">{d.categoria}</td>
                            <td className="px-3 py-2 text-slate-300">{d.descricao}</td>
                            <td className="px-3 py-2 text-right font-mono text-rose-400">R$ {d.valor.toFixed(2)}</td>
                            <td className="px-3 py-2 text-center">
                              <button onClick={() => handleRemoveDespesa(d.id)} className="text-slate-500 hover:text-rose-400">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-900">
                          <td colSpan={2} className="px-3 py-2 text-right font-semibold text-slate-300">Total de Despesas:</td>
                          <td className="px-3 py-2 text-right font-mono text-rose-500 font-bold">R$ {totalDespesas.toFixed(2)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Observações (Opcional)</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 min-h-[80px]"
                  placeholder="Anotações adicionais sobre o evento..."
                />
              </div>

              {/* Resultado Financeiro Previsto */}
              <div className={`p-4 rounded-xl border ${lucroLiquido >= 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'} flex justify-between items-center`}>
                <span className="font-semibold text-slate-300">Lucro Líquido Previsto:</span>
                <span className={`text-xl font-bold font-mono ${lucroLiquido >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  R$ {lucroLiquido.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900/50">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!nomeEvento || !dataEvento || faturamentoBruto === ""}
                className="px-5 py-2.5 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-fuchsia-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Salvar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
