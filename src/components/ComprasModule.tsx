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
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  const [newCategoria, setNewCategoria] = useState<string>("Bar");
  const [newQuantidade, setNewQuantidade] = useState(1);
  const [newStatus, setNewStatus] = useState<GeneralPurchase["status"]>("A Orçar");
  const [newFornecedor, setNewFornecedor] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newValorUnitario, setNewValorUnitario] = useState("");
  const [newImagem, setNewImagem] = useState("");

  // Computed total
  const computedValorTotal = (Number(newValorUnitario) || 0) * newQuantidade;

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim() || newQuantidade <= 0) {
      alert("Por favor preencha o nome do item e garanta quantidade válida.");
      return;
    }

    try {
      const data: any = {
        item: newItem.trim(),
        categoria: newCategoria,
        quantidade: Number(newQuantidade),
        status: newStatus,
        fornecedor: newFornecedor.trim(),
        link: newLink.trim(),
        imagem: newImagem,
      };
      
      if (newValorUnitario) {
        data.valorUnitario = Number(newValorUnitario);
        data.valorComprado = computedValorTotal;
      } else {
        data.valorUnitario = null;
        data.valorComprado = null; // Clear if empty
      }

      if (editItemId) {
        await appDb.update("compras_gerais", editItemId, data);
      } else {
        await appDb.add("compras_gerais", data);
      }
      appDb.dispatchUpdate();

      setNewItem("");
      setNewQuantidade(1);
      setNewFornecedor("");
      setNewLink("");
      setNewValorUnitario("");
      setNewImagem("");
      setEditItemId(null);
      setShowModal(false);
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    }
  };

  const openForm = (item?: GeneralPurchase) => {
    if (item) {
      setEditItemId(item.id);
      setNewItem(item.item);
      setNewCategoria(item.categoria);
      setNewQuantidade(item.quantidade);
      setNewStatus(item.status);
      setNewFornecedor(item.fornecedor || "");
      setNewLink(item.link || "");
      setNewImagem(item.imagem || "");
      if (item.valorUnitario) {
        setNewValorUnitario(item.valorUnitario.toString());
      } else if (item.valorComprado && item.quantidade) {
        setNewValorUnitario((item.valorComprado / item.quantidade).toFixed(2));
      } else {
        setNewValorUnitario("");
      }
    } else {
      setEditItemId(null);
      setNewItem("");
      setNewCategoria("Bar");
      setNewQuantidade(1);
      setNewStatus("A Orçar");
      setNewFornecedor("");
      setNewLink("");
      setNewImagem("");
      setNewValorUnitario("");
    }
    setShowModal(true);
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

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case "Bar": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "Vinho": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "Salão": return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
      case "Estrutura": return "text-purple-400 bg-purple-500/10 border-purple-500/20";
      case "Limpeza": return "text-teal-400 bg-teal-500/10 border-teal-500/20";
      case "Cozinha": return "text-orange-400 bg-orange-500/10 border-orange-500/20";
      case "Escritório": return "text-slate-300 bg-slate-500/10 border-slate-500/20";
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
    let pdfTitle = "Lista de Compras Semanal - Sea Rooftop";
    if (catFilter !== "todos") {
       pdfTitle += ` (${catFilter})`;
    }
    doc.text(pdfTitle, 14, 15);
    doc.setFontSize(10);
    doc.text(`Data de geração: ${new Date().toLocaleDateString('pt-BR')}`, 14, 22);
    
    // Group items by category to make a nice checklist
    const itemsToBuy = filteredItems.filter(i => i.status !== "Comprado" && i.status !== "A Orçar"); // Usually we buy what is "Solicitado", but let's include "Solicitado" and "A Orçar" as things to buy
    const activeItems = filteredItems.filter(i => i.status !== "Comprado");

    const categories: string[] = Array.from(new Set(activeItems.map(i => i.categoria)));
    
    let currentY = 30;

    if (activeItems.length === 0) {
      doc.text("Nenhum item pendente para compra nesta lista.", 14, currentY);
    }

    categories.forEach(cat => {
      // Check if we need a new page
      if (currentY > doc.internal.pageSize.getHeight() - 40) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(14, 165, 233); // Cyan color
      doc.text(`Categoria: ${cat.toUpperCase()}`, 14, currentY);
      currentY += 8;

      const catItems = activeItems.filter(i => i.categoria === cat);
      const tableRows: any[] = [];
      
      catItems.forEach(i => {
        // Empty checkbox, Quantity, Item String
        tableRows.push(["[  ]", i.quantidade.toString(), i.item, i.status]);
      });

      autoTable(doc, {
        head: [["[X]", "Qtd", "Nome do Item", "Status Atual"]],
        body: tableRows,
        startY: currentY,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [15, 23, 42] }, // Slate 900
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { cellWidth: 15, halign: 'center' },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 40 }
        },
        didDrawPage: (data) => {
           currentY = data.cursor?.y || currentY;
        }
      });
      currentY += 10; // extra padding after table
    });
    
    doc.save("lista-de-compras.pdf");
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
            onClick={() => openForm()}
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
            <option value="todos">Todas as Categorias</option>
            <option value="Bar">Bar / Bebidas</option>
            <option value="Vinho">Adega / Vinhos</option>
            <option value="Salão">Salão / Copa</option>
            <option value="Cozinha">Cozinha / Insumos</option>
            <option value="Limpeza">Limpeza / Produtos</option>
            <option value="Escritório">Escritório / Papelaria</option>
            <option value="Estrutura">Estrutura / Fixos</option>
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
                <th className="p-4 font-semibold w-40">Setor/Fornecedor</th>
                <th className="p-4 font-semibold w-44 text-center">Quantidade</th>
                <th className="p-4 font-semibold w-44 text-center">Valor / Status</th>
                <th className="p-4 font-semibold w-24 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300 text-sm">
              {filteredItems.map((ui) => (
                <tr key={ui.id} className="hover:bg-slate-850/30 transition">
                  <td className="p-4 font-semibold text-slate-100 font-mono flex items-center gap-3">
                    {ui.imagem && (
                      <img src={ui.imagem} alt={ui.item} className="h-10 w-10 object-cover rounded border border-slate-700" />
                    )}
                    <span>{ui.item}</span>
                  </td>
                  
                  <td className="p-4 flex flex-col items-start gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase border tracking-wider ${getCategoryColor(ui.categoria)}`}>
                      {ui.categoria}
                    </span>
                    {ui.fornecedor && (
                      <span className="text-xs text-slate-500 font-mono" title="Fornecedor">
                        🏭 {ui.fornecedor}
                      </span>
                    )}
                    {ui.link && (
                      <a href={ui.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300 underline line-clamp-1 break-all mt-0.5" title={ui.link}>
                        🔗 Link do Produto
                      </a>
                    )}
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
                    <div className="flex flex-col gap-2">
                      {ui.valorComprado ? (
                        <span className="text-xs text-emerald-400 font-mono font-bold text-center bg-emerald-500/10 px-2 py-1 rounded w-full border border-emerald-500/20">
                          R$ {ui.valorComprado.toFixed(2)}
                        </span>
                      ) : null}
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
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="p-4 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => openForm(ui)}
                        className="px-3 py-1.5 border border-slate-800 rounded-lg text-slate-400 font-medium hover:text-white hover:bg-slate-800 transition text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(ui.id)}
                        className="p-1.5 border border-slate-850 rounded-lg text-slate-500 hover:text-rose-450 hover:bg-rose-500/10 transition"
                        title="Excluir solicitado"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
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
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-y-auto max-h-[90vh] pb-8 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">{editItemId ? 'Editar Pedido' : 'Solicitar Pedido de Compra'}</h3>
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
                    onChange={(e) => setNewCategoria(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Bar">Bar / Bebidas & Gelo</option>
                    <option value="Vinho">Adega / Vinhos</option>
                    <option value="Salão">Salão / Copa</option>
                    <option value="Cozinha">Cozinha / Insumos</option>
                    <option value="Limpeza">Limpeza / Manutenção</option>
                    <option value="Escritório">Escritório / Papelaria</option>
                    <option value="Estrutura">Estrutura / Fixos</option>
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
                  <option value="Solicitado">Solicitado Oficialmente</option>
                  <option value="Comprado">Comprado & Recebido</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Fornecedor
                  </label>
                  <input
                    type="text"
                    value={newFornecedor}
                    onChange={(e) => setNewFornecedor(e.target.value)}
                    placeholder="Ex: Pão de Açúcar"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Link do Produto
                  </label>
                  <input
                    type="url"
                    value={newLink}
                    onChange={(e) => setNewLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Valor Unitário (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newValorUnitario}
                    onChange={(e) => setNewValorUnitario(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Valor de Compra Total (R$)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={computedValorTotal > 0 ? computedValorTotal.toFixed(2) : ""}
                    placeholder="Automático"
                    className="w-full bg-slate-900 border border-slate-850 rounded-lg p-2.5 text-slate-400 text-sm focus:outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Imagem do Produto (Opcional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setNewImagem(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    } else {
                      setNewImagem("");
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20 cursor-pointer"
                />
                {newImagem && (
                  <div className="mt-3">
                    <img src={newImagem} alt="Preview" className="h-24 w-24 object-cover rounded-lg border border-slate-800" />
                  </div>
                )}
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
