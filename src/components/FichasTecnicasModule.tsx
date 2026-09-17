import React, { useState, useEffect, useRef } from "react";
import { appDb } from "../firebase";
import { Search, Plus, ChefHat, Trash2, FileText, Check, Coffee, CheckSquare, Square, FlaskConical, User as UserIcon, Package, ChevronDown, ChevronUp } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface Ingrediente {
  nome: string;
  quantidade: string;
  isCadastrado?: boolean;
  origem?: 'manual' | 'insumo' | 'materia_prima';
  custoCompra?: string;
  unidadeCompra?: string;
}

export interface CategoriaFicha {
  id?: string;
  tipo: "bebida" | "comida" | "insumo";
  nome: string;
}

export interface MateriaPrima {
  id?: string;
  nome: string;
  custo: number;
  unidade: string;
}

export interface FichaTecnica {
  id?: string;
  tipo: "bebida" | "comida" | "insumo";
  nome: string;
  categoria?: string;
  recipiente?: string;
  ingredientes: Ingrediente[];
  modoPreparo: string;
  dataCriacao?: string;
  createdAt?: string;
  createdBy?: string;
  rendimentoQtd?: number;
  rendimentoUnidade?: string;
}

const SearchableSelect = ({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  color = 'amber' 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: { label: string; value: string }[]; 
  placeholder: string;
  color?: 'amber' | 'indigo' | 'emerald';
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );
  // Sort alphabetically
  filteredOptions.sort((a, b) => a.label.localeCompare(b.label));

  const selectedOption = options.find(o => o.value === value);
  const borderRingClass = color === 'amber' ? 'ring-1 ring-amber-500 border-amber-500' : 'ring-1 ring-indigo-500 border-indigo-500';

  return (
    <div className="relative w-full" ref={wrapperRef}>
       <div 
         className={`w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white cursor-text text-sm flex justify-between items-center ${isOpen ? borderRingClass : ''}`}
         onClick={() => setIsOpen(true)}
       >
         {isOpen ? (
           <input 
             type="text" 
             className="bg-transparent border-none outline-none w-full text-white text-sm" 
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             autoFocus
             placeholder="Buscar..."
           />
         ) : (
           <span className={selectedOption ? "text-white" : "text-slate-400"}>{selectedOption ? selectedOption.label : placeholder}</span>
         )}
         <ChevronDown className="h-4 w-4 text-slate-400 ml-2 shrink-0" />
       </div>

       {isOpen && (
         <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
           {filteredOptions.length > 0 ? (
             filteredOptions.map((opt) => (
               <div
                 key={opt.value}
                 className={`px-3 py-2 text-sm cursor-pointer hover:bg-slate-700 ${value === opt.value ? 'bg-slate-700 text-white' : 'text-slate-300'}`}
                 onClick={() => {
                   onChange(opt.value);
                   setSearch('');
                   setIsOpen(false);
                 }}
               >
                 {opt.label}
               </div>
             ))
           ) : (
             <div className="px-3 py-2 text-sm text-slate-500">Nenhum resultado</div>
           )}
         </div>
       )}
    </div>
  );
};

