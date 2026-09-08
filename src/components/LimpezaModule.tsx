import React, { useState, useEffect } from "react";
import { appDb } from "../firebase";
import { Limpeza, PedidoLimpeza } from "../types";
import { 
  PlusCircle, 
  Pencil, 
  Trash2, 
  X, 
  ShoppingCart, 
  FileDown, 
  Info,
  Calendar,
  Check,
  Package
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function LimpezaModule() {
  const [activeTab, setActiveTab] = useState<"lista" | "pedidos">("lista");
  
  // Data States
  const [limpezas, setLimpeza] = useState<Limpeza[]>([]);
  const [pedidos, setPedidos] = useState<PedidoLimpeza[]>([]);
  
  // Loading
  const [loading, setLoading] = useState(true);

  const limpezasOrdenados = [...limpezas].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB;
  });

  // Modal States
  const [showAddLimpeza, setShowAddLimpeza] = useState(false);
  const [editLimpezaId, setEditLimpezaId] = useState<string | null>(null);
  const [showNovoPedido, setShowNovoPedido] = useState(false);
  
  // Limpeza Form
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<Limpeza["categoria"]>("Químicos");
  const [fornecedor, setFornecedor] = useState("");

  // Pedido Form
  const [pedidoItens, setPedidoItens] = useState<{limpezaId: string; quantidade: number}[]>([]);

  useEffect(() => {
    const unsubLimpeza = appDb.subscribe("materiais_limpeza", (data) => {
      setLimpeza(data as Limpeza[]);
      setLoading(false);
    });
    
    const unsubPedidos = appDb.subscribe("pedidos_limpeza", (data) => {
      setPedidos(data as PedidoLimpeza[]);
    });

    return () => {
      unsubLimpeza();
      unsubPedidos();
    };
  }, []);

  const openAddLimpeza = () => {
    setEditLimpezaId(null);
    setNome("");
    setCategoria("Químicos");
    setFornecedor("");
    setShowAddLimpeza(true);
  };

  const openEditLimpeza = (v: Limpeza) => {
    setEditLimpezaId(v.id);
    setNome(v.nome);
    setCategoria(v.categoria);
    setFornecedor(v.fornecedor || "");
    setShowAddLimpeza(true);
  };

  const handleSaveLimpeza = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !categoria) {
      alert("Preencha nome e categoria.");
      return;
    }

    const payload = {
      nome: nome.trim(),
      categoria,
      fornecedor: fornecedor.trim()
    };

    try {
      if (editLimpezaId) {
        await appDb.update("materiais_limpeza", editLimpezaId, payload);
      } else {
        await appDb.add("materiais_limpeza", payload);
      }
      setShowAddLimpeza(false);
    } catch (err: any) {
      alert("Erro ao salvar material: " + err.message);
    }
  };

  const handleDeleteLimpeza = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este material?")) {
      try {
        await appDb.delete("materiais_limpeza", id);
      } catch (err: any) {
        alert("Erro ao excluir material: " + err.message);
      }
    }
  };

  const handleDeletePedido = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este pedido?")) {
      try {
        await appDb.delete("pedidos_limpeza", id);
      } catch (err: any) {
        alert("Erro ao excluir pedido: " + err.message);
      }
    }
  };

  const handleUpdatePedidoStatus = async (id: string, newStatus: string) => {
    try {
      await appDb.update("pedidos_limpeza", id, { status: newStatus });
    } catch (err: any) {
      alert("Erro ao atualizar status: " + err.message);
    }
  };

  const iniciarNovoPedido = () => {
    // Inicializa todos com quantidade 0
    const itens = limpezasOrdenados.map(v => ({ limpezaId: v.id, quantidade: 0 }));
    setPedidoItens(itens);
    setShowNovoPedido(true);
  };

  const handleQuantidadeChange = (limpezaId: string, delta: number) => {
    setPedidoItens(prev => prev.map(item => {
      if (item.limpezaId === limpezaId) {
        return { ...item, quantidade: Math.max(0, item.quantidade + delta) };
      }
      return item;
    }));
  };

  const handleSalvarPedido = async () => {
    const itensSelecionados = pedidoItens.filter(i => i.quantidade > 0);
    if (itensSelecionados.length === 0) {
      alert("Selecione pelo menos um limpeza.");
      return;
    }

    let valorTotal = 0;
    const itensFormatados = itensSelecionados.map(item => {
      const v = limpezas.find(x => x.id === item.limpezaId);
      return {
        limpezaId: item.limpezaId,
        nome: v ? v.nome : "Desconhecido",
        quantidade: item.quantidade,
        fornecedor: v?.fornecedor || "Não informado"
      };
    });

    try {
      const newPedido = await appDb.add("pedidos_limpeza", {
        dataPedido: new Date().toISOString().split("T")[0],
        itens: itensFormatados,
        status: "Pendente"
      });
      
      setShowNovoPedido(false);
      gerarPDF(newPedido as PedidoLimpeza);
      setActiveTab("pedidos");
    } catch (err: any) {
      alert("Erro ao criar pedido: " + err.message);
    }
  };

  const gerarPDF = (pedido: PedidoLimpeza) => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Pedido de Material de Limpeza - Sea Rooftop", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Data: ${pedido.dataPedido.split("-").reverse().join("/")}`, 14, 28);
    doc.text(`Status: ${pedido.status}`, 14, 34);

    const tableColumn = ["Fornecedor", "Material", "Qtd"];
    const tableRows: any[] = [];
    
    pedido.itens.forEach(item => {
      tableRows.push([
        item.fornecedor || "-",
        item.nome,
        item.quantidade
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [40, 40, 40] }
    });

    doc.save(`pedido_limpeza_${pedido.dataPedido}.pdf`);
  };

  if (loading) {
    return <div className="p-8 text-slate-400">Carregando módulo...</div>;
  }

  return (
    <div className="flex flex-col space-y-6 animate-in fade-in duration-300">
      
      {/* HEADER E TABS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Package className="h-6 w-6 text-cyan-400" />
            Materiais de Limpeza
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestão de materiais e controle de pedidos semanais.
          </p>
        </div>
        
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
          <button
            onClick={() => setActiveTab("lista")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              activeTab === "lista" 
                ? "bg-slate-800 text-white shadow" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Materiais
          </button>
          <button
            onClick={() => setActiveTab("pedidos")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              activeTab === "pedidos" 
                ? "bg-slate-800 text-white shadow" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Pedidos
          </button>
        </div>
      </div>

      {activeTab === "lista" && (
        <div className="flex-1 flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <button
              onClick={openAddLimpeza}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow transition cursor-pointer"
            >
              <PlusCircle className="h-4 w-4 text-cyan-400" />
              Novo Material
            </button>
            <button
              onClick={iniciarNovoPedido}
              disabled={limpezas.length === 0}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="h-4 w-4" />
              Fazer Pedido
            </button>
          </div>

          <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 font-mono">
                    <th className="p-4 font-semibold">Nome do Material</th>
                    <th className="p-4 font-semibold">Categoria</th>
                    <th className="p-4 font-semibold">Fornecedor</th>
                    <th className="p-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300 text-sm">
                  {limpezasOrdenados.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-500 font-mono text-xs">
                        NENHUM MATERIAL CADASTRADO
                      </td>
                    </tr>
                  ) : (
                    limpezasOrdenados.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-4">
                          <p className="font-semibold text-slate-100">{v.nome}</p>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-medium font-mono uppercase border border-slate-700 bg-slate-800 text-slate-300">
                            {v.categoria}
                          </span>
                        </td>
                        <td className="p-4">
                          {v.fornecedor ? (
                            <p className="text-sm text-slate-300">{v.fornecedor}</p>
                          ) : (
                            <p className="text-xs text-slate-500">-</p>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditLimpeza(v)}
                              className="p-2 border border-slate-800 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLimpeza(v.id)}
                              className="p-2 border border-slate-800 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
        </div>
      )}

      {activeTab === "pedidos" && (
        <div className="flex-1 flex flex-col space-y-4">
          <div className="flex justify-between items-center">
             <h2 className="text-lg font-bold text-white tracking-tight">Histórico de Pedidos</h2>
             <button
              onClick={iniciarNovoPedido}
              disabled={limpezas.length === 0}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlusCircle className="h-4 w-4" />
              Novo Pedido
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pedidos.length === 0 ? (
              <div className="col-span-full p-8 text-center text-slate-500 font-mono text-xs border border-slate-800 border-dashed rounded-xl">
                NENHUM PEDIDO REGISTRADO
              </div>
            ) : (
              pedidos.map(p => (
                <div key={p.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-slate-200 font-semibold text-sm flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-500" />
                        {p.dataPedido.split("-").reverse().join("/")}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">{p.itens.length} materiais solicitados</p>
                    </div>
                    <select
                      value={p.status}
                      onChange={(e) => handleUpdatePedidoStatus(p.id, e.target.value)}
                      className={`text-xs font-bold font-mono uppercase rounded-lg px-2 py-1 outline-none border focus:ring-1 focus:ring-amber-500 transition-colors ${
                        p.status === 'Recebido' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        p.status === 'Enviado' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}
                    >
                      <option value="Pendente" className="bg-slate-900 text-amber-400">Pendente</option>
                      <option value="Enviado" className="bg-slate-900 text-blue-400">Enviado</option>
                      <option value="Recebido" className="bg-slate-900 text-emerald-400">Recebido</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2 pt-4 border-t border-slate-800/50">
                    <button 
                      onClick={() => gerarPDF(p)}
                      className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-2 rounded font-medium flex items-center justify-center gap-2 transition"
                    >
                      <FileDown className="h-3.5 w-3.5" />
                      Baixar PDF
                    </button>
                    <button 
                      onClick={() => handleDeletePedido(p.id)}
                      className="bg-slate-800/50 hover:bg-slate-800 text-rose-400 hover:text-rose-300 text-xs py-2 px-3 rounded font-medium flex items-center justify-center transition border border-slate-800/50 hover:border-rose-900"
                      title="Excluir Pedido"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR / EDITAR LIMPEZA */}
      {showAddLimpeza && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-lg font-bold text-white">
                {editLimpezaId ? "Editar Material" : "Novo Material"}
              </h3>
              <button 
                onClick={() => setShowAddLimpeza(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveLimpeza} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Nome do Material
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  placeholder="Ex: Água Sanitária 5L"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Categoria
                  </label>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Químicos">Químicos</option>
                    <option value="Descartáveis">Descartáveis</option>
                    <option value="Utensílios">Utensílios</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Fornecedor
                  </label>
                  <input
                    type="text"
                    value={fornecedor}
                    onChange={(e) => setFornecedor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                    placeholder="Ex: Distribuidora XYZ"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddLimpeza(false)}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-sm font-medium shadow-md transition"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FAZER PEDIDO */}
      {showNovoPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-cyan-400" />
                Criar Pedido de Limpeza
              </h3>
              <button 
                onClick={() => setShowNovoPedido(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <p className="text-sm text-slate-400 mb-4">
                Ajuste a quantidade dos materiais que deseja solicitar.
              </p>
              
              <div className="space-y-3">
                {limpezasOrdenados.map(v => {
                  const qtd = pedidoItens.find(i => i.limpezaId === v.id)?.quantidade || 0;
                  return (
                    <div key={v.id} className={`flex items-center justify-between p-3 rounded-lg border transition ${qtd > 0 ? "bg-cyan-500/10 border-cyan-500/30" : "bg-slate-950 border-slate-800"}`}>
                      <div className="flex-1 pr-4">
                        <p className="text-slate-200 font-semibold text-sm">{v.nome}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{v.categoria}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-slate-900 p-1.5 rounded-lg border border-slate-700">
                        <button
                          onClick={() => handleQuantidadeChange(v.id, -1)}
                          className="h-8 w-8 flex items-center justify-center rounded-md bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 active:scale-95 transition"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-mono font-bold text-slate-100 text-sm">
                          {qtd}
                        </span>
                        <button
                          onClick={() => handleQuantidadeChange(v.id, 1)}
                          className="h-8 w-8 flex items-center justify-center rounded-md bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 active:scale-95 transition"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/80 shrink-0 flex items-center justify-between">
              <div className="text-slate-300 text-sm font-mono">
                Itens Selecionados: <span className="text-white font-bold">{pedidoItens.filter(i => i.quantidade > 0).reduce((acc, curr) => acc + curr.quantidade, 0)}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNovoPedido(false)}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarPedido}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-sm font-medium shadow-md transition flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Concluir Pedido e Gerar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
