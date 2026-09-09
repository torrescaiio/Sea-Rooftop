import React, { useState, useEffect } from "react";
import { appDb } from "../firebase";
import { Search, Plus, ChefHat, Trash2, FileText, Check, Coffee, CheckSquare, Square } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface Ingrediente {
  nome: string;
  quantidade: string;
}

export interface FichaTecnica {
  id?: string;
  tipo: "bebida" | "comida";
  nome: string;
  recipiente?: string;
  ingredientes: Ingrediente[];
  modoPreparo: string;
  dataCriacao: string;
}

export default function FichasTecnicasModule() {
  const [fichas, setFichas] = useState<FichaTecnica[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<"bebida" | "comida">("bebida");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form
  const [tipo, setTipo] = useState<"bebida" | "comida">("bebida");
  const [nome, setNome] = useState("");
  const [recipiente, setRecipiente] = useState("");
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([{ nome: "", quantidade: "" }]);
  const [modoPreparo, setModoPreparo] = useState("");

  useEffect(() => {
    const unsubscribe = appDb.subscribe("fichas_tecnicas", (data) => {
      const items = data as FichaTecnica[];
      setFichas(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddIngrediente = () => {
    setIngredientes([...ingredientes, { nome: "", quantidade: "" }]);
  };

  const handleIngredienteChange = (index: number, field: keyof Ingrediente, value: string) => {
    const newIngredientes = [...ingredientes];
    newIngredientes[index][field] = value;
    setIngredientes(newIngredientes);
  };

  const handleRemoveIngrediente = (index: number) => {
    if (ingredientes.length === 1) return;
    const newIngredientes = [...ingredientes];
    newIngredientes.splice(index, 1);
    setIngredientes(newIngredientes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || ingredientes.some(i => !i.nome.trim() || !i.quantidade.trim()) || !modoPreparo.trim()) {
      alert("Preencha todos os campos da ficha (ingredientes e modo de preparo).");
      return;
    }

    try {
      await appDb.add("fichas_tecnicas", {
        tipo,
        nome,
        recipiente,
        ingredientes,
        modoPreparo,
        dataCriacao: new Date().toISOString()
      });
      setShowAddModal(false);
      setTipo("bebida");
      setNome("");
      setRecipiente("");
      setIngredientes([{ nome: "", quantidade: "" }]);
      setModoPreparo("");
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar a ficha técnica.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja realmente excluir esta ficha técnica?")) {
      await appDb.delete("fichas_tecnicas", id);
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(selectedId => selectedId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredFichas.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredFichas.map(f => f.id!));
    }
  };

  const gerarPDFMultiplas = () => {
    if (selectedIds.length === 0) {
      alert("Selecione pelo menos uma ficha técnica para exportar.");
      return;
    }

    const doc = new jsPDF();
    const fichasSelecionadas = fichas.filter(f => selectedIds.includes(f.id!));

    fichasSelecionadas.forEach((ficha, index) => {
      if (index > 0) {
        doc.addPage();
      }

      doc.setFontSize(22);
      doc.setTextColor(0);
      doc.text("Ficha Técnica de Produção", 14, 22);

      doc.setFontSize(16);
      doc.setTextColor(50);
      doc.text(ficha.nome, 14, 32);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Tipo: ${ficha.tipo === 'bebida' ? 'Bebida/Bar' : 'Comida/Cozinha'}`, 14, 40);
      if (ficha.recipiente) {
        doc.text(`Recipiente (Copo/Prato): ${ficha.recipiente}`, 14, 46);
        doc.text(`Data de Criação: ${new Date(ficha.dataCriacao).toLocaleDateString('pt-BR')}`, 14, 52);
      } else {
        doc.text(`Data de Criação: ${new Date(ficha.dataCriacao).toLocaleDateString('pt-BR')}`, 14, 46);
      }

      // Ingredientes
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Ingredientes", 14, ficha.recipiente ? 66 : 60);

      const tableData = ficha.ingredientes.map(i => [i.nome, i.quantidade]);
      
      autoTable(doc, {
        head: [['Ingrediente / Insumo', 'Quantidade']],
        body: tableData,
        startY: ficha.recipiente ? 71 : 65,
        theme: 'grid',
        headStyles: { fillColor: [40, 40, 40] }
      });

      const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 65;

      // Modo de Preparo
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Modo de Preparo", 14, finalY + 15);

      doc.setFontSize(11);
      doc.setTextColor(50);
      const splitText = doc.splitTextToSize(ficha.modoPreparo, 180);
      doc.text(splitText, 14, finalY + 22);
    });

    doc.save(`Fichas_Tecnicas_${new Date().getTime()}.pdf`);
  };

  const filteredFichas = fichas.filter(f => {
    const matchSearch = f.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = f.tipo === filterTipo;
    return matchSearch && matchTipo;
  }).sort((a, b) => a.nome.localeCompare(b.nome));

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <ChefHat className="h-8 w-8 text-emerald-500" />
            Fichas Técnicas
          </h1>
          <p className="text-slate-400 mt-1 text-sm">Gerador de fichas de produção para bebidas e comidas.</p>
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <button 
            onClick={gerarPDFMultiplas}
            disabled={selectedIds.length === 0}
            className="flex-1 sm:flex-none bg-slate-800 disabled:opacity-50 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <FileText className="h-4 w-4" />
            Exportar Selecionadas ({selectedIds.length})
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Ficha
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setFilterTipo("bebida")}
            className={`flex-1 py-4 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${
              filterTipo === "bebida" 
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Coffee className="h-4 w-4" />
            Bebidas (Bar)
          </button>
          <button
            onClick={() => setFilterTipo("comida")}
            className={`flex-1 py-4 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${
              filterTipo === "comida" 
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <ChefHat className="h-4 w-4" />
            Comidas (Cozinha)
          </button>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-900/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder={`Buscar em ${filterTipo === 'bebida' ? 'Bebidas' : 'Comidas'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>
        </div>

        <div className="p-6">
          {filteredFichas.length === 0 ? (
            <div className="text-center py-12">
              <ChefHat className="h-12 w-12 text-slate-700 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-300">Nenhuma ficha encontrada</h3>
              <p className="text-slate-500 mt-1">Crie sua primeira ficha técnica de produção.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredFichas.map(ficha => {
                const isSelected = selectedIds.includes(ficha.id!);
                return (
                  <div 
                    key={ficha.id} 
                    className={`bg-slate-950 border rounded-xl overflow-hidden transition-all duration-200 cursor-pointer ${
                      isSelected ? "border-emerald-500 ring-1 ring-emerald-500/50" : "border-slate-800 hover:border-slate-700"
                    }`}
                    onClick={() => handleToggleSelect(ficha.id!)}
                  >
                    <div className="p-4 border-b border-slate-800/50 flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center rounded-lg transition-colors ${isSelected ? "text-emerald-500" : "text-slate-500"}`}>
                          {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-lg leading-tight">{ficha.nome}</h3>
                          <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded mt-1 ${
                            ficha.tipo === 'bebida' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-orange-500/20 text-orange-400'
                          }`}>
                            {ficha.tipo === 'bebida' ? <Coffee className="h-3 w-3" /> : <ChefHat className="h-3 w-3" />}
                            {ficha.tipo}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(ficha.id!);
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="p-4 bg-slate-900/30">
                      {ficha.recipiente && (
                        <div className="mb-4 bg-slate-800/50 p-2 rounded flex items-center justify-between">
                          <span className="text-xs text-slate-400 font-medium uppercase">Copo / Prato:</span>
                          <span className="text-sm font-medium text-slate-200">{ficha.recipiente}</span>
                        </div>
                      )}
                      <p className="text-xs text-slate-400 font-medium mb-2 uppercase tracking-wider">Ingredientes ({ficha.ingredientes.length})</p>
                      <ul className="space-y-1.5 mb-4">
                        {ficha.ingredientes.slice(0, 3).map((ing, idx) => (
                          <li key={idx} className="flex justify-between text-sm">
                            <span className="text-slate-300 truncate pr-2">{ing.nome}</span>
                            <span className="text-slate-500 font-mono whitespace-nowrap">{ing.quantidade}</span>
                          </li>
                        ))}
                        {ficha.ingredientes.length > 3 && (
                          <li className="text-xs text-slate-500 italic mt-1">
                            + {ficha.ingredientes.length - 3} ingrediente(s)...
                          </li>
                        )}
                      </ul>
                      <p className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wider">Preparo</p>
                      <p className="text-sm text-slate-300 line-clamp-2">{ficha.modoPreparo}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white uppercase tracking-wider">Nova Ficha Técnica</h2>
                <p className="text-sm text-slate-400 mt-1">Cadastro de ficha de produção.</p>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Tipo</label>
                    <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                      <button
                        type="button"
                        onClick={() => setTipo('bebida')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                          tipo === 'bebida' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Bebida
                      </button>
                      <button
                        type="button"
                        onClick={() => setTipo('comida')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                          tipo === 'comida' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Comida
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Nome do Produto</label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Negroni, Hambúrguer Clássico..."
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-medium text-slate-300">Recipiente (Copo / Prato) <span className="text-slate-500 font-normal">(Opcional)</span></label>
                    <input
                      type="text"
                      value={recipiente}
                      onChange={(e) => setRecipiente(e.target.value)}
                      placeholder={tipo === 'bebida' ? "Ex: Copo Highball, Taça de Gin..." : "Ex: Prato Raso, Bowl..."}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-300">Ingredientes / Insumos</label>
                    <button
                      type="button"
                      onClick={handleAddIngrediente}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded"
                    >
                      <Plus className="h-3 w-3" /> Adicionar Insumo
                    </button>
                  </div>
                  <div className="space-y-2">
                    {ingredientes.map((ing, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <input
                            type="text"
                            required
                            placeholder="Nome do insumo (Ex: Gin)"
                            value={ing.nome}
                            onChange={(e) => handleIngredienteChange(idx, 'nome', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                          />
                        </div>
                        <div className="w-1/3">
                          <input
                            type="text"
                            required
                            placeholder="Qtd (Ex: 30ml)"
                            value={ing.quantidade}
                            onChange={(e) => handleIngredienteChange(idx, 'quantidade', e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngrediente(idx)}
                          disabled={ingredientes.length === 1}
                          className="p-2 text-slate-500 hover:text-rose-400 bg-slate-800 rounded-lg border border-slate-700 disabled:opacity-50 transition-colors mt-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Modo de Preparo</label>
                  <textarea
                    required
                    value={modoPreparo}
                    onChange={(e) => setModoPreparo(e.target.value)}
                    rows={4}
                    placeholder="Descreva o passo a passo da produção..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-sm resize-none"
                  ></textarea>
                </div>
              </div>
              <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900 sticky bottom-0 z-10 shrink-0 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Salvar Ficha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