export default function FichasTecnicasModule() {
  const [fichas, setFichas] = useState<FichaTecnica[]>([]);
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<"bebida" | "comida" | "insumo" | "materias_primas">("bebida");
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form
  const [tipo, setTipo] = useState<"bebida" | "comida" | "insumo">("bebida");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [showAddCategoria, setShowAddCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [recipiente, setRecipiente] = useState("");
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([{ nome: "", quantidade: "", isCadastrado: false, origem: 'manual' }]);
  const [modoPreparo, setModoPreparo] = useState("");
  const [categoriasLista, setCategoriasLista] = useState<CategoriaFicha[]>([]);
  
  // Cost tracking for "insumo"
  const [rendimentoQtd, setRendimentoQtd] = useState<string>("1");
  const [rendimentoUnidade, setRendimentoUnidade] = useState<string>("l");

  const resetForm = () => {
    setEditingId(null);
    setTipo("bebida");
    setNome("");
    setCategoria("");
    setRecipiente("");
    setIngredientes([{ nome: "", quantidade: "", isCadastrado: false, origem: 'manual' }]);
    setModoPreparo("");
    setRendimentoQtd("1");
    setRendimentoUnidade("l");
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEdit = (ficha: FichaTecnica) => {
    setEditingId(ficha.id!);
    setTipo(ficha.tipo);
    setNome(ficha.nome);
    setCategoria(ficha.categoria || "");
    setRecipiente(ficha.recipiente || "");
    setIngredientes(ficha.ingredientes.map(i => ({
      ...i,
      origem: i.origem || (i.isCadastrado ? 'insumo' : 'manual')
    })));
    setModoPreparo(ficha.modoPreparo);
    if (ficha.tipo === 'insumo') {
      setRendimentoQtd(ficha.rendimentoQtd?.toString() || "1");
      setRendimentoUnidade(ficha.rendimentoUnidade || "l");
    }
    setShowAddModal(true);
    setExpandedId(null);
  };

  useEffect(() => {
    let fichasLoaded = false;
    let categoriasLoaded = false;
    let materiasLoaded = false;
    
    const checkLoading = () => {
      if (fichasLoaded && categoriasLoaded && materiasLoaded) {
        setLoading(false);
      }
    };

    const unsubscribeFichas = appDb.subscribe("fichas_tecnicas", (data) => {
      setFichas(data as FichaTecnica[]);
      fichasLoaded = true;
      checkLoading();
    });

    const unsubscribeCategorias = appDb.subscribe("fichas_categorias", (data) => {
      setCategoriasLista(data as CategoriaFicha[]);
      categoriasLoaded = true;
      checkLoading();
    });

    const unsubscribeMaterias = appDb.subscribe("materias_primas", (data) => {
      setMateriasPrimas(data as MateriaPrima[]);
      materiasLoaded = true;
      checkLoading();
    });

    return () => {
      unsubscribeFichas();
      unsubscribeCategorias();
      unsubscribeMaterias();
    };
  }, []);

  const handleAddCategoria = async () => {
    if (novaCategoriaNome && novaCategoriaNome.trim() !== "") {
      try {
        await appDb.add("fichas_categorias", {
          tipo,
          nome: novaCategoriaNome.trim()
        });
        setCategoria(novaCategoriaNome.trim());
        setShowAddCategoria(false);
        setNovaCategoriaNome("");
      } catch (error) {
        console.error("Erro ao adicionar categoria", error);
      }
    }
  };

  const handleAddIngrediente = (origem: 'manual' | 'insumo' | 'materia_prima' = 'manual') => {
    setIngredientes([...ingredientes, { 
      nome: "", 
      quantidade: "", 
      isCadastrado: origem === 'insumo', 
      origem 
    }]);
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
      const novaFicha: any = {
        tipo,
        nome,
        categoria,
        recipiente,
        ingredientes,
        modoPreparo,
        dataCriacao: new Date().toISOString()
      };
      
      if (tipo === 'insumo') {
        novaFicha.rendimentoQtd = parseFloat(rendimentoQtd) || 1;
        novaFicha.rendimentoUnidade = rendimentoUnidade || 'un';
      }
      
      if (editingId) {
        // preserve original creation date
        const existingFicha = fichas.find(f => f.id === editingId);
        if (existingFicha && existingFicha.dataCriacao) {
          novaFicha.dataCriacao = existingFicha.dataCriacao;
        }
        await appDb.update("fichas_tecnicas", editingId, novaFicha);
      } else {
        await appDb.add("fichas_tecnicas", novaFicha);
      }
      
      // Auto-extract ingredients into materias_primas if they don't exist, and update if cost specified
      for (const ing of ingredientes) {
        if (ing.origem === 'insumo' || ing.isCadastrado) continue; // It's an existing Ficha reference
        const nameClean = ing.nome.trim();
        if (!nameClean) continue;
        
        const existing = materiasPrimas.find(m => m.nome.toLowerCase() === nameClean.toLowerCase());
        
        const unitMatch = ing.quantidade.match(/^([\d.,]+)\s*([a-zA-Z]+)$/);
        const defaultUnit = unitMatch ? unitMatch[2].toLowerCase() : 'un';
        
        const custoToSave = ing.custoCompra ? parseFloat(ing.custoCompra) : (existing?.custo || 0);
        const unidadeToSave = ing.unidadeCompra || existing?.unidade || defaultUnit;

        if (!existing && ing.origem !== 'materia_prima') {
           await appDb.add("materias_primas", {
              nome: nameClean,
              custo: custoToSave,
              unidade: unidadeToSave
           });
        } else if (existing) {
           if (ing.custoCompra && ing.unidadeCompra && (custoToSave !== existing.custo || unidadeToSave !== existing.unidade)) {
              await appDb.update("materias_primas", existing.id!, {
                 custo: custoToSave,
                 unidade: unidadeToSave
              });
           }
        }
      }

      setShowAddModal(false);
      resetForm();
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

  const handleSetFilterTipo = (novoTipo: "bebida" | "comida" | "insumo" | "materias_primas") => {
    setFilterTipo(novoTipo);
    setFilterCategoria("todas");
  };

  const handleUpdateMateriaPrima = async (id: string, custo: number, unidade: string) => {
    try {
      await appDb.update("materias_primas", id, { custo, unidade });
    } catch (e) {
      console.error("Erro ao atualizar matéria-prima:", e);
      alert("Erro ao atualizar matéria-prima.");
    }
  };

  const calcularCustoIngrediente = (ing: Ingrediente, visited = new Set<string>()): number => {
    const qtdMatch = ing.quantidade.match(/^([\d.,]+)\s*(.*)$/);
    if (!qtdMatch) return 0;

    const val = parseFloat(qtdMatch[1].replace(',', '.'));
    const unit = qtdMatch[2].toLowerCase().trim() || 'un';

    if (ing.origem === 'insumo' || ing.isCadastrado) {
      const subFicha = fichas.find(f => f.nome === ing.nome && f.tipo === 'insumo');
      if (subFicha) {
        const subCustoTotal = calcularCustoFicha(subFicha, visited);
        const rendQtd = subFicha.rendimentoQtd || 1;
        const rendUnit = (subFicha.rendimentoUnidade || 'un').toLowerCase();
        const subCustoUnitario = subCustoTotal / rendQtd;

        let multiplier = 1;
        if (rendUnit === 'kg' && (unit === 'g' || unit === 'gr')) multiplier = 0.001;
        else if (rendUnit === 'l' && unit === 'ml') multiplier = 0.001;
        else if (rendUnit === 'g' && unit === 'kg') multiplier = 1000;
        else if (rendUnit === 'ml' && unit === 'l') multiplier = 1000;

        return (val * multiplier) * subCustoUnitario;
      }
    } else {
      const mat = materiasPrimas.find(m => m.nome.toLowerCase() === ing.nome.trim().toLowerCase());
      if (mat && mat.custo > 0) {
        const baseUnit = (mat.unidade || 'un').toLowerCase();
        let multiplier = 1;
        if (baseUnit === 'kg' && (unit === 'g' || unit === 'gr')) multiplier = 0.001;
        else if (baseUnit === 'l' && unit === 'ml') multiplier = 0.001;
        else if (baseUnit === 'g' && unit === 'kg') multiplier = 1000;
        else if (baseUnit === 'ml' && unit === 'l') multiplier = 1000;

        return (val * multiplier) * mat.custo;
      }
    }
    return 0;
  };

  const calcularCustoFicha = (ficha: FichaTecnica, visited = new Set<string>()): number => {
    if (visited.has(ficha.id!)) return 0;
    visited.add(ficha.id!);

    let custoTotal = 0;
    if (!ficha.ingredientes) return 0;

    ficha.ingredientes.forEach(ing => {
      custoTotal += calcularCustoIngrediente(ing, visited);
    });

    return custoTotal;
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
            onClick={handleOpenAdd}
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
          <button
            onClick={() => handleSetFilterTipo("materias_primas")}
            className={`flex-1 min-w-[140px] py-4 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${
              filterTipo === "materias_primas" 
                ? "border-emerald-500 text-emerald-400 bg-emerald-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Package className="h-4 w-4" />
            Matérias-Primas
          </button>
        </div>

        {filterTipo !== 'materias_primas' && (
        <>
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
            <div className="flex flex-col gap-2">
              {filteredFichas.map(ficha => {
                const isSelected = selectedIds.includes(ficha.id!);
                const isExpanded = expandedId === ficha.id;
                
                // Calculate dynamic cost
                let custoExibicao = calcularCustoFicha(ficha);
                if (ficha.tipo === 'insumo' && ficha.rendimentoQtd) {
                  custoExibicao = custoExibicao / ficha.rendimentoQtd;
                }
                
                return (
                  <div 
                    key={ficha.id} 
                    className={`bg-slate-950 border rounded-xl overflow-hidden transition-all duration-200 ${
                      isSelected ? "border-emerald-500 ring-1 ring-emerald-500/50" : "border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div 
                      className="p-4 flex items-center justify-between cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : (ficha.id || null))}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSelect(ficha.id!);
                          }}
                          className={`flex items-center justify-center rounded-lg transition-colors p-1 hover:bg-slate-800 ${isSelected ? "text-emerald-500" : "text-slate-500"}`}
                        >
                          {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                        </button>
                        
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className={`flex items-center justify-center h-8 w-8 rounded-full ${
                              ficha.tipo === 'bebida' ? 'bg-indigo-500/20 text-indigo-400' :
                              ficha.tipo === 'comida' ? 'bg-orange-500/20 text-orange-400' :
                              'bg-pink-500/20 text-pink-400'
                            }`}>
                              {ficha.tipo === 'bebida' ? <Coffee className="h-4 w-4" /> : 
                               ficha.tipo === 'comida' ? <ChefHat className="h-4 w-4" /> : 
                               <FlaskConical className="h-4 w-4" />}
                            </span>
                            <div>
                              <h3 className="font-bold text-white text-base leading-tight">{ficha.nome}</h3>
                              <div className="flex gap-2 mt-0.5">
                                {ficha.categoria && (
                                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                                    {ficha.categoria}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 pl-12 sm:pl-0">
                            {custoExibicao > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs font-mono font-bold tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                R$ {custoExibicao.toFixed(2)}
                                {ficha.tipo === 'insumo' && ficha.rendimentoUnidade ? ` / ${ficha.rendimentoUnidade}` : ''}
                              </span>
                            )}
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(ficha);
                              }}
                              className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors hidden sm:block"
                              title="Editar Ficha"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(ficha.id!);
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors hidden sm:block"
                              title="Excluir Ficha"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            
                            <div className="text-slate-400">
                              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="p-5 bg-slate-900/30 border-t border-slate-800/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Ingredientes / Insumos ({ficha.ingredientes.length})</p>
                              {ficha.recipiente && (
                                <span className="text-[10px] text-slate-500 font-medium uppercase bg-slate-800 px-2 py-0.5 rounded">
                                  Recipiente: {ficha.recipiente}
                                </span>
                              )}
                            </div>
                            
                            <ul className="space-y-2">
                              {ficha.ingredientes.map((ing, idx) => {
                                const custoIngrediente = calcularCustoIngrediente(ing, new Set<string>());
                                return (
                                <li key={idx} className="flex justify-between items-center text-sm py-1 border-b border-slate-800/50 last:border-0">
                                  <span className="text-slate-300 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span>
                                    {ing.nome}
                                  </span>
                                  <div className="flex items-center gap-4">
                                    <span className="text-slate-400 font-mono font-medium">{ing.quantidade}</span>
                                    {custoIngrediente > 0 ? (
                                      <span className="text-emerald-400 font-mono text-xs w-20 text-right">R$ {custoIngrediente.toFixed(2)}</span>
                                    ) : (
                                      <span className="text-slate-600 font-mono text-xs w-20 text-right">-</span>
                                    )}
                                  </div>
                                </li>
                                );
                              })}
                            </ul>
                          </div>
                          
                          <div>
                            <p className="text-xs text-slate-400 font-medium mb-3 uppercase tracking-wider">Modo de Preparo</p>
                            <div className="bg-slate-900/50 rounded-lg p-4 text-sm text-slate-300 whitespace-pre-wrap border border-slate-800">
                              {ficha.modoPreparo}
                            </div>
                            
                            <div className="mt-4 pt-3 flex justify-between items-center text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                              <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> Criado por {ficha.createdBy || "Sistema"}</span>
                              <span>{ficha.dataCriacao ? new Date(ficha.dataCriacao).toLocaleDateString('pt-BR') : ficha.createdAt ? new Date(ficha.createdAt).toLocaleDateString('pt-BR') : "-"}</span>
                            </div>
                            
                            {/* Mobile action buttons */}
                            <div className="mt-4 flex justify-end gap-2 sm:hidden">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(ficha);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-white hover:bg-emerald-500/20 bg-emerald-500/10 rounded transition-colors"
                              >
                                <FileText className="h-3.5 w-3.5" /> Editar
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(ficha.id!);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-rose-400 hover:text-white hover:bg-rose-500/20 bg-rose-500/10 rounded transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Excluir
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </>
        )}

        {filterTipo === 'materias_primas' && (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                    <th className="p-3 font-medium">Nome do Insumo (Auto-extraído)</th>
                    <th className="p-3 font-medium">Custo Referência (R$)</th>
                    <th className="p-3 font-medium">Unidade de Medida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {materiasPrimas.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-12 text-center">
                        <Package className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-300">Nenhum insumo detectado</h3>
                        <p className="text-slate-500 mt-1">Crie fichas técnicas e adicione ingredientes para preencher esta lista automaticamente.</p>
                      </td>
                    </tr>
                  ) : materiasPrimas.map(mat => (
                    <tr key={mat.id} className="hover:bg-slate-800/20 transition-colors group">
                      <td className="p-3">
                        <span className="text-sm font-bold text-slate-200">{mat.nome}</span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 text-sm">R$</span>
                          <input 
                            type="number"
                            step="0.01"
                            defaultValue={mat.custo || 0}
                            onBlur={(e) => handleUpdateMateriaPrima(mat.id!, parseFloat(e.target.value) || 0, mat.unidade)}
                            className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
                          />
                        </div>
                      </td>
                      <td className="p-3">
                        <select
                          defaultValue={mat.unidade || "un"}
                          onChange={(e) => handleUpdateMateriaPrima(mat.id!, mat.custo, e.target.value)}
                          className="w-full max-w-[180px] bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
                        >
                          <option value="kg">Quilograma (Kg)</option>
                          <option value="g">Grama (g)</option>
                          <option value="l">Litro (L)</option>
                          <option value="ml">Mililitro (ml)</option>
                          <option value="un">Unidade (Un)</option>
                          <option value="cx">Caixa (Cx)</option>
                          <option value="garrafa">Garrafa</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white uppercase tracking-wider">{editingId ? "Editar Ficha Técnica" : "Nova Ficha Técnica"}</h2>
                <p className="text-sm text-slate-400 mt-1">{editingId ? "Atualizar detalhes da ficha existente." : "Cadastro de ficha de produção."}</p>
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
                    {showAddCategoria ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={novaCategoriaNome}
                          onChange={(e) => setNovaCategoriaNome(e.target.value)}
                          placeholder="Nome da categoria..."
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-sm"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddCategoria}
                          disabled={!novaCategoriaNome.trim()}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddCategoria(false);
                            setNovaCategoriaNome("");
                          }}
                          className="bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-400 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
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
                          onClick={() => setShowAddCategoria(true)}
                          className="bg-slate-800 border border-slate-700 hover:border-emerald-500 hover:text-emerald-400 text-slate-400 px-3 py-2 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
                        >
                          <Plus className="h-4 w-4" /> Nova Categoria
                        </button>
                      </div>
                    )}
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
                  
                  {tipo === 'insumo' && (
                    <div className="md:col-span-2 bg-slate-800/40 p-4 rounded-xl border border-emerald-500/20 my-2">
                      <h4 className="text-sm font-medium text-emerald-400 mb-3">Rendimento Final (Base para calcular o custo unitário)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">Quantidade Final</label>
                          <input
                            type="number"
                            step="0.01"
                            value={rendimentoQtd}
                            onChange={(e) => setRendimentoQtd(e.target.value)}
                            placeholder="Ex: 1.5"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">Unidade de Medida</label>
                          <select
                            value={rendimentoUnidade}
                            onChange={(e) => setRendimentoUnidade(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="l">Litro (L)</option>
                            <option value="kg">Quilograma (Kg)</option>
                            <option value="ml">Mililitro (ml)</option>
                            <option value="g">Grama (g)</option>
                            <option value="un">Unidade (Un)</option>
                            <option value="cx">Caixa (Cx)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-300">Ingredientes / Insumos</label>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={() => handleAddIngrediente('manual')}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded transition-colors"
                      >
                        <Plus className="h-3 w-3" /> Manual
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddIngrediente('materia_prima')}
                        className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded transition-colors"
                      >
                        <Package className="h-3 w-3" /> Puxar Matéria-Prima
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddIngrediente('insumo')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 bg-indigo-500/10 px-2 py-1 rounded transition-colors"
                      >
                        <FlaskConical className="h-3 w-3" /> Puxar Insumo
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {ingredientes.map((ing, idx) => (
                      <div key={idx} className="flex flex-col gap-2 p-3 bg-slate-900/50 border border-slate-800 rounded-lg">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1">
                            {ing.origem === 'insumo' || ing.isCadastrado ? (
                              <SearchableSelect
                                value={ing.nome}
                                onChange={(val) => handleIngredienteChange(idx, 'nome', val)}
                                placeholder="Selecione um insumo/preparo..."
                                color="indigo"
                                options={fichas.filter(f => f.tipo === 'insumo').map(f => ({ label: f.nome, value: f.nome }))}
                              />
                            ) : ing.origem === 'materia_prima' ? (
                              <SearchableSelect
                                value={ing.nome}
                                onChange={(val) => handleIngredienteChange(idx, 'nome', val)}
                                placeholder="Selecione uma matéria-prima..."
                                color="amber"
                                options={materiasPrimas.map(m => ({ label: m.nome, value: m.nome }))}
                              />
                            ) : (
                              <input
                                type="text"
                                required
                                placeholder="Nome do ingrediente (Ex: Açúcar)"
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
                              placeholder="Qtd Receita (Ex: 500g)"
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
                        
                        {(!ing.isCadastrado && ing.origem !== 'materia_prima') && ing.nome.trim() !== '' && (
                          <div className="flex gap-2 items-center pl-1 border-l-2 border-emerald-500/50 mt-1 ml-1">
                            <span className="text-xs text-slate-400 whitespace-nowrap">Preço: R$</span>
                            <input 
                              type="number" step="0.01" 
                              placeholder="0.00" 
                              value={ing.custoCompra || ''} 
                              onChange={(e) => handleIngredienteChange(idx, 'custoCompra', e.target.value)}
                              className="w-20 bg-slate-950 border border-slate-700 rounded text-xs px-2 py-1 text-white focus:border-emerald-500 focus:outline-none"
                            />
                            <span className="text-xs text-slate-400 whitespace-nowrap">por</span>
                            <select 
                              value={ing.unidadeCompra || ''} 
                              onChange={(e) => handleIngredienteChange(idx, 'unidadeCompra', e.target.value)}
                              className="w-24 bg-slate-950 border border-slate-700 rounded text-xs px-2 py-1 text-white focus:border-emerald-500 focus:outline-none"
                            >
                              <option value="">(Unidade)</option>
                              <option value="kg">Kg</option>
                              <option value="l">Litro (L)</option>
                              <option value="un">Unid.</option>
                              <option value="cx">Caixa</option>
                              <option value="g">Grama (g)</option>
                              <option value="ml">Mililitro</option>
                            </select>
                            <span className="text-[10px] text-slate-500 italic ml-2 hidden sm:inline-block">Isso atualizará o custo do item nas Matérias-Primas.</span>
                          </div>
                        )}
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
                  onClick={() => { setShowAddModal(false); resetForm(); }}
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
