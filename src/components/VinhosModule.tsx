import React, { useState, useEffect } from "react";
import { appDb } from "../firebase";
import { Vinho, PedidoVinho, ContagemEstoque } from "../types";
import { 
  Wine, 
  PlusCircle, 
  Pencil, 
  Trash2, 
  X, 
  ShoppingCart, 
  FileDown, 
  Info,
  Calendar,
  Check
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function VinhosModule() {
  const [activeTab, setActiveTab] = useState<"carta" | "pedidos" | "estoque">("carta");
  
  // Data States
  const [vinhos, setVinhos] = useState<Vinho[]>([]);
  const [pedidos, setPedidos] = useState<PedidoVinho[]>([]);
  const [contagens, setContagens] = useState<ContagemEstoque[]>([]);
  
  // Loading
  const [loading, setLoading] = useState(true);

  const vinhosOrdenados = [...vinhos].sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateA - dateB;
  });

  // Modal States
  const [showAddVinho, setShowAddVinho] = useState(false);
  const [editVinhoId, setEditVinhoId] = useState<string | null>(null);
  const [showNovoPedido, setShowNovoPedido] = useState(false);
  const [showNovaContagem, setShowNovaContagem] = useState(false);
  
  // Vinho Form
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<Vinho["tipo"]>("Tinto");
  const [uva, setUva] = useState("");
  const [produtor, setProdutor] = useState("");
  const [pais, setPais] = useState("");
  const [precoCusto, setPrecoCusto] = useState<number | "">("");
  const [fornecedor, setFornecedor] = useState("");

  // Pedido Form
  const [pedidoItens, setPedidoItens] = useState<{vinhoId: string; quantidade: number}[]>([]);

  // Contagem Form
  const [contagemItens, setContagemItens] = useState<{vinhoId: string; quantidade: number}[]>([]);

  useEffect(() => {
    const unsubVinhos = appDb.subscribe("vinhos", (data) => {
      setVinhos(data as Vinho[]);
      setLoading(false);
    });
    
    const unsubPedidos = appDb.subscribe("pedidos_vinho", (data) => {
      setPedidos(data as PedidoVinho[]);
    });

    const unsubContagens = appDb.subscribe("contagem_estoque", (data) => {
      setContagens(data as ContagemEstoque[]);
    });

    return () => {
      unsubVinhos();
      unsubPedidos();
      unsubContagens();
    };
  }, []);

  const openAddVinho = () => {
    setEditVinhoId(null);
    setNome("");
    setTipo("Tinto");
    setUva("");
    setProdutor("");
    setPais("");
    setPrecoCusto("");
    setFornecedor("");
    setShowAddVinho(true);
  };

  const openEditVinho = (v: Vinho) => {
    setEditVinhoId(v.id);
    setNome(v.nome);
    setTipo(v.tipo);
    setUva(v.uva);
    setProdutor(v.produtor);
    setPais(v.pais);
    setPrecoCusto(v.precoCusto || "");
    setFornecedor(v.fornecedor || "");
    setShowAddVinho(true);
  };

  const handleSaveVinho = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !tipo || !produtor) {
      alert("Preencha nome, tipo e produtor.");
      return;
    }

    const payload = {
      nome: nome.trim(),
      tipo,
      uva: uva.trim(),
      produtor: produtor.trim(),
      pais: pais.trim(),
      precoCusto: precoCusto ? Number(precoCusto) : null,
      fornecedor: fornecedor.trim()
    };

    try {
      if (editVinhoId) {
        await appDb.update("vinhos", editVinhoId, payload);
      } else {
        await appDb.add("vinhos", payload);
      }
      setShowAddVinho(false);
    } catch (err: any) {
      alert("Erro ao salvar vinho: " + err.message);
    }
  };

  const handleDeleteVinho = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este vinho?")) {
      try {
        await appDb.delete("vinhos", id);
      } catch (err: any) {
        alert("Erro ao excluir vinho: " + err.message);
      }
    }
  };

  const handleDeletePedido = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este pedido?")) {
      try {
        await appDb.delete("pedidos_vinho", id);
      } catch (err: any) {
        alert("Erro ao excluir pedido: " + err.message);
      }
    }
  };

  const iniciarNovaContagem = () => {
    // Inicializa todos com quantidade 0
    const itens = vinhosOrdenados.map(v => ({ vinhoId: v.id, quantidade: 0 }));
    setContagemItens(itens);
    setShowNovaContagem(true);
  };

  const handleQuantidadeContagemChange = (vinhoId: string, delta: number) => {
    setContagemItens(prev => prev.map(item => {
      if (item.vinhoId === vinhoId) {
        return { ...item, quantidade: Math.max(0, item.quantidade + delta) };
      }
      return item;
    }));
  };

  const handleSetQuantidadeContagem = (vinhoId: string, valor: string) => {
    const qtd = parseInt(valor, 10);
    if (isNaN(qtd) || qtd < 0) return;
    setContagemItens(prev => prev.map(item => {
      if (item.vinhoId === vinhoId) {
        return { ...item, quantidade: qtd };
      }
      return item;
    }));
  };

  const handleSalvarContagem = async () => {
    // Save all items even if 0, so we have a full inventory picture
    try {
      await appDb.add("contagem_estoque", {
        dataContagem: new Date().toISOString().split("T")[0],
        itens: contagemItens
      });
      setShowNovaContagem(false);
      setActiveTab("estoque");
    } catch (err: any) {
      alert("Erro ao salvar contagem: " + err.message);
    }
  };

  const handleDeleteContagem = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir esta contagem de estoque?")) {
      try {
        await appDb.delete("contagem_estoque", id);
      } catch (err: any) {
        alert("Erro ao excluir contagem: " + err.message);
      }
    }
  };

  const getVendasPorVinho = () => {
    if (contagens.length < 2) return [];
    
    // Sort contagens by date descending
    const sortedContagens = [...contagens].sort((a, b) => new Date(b.dataContagem).getTime() - new Date(a.dataContagem).getTime());
    
    const latest = sortedContagens[0];
    const previous = sortedContagens[1];
    
    const relatorio = vinhosOrdenados.map(v => {
      const qLatest = latest.itens.find(i => i.vinhoId === v.id)?.quantidade || 0;
      const qPrev = previous.itens.find(i => i.vinhoId === v.id)?.quantidade || 0;
      const vendidas = Math.max(0, qPrev - qLatest);
      
      return {
        vinho: v,
        estoqueAtual: qLatest,
        vendidas,
        receitaEstimada: vendidas * (v.precoCusto || 0) // We only have precoCusto, maybe they want to see revenue based on cost? Or just volume.
      };
    });
    
    return relatorio.sort((a, b) => b.vendidas - a.vendidas); // sort by sales volume
  };

  const iniciarNovoPedido = () => {
    // Inicializa todos com quantidade 0
    const itens = vinhosOrdenados.map(v => ({ vinhoId: v.id, quantidade: 0 }));
    setPedidoItens(itens);
    setShowNovoPedido(true);
  };

  const handleQuantidadeChange = (vinhoId: string, delta: number) => {
    setPedidoItens(prev => prev.map(item => {
      if (item.vinhoId === vinhoId) {
        return { ...item, quantidade: Math.max(0, item.quantidade + delta) };
      }
      return item;
    }));
  };

  const handleSalvarPedido = async () => {
    const itensSelecionados = pedidoItens.filter(i => i.quantidade > 0);
    if (itensSelecionados.length === 0) {
      alert("Selecione pelo menos um vinho.");
      return;
    }

    let valorTotal = 0;
    const itensFormatados = itensSelecionados.map(item => {
      const v = vinhos.find(x => x.id === item.vinhoId);
      const preco = v?.precoCusto || 0;
      valorTotal += preco * item.quantidade;
      return {
        vinhoId: item.vinhoId,
        nome: v ? `${v.nome} (${v.produtor})` : "Desconhecido",
        quantidade: item.quantidade,
        precoUnitario: preco,
        fornecedor: v?.fornecedor || "Não informado"
      };
    });

    try {
      const newPedido = await appDb.add("pedidos_vinho", {
        dataPedido: new Date().toISOString().split("T")[0],
        itens: itensFormatados,
        valorTotal,
        status: "Pendente"
      });
      
      setShowNovoPedido(false);
      gerarPDF(newPedido as PedidoVinho);
      setActiveTab("pedidos");
    } catch (err: any) {
      alert("Erro ao criar pedido: " + err.message);
    }
  };

  const gerarPDF = (pedido: PedidoVinho) => {
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text("Pedido de Vinhos - Sea Rooftop", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Data: ${pedido.dataPedido.split("-").reverse().join("/")}`, 14, 28);
    doc.text(`Status: ${pedido.status}`, 14, 34);

    const tableColumn = ["Fornecedor", "Vinho", "Qtd"];
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

    doc.save(`pedido_vinhos_${pedido.dataPedido}.pdf`);
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
            <Wine className="h-6 w-6 text-fuchsia-400" />
            Carta de Vinhos
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestão de rótulos e pedidos para o Sea Rooftop.
          </p>
        </div>
        
        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
          <button
            onClick={() => setActiveTab("carta")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              activeTab === "carta" 
                ? "bg-slate-800 text-white shadow" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Rótulos
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
          <button
            onClick={() => setActiveTab("estoque")}
            className={`px-4 py-2 text-sm font-medium rounded-md transition ${
              activeTab === "estoque" 
                ? "bg-slate-800 text-white shadow" 
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Estoque & Vendas
          </button>
        </div>
      </div>

      {activeTab === "carta" && (
        <div className="flex-1 flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <button
              onClick={openAddVinho}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow transition cursor-pointer"
            >
              <PlusCircle className="h-4 w-4 text-fuchsia-400" />
              Novo Vinho
            </button>
            <button
              onClick={iniciarNovoPedido}
              disabled={vinhos.length === 0}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <th className="p-4 font-semibold">Rótulo / Produtor</th>
                    <th className="p-4 font-semibold">Tipo</th>
                    <th className="p-4 font-semibold">Uva / Região</th>
                    <th className="p-4 font-semibold">Custo Aprox.</th>
                    <th className="p-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300 text-sm">
                  {vinhosOrdenados.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-500 font-mono text-xs">
                        NENHUM VINHO CADASTRADO
                      </td>
                    </tr>
                  ) : (
                    vinhosOrdenados.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-4">
                          <p className="font-semibold text-slate-100">{v.nome}</p>
                          <p className="text-xs text-slate-500">{v.produtor}</p>
                        </td>
                        <td className="p-4">
                          <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-medium font-mono uppercase border border-slate-700 bg-slate-800 text-slate-300">
                            {v.tipo}
                          </span>
                        </td>
                        <td className="p-4">
                          <p>{v.uva || "-"}</p>
                          <p className="text-xs text-slate-500">{v.pais || "-"}</p>
                          {v.fornecedor && <p className="text-xs text-fuchsia-400 mt-1">Forn: {v.fornecedor}</p>}
                        </td>
                        <td className="p-4 font-mono text-emerald-400">
                          {v.precoCusto ? `R$ ${v.precoCusto.toFixed(2)}` : "-"}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditVinho(v)}
                              className="p-2 border border-slate-800 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400 transition"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteVinho(v.id)}
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
              disabled={vinhos.length === 0}
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
                      <p className="text-xs text-slate-400 mt-1">{p.itens.length} rótulos solicitados</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase border border-amber-500/20 bg-amber-500/10 text-amber-400">
                      {p.status}
                    </span>
                  </div>
                  
                  <div className="text-xl font-mono text-white">
                    R$ {p.valorTotal.toFixed(2)}
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

      {activeTab === "estoque" && (
        <div className="flex-1 flex flex-col space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white tracking-tight">Relatório de Estoque e Vendas</h2>
            <button
              onClick={iniciarNovaContagem}
              disabled={vinhos.length === 0}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlusCircle className="h-4 w-4" />
              Nova Contagem
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-5">
            <h3 className="text-slate-200 font-semibold mb-4 text-sm uppercase tracking-wider font-mono">
              Análise de Vendas (Últimas 2 Contagens)
            </h3>
            {contagens.length < 2 ? (
              <p className="text-slate-500 text-sm italic">
                {contagens.length === 0 
                  ? "Nenhuma contagem de estoque registrada. Faça a primeira contagem." 
                  : "Apenas uma contagem registrada. É necessário ter pelo menos duas para calcular vendas por diferença."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400 font-mono">
                      <th className="p-3 font-semibold">Vinho</th>
                      <th className="p-3 font-semibold">Estoque Atual</th>
                      <th className="p-3 font-semibold text-emerald-400">Qtd. Vendida</th>
                      <th className="p-3 font-semibold text-emerald-400">Volume Bruto Aprox.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 text-slate-300 text-sm">
                    {getVendasPorVinho().map((rel, idx) => (
                      <tr key={rel.vinho.id} className="hover:bg-slate-800/30 transition">
                        <td className="p-3">
                          <p className="font-semibold text-slate-200">{rel.vinho.nome}</p>
                          <p className="text-xs text-slate-500">{rel.vinho.produtor} • {rel.vinho.tipo}</p>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-300">
                          {rel.estoqueAtual}
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-400">
                          {rel.vendidas}
                        </td>
                        <td className="p-3 font-mono text-emerald-400">
                          R$ {rel.receitaEstimada.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-slate-200 font-semibold mb-4 text-sm uppercase tracking-wider font-mono">
              Histórico de Contagens
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contagens.length === 0 ? (
                <p className="text-slate-500 text-sm col-span-full">Nenhuma contagem no histórico.</p>
              ) : (
                [...contagens].sort((a, b) => new Date(b.dataContagem).getTime() - new Date(a.dataContagem).getTime()).map(c => (
                  <div key={c.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-between">
                    <div>
                      <p className="text-slate-300 font-bold mb-1">
                        Contagem: {c.dataContagem.split("-").reverse().join("/")}
                      </p>
                      <p className="text-slate-500 text-xs">
                        Rótulos contados: {c.itens.filter(i => i.quantidade > 0).length}
                      </p>
                      <p className="text-slate-500 text-xs">
                        Total garrafas: {c.itens.reduce((acc, curr) => acc + curr.quantidade, 0)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteContagem(c.id)}
                      className="mt-4 bg-slate-800/50 hover:bg-slate-800 text-rose-400 hover:text-rose-300 text-xs py-2 px-3 rounded font-medium flex items-center justify-center transition border border-slate-800/50 hover:border-rose-900"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Excluir Contagem
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ADICIONAR / EDITAR VINHO */}
      {showAddVinho && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
              <h3 className="text-lg font-bold text-white">
                {editVinhoId ? "Editar Vinho" : "Novo Vinho"}
              </h3>
              <button 
                onClick={() => setShowAddVinho(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveVinho} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Rótulo / Nome
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-fuchsia-500 focus:outline-none"
                  placeholder="Ex: Alamos Malbec"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Tipo
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-fuchsia-500 focus:outline-none"
                  >
                    <option value="Tinto">Tinto</option>
                    <option value="Branco">Branco</option>
                    <option value="Rosé">Rosé</option>
                    <option value="Espumante">Espumante</option>
                    <option value="Sobremesa">Sobremesa</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Produtor / Bodega
                  </label>
                  <input
                    type="text"
                    required
                    value={produtor}
                    onChange={(e) => setProdutor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-fuchsia-500 focus:outline-none"
                    placeholder="Ex: Catena Zapata"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Uva (Blend)
                  </label>
                  <input
                    type="text"
                    value={uva}
                    onChange={(e) => setUva(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-fuchsia-500 focus:outline-none"
                    placeholder="Ex: 100% Malbec"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Região / País
                  </label>
                  <input
                    type="text"
                    value={pais}
                    onChange={(e) => setPais(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-fuchsia-500 focus:outline-none"
                    placeholder="Ex: Mendoza, Argentina"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Preço de Custo (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={precoCusto}
                    onChange={(e) => setPrecoCusto(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-fuchsia-500 focus:outline-none font-mono"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Fornecedor
                  </label>
                  <input
                    type="text"
                    value={fornecedor}
                    onChange={(e) => setFornecedor(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-fuchsia-500 focus:outline-none"
                    placeholder="Ex: Grand Cru"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddVinho(false)}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white rounded-lg text-sm font-medium shadow-md transition"
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
                <ShoppingCart className="h-5 w-5 text-fuchsia-400" />
                Criar Pedido de Vinhos
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
                Ajuste a quantidade dos rótulos que deseja solicitar.
              </p>
              
              <div className="space-y-3">
                {vinhosOrdenados.map(v => {
                  const qtd = pedidoItens.find(i => i.vinhoId === v.id)?.quantidade || 0;
                  return (
                    <div key={v.id} className={`flex items-center justify-between p-3 rounded-lg border transition ${qtd > 0 ? "bg-fuchsia-500/10 border-fuchsia-500/30" : "bg-slate-950 border-slate-800"}`}>
                      <div className="flex-1 pr-4">
                        <p className="text-slate-200 font-semibold text-sm">{v.nome}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{v.produtor} • {v.tipo}</p>
                        {v.precoCusto && (
                           <p className="text-slate-400 text-xs font-mono mt-1">Custo: R$ {v.precoCusto.toFixed(2)}</p>
                        )}
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
                Rótulos Selecionados: <span className="text-white font-bold">{pedidoItens.filter(i => i.quantidade > 0).reduce((acc, curr) => acc + curr.quantidade, 0)}</span>
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
                  className="px-5 py-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white rounded-lg text-sm font-medium shadow-md transition flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Concluir Pedido e Gerar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVA CONTAGEM */}
      {showNovaContagem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <PlusCircle className="h-5 w-5 text-emerald-400" />
                Registrar Contagem Semanal (Estoque)
              </h3>
              <button 
                onClick={() => setShowNovaContagem(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <p className="text-sm text-slate-400 mb-4">
                Insira a quantidade atual de garrafas físicas para cada rótulo.
              </p>
              
              <div className="space-y-3">
                {vinhosOrdenados.map(v => {
                  const qtd = contagemItens.find(i => i.vinhoId === v.id)?.quantidade || 0;
                  return (
                    <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border bg-slate-950 border-slate-800 transition focus-within:border-emerald-500/50">
                      <div className="flex-1 pr-4">
                        <p className="text-slate-200 font-semibold text-sm">{v.nome}</p>
                        <p className="text-slate-500 text-xs mt-0.5">{v.produtor} • {v.tipo}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-slate-900 p-1.5 rounded-lg border border-slate-700">
                        <button
                          onClick={() => handleQuantidadeContagemChange(v.id, -1)}
                          className="h-8 w-8 flex items-center justify-center rounded-md bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 active:scale-95 transition"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={qtd}
                          onChange={(e) => handleSetQuantidadeContagem(v.id, e.target.value)}
                          className="w-14 text-center font-mono font-bold text-slate-100 bg-transparent border-none focus:outline-none focus:ring-0 text-sm"
                        />
                        <button
                          onClick={() => handleQuantidadeContagemChange(v.id, 1)}
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
                Total de garrafas: <span className="text-white font-bold">{contagemItens.reduce((acc, curr) => acc + curr.quantidade, 0)}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNovaContagem(false)}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSalvarContagem}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-sm font-medium shadow-md transition flex items-center gap-2"
                >
                  <Check className="h-4 w-4" />
                  Salvar Contagem
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
