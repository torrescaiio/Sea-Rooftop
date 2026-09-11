import React, { useState, useEffect } from "react";
import { appDb } from "../firebase";
import { Search, Plus, ChefHat, Trash2, FileText, Check, Coffee, CheckSquare, Square, FlaskConical } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface Ingrediente {
  nome: string;
  quantidade: string;
  isCadastrado?: boolean;
}

export interface CategoriaFicha {
  id?: string;
  tipo: "bebida" | "comida" | "insumo";
  nome: string;
}

export interface FichaTecnica {
  id?: string;
  tipo: "bebida" | "comida" | "insumo";
  nome: string;
  categoria?: string;
  recipiente?: string;
  ingredientes: Ingrediente[];
  modoPreparo: string;
  dataCriacao: string;
}

export default function FichasTecnicasModule() {
  const [fichas, setFichas] = useState<FichaTecnica[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<"bebida" | "comida" | "insumo">("bebida");
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form
  const [tipo, setTipo] = useState<"bebida" | "comida" | "insumo">("bebida");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [recipiente, setRecipiente] = useState("");
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([{ nome: "", quantidade: "" }]);
  const [modoPreparo, setModoPreparo] = useState("");
  const [categoriasLista, setCategoriasLista] = useState<CategoriaFicha[]>([]);

  useEffect(() => {
    let fichasLoaded = false;
    let categoriasLoaded = false;
    
    const unsubscribeFichas = appDb.subscribe("fichas_tecnicas", (data) => {
      setFichas(data as FichaTecnica[]);
      fichasLoaded = true;
      if (categoriasLoaded) setLoading(false);
    });

    const unsubscribeCategorias = appDb.subscribe("fichas_categorias", (data) => {
      setCategoriasLista(data as CategoriaFicha[]);
      categoriasLoaded = true;
      if (fichasLoaded) setLoading(false);
    });

    return () => {
      unsubscribeFichas();
      unsubscribeCategorias();
    };
  }, []);

  const handleAddCategoria = async () => {
    const nomeCategoria = window.prompt(`Digite o nome da nova categoria para ${tipo === 'bebida' ? 'Bebidas' : tipo === 'comida' ? 'Comidas' : 'Insumos'}:`);
    if (nomeCategoria && nomeCategoria.trim() !== "") {
      try {
        await appDb.add("fichas_categorias", {
          tipo,
          nome: nomeCategoria.trim()
        });
        setCategoria(nomeCategoria.trim());
      } catch (error) {
        console.error("Erro ao adicionar categoria", error);
        alert("Erro ao adicionar categoria.");
      }
    }
  };

  const handleAddIngrediente = (isCadastrado: boolean = false) => {
    setIngredientes([...ingredientes, { nome: "", quantidade: "", isCadastrado }]);
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
        categoria,
        recipiente,
        ingredientes,
        modoPreparo,
        dataCriacao: new Date().toISOString()
      });
      setShowAddModal(false);
      setTipo("bebida");
      setNome("");
      setCategoria("");
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
      let yPos = 40;
      doc.text(`Tipo: ${ficha.tipo === 'bebida' ? 'Bebida/Bar' : ficha.tipo === 'comida' ? 'Comida/Cozinha' : 'Insumo/Preparo'}`, 14, yPos);
      if (ficha.categoria) {
        doc.text(`Categoria: ${ficha.categoria}`, 100, yPos);
      }
      yPos += 6;
      
      if (ficha.recipiente) {
        doc.text(`Armazenamento/Recipiente: ${ficha.recipiente}`, 14, yPos);
        yPos += 6;
      }
      doc.text(`Data de Criação: ${new Date(ficha.dataCriacao).toLocaleDateString('pt-BR')}`, 14, yPos);
      
      yPos += 14;
      // Ingredientes
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Ingredientes", 14, yPos);

      const tableData = ficha.ingredientes.map(i => [i.nome, i.quantidade]);
      
      autoTable(doc, {
        head: [['Ingrediente / Insumo', 'Quantidade']],
        body: tableData,
        startY: yPos + 5,
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
    const matchCategoria = filterCategoria === "todas" || f.categoria === filterCategoria;
    return matchSearch && matchTipo && matchCategoria;
  }).sort((a, b) => a.nome.localeCompare(b.nome));

  const sugestoesInsumos = fichas.filter(f => f.tipo === "insumo").map(f => f.nome).sort();

  const handleSetFilterTipo = (novoTipo: "bebida" | "comida" | "insumo") => {
    setFilterTipo(novoTipo);
    setFilterCategoria("todas");
  };

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
          <p className="text-slate-400 mt-1 text-sm">Gerador de fichas de produção para bebidas, comidas e insumos.</p>
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
        <div className="flex border-b border-slate-800 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => handleSetFilterTipo("bebida")}
            className={`flex-1 min-w-[140px] py-4 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${
              filterTipo === "bebida" 
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Coffee className="h-4 w-4" />
            Bebidas (Bar)
          </button>
          <button
            onClick={() => handleSetFilterTipo("comida")}
            className={`flex-1 min-w-[140px] py-4 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${
              filterTipo === "comida" 
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <ChefHat className="h-4 w-4" />
            Comidas (Cozinha)
          </button>
          <button
            onClick={() => handleSetFilterTipo("insumo")}
            className={`flex-1 min-w-[140px] py-4 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${
              filterTipo === "insumo" 
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <FlaskConical className="h-4 w-4" />
            Insumos / Preparos
          </button>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder={`Buscar em ${filterTipo === 'bebida' ? 'Bebidas' : filterTipo === 'comida' ? 'Comidas' : 'Insumos'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            />
          </div>
          <div className="sm:w-64">
            <select
              value={filterCategoria}
              onChange={(e) => setFilterCategoria(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
            >
              <option value="todas">Todas as categorias</option>
              {categoriasLista.filter(c => c.tipo === filterTipo).map(c => (
                <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
              ))}
            </select>
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
                          <div className="flex flex-wrap gap-2 mt-1.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
                              ficha.tipo === 'bebida' ? 'bg-indigo-500/20 text-indigo-400' :
                              ficha.tipo === 'comida' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-pink-500/20 text-pink-400'
                            }`}>
                              {ficha.tipo === 'bebida' ? <Coffee className="h-3 w-3" /> :
                               ficha.tipo === 'comida' ? <ChefHat className="h-3 w-3" /> :
                               <FlaskConical className="h-3 w-3" />}
                              {ficha.tipo}
                            </span>
                            {ficha.categoria && (
                              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                {ficha.categoria}
                              </span>
                            )}
                          </div>
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
                          <span className="text-xs text-slate-400 font-medium uppercase">Armazenamento/Recipiente:</span>
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
                      <button
                        type="button"
                        onClick={() => setTipo('insumo')}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                          tipo === 'insumo' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        Insumo
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
                      placeholder={tipo === 'insumo' ? "Ex: Xarope de Gengibre, Molho Ranch..." : "Ex: Negroni, Hambúrguer Clássico..."}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-medium text-slate-300">Categoria <span className="text-slate-500 font-normal">(Opcional)</span></label>
                    <div className="flex gap-2">
                      <select
                        value={categoria}
                        onChange={(e) => setCategoria(e.target.value)}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-sm"
                      >
                        <option value="">Nenhuma categoria</option>
                        {categoriasLista.filter(c => c.tipo === tipo).map(c => (
                          <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddCategoria}
                        className="bg-slate-800 border border-slate-700 hover:border-emerald-500 hover:text-emerald-400 text-slate-400 px-3 py-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
                      >
                        <Plus className="h-4 w-4" /> Nova Categoria
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-medium text-slate-300">Recipiente / Armazenamento <span className="text-slate-500 font-normal">(Opcional)</span></label>
                    <input
                      type="text"
                      value={recipiente}
                      onChange={(e) => setRecipiente(e.target.value)}
                      placeholder={tipo === 'bebida' ? "Ex: Copo Highball, Taça de Gin..." : tipo === 'comida' ? "Ex: Prato Raso, Bowl..." : "Ex: Bisnaga, Garrafa Squeeze..."}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-300">Ingredientes / Insumos</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddIngrediente(false)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Ingrediente Manual
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddIngrediente(true)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded transition-colors"
                      >
                        <FlaskConical className="h-3 w-3" /> Puxar Insumo
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {ingredientes.map((ing, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <div className="flex-1">
                          {ing.isCadastrado ? (
                            <select
                              required
                              value={ing.nome}
                              onChange={(e) => handleIngredienteChange(idx, 'nome', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                            >
                              <option value="" disabled>Selecione um insumo/preparo...</option>
                              {fichas.filter(f => f.tipo === 'insumo').map((f) => (
                                <option key={f.id || f.nome} value={f.nome}>{f.nome}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              required
                              placeholder="Nome do ingrediente (Ex: Gelo, Sal...)"
                              value={ing.nome}
                              onChange={(e) => handleIngredienteChange(idx, 'nome', e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                            />
                          )}
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
