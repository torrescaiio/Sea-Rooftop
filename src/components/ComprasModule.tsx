import React, { useEffect, useState } from "react";
import { appDb } from "../firebase";
import { GeneralPurchase } from "../types";
import { 
  ShoppingCart, 
  Plus, 
  Trash2, 
  PlusCircle, 
  Search, 
  DollarSign,
  X,
  TrendingDown,
  ChevronUp,
  ChevronDown,
  FileDown
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ComprasModule() {
  const [items, setItems] = useState<GeneralPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorLine, setErrorLine] = useState<string | null>(null);

  // Form states
  const [showModal, setShowModal] = useState(false);
  const [newItem, setNewItem] = useState("");
  const [newCategoria, setNewCategoria] = useState<GeneralPurchase["categoria"]>("Bar");
  const [newQuantidade, setNewQuantidade] = useState(1);
  const [newStatus, setNewStatus] = useState<GeneralPurchase["status"]>("A Orçar");

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [catFilter, setCatFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");

  useEffect(() => {
    const unsubscribe = appDb.subscribe("compras_gerais", 
      (data) => {
        setItems(data as GeneralPurchase[]);
        setLoading(false);
      },
      (err) => {
        setErrorLine("Erro ao carregar compras gerais: " + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim() || newQuantidade <= 0) {
      alert("Por favor preencha o nome do item e garanta quantidade válida.");
      return;
    }

    try {
      const data = {
        item: newItem.trim(),
        categoria: newCategoria,
        quantidade: Number(newQuantidade),
        status: newStatus
      };

      await appDb.add("compras_gerais", data);
      appDb.dispatchUpdate();

      setNewItem("");
      setNewQuantidade(1);
      setShowModal(false);
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja mesmo remover permanentemente este item da lista de compras?")) {
      try {
        await appDb.delete("compras_gerais", id);
        appDb.dispatchUpdate();
      } catch (err: any) {
        alert("Erro ao deletar: " + err.message);
      }
    }
  };

  const handleUpdateStatus = async (id: string, nextStatus: GeneralPurchase["status"]) => {
    try {
      await appDb.update("compras_gerais", id, { status: nextStatus });
      appDb.dispatchUpdate();
    } catch (err: any) {
      alert("Erro ao mudar status: " + err.message);
    }
  };

  const handleAdjustQuantidade = async (id: string, current: number, change: number) => {
    const nextVal = current + change;
    if (nextVal <= 0) return;
    try {
      await appDb.update("compras_gerais", id, { quantidade: nextVal });
      appDb.dispatchUpdate();
    } catch (err: any) {
      alert("Erro ao ajustar quantidade: " + err.message);
    }
  };

  const getCategoryColor = (cat: GeneralPurchase["categoria"]) => {
    switch (cat) {
      case "Bar": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "Salão": return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
      case "Estrutura": return "text-purple-400 bg-purple-500/10 border-purple-500/20";
      default: return "text-slate-400 border-slate-800";
    }
  };

  // Filter items
  const filteredItems = items.filter(u => {
    const matchesSearch = u.item.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = catFilter === "todos" || u.categoria === catFilter;
    const matchesStatus = statusFilter === "todos" || u.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Relatório de Compras Gerais", 14, 15);
    
    const tableColumn = ["Item", "Categoria", "Valor Estimado", "Status"];
    const tableRows: any[] = [];
    
    filteredItems.forEach(i => {
      const rowData = [
        i.item,
        i.categoria,
        `R$ ${i.valorEstimado.toFixed(2)}`,
        i.status
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });
    
    doc.save("compras-export.pdf");
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-cyan-400" />
            Compras Gerais (Insumos Operacionais)
          </h2>
          <p className="text-sm text-slate-400">
            Acompanhe pedidos de reposição e itens aprovados de infraestrutura para o bar, salão ou rooftop.
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
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg hover:shadow-cyan-500/10 transition cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            Solicitar Compra
          </button>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Pesquise por item de compra..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2 py-2 px-3 text-slate-300 text-sm focus:border-cyan-500 focus:outline-none"
          >
            <option value="todos">Todos os Setores</option>
            <option value="Bar">Bar / Bebidas & Gelo</option>
            <option value="Salão">Salão / Atendimento</option>
            <option value="Estrutura">Estrutura / Escritório</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2 py-2 px-3 text-slate-300 text-sm focus:border-cyan-500 focus:outline-none"
          >
            <option value="todos">Todos os Status</option>
            <option value="A Orçar">A Orçar</option>
            <option value="Solicitado">Solicitado</option>
            <option value="Comprado">Comprado</option>
          </select>
        </div>
      </div>

      {errorLine && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm rounded-lg">
          {errorLine}
        </div>
      )}

      {/* Grid listing Table */}
      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="h-8 w-8 border-t-2 border-r-2 border-cyan-400 rounded-full animate-spin" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center p-12 bg-slate-900 border border-slate-850 rounded-xl">
          <p className="text-slate-400">Nenhum item na lista corresponde à consulta atual.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 shadow-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950/65 border-b border-slate-800/80 text-slate-400 text-xs font-mono tracking-wider uppercase">
                <th className="p-4 font-semibold">Insumo / Item</th>
                <th className="p-4 font-semibold w-40">Setor</th>
                <th className="p-4 font-semibold w-44 text-center">Quantidade Solicitada</th>
                <th className="p-4 font-semibold w-44">Status de Aquisição</th>
                <th className="p-4 font-semibold w-24 text-center">Remover</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300 text-sm">
              {filteredItems.map((ui) => (
                <tr key={ui.id} className="hover:bg-slate-850/30 transition">
                  <td className="p-4 font-semibold text-slate-100 font-mono">
                    {ui.item}
                  </td>
                  
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border tracking-wider ${getCategoryColor(ui.categoria)}`}>
                      {ui.categoria}
                    </span>
                  </td>

                  {/* Quantity with quick adjusters */}
                  <td className="p-4 text-center">
                    <div className="inline-flex items-center space-x-3 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-850">
                      <button
                        onClick={() => handleAdjustQuantidade(ui.id, ui.quantidade, -1)}
                        className="p-0.5 text-slate-500 hover:text-white rounded hover:bg-slate-850 transition cursor-pointer"
                        title="Diminuir"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      
                      <span className="font-mono font-bold text-slate-200 text-sm w-8 text-center">{ui.quantidade}</span>
                      
                      <button
                        onClick={() => handleAdjustQuantidade(ui.id, ui.quantidade, 1)}
                        className="p-0.5 text-slate-505 hover:text-white rounded hover:bg-slate-850 transition cursor-pointer"
                        title="Aumentar"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>

                  {/* Status Inline Switcher Badge */}
                  <td className="p-4">
                    <select
                      value={ui.status}
                      onChange={(e) => handleUpdateStatus(ui.id, e.target.value as any)}
                      className={`w-full py-1.5 px-3 rounded-lg text-xs font-bold uppercase leading-tight bg-slate-950 font-mono border ${
                        ui.status === "Comprado"
                          ? "text-emerald-400 border-emerald-500/20"
                          : ui.status === "Solicitado"
                          ? "text-amber-400 border-amber-500/20"
                          : "text-slate-400 border-slate-800"
                      }`}
                    >
                      <option value="A Orçar">A Orçar</option>
                      <option value="Solicitado">Solicitado</option>
                      <option value="Comprado">Comprado</option>
                    </select>
                  </td>

                  {/* Detach option */}
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleDelete(ui.id)}
                      className="p-1.5 border border-slate-850 rounded-lg text-slate-500 hover:text-rose-450 hover:bg-rose-500/10 transition"
                      title="Excluir solicitado"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Action ADD Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Solicitar Pedido de Compra</h3>
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
                  Item a Adquirir
                </label>
                <input
                  type="text"
                  required
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  placeholder="Ex: Pegadores de gelo em inox escovado"
                  className="w-full bg-slate-950 border border-slate-855 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Categoria Setor
                  </label>
                  <select
                    value={newCategoria}
                    onChange={(e) => setNewCategoria(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Bar">Bar / Bebidas</option>
                    <option value="Salão">Salão / Copa</option>
                    <option value="Estrutura">Estrutura / Interna</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Quantidade Desejada
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={newQuantidade}
                    onChange={(e) => setNewQuantidade(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Status de Processo
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="A Orçar">A Orçar (Apenas Escrita)</option>
                  <option value="Solicitado">Soliciatado Oficialmente</option>
                  <option value="Comprado">Comprado & Recebido</option>
                </select>
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
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg text-sm font-medium shadow-md transition cursor-pointer min-h-[44px]"
                >
                  Registrar Solicitação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
