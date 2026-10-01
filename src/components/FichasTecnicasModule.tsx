import React, { useState, useEffect, useRef, useMemo } from "react";
import { appDb } from "../firebase";
import { 
  Search, Plus, ChefHat, Trash2, FileText, Check, Coffee, CheckSquare, 
  Square, FlaskConical, User as UserIcon, Package, ChevronDown, ChevronUp, 
  Sparkles, RefreshCw, AlertCircle 
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface InsumoCatalogo {
  nome: string;
  um: string;
  custo: number;
}

export interface AutocompleteItem {
  id?: string;
  nome: string;
  origem: 'catalogo' | 'insumo' | 'materia_prima';
  um: string;
  custo: number;
  labelOrigem: string;
}

export interface Ingrediente {
  nome: string;
  quantidade: string;
  isCadastrado?: boolean;
  origem?: 'manual' | 'insumo' | 'materia_prima' | 'catalogo';
  custoCompra?: string;
  unidadeCompra?: string;
  custoCalculado?: number;
  custo?: number;
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

const API_URL = "https://script.google.com/macros/s/AKfycbzZjwaEDHoyuIuBZ3omHGDmPxD3HA82b8In6ocV3Yp0s-6lzqeXjTs5EDUJ4HQmhx6k/exec";

// Normalizes strings for tolerant comparison (handles accents, spaces, and casing)
export const normalizeText = (text: string) => {
  return (text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

// Finds an item in the Google Sheets catalog
export const findCatalogoItem = (nome: string, catalogo: InsumoCatalogo[]): InsumoCatalogo | undefined => {
  if (!nome || !catalogo || catalogo.length === 0) return undefined;
  const clean = nome.trim().toLowerCase();
  const exact = catalogo.find(c => c.nome.trim().toLowerCase() === clean);
  if (exact) return exact;
  const norm = normalizeText(nome);
  return catalogo.find(c => normalizeText(c.nome) === norm);
};

// Conversão inteligente de unidades culinárias e de bar
export const getUnitMultiplier = (recipeUnit: string, baseUnit: string, itemName: string = ""): number => {
  const ru = recipeUnit.toLowerCase().trim();
  const bu = baseUnit.toLowerCase().trim();

  // Se são iguais ou a receita não especificou unidade extra
  if (!ru || ru === bu) return 1;

  // Conversões de Massa (Peso)
  const isRecipeG = ['g', 'gr', 'grs', 'grama', 'gramas'].includes(ru);
  const isRecipeKg = ['kg', 'kgs', 'quilo', 'quilos', 'quilograma'].includes(ru);
  const isBaseG = ['g', 'gr', 'grs', 'grama', 'gramas'].includes(bu);
  const isBaseKg = ['kg', 'kgs', 'quilo', 'quilos', 'quilograma'].includes(bu);

  if (isBaseKg && isRecipeG) return 0.001; // ex: 500g de um insumo precificado por KG
  if (isBaseG && isRecipeKg) return 1000;

  // Conversões de Volume (Líquidos)
  const isRecipeMl = ['ml', 'mls', 'mililitro', 'mililitros'].includes(ru);
  const isRecipeL = ['l', 'lt', 'lts', 'litro', 'litros'].includes(ru);
  const isBaseMl = ['ml', 'mls', 'mililitro', 'mililitros'].includes(bu);
  const isBaseL = ['l', 'lt', 'lts', 'litro', 'litros'].includes(bu);

  if (isBaseL && isRecipeMl) return 0.001; // ex: 50ml de um insumo precificado por Litro
  if (isBaseMl && isRecipeL) return 1000;

  // Doses e medidas padrão de coquetelaria (dose padrão = 50ml)
  if (isBaseL && ru === 'dose') return 0.050;
  if (isBaseMl && ru === 'dose') return 50;

  // Colheres (sopa ~ 15ml/g, chá ~ 5ml/g)
  if ((isBaseKg || isBaseL) && ['cs', 'colher', 'colheres'].includes(ru)) return 0.015;
  if ((isBaseG || isBaseMl) && ['cs', 'colher', 'colheres'].includes(ru)) return 15;

  // Unidade/Garrafa para drinks medidos em ml
  const isBaseUnitOrBottle = ['un', 'unid', 'unidade', 'garrafa', 'gf', 'gfa'].includes(bu);
  if (isBaseUnitOrBottle) {
    const nameUpper = itemName.toUpperCase();
    let bottleMl = 0;
    const mlMatch = nameUpper.match(/(\d+)\s*ML/);
    const lMatch = nameUpper.match(/(\d+(?:[.,]\d+)?)\s*L(?:T)?(?:\b|\s)/);

    if (mlMatch) {
      bottleMl = parseFloat(mlMatch[1]);
    } else if (lMatch) {
      bottleMl = parseFloat(lMatch[1].replace(',', '.')) * 1000;
    } else if (
      nameUpper.includes("GIN") || nameUpper.includes("VODKA") || 
      nameUpper.includes("WHISKY") || nameUpper.includes("WHISKEY") || 
      nameUpper.includes("RUM") || nameUpper.includes("TEQUILA") || 
      nameUpper.includes("LICOR") || nameUpper.includes("APEROL") || 
      nameUpper.includes("CAMPARI") || nameUpper.includes("CACHAÇA") ||
      nameUpper.includes("CACHACA")
    ) {
      // Garrafa padrão de destilados no Brasil = 750ml
      bottleMl = 750;
    }

    if (bottleMl > 0) {
      if (isRecipeMl) return 1 / bottleMl;
      if (isRecipeL) return 1000 / bottleMl;
      if (ru === 'dose') return 50 / bottleMl;
    }
  }

  return 1;
};

// Autocomplete / Combobox unificado para seleção de Insumos (Planilha + Pasta de Insumos + Matérias-Primas)
const InsumoCombobox = ({
  value,
  onChangeName,
  onSelectSuggestion,
  sugestoes,
  placeholder = "Buscar na pasta/catálogo ou digitar..."
}: {
  value: string;
  onChangeName: (val: string) => void;
  onSelectSuggestion: (item: AutocompleteItem) => void;
  sugestoes: AutocompleteItem[];
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!value || value.trim() === "") return sugestoes.slice(0, 40);
    const q = normalizeText(value);
    return sugestoes.filter(item => normalizeText(item.nome).includes(q)).slice(0, 40);
  }, [value, sugestoes]);

  const matched = sugestoes.find(s => normalizeText(s.nome) === normalizeText(value));

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="relative">
        <input
          type="text"
          required
          value={value}
          onChange={(e) => {
            onChangeName(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm pr-8 transition-colors"
        />
        {matched ? (
          <span 
            className={`absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center justify-center h-5 w-5 rounded-full ${
              matched.origem === 'catalogo' 
                ? 'bg-emerald-500/20 text-emerald-400' 
                : matched.origem === 'insumo' 
                ? 'bg-indigo-500/20 text-indigo-400' 
                : 'bg-amber-500/20 text-amber-400'
            }`}
            title={`Item vinculado (${matched.labelOrigem}): R$ ${matched.custo.toFixed(2)} / ${matched.um}`}
          >
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown 
            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 cursor-pointer pointer-events-none" 
          />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto">
          {sugestoes.length > 0 && (
            <div className="p-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 bg-slate-900/90 flex justify-between items-center sticky top-0 backdrop-blur-sm z-10">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Sparkles className="h-3 w-3" /> Insumos Disponíveis ({sugestoes.length})
              </span>
              <span className="text-[10px] text-slate-400 lowercase">clique para auto-preencher</span>
            </div>
          )}
          {filtered.length > 0 ? (
            filtered.map((item, idx) => (
              <div
                key={idx}
                className="px-3 py-2.5 text-sm cursor-pointer hover:bg-slate-700/80 flex items-center justify-between border-b border-slate-700/30 last:border-0 transition-colors"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelectSuggestion(item);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-200">{item.nome}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                    item.origem === 'catalogo' 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                      : item.origem === 'insumo' 
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {item.labelOrigem}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0 ml-2">
                  R$ {Number(item.custo).toFixed(2)} / {item.um}
                </span>
              </div>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-slate-400 text-center">
              <span>Nenhum item correspondente encontrado.</span>
              <p className="text-xs text-slate-500 mt-1">Você pode prosseguir com o nome digitado como ingrediente avulso.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Select estilizado para sub-fichas
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
  filteredOptions.sort((a, b) => a.label.localeCompare(b.label));

  const selectedOption = options.find(o => o.value === value);
  const borderRingClass = color === 'amber' 
    ? 'ring-1 ring-amber-500 border-amber-500' 
    : color === 'emerald' 
    ? 'ring-1 ring-emerald-500 border-emerald-500' 
    : 'ring-1 ring-indigo-500 border-indigo-500';

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
             placeholder="Buscar insumo..."
           />
         ) : (
           <span className={selectedOption ? "text-white" : "text-slate-400"}>
             {selectedOption ? selectedOption.label : placeholder}
           </span>
         )}
         <ChevronDown className="h-4 w-4 text-slate-400 ml-2 shrink-0" />
       </div>

       {isOpen && (
         <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto">
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
  const [catalogoInsumos, setCatalogoInsumos] = useState<InsumoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCatalogo, setLoadingCatalogo] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTipo, setFilterTipo] = useState<"bebida" | "comida" | "insumo" | "materias_primas">("bebida");
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [tipo, setTipo] = useState<"bebida" | "comida" | "insumo">("bebida");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [showAddCategoria, setShowAddCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [recipiente, setRecipiente] = useState("");
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([
    { nome: "", quantidade: "", isCadastrado: false, origem: 'catalogo', custoCompra: "", unidadeCompra: "" }
  ]);
  const [modoPreparo, setModoPreparo] = useState("");
  const [categoriasLista, setCategoriasLista] = useState<CategoriaFicha[]>([]);
  
  // Cost tracking for "insumo"
  const [rendimentoQtd, setRendimentoQtd] = useState<string>("1");
  const [rendimentoUnidade, setRendimentoUnidade] = useState<string>("l");

  // 1. INGESTÃO: Fetch catalogoInsumos com tratamento tolerante de erro do Google Apps Script
  const fetchCatalogo = async () => {
    try {
      setLoadingCatalogo(true);
      setApiError(null);
      const response = await fetch(API_URL);
      const text = await response.text();

      // Detecta se o Google Apps Script retornou página de erro HTML
      if (text.includes("ReferenceError") || text.includes("<!DOCTYPE html>")) {
        const errorMatch = text.match(/ReferenceError:[^<]+/);
        const msg = errorMatch ? errorMatch[0].replace(/&quot;/g, '"') : "Erro de execução na linha 148 do script Google Apps Script";
        console.warn("Aviso na API Google Apps Script:", msg);
        setApiError(msg);
        return;
      }

      const json = JSON.parse(text);
      if (json.sucesso && Array.isArray(json.catalogoInsumos)) {
        setCatalogoInsumos(json.catalogoInsumos);
      }
    } catch (error: any) {
      console.warn("Aviso ao conectar à API Google Apps Script:", error);
      setApiError(error.message || "Não foi possível carregar o catálogo da planilha");
    } finally {
      setLoadingCatalogo(false);
    }
  };

  useEffect(() => {
    fetchCatalogo();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setTipo("bebida");
    setNome("");
    setCategoria("");
    setRecipiente("");
    setIngredientes([
      { nome: "", quantidade: "", isCadastrado: false, origem: 'catalogo', custoCompra: "", unidadeCompra: "" }
    ]);
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
    setIngredientes(ficha.ingredientes.map(i => {
      const catMatch = findCatalogoItem(i.nome, catalogoInsumos);
      return {
        ...i,
        origem: i.origem || (i.isCadastrado ? 'insumo' : 'catalogo'),
        unidadeCompra: i.unidadeCompra || catMatch?.um || '',
        custoCompra: i.custoCompra || (catMatch ? catMatch.custo.toString() : '')
      };
    }));
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

  // 4. RETROCOMPATIBILIDADE E CÁLCULO DINÂMICO
  const calcularCustoIngredienteInfo = (
    ing: Ingrediente, 
    visited = new Set<string>()
  ): { custo: number; isDynamic: boolean; unitCost?: number; unit?: string; origemNome?: string } => {
    const qtdMatch = ing.quantidade.match(/^([\d.,]+)\s*(.*)$/);
    if (!qtdMatch) {
      if (typeof ing.custoCalculado === 'number' && ing.custoCalculado > 0) {
        return { custo: ing.custoCalculado, isDynamic: false };
      }
      return { custo: 0, isDynamic: false };
    }

    const val = parseFloat(qtdMatch[1].replace(',', '.'));
    const unit = qtdMatch[2].toLowerCase().trim();

    // 1. Sub-receita produzida (Insumo / Preparo na pasta)
    const subFicha = fichas.find(f => normalizeText(f.nome) === normalizeText(ing.nome) && f.tipo === 'insumo');
    if (subFicha) {
      const subCustoTotal = calcularCustoFicha(subFicha, visited);
      const rendQtd = subFicha.rendimentoQtd || 1;
      const rendUnit = (subFicha.rendimentoUnidade || 'un').toLowerCase();
      const subCustoUnitario = subCustoTotal / rendQtd;
      const multiplier = getUnitMultiplier(unit || rendUnit, rendUnit, ing.nome);

      return {
        custo: (val * multiplier) * subCustoUnitario,
        isDynamic: false,
        unitCost: subCustoUnitario,
        unit: rendUnit,
        origemNome: 'Insumo / Pasta'
      };
    }

    // 2. PRECIFICAÇÃO DINÂMICA (Google Sheets API)
    const catMatch = findCatalogoItem(ing.nome, catalogoInsumos);
    if (catMatch && typeof catMatch.custo === 'number' && catMatch.custo > 0) {
      const baseUnit = (catMatch.um || 'un').toLowerCase().trim();
      const multiplier = getUnitMultiplier(unit || baseUnit, baseUnit, ing.nome);
      const custoFinal = val * multiplier * catMatch.custo;
      return {
        custo: custoFinal,
        isDynamic: true,
        unitCost: catMatch.custo,
        unit: catMatch.um,
        origemNome: 'Planilha Softcom/API'
      };
    }

    // 3. RETROCOMPATIBILIDADE: INGREDIENTE LEGADO (SEM MATCH NA PLANILHA)
    // 3a. Busca na coleção de matérias-primas
    const mat = materiasPrimas.find(m => normalizeText(m.nome) === normalizeText(ing.nome));
    if (mat && mat.custo > 0) {
      const baseUnit = (mat.unidade || 'un').toLowerCase();
      const multiplier = getUnitMultiplier(unit || baseUnit, baseUnit, ing.nome);
      return {
        custo: val * multiplier * mat.custo,
        isDynamic: false,
        unitCost: mat.custo,
        unit: mat.unidade,
        origemNome: 'Matéria-Prima Cadastrada'
      };
    }

    // 3b. Custo unitário salvo no próprio ingrediente
    if (ing.custoCompra && parseFloat(ing.custoCompra) > 0) {
      const baseCost = parseFloat(ing.custoCompra);
      const baseUnit = (ing.unidadeCompra || 'un').toLowerCase();
      const multiplier = getUnitMultiplier(unit || baseUnit, baseUnit, ing.nome);
      return {
        custo: val * multiplier * baseCost,
        isDynamic: false,
        unitCost: baseCost,
        unit: ing.unidadeCompra || 'un',
        origemNome: 'Custo Manual'
      };
    }

    // 3c. Snapshot estático salvo anteriormente no Firebase
    if (typeof ing.custoCalculado === 'number' && ing.custoCalculado > 0) {
      return {
        custo: ing.custoCalculado,
        isDynamic: false,
        origemNome: 'Snapshot Firebase'
      };
    }

    // 3d. Custo legado direto
    if (typeof (ing as any).custo === 'number' && (ing as any).custo > 0) {
      return {
        custo: (ing as any).custo,
        isDynamic: false,
        origemNome: 'Custo Legado'
      };
    }

    return { custo: 0, isDynamic: false };
  };

  const calcularCustoIngrediente = (ing: Ingrediente, visited = new Set<string>()): number => {
    return calcularCustoIngredienteInfo(ing, visited).custo;
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

  // SUGESTÕES UNIFICADAS: Agrupa Planilha + Insumos da Pasta + Matérias-Primas
  const todasSugestoes = useMemo<AutocompleteItem[]>(() => {
    const lista: AutocompleteItem[] = [];
    const nomesAdicionados = new Set<string>();

    // 1. Insumos / Preparos cadastrados na pasta (fichas tipo 'insumo')
    fichas.filter(f => f.tipo === 'insumo').forEach(subFicha => {
      const norm = normalizeText(subFicha.nome);
      const subCustoTotal = calcularCustoFicha(subFicha);
      const rendQtd = subFicha.rendimentoQtd || 1;
      const subCustoUnitario = subCustoTotal / rendQtd;
      lista.push({
        id: subFicha.id,
        nome: subFicha.nome,
        origem: 'insumo',
        um: subFicha.rendimentoUnidade || 'un',
        custo: subCustoUnitario,
        labelOrigem: 'Insumo / Pasta'
      });
      nomesAdicionados.add(norm);
    });

    // 2. Catálogo Google Sheets API
    catalogoInsumos.forEach(item => {
      const norm = normalizeText(item.nome);
      if (!nomesAdicionados.has(norm)) {
        lista.push({
          nome: item.nome,
          origem: 'catalogo',
          um: item.um || 'UN',
          custo: item.custo || 0,
          labelOrigem: 'Planilha'
        });
        nomesAdicionados.add(norm);
      }
    });

    // 3. Matérias-Primas cadastradas
    materiasPrimas.forEach(mat => {
      const norm = normalizeText(mat.nome);
      if (!nomesAdicionados.has(norm)) {
        lista.push({
          id: mat.id,
          nome: mat.nome,
          origem: 'materia_prima',
          um: mat.unidade || 'un',
          custo: mat.custo || 0,
          labelOrigem: 'Matéria-Prima'
        });
        nomesAdicionados.add(norm);
      }
    });

    return lista;
  }, [catalogoInsumos, fichas, materiasPrimas]);

  // 2. UI DE SELEÇÃO: Adicionar novo ingrediente com sugestões
  const handleAddIngrediente = (origem: 'catalogo' | 'insumo' | 'manual' = 'catalogo') => {
    setIngredientes([
      ...ingredientes, 
      { 
        nome: "", 
        quantidade: "", 
        isCadastrado: origem === 'insumo', 
        origem,
        custoCompra: "",
        unidadeCompra: ""
      }
    ]);
  };

  // 3. AUTO-PREENCHIMENTO: Preenche unidade e custo automaticamente ao selecionar sugestão
  const handleSelectSuggestion = (index: number, item: AutocompleteItem) => {
    const newIngredientes = [...ingredientes];
    newIngredientes[index] = {
      ...newIngredientes[index],
      nome: item.nome,
      unidadeCompra: item.um || 'UN',
      custoCompra: item.custo > 0 ? item.custo.toFixed(2) : '0',
      origem: item.origem,
      isCadastrado: item.origem === 'insumo'
    };
    setIngredientes(newIngredientes);
  };

  const handleIngredienteChange = (index: number, field: keyof Ingrediente, value: string) => {
    const newIngredientes = [...ingredientes];
    newIngredientes[index][field] = value;
    
    // Se o usuário digitou um nome que casa com alguma sugestão, auto-preenche
    if (field === 'nome') {
      const match = todasSugestoes.find(s => normalizeText(s.nome) === normalizeText(value));
      if (match) {
        if (!newIngredientes[index].unidadeCompra) newIngredientes[index].unidadeCompra = match.um;
        if (!newIngredientes[index].custoCompra && match.custo > 0) newIngredientes[index].custoCompra = match.custo.toFixed(2);
        newIngredientes[index].origem = match.origem;
      }
    }
    
    setIngredientes(newIngredientes);
  };

  const handleRemoveIngrediente = (index: number) => {
    if (ingredientes.length === 1) return;
    const newIngredientes = [...ingredientes];
    newIngredientes.splice(index, 1);
    setIngredientes(newIngredientes);
  };

  // 5. SALVAMENTO: Salva array completo com snapshot do custoCalculado no Firebase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || ingredientes.some(i => !i.nome.trim() || !i.quantidade.trim()) || !modoPreparo.trim()) {
      alert("Preencha todos os campos da ficha (ingredientes e modo de preparo).");
      return;
    }

    try {
      const ingredientesParaSalvar = ingredientes.map(ing => {
        const custoCalculado = calcularCustoIngrediente(ing);
        return {
          nome: ing.nome.trim(),
          quantidade: ing.quantidade.trim(),
          isCadastrado: ing.isCadastrado || ing.origem === 'insumo',
          origem: ing.origem || 'catalogo',
          custoCompra: ing.custoCompra || '',
          unidadeCompra: ing.unidadeCompra || '',
          custoCalculado: Number(custoCalculado.toFixed(2))
        };
      });

      const novaFicha: any = {
        tipo,
        nome: nome.trim(),
        categoria,
        recipiente,
        ingredientes: ingredientesParaSalvar,
        modoPreparo,
        dataCriacao: new Date().toISOString()
      };
      
      if (tipo === 'insumo') {
        novaFicha.rendimentoQtd = parseFloat(rendimentoQtd) || 1;
        novaFicha.rendimentoUnidade = rendimentoUnidade || 'un';
      }
      
      if (editingId) {
        const existingFicha = fichas.find(f => f.id === editingId);
        if (existingFicha && existingFicha.dataCriacao) {
          novaFicha.dataCriacao = existingFicha.dataCriacao;
        }
        await appDb.update("fichas_tecnicas", editingId, novaFicha);
      } else {
        await appDb.add("fichas_tecnicas", novaFicha);
      }
      
      // Mantém a retrocompatibilidade também com a aba Matérias-Primas
      for (const ing of ingredientes) {
        if (ing.origem === 'insumo' || ing.isCadastrado) continue;
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
      doc.text(`Data de Criação: ${ficha.dataCriacao ? new Date(ficha.dataCriacao).toLocaleDateString('pt-BR') : '-'}`, 14, yPos);
      
      yPos += 14;
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text("Ingredientes", 14, yPos);

      const tableData = ficha.ingredientes.map(i => {
        const c = calcularCustoIngrediente(i);
        return [i.nome, i.quantidade, c > 0 ? `R$ ${c.toFixed(2)}` : '-'];
      });
      
      autoTable(doc, {
        head: [['Ingrediente / Insumo', 'Quantidade', 'Custo Estimado']],
        body: tableData,
        startY: yPos + 5,
        theme: 'grid',
        headStyles: { fillColor: [40, 40, 40] }
      });

      const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 65;

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

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <ChefHat className="h-8 w-8 text-emerald-500" />
            Fichas Técnicas
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Gerador de fichas de produção e precificação inteligente de insumos.
          </p>
          
          {/* Status da Ingestão da Planilha */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {loadingCatalogo ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                <RefreshCw className="h-3 w-3 animate-spin" /> Conectando ao catálogo da planilha...
              </span>
            ) : catalogoInsumos.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium">
                <Sparkles className="h-3 w-3" /> Preços dinâmicos sincronizados ({catalogoInsumos.length} insumos da planilha)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/80 border border-slate-700 px-2.5 py-0.5 rounded-full">
                {todasSugestoes.length} insumos disponíveis na sua pasta
              </span>
            )}
            <button
              onClick={fetchCatalogo}
              className="text-xs text-slate-400 hover:text-slate-200 underline flex items-center gap-1"
              title="Recarregar catálogo da planilha"
            >
              <RefreshCw className="h-3 w-3" /> Atualizar
            </button>
          </div>
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
            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
          >
            <Plus className="h-4 w-4" />
            Nova Ficha
          </button>
        </div>
      </div>

      {/* AVISO DO GOOGLE APPS SCRIPT (CASO O SCRIPT DA PLANILHA ESTEJA COM ERRO) */}
      {apiError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-300 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-amber-200 text-sm">
              Aviso na API do Google Sheets (Apps Script)
            </p>
            <p className="text-slate-300 font-mono text-[11px] bg-slate-950/70 p-2 rounded border border-amber-500/20">
              {apiError}
            </p>
            <p className="text-slate-400 text-xs">
              O script da sua planilha no Google retornou um erro interno (linha 148 do arquivo Código.gs). O sistema continuará puxando e calculando normalmente todos os insumos já criados na sua pasta de insumos e matérias-primas cadastradas.
            </p>
          </div>
        </div>
      )}

      {/* ABAS & LISTA */}
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
                <p className="text-slate-500 mt-1">Crie sua primeira ficha técnica com precificação integrada.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filteredFichas.map(ficha => {
                  const isSelected = selectedIds.includes(ficha.id!);
                  const isExpanded = expandedId === ficha.id;
                  
                  // Cálculo do custo total da ficha
                  let custoExibicao = calcularCustoFicha(ficha);
                  if (ficha.tipo === 'insumo' && ficha.rendimentoQtd) {
                    custoExibicao = custoExibicao / ficha.rendimentoQtd;
                  }

                  const hasDynamic = ficha.ingredientes.some(i => calcularCustoIngredienteInfo(i).isDynamic);
                  
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
                                <span 
                                  className="inline-flex items-center gap-1.5 text-xs font-mono font-bold tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                  title={hasDynamic ? "Custo calculado com dados em tempo real da planilha" : "Custo calculado com base nos insumos"}
                                >
                                  {hasDynamic && <Sparkles className="h-3 w-3 text-emerald-400" />}
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
                      
                      {/* CARD EXPANDIDO: DETALHES DE INGREDIENTES */}
                      {isExpanded && (
                        <div className="p-5 bg-slate-900/30 border-t border-slate-800/50">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                                  Ingredientes / Insumos ({ficha.ingredientes.length})
                                </p>
                                {ficha.recipiente && (
                                  <span className="text-[10px] text-slate-500 font-medium uppercase bg-slate-800 px-2 py-0.5 rounded">
                                    Recipiente: {ficha.recipiente}
                                  </span>
                                )}
                              </div>
                              
                              <ul className="space-y-2">
                                {ficha.ingredientes.map((ing, idx) => {
                                  const custoInfo = calcularCustoIngredienteInfo(ing, new Set<string>());
                                  return (
                                    <li key={idx} className="flex justify-between items-center text-sm py-1.5 border-b border-slate-800/50 last:border-0">
                                      <span className="text-slate-300 flex items-center gap-2 flex-wrap">
                                        <span className={`w-1.5 h-1.5 rounded-full ${
                                          custoInfo.isDynamic ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-slate-500"
                                        }`}></span>
                                        <span className="font-medium">{ing.nome}</span>
                                        {custoInfo.isDynamic ? (
                                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-medium inline-flex items-center gap-1">
                                            <Sparkles className="h-2.5 w-2.5" /> Planilha
                                          </span>
                                        ) : custoInfo.origemNome && (
                                          <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.2 rounded font-medium">
                                            {custoInfo.origemNome}
                                          </span>
                                        )}
                                      </span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-slate-400 font-mono font-medium">{ing.quantidade}</span>
                                        {custoInfo.custo > 0 ? (
                                          <div className="text-right">
                                            <span className="text-emerald-400 font-mono text-xs block font-bold">
                                              R$ {custoInfo.custo.toFixed(2)}
                                            </span>
                                            {custoInfo.unitCost && (
                                              <span className="text-[10px] text-slate-500 block font-mono">
                                                (R$ {custoInfo.unitCost.toFixed(2)}/{custoInfo.unit})
                                              </span>
                                            )}
                                          </div>
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

        {/* ABA MATÉRIAS-PRIMAS */}
        {filterTipo === 'materias_primas' && (
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                    <th className="p-3 font-medium">Nome do Insumo</th>
                    <th className="p-3 font-medium">Preço Atualizado Planilha</th>
                    <th className="p-3 font-medium">Custo Referência Manual (R$)</th>
                    <th className="p-3 font-medium">Unidade de Medida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {materiasPrimas.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-12 text-center">
                        <Package className="h-12 w-12 text-slate-700 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-300">Nenhum insumo detectado</h3>
                        <p className="text-slate-500 mt-1">Crie fichas técnicas e adicione ingredientes para preencher esta lista automaticamente.</p>
                      </td>
                    </tr>
                  ) : materiasPrimas.map(mat => {
                    const matchPlanilha = findCatalogoItem(mat.nome, catalogoInsumos);
                    return (
                      <tr key={mat.id} className="hover:bg-slate-800/20 transition-colors group">
                        <td className="p-3">
                          <span className="text-sm font-bold text-slate-200">{mat.nome}</span>
                        </td>
                        <td className="p-3">
                          {matchPlanilha ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                              <Sparkles className="h-3 w-3" /> R$ {matchPlanilha.custo.toFixed(2)} / {matchPlanilha.um}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">Sem match na planilha</span>
                          )}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 rounded-t-2xl shrink-0">
              <div>
                <h2 className="text-xl font-bold text-white uppercase tracking-wider">
                  {editingId ? "Editar Ficha Técnica" : "Nova Ficha Técnica"}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  {editingId ? "Atualizar detalhes da ficha e seus insumos." : "Cadastro de receita com precificação dinâmica da planilha e pasta."}
                </p>
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

                {/* SEÇÃO DE INGREDIENTES COM AUTOCOMPLETE UNIFICADO */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <label className="text-sm font-medium text-slate-300">Ingredientes / Insumos</label>
                      <p className="text-xs text-slate-400">
                        Busque no catálogo ou na pasta de insumos para auto-preencher unidade e custo unitário.
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={() => handleAddIngrediente('catalogo')}
                        className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 rounded transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" /> Adicionar Ingrediente
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddIngrediente('insumo')}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1.5 rounded transition-colors"
                      >
                        <FlaskConical className="h-3.5 w-3.5" /> Puxar Insumo da Pasta
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {ingredientes.map((ing, idx) => {
                      const custoInfo = calcularCustoIngredienteInfo(ing);
                      const isSubFichaExplicit = ing.origem === 'insumo' && ing.isCadastrado;

                      return (
                        <div key={idx} className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2 hover:border-slate-700 transition-colors">
                          <div className="flex gap-2 items-start">
                            <div className="flex-1">
                              <label className="text-[11px] font-medium text-slate-400 mb-1 block">
                                Nome do Ingrediente (Busca na Pasta e Planilha)
                              </label>
                              {isSubFichaExplicit ? (
                                <SearchableSelect
                                  value={ing.nome}
                                  onChange={(val) => handleIngredienteChange(idx, 'nome', val)}
                                  placeholder="Selecione um insumo da pasta..."
                                  color="indigo"
                                  options={fichas.filter(f => f.tipo === 'insumo').map(f => ({ label: f.nome, value: f.nome }))}
                                />
                              ) : (
                                <InsumoCombobox
                                  value={ing.nome}
                                  onChangeName={(val) => handleIngredienteChange(idx, 'nome', val)}
                                  onSelectSuggestion={(item) => handleSelectSuggestion(idx, item)}
                                  sugestoes={todasSugestoes}
                                  placeholder="Digite cenoura, açúcar, tanqueray..."
                                />
                              )}
                            </div>

                            <div className="w-1/3 min-w-[120px]">
                              <label className="text-[11px] font-medium text-slate-400 mb-1 block">Qtd Utilizada</label>
                              <input
                                type="text"
                                required
                                placeholder="Ex: 50ml, 200g, 2"
                                value={ing.quantidade}
                                onChange={(e) => handleIngredienteChange(idx, 'quantidade', e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm"
                              />
                            </div>

                            <div className="pt-6">
                              <button
                                type="button"
                                onClick={() => handleRemoveIngrediente(idx)}
                                disabled={ingredientes.length === 1}
                                className="p-2 text-slate-500 hover:text-rose-400 bg-slate-800 rounded-lg border border-slate-700 disabled:opacity-50 transition-colors"
                                title="Remover Ingrediente"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* BARRA DE AUTO-PREENCHIMENTO (Unidade, Custo Unitário e Subtotal) */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400">Unidade:</span>
                                <input
                                  type="text"
                                  placeholder="UN, KG, L..."
                                  value={ing.unidadeCompra || ''}
                                  onChange={(e) => handleIngredienteChange(idx, 'unidadeCompra', e.target.value)}
                                  className="w-16 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-center uppercase focus:border-emerald-500 focus:outline-none"
                                />
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400">Custo Unitário: R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={ing.custoCompra || ''}
                                  onChange={(e) => handleIngredienteChange(idx, 'custoCompra', e.target.value)}
                                  className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono focus:border-emerald-500 focus:outline-none"
                                />
                              </div>

                              {custoInfo.isDynamic ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                                  <Sparkles className="h-3 w-3" /> Preço Planilha
                                </span>
                              ) : custoInfo.origemNome && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-medium">
                                  {custoInfo.origemNome}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 font-mono text-xs">
                              <span className="text-slate-400">Subtotal:</span>
                              <span className={`font-bold ${custoInfo.custo > 0 ? "text-emerald-400" : "text-slate-500"}`}>
                                R$ {custoInfo.custo.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
