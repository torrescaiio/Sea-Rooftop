import React, { useState, useEffect, useRef, useMemo } from "react";
import { appDb } from "../firebase";
import { 
  Search, Plus, ChefHat, Trash2, FileText, Check, Coffee, CheckSquare, 
  Square, FlaskConical, User as UserIcon, Package, ChevronDown, ChevronUp, 
  Sparkles, RefreshCw, AlertCircle, TrendingUp, DollarSign, AlertTriangle, X, ShoppingCart,
  ArrowLeftRight, RotateCcw, Scale, Pencil
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface InsumoCatalogo {
  nome: string;
  um: string;
  custo: number;
  fornecedor?: string;
  detalhe?: string;
  origemPlanilha?: 'catalogo' | 'compras';
}

export interface AutocompleteItem {
  id?: string;
  nome: string;
  origem: 'catalogo' | 'compras' | 'insumo' | 'materia_prima' | 'manual';
  um: string;
  custo: number;
  labelOrigem: string;
  fornecedor?: string;
}

export interface Ingrediente {
  nome: string;
  quantidade: string;
  isCadastrado?: boolean;
  origem?: 'manual' | 'insumo' | 'materia_prima' | 'catalogo' | 'compras';
  custoCompra?: string;
  unidadeCompra?: string;
  custoCalculado?: number;
  custo?: number;
  // Campos de Desmembramento / Conversão de Embalagem (Fardo/Caixa para KG, L, etc.)
  fatorConversao?: number;
  unidadeOriginalCompra?: string;
  custoOriginalCompra?: number;
  isConvertido?: boolean;
  // true somente quando o usuário DIGITOU o custo/unidade de propósito.
  // Sem essa marca, o custo é sempre recalculado ao vivo a partir da fonte (sub-receita, matéria-prima ou planilha).
  custoManual?: boolean;
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
  precoVenda?: number; // Preço de venda no cardápio
  ingredientes: Ingrediente[];
  modoPreparo: string;
  dataCriacao?: string;
  createdAt?: string;
  createdBy?: string;
  rendimentoQtd?: number;
  rendimentoUnidade?: string;
}

export interface ResumoFinanceiro {
  custoTotal: number;
  precoVenda: number;
  lucroBruto: number;
  cmvPercentual: number | null;
  statusMargem: 'excelente' | 'atencao' | 'perigo' | 'invalido';
  mensagemMargem: string;
}

// Tratamento de erros, matemática e regras de negócio de Margem / CMV
export const calcularResumoFinanceiro = (
  custoTotal: number, 
  precoVendaRaw: number | string | undefined
): ResumoFinanceiro => {
  const precoVenda = typeof precoVendaRaw === 'string'
    ? parseFloat(precoVendaRaw.replace(',', '.')) || 0
    : precoVendaRaw || 0;

  const lucroBruto = precoVenda - custoTotal;

  // Se o preço de venda não foi informado ou é zero
  if (!precoVenda || precoVenda <= 0) {
    return {
      custoTotal,
      precoVenda: 0,
      lucroBruto: 0,
      cmvPercentual: null,
      statusMargem: 'invalido',
      mensagemMargem: 'Defina o preço de venda'
    };
  }

  // Se o preço de venda é menor que o custo (prejuízo direto)
  if (precoVenda < custoTotal) {
    const cmv = (custoTotal / precoVenda) * 100;
    return {
      custoTotal,
      precoVenda,
      lucroBruto,
      cmvPercentual: cmv,
      statusMargem: 'perigo',
      mensagemMargem: 'Perigo: Prejuízo (Venda < Custo)'
    };
  }

  const cmv = (custoTotal / precoVenda) * 100;

  // Regras de negócio de CMV:
  // - CMV até 28%: Verde (Margem Excelente)
  // - CMV entre 28.01% e 34%: Amarelo (Atenção - Margem Apertada)
  // - CMV acima de 34%: Vermelho (Perigo - Prejuízo/Margem Ruim)
  if (cmv <= 28) {
    return {
      custoTotal,
      precoVenda,
      lucroBruto,
      cmvPercentual: cmv,
      statusMargem: 'excelente',
      mensagemMargem: 'Margem Excelente (CMV ≤ 28%)'
    };
  } else if (cmv <= 34) {
    return {
      custoTotal,
      precoVenda,
      lucroBruto,
      cmvPercentual: cmv,
      statusMargem: 'atencao',
      mensagemMargem: 'Atenção - Margem Apertada (28% a 34%)'
    };
  } else {
    return {
      custoTotal,
      precoVenda,
      lucroBruto,
      cmvPercentual: cmv,
      statusMargem: 'perigo',
      mensagemMargem: 'Perigo - Margem Ruim (CMV > 34%)'
    };
  }
};

// Endpoints das Planilhas do Google Sheets (Vendas/Catálogo e Compras/Notas Fiscais)
const API_URL = "https://script.google.com/macros/s/AKfycbzZjwaEDHoyuIuBZ3omHGDmPxD3HA82b8In6ocV3Yp0s-6lzqeXjTs5EDUJ4HQmhx6k/exec";
const COMPRAS_API_URL = "https://script.google.com/macros/s/AKfycbzNyhNQFrmIZ7iB--EYhcdCcNhrquWatUveNQv85-Z4e61FKaB30gNyBuwUvf517sQVWQ/exec";

// Normaliza strings para busca e comparação tolerante (ignora acentos, espaços e caixa alta/baixa)
export const normalizeText = (text: string) => {
  return (text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

// Busca inteligente no catálogo unificado da planilha
export const findCatalogoItem = (nome: string, catalogo: InsumoCatalogo[]): InsumoCatalogo | undefined => {
  if (!nome || !catalogo || catalogo.length === 0) return undefined;
  const clean = nome.trim().toLowerCase();
  
  // 1. Busca exata direta
  const exact = catalogo.find(c => c.nome.trim().toLowerCase() === clean);
  if (exact) return exact;

  // 2. Busca com texto normalizado
  const norm = normalizeText(nome);
  const normalizedMatch = catalogo.find(c => normalizeText(c.nome) === norm);
  if (normalizedMatch) return normalizedMatch;

  // Proteção contra falsos positivos para termos comuns / genéricos
  // Água, gelo, sal, etc. não devem herdar custos de "água tônica", "água de coco", "gelo seco", etc.
  const commonGenericTerms = ['agua', 'gelo', 'sal', 'acucar', 'cafe'];
  if (commonGenericTerms.includes(norm)) {
    return undefined;
  }

  // 3. Busca por inclusão de palavras-chave significativas
  const words = norm.split(/\s+/).filter(w => w.length > 2);

  // Se for apenas uma palavra curta (ex: "agua", "copo"), evitar match em "agua tonica", "copo descartavel 500ml", etc.
  if (words.length === 1 && words[0].length < 6) {
    const singleMatch = catalogo.find(c => {
      const cNorm = normalizeText(c.nome);
      const cWords = cNorm.split(/\s+/);
      return cWords.includes(words[0]) && cWords.length <= 2;
    });
    if (singleMatch) return singleMatch;
    return undefined;
  }

  if (words.length > 0) {
    const wordMatch = catalogo.find(c => {
      const cNorm = normalizeText(c.nome);
      const supplierNorm = c.fornecedor ? normalizeText(c.fornecedor) : '';
      return words.every(w => cNorm.includes(w) || supplierNorm.includes(w));
    });
    if (wordMatch) return wordMatch;
  }

  return undefined;
};

// Helper robusto para extrair o rendimento e a unidade de qualquer ficha técnica (suportando todas variações de campos legados e strings)
export const getFichaRendimentoInfo = (ficha: FichaTecnica | any): { qtd: number; unidade: string } => {
  if (!ficha) return { qtd: 1, unidade: 'un' };

  const rawQtd = ficha.rendimentoQtd ?? 
                 ficha.rendimento ?? 
                 ficha.rendimento_qtd ?? 
                 ficha.rendimentoQuantidade ?? 
                 ficha.rendimentoFinal;
  
  let qtd = 1;
  let unidadeExtraida = "";

  if (typeof rawQtd === 'number' && !isNaN(rawQtd) && rawQtd > 0) {
    qtd = rawQtd;
  } else if (typeof rawQtd === 'string') {
    const cleanStr = rawQtd.trim().replace(',', '.');
    const match = cleanStr.match(/^([\d.]+)\s*(.*)$/);
    if (match) {
      const parsed = parseFloat(match[1]);
      if (!isNaN(parsed) && parsed > 0) {
        qtd = parsed;
      }
      if (match[2]) {
        unidadeExtraida = match[2].trim().toLowerCase();
      }
    }
  }

  const rawUnit = ficha.rendimentoUnidade || 
                  ficha.rendimento_unidade || 
                  ficha.unidadeRendimento || 
                  ficha.unidadeMedida || 
                  ficha.unidade || 
                  unidadeExtraida || 
                  (ficha.tipo === 'insumo' ? 'l' : 'un');

  let cleanUnit = (rawUnit || 'un').toLowerCase().trim();
  if (['l', 'lt', 'lts', 'litro', 'litros'].includes(cleanUnit)) cleanUnit = 'l';
  else if (['kg', 'kgs', 'quilo', 'quilos', 'quilograma'].includes(cleanUnit)) cleanUnit = 'kg';
  else if (['ml', 'mls', 'mililitro', 'mililitros'].includes(cleanUnit)) cleanUnit = 'ml';
  else if (['g', 'gr', 'grs', 'grama', 'gramas'].includes(cleanUnit)) cleanUnit = 'g';
  else if (['un', 'unid', 'unidade', 'unidades', 'porcao', 'porção', 'porcoes', 'porções', 'dose', 'doses'].includes(cleanUnit)) cleanUnit = 'un';

  return { qtd: qtd > 0 ? qtd : 1, unidade: cleanUnit };
};

// ---------------------------------------------------------------------------
// Conversão de unidades (culinária e bar)
// unitConversion devolve o multiplicador E se a conversão é confiável (ok).
// ok = false significa que as unidades não conversam (ex.: receita em KG e preço por CX sem peso no nome)
// e o custo daquela linha NÃO deve ser considerado confiável.
// ---------------------------------------------------------------------------
const MASS_G = ['g', 'gr', 'grs', 'grama', 'gramas'];
const MASS_KG = ['kg', 'kgs', 'quilo', 'quilos', 'quilograma'];
const VOL_ML = ['ml', 'mls', 'mililitro', 'mililitros'];
const VOL_L = ['l', 'lt', 'lts', 'litro', 'litros'];
const COUNT_UNITS = ['un', 'und', 'unid', 'unidade', 'unidades', 'pc', 'pç', 'peca', 'peça', 'fatia', 'fatias', 'folha', 'folhas', 'ramo', 'ramos', 'gf', 'gfa', 'garrafa', 'lata', 'cx', 'cx.', 'caixa', 'pct', 'pacote', 'fd', 'fardo', 'dz', 'porcao', 'porção'];
const PACKAGE_UNITS = ['un', 'und', 'unid', 'unidade', 'garrafa', 'gf', 'gfa', 'lata', 'cx', 'cx.', 'caixa', 'pct', 'pacote', 'fd', 'fardo', 'pç', 'peca'];

// Lê o conteúdo da embalagem a partir do nome (ex.: "ACUCAR CRISTAL 5KG", "XAROPE MONIN 700ML", "AGUA 1,5L", "BACON 500G")
export const parseConteudoEmbalagem = (itemName: string): { ml?: number; g?: number } => {
  const s = (itemName || '').toUpperCase();
  const ml = s.match(/(\d+(?:[.,]\d+)?)\s*ML\b/);
  if (ml) return { ml: parseFloat(ml[1].replace(',', '.')) };
  const l = s.match(/(\d+(?:[.,]\d+)?)\s*(?:L|LT|LTS|LITROS?)\b/);
  if (l) return { ml: parseFloat(l[1].replace(',', '.')) * 1000 };
  const kg = s.match(/(\d+(?:[.,]\d+)?)\s*(?:KG|KGS)\b/);
  if (kg) return { g: parseFloat(kg[1].replace(',', '.')) * 1000 };
  const g = s.match(/(\d+(?:[.,]\d+)?)\s*(?:G|GR|GRS)\b/);
  if (g) return { g: parseFloat(g[1].replace(',', '.')) };
  if (/\b(GIN|VODKA|WHISKY|WHISKEY|RUM|TEQUILA|LICOR|APEROL|CAMPARI|CACHA[CÇ]A)\b/.test(s)) return { ml: 750 }; // garrafa padrão
  return {};
};

export const unitConversion = (recipeUnit: string, baseUnit: string, itemName: string = "", quantityVal: number = 0): { mult: number; ok: boolean } => {
  const ru = (recipeUnit || '').toLowerCase().trim();
  const bu = (baseUnit || '').toLowerCase().trim();

  if (ru && ru === bu) return { mult: 1, ok: true };

  const isRecipeG = MASS_G.includes(ru), isRecipeKg = MASS_KG.includes(ru);
  const isBaseG = MASS_G.includes(bu), isBaseKg = MASS_KG.includes(bu);
  if (isBaseKg && isRecipeG) return { mult: 0.001, ok: true };
  if (isBaseG && isRecipeKg) return { mult: 1000, ok: true };
  if ((isBaseKg && isRecipeKg) || (isBaseG && isRecipeG)) return { mult: 1, ok: true };

  const isRecipeMl = VOL_ML.includes(ru), isRecipeL = VOL_L.includes(ru);
  const isBaseMl = VOL_ML.includes(bu), isBaseL = VOL_L.includes(bu);
  if (isBaseL && isRecipeMl) return { mult: 0.001, ok: true };
  if (isBaseMl && isRecipeL) return { mult: 1000, ok: true };
  if ((isBaseL && isRecipeL) || (isBaseMl && isRecipeMl)) return { mult: 1, ok: true };

  // Medidas de bar/cozinha convertidas para ml
  const medidasMl: Record<string, number> = {
    dose: 50, doses: 50, ds: 50, oz: 30, onca: 30, 'onça': 30, oncas: 30, 'onças': 30, cl: 10,
    dash: 1, dashes: 1, lance: 1, lances: 1, bailarina: 5, cb: 5, 'colher bailarina': 5,
    cs: 15, colher: 15, colheres: 15, 'colher de sopa': 15, sopa: 15,
    cc: 5, 'colher de cha': 5, 'colher de chá': 5, cha: 5, 'chá': 5,
    gota: 0.05, gotas: 0.05, xicara: 200, 'xícara': 200, xicaras: 200, 'xícaras': 200, copo: 200, copos: 200,
  };
  const medida = medidasMl[ru];
  if (medida !== undefined) {
    if (isBaseL || isBaseKg) return { mult: medida / 1000, ok: true };
    if (isBaseMl || isBaseG) return { mult: medida, ok: true };
  }

  // Receita sem unidade explícita: mantém a regra antiga (>=5 sobre L = ml; >=10 sobre KG = g)
  if (!ru) {
    if (isBaseL && quantityVal >= 5) return { mult: 0.001, ok: true };
    if (isBaseKg && quantityVal >= 10) return { mult: 0.001, ok: true };
    return { mult: 1, ok: true };
  }

  // Preço por embalagem (UN, CX, garrafa...) e receita em ml/g: usa o conteúdo lido do nome
  if (PACKAGE_UNITS.includes(bu)) {
    const cont = parseConteudoEmbalagem(itemName);
    const recipeMl = isRecipeMl ? 1 : isRecipeL ? 1000 : medida !== undefined ? medida : 0;
    const recipeG = isRecipeG ? 1 : isRecipeKg ? 1000 : 0;
    if (cont.ml && recipeMl) return { mult: recipeMl / cont.ml, ok: true };
    if (cont.g && recipeG) return { mult: recipeG / cont.g, ok: true };
  }

  // Contagem com contagem (1 un de um item vendido por UN)
  if (COUNT_UNITS.includes(ru) && COUNT_UNITS.includes(bu)) return { mult: 1, ok: true };

  // Unidades que não conversam: devolve 1 para não quebrar telas antigas, mas marca como NÃO confiável
  return { mult: 1, ok: false };
};

// Mantido por compatibilidade com o restante do código
export const getUnitMultiplier = (recipeUnit: string, baseUnit: string, itemName: string = "", quantityVal: number = 0): number =>
  unitConversion(recipeUnit, baseUnit, itemName, quantityVal).mult;

// Quantidades fora do padrão (provável erro de digitação, ex.: "0,005ml" ou "30l")
export const alertaQuantidade = (val: number, unit: string): string | null => {
  const u = (unit || '').toLowerCase().trim();
  if (VOL_ML.includes(u) && val > 0 && val < 1) return `Quantidade suspeita: ${val} ml (quis dizer ${val} L?)`;
  if (MASS_G.includes(u) && val > 0 && val < 1) return `Quantidade suspeita: ${val} g (quis dizer ${val} kg?)`;
  if (VOL_L.includes(u) && val > 5) return `Quantidade suspeita: ${val} L (quis dizer ${val} ml?)`;
  if (MASS_KG.includes(u) && val > 20) return `Quantidade suspeita: ${val} kg (quis dizer ${val} g?)`;
  return null;
};

// Autocomplete / Combobox unificado para seleção de Insumos (Planilha + Pasta de Insumos + Matérias-Primas)
const InsumoCombobox = ({
  value,
  onChangeName,
  onSelectSuggestion,
  sugestoes,
  placeholder = "Buscar na planilha, pasta de insumos ou digitar..."
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
    if (!value || value.trim() === "") return sugestoes.slice(0, 50);
    const q = normalizeText(value);
    return sugestoes.filter(item => {
      const nomeMatch = normalizeText(item.nome).includes(q);
      const fornecedorMatch = item.fornecedor ? normalizeText(item.fornecedor).includes(q) : false;
      return nomeMatch || fornecedorMatch;
    }).slice(0, 50);
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
              matched.origem === 'compras'
                ? 'bg-cyan-500/20 text-cyan-400'
                : matched.origem === 'catalogo' 
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
        <div className="absolute z-50 left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-h-72 overflow-y-auto">
          {sugestoes.length > 0 && (
            <div className="p-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/60 bg-slate-900/95 flex justify-between items-center sticky top-0 backdrop-blur-sm z-10">
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
                className="px-3 py-2.5 text-sm cursor-pointer hover:bg-slate-700/80 flex items-center justify-between border-b border-slate-700/30 last:border-0 transition-colors gap-2"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelectSuggestion(item);
                  setIsOpen(false);
                }}
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-200 truncate">{item.nome}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium border shrink-0 ${
                      item.origem === 'compras'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                        : item.origem === 'catalogo' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : item.origem === 'insumo' 
                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {item.labelOrigem}
                    </span>
                  </div>
                  {item.fornecedor && (
                    <span className="text-[11px] text-slate-400 truncate mt-0.5">
                      Fornecedor: {item.fornecedor}
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0 ml-2">
                  R$ {Number(item.custo).toFixed(2)} / {item.um}
                </span>
              </div>
            ))
          ) : (
            <div className="px-3 py-3 text-sm text-slate-400 text-center">
              <span>Nenhum item correspondente encontrado para &quot;{value}&quot;.</span>
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
  const [filterTipo, setFilterTipo] = useState<"bebida" | "comida" | "insumo" | "materias_primas" | "auditoria">("bebida");
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states com precoVenda
  const [tipo, setTipo] = useState<"bebida" | "comida" | "insumo">("bebida");
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [precoVenda, setPrecoVenda] = useState<string>("");
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

  // Estado para controle do desmembramento/conversão in-line de fardos/caixas
  const [conversaoAbertaIndex, setConversaoAbertaIndex] = useState<number | null>(null);
  const [conversaoDraft, setConversaoDraft] = useState<{
    fator: string;
    novaUnidade: string;
  }>({ fator: "", novaUnidade: "KG" });

  // Estado para cadastro e edição de matérias-primas (ex: Água com custo zero)
  const [showMateriaModal, setShowMateriaModal] = useState(false);
  const [editingMateriaId, setEditingMateriaId] = useState<string | null>(null);
  const [materiaNome, setMateriaNome] = useState("");
  const [materiaCusto, setMateriaCusto] = useState<string>("0");
  const [materiaUnidade, setMateriaUnidade] = useState<string>("L");
  const [savingMateria, setSavingMateria] = useState(false);

  // Helper para inferir unidade de medida a partir do nome do insumo
  const inferirUnidade = (nomeItem: string): string => {
    const s = nomeItem.toUpperCase();
    // Número + unidade no nome ("ACUCAR 5KG", "AGUA 1,5L", "BACON 500G") = preço por EMBALAGEM.
    // O conteúdo é lido do nome na hora da conversão (parseConteudoEmbalagem). Antes isso virava "preço por KG/L"
    // e um pacote de 5 kg era cobrado como se fosse 1 kg.
    if (/\d+(?:[.,]\d+)?\s*(KG|KGS|G|GR|L|LT|LTS|ML)\b/.test(s)) return "UN";
    if (s.includes(" KG") || s.includes("QUILO") || s.includes("QUILOGRAMA")) return "KG";
    if (s.includes("LITRO") || s.includes(" REFIL")) return "L";
    if (s.includes(" ML") || s.includes(" LATA") || s.includes(" LONG NECK") || s.includes(" GFA") || s.includes(" VD ")) return "UN";
    if (s.includes(" PAC ") || s.includes(" CX") || s.includes(" PACOTE") || s.includes(" CAIXA")) return "UN";
    // Hortifrúti, Carnes, Queijos e Peixes geralmente cotados em KG
    const carnesVerduras = ["CENOURA", "TOMATE", "CEBOLA", "ALHO", "BATATA", "FILE", "FILÉ", "BOVINO", "POLVO", "CAMARAO", "CAMARÃO", "SALAME", "QUEIJO", "MIGNON", "PEIXE", "COSTELA", "LIMAO", "LIMÃO", "CHURROS"];
    if (carnesVerduras.some(cv => s.includes(cv))) return "KG";
    return "UN";
  };

  // Ingestão unificada: busca do Catálogo de Insumos e da Planilha de Compras/Notas Fiscais
  const fetchCatalogo = async () => {
    try {
      setLoadingCatalogo(true);
      setApiError(null);

      const combinedCatalog: InsumoCatalogo[] = [];
      const seenNames = new Set<string>();

      // 1. Busca do Catálogo de Insumos da Planilha (API Vendas & Insumos)
      try {
        const resp1 = await fetch(API_URL);
        const text1 = await resp1.text();

        if (!text1.includes("ReferenceError") && !text1.startsWith("<!DOCTYPE html>")) {
          const json1 = JSON.parse(text1);
          if (json1.sucesso && Array.isArray(json1.catalogoInsumos)) {
            const standardUnits = ['un', 'unid', 'unidade', 'kg', 'kgs', 'g', 'gr', 'l', 'lt', 'lts', 'ml', 'cx', 'cx.', 'caixa', 'pct', 'pacote', 'gf', 'gfa', 'garrafa', 'dz', 'dose', 'lata', 'pç', 'peca'];

            json1.catalogoInsumos.forEach((rawItem: any) => {
              if (!rawItem) return;
              const rawNome = (rawItem.nome || "").toString().trim();
              const rawUm = (rawItem.um || "").toString().trim();
              const rawCusto = Number(rawItem.custo) || 0;

              // Verifica se a planilha teve colunas invertidas [Fornecedor, Produto, Custo]
              const isUmAProductName = rawUm.length > 5 || rawUm.includes(" ") || !standardUnits.includes(rawUm.toLowerCase());

              let finalNome = rawNome;
              let finalUm = rawUm || "UN";
              let fornecedor: string | undefined = undefined;

              if (isUmAProductName) {
                // O nome real do insumo está em rawUm (ex: "FILÉ MIGNON BOVINO", "RAPADURA", "CREME DE LEITE...")
                finalNome = rawUm;
                fornecedor = rawNome; // ex: "ORMENEZE", "CFRUTOS", "BL IMPORTADORA"
                finalUm = inferirUnidade(rawUm);
              }

              if (finalNome) {
                const norm = normalizeText(finalNome);
                if (!seenNames.has(norm)) {
                  seenNames.add(norm);
                  combinedCatalog.push({
                    nome: finalNome,
                    um: finalUm.toUpperCase(),
                    custo: rawCusto,
                    fornecedor,
                    origemPlanilha: 'catalogo'
                  });
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn("Aviso ao conectar à API de Insumos:", err);
      }

      // 2. Busca da Planilha de Compras & NF-e (Mais de 750 itens com preço real faturado)
      try {
        const resp2 = await fetch(COMPRAS_API_URL);
        if (resp2.ok) {
          const json2 = await resp2.json();
          if (json2.sucesso && json2.geral && json2.geral.itensBusca) {
            const itensBusca = json2.geral.itensBusca;
            Object.entries(itensBusca).forEach(([nomeItem, info]: [string, any]) => {
              const norm = normalizeText(nomeItem);
              const qtd = Number(info?.qtd) || 0;
              const total = Number(info?.total) || 0;
              const unitCost = qtd > 0 ? total / qtd : 0;
              const detectedUm = inferirUnidade(nomeItem);

              if (!seenNames.has(norm)) {
                seenNames.add(norm);
                combinedCatalog.push({
                  nome: nomeItem,
                  um: detectedUm,
                  custo: unitCost,
                  origemPlanilha: 'compras'
                });
              } else {
                // Se já existia, atualiza se o preço de compras for mais fidedigno
                const existing = combinedCatalog.find(c => normalizeText(c.nome) === norm);
                if (existing && existing.custo <= 0 && unitCost > 0) {
                  existing.custo = unitCost;
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn("Aviso ao conectar à API de Compras:", err);
      }

      setCatalogoInsumos(combinedCatalog);
    } catch (error: any) {
      console.warn("Aviso ao sincronizar catálogo:", error);
      setApiError(error.message || "Não foi possível carregar os insumos da planilha");
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
    setPrecoVenda("");
    setRecipiente("");
    setIngredientes([
      { nome: "", quantidade: "", isCadastrado: false, origem: 'catalogo', custoCompra: "", unidadeCompra: "" }
    ]);
    setModoPreparo("");
    setRendimentoQtd("1");
    setRendimentoUnidade("l");
    setConversaoAbertaIndex(null);
  };

  const handleOpenAdd = () => {
    resetForm();
    setShowAddModal(true);
  };

  // Retrocompatibilidade: Se precoVenda for nulo/indefinido em fichas antigas, assume ""
  const handleEdit = (ficha: FichaTecnica) => {
    setEditingId(ficha.id!);
    setTipo(ficha.tipo);
    setNome(ficha.nome);
    setCategoria(ficha.categoria || "");
    setPrecoVenda(ficha.precoVenda !== undefined && ficha.precoVenda !== null && ficha.precoVenda > 0 ? ficha.precoVenda.toString() : "");
    setRecipiente(ficha.recipiente || "");
    setConversaoAbertaIndex(null);
    setIngredientes(ficha.ingredientes.map(i => {
      const hasSavedCusto = i.custoCompra !== undefined && i.custoCompra !== null && i.custoCompra.toString().trim() !== '';
      const matMatch = materiasPrimas.find(m => normalizeText(m.nome) === normalizeText(i.nome));
      const catMatch = findCatalogoItem(i.nome, catalogoInsumos);
      const isConvertido = i.isConvertido || (typeof i.fatorConversao === 'number' && i.fatorConversao > 0);
      
      let finalCustoCompra = i.custoCompra;
      if (!hasSavedCusto) {
        if (matMatch && typeof matMatch.custo === 'number') {
          finalCustoCompra = matMatch.custo.toString();
        } else if (catMatch && catMatch.custo >= 0) {
          finalCustoCompra = catMatch.custo.toFixed(2);
        } else {
          finalCustoCompra = '';
        }
      }

      return {
        ...i,
        origem: i.origem || (i.isCadastrado ? 'insumo' : (matMatch ? 'materia_prima' : 'catalogo')),
        unidadeCompra: i.unidadeCompra || matMatch?.unidade || catMatch?.um || '',
        custoCompra: finalCustoCompra,
        fatorConversao: i.fatorConversao,
        unidadeOriginalCompra: i.unidadeOriginalCompra || (catMatch ? catMatch.um : undefined),
        custoOriginalCompra: i.custoOriginalCompra ?? (catMatch && catMatch.custo > 0 ? catMatch.custo : undefined),
        isConvertido
      };
    }));
    setModoPreparo(ficha.modoPreparo);
    const rendInfo = getFichaRendimentoInfo(ficha);
    setRendimentoQtd(rendInfo.qtd.toString());
    setRendimentoUnidade(rendInfo.unidade);
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

  const handleOpenAddMateria = () => {
    setEditingMateriaId(null);
    setMateriaNome("");
    setMateriaCusto("0");
    setMateriaUnidade("L");
    setShowMateriaModal(true);
  };

  const handleEditMateria = (mat: MateriaPrima) => {
    setEditingMateriaId(mat.id || null);
    setMateriaNome(mat.nome);
    setMateriaCusto(mat.custo !== undefined ? mat.custo.toString() : "0");
    setMateriaUnidade(mat.unidade || "L");
    setShowMateriaModal(true);
  };

  const handleSaveMateria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materiaNome.trim()) return;
    setSavingMateria(true);
    try {
      const parsedCost = parseFloat(materiaCusto.replace(',', '.')) || 0;
      const data = {
        nome: materiaNome.trim(),
        custo: Math.max(0, parsedCost),
        unidade: (materiaUnidade.trim() || 'un').toUpperCase()
      };

      if (editingMateriaId) {
        await appDb.update("materias_primas", editingMateriaId, data);
      } else {
        await appDb.add("materias_primas", data);
      }
      setShowMateriaModal(false);
    } catch (err) {
      console.error("Erro ao salvar matéria-prima:", err);
    } finally {
      setSavingMateria(false);
    }
  };

  const handleDeleteMateria = async (id?: string) => {
    if (!id) return;
    try {
      await appDb.delete("materias_primas", id);
    } catch (err) {
      console.error("Erro ao excluir matéria-prima:", err);
    }
  };

  const handleSeedAgua = async () => {
    try {
      await appDb.add("materias_primas", {
        nome: "Água",
        custo: 0,
        unidade: "L"
      });
    } catch (err) {
      console.error("Erro ao cadastrar água:", err);
    }
  };

  // ---------------------------------------------------------------------------
  // Fonte de preço VIVA de um ingrediente (ignora qualquer custo salvo na ficha).
  // Ordem: sub-receita (nome exato) → matéria-prima (nome exato) → planilha (catálogo/compras) → sub-receita por nome aproximado.
  // ---------------------------------------------------------------------------
  type FontePreco = { unitCost: number; unit: string; origemNome: string; isDynamic: boolean; aproximado?: string };

  const resolverFontePreco = (ing: Ingrediente, visited: Set<string>): FontePreco | null => {
    const normIngNome = normalizeText(ing.nome);
    if (!normIngNome) return null;

    const fromSubFicha = (subFicha: FichaTecnica, aproximado?: string): FontePreco => {
      const subCustoTotal = calcularCustoFicha(subFicha, new Set(visited));
      const rendInfo = getFichaRendimentoInfo(subFicha);
      return {
        unitCost: rendInfo.qtd > 0 ? subCustoTotal / rendInfo.qtd : subCustoTotal,
        unit: rendInfo.unidade,
        origemNome: subFicha.tipo === 'insumo' ? 'Insumo / Pasta' : 'Receita Própria',
        isDynamic: false,
        aproximado,
      };
    };

    // 1. Sub-receita com nome EXATO (prioriza tipo insumo)
    const subExata = fichas.find(f => normalizeText(f.nome) === normIngNome && f.tipo === 'insumo') ||
                     fichas.find(f => normalizeText(f.nome) === normIngNome);
    if (subExata) return fromSubFicha(subExata);

    // 2. Matéria-prima cadastrada (aceita custo 0, ex.: Água)
    const mat = materiasPrimas.find(m => normalizeText(m.nome) === normIngNome);
    if (mat && typeof mat.custo === 'number' && mat.custo >= 0) {
      return {
        unitCost: mat.custo,
        unit: (mat.unidade || 'un'),
        origemNome: mat.custo === 0 ? 'Matéria-Prima (Custo Zero)' : 'Matéria-Prima Cadastrada',
        isDynamic: false,
      };
    }

    // 3. Planilha (Catálogo ou Compras/NF)
    const catMatch = findCatalogoItem(ing.nome, catalogoInsumos);
    if (catMatch && typeof catMatch.custo === 'number' && catMatch.custo >= 0) {
      return {
        unitCost: catMatch.custo,
        unit: (catMatch.um || 'un').trim(),
        origemNome: catMatch.origemPlanilha === 'compras' ? 'Planilha Compras' : 'Planilha',
        isDynamic: true,
        aproximado: normalizeText(catMatch.nome) !== normIngNome ? catMatch.nome : undefined,
      };
    }

    // 4. Sub-receita por nome aproximado (último recurso, sempre sinalizado)
    const subAprox = fichas.find(f => {
      const fNorm = normalizeText(f.nome);
      return fNorm.length >= 6 && normIngNome.length >= 6 && (normIngNome.includes(fNorm) || fNorm.includes(normIngNome));
    });
    if (subAprox) return fromSubFicha(subAprox, subAprox.nome);

    return null;
  };

  // Cálculo individual de custo por ingrediente.
  // Regra: preço VIVO por padrão. Custo digitado à mão só vale se o usuário marcou (custoManual).
  const calcularCustoIngredienteInfo = (
    ing: Ingrediente, 
    visited = new Set<string>()
  ): { custo: number; isDynamic: boolean; unitCost?: number; unit?: string; origemNome?: string; alertas: string[] } => {
    const alertas: string[] = [];
    let val = 0;
    let unit = "";

    const fracMatch = ing.quantidade ? ing.quantidade.match(/^(\d+)\/(\d+)\s*(.*)$/) : null;
    if (fracMatch) {
      val = parseInt(fracMatch[1], 10) / parseInt(fracMatch[2], 10);
      unit = fracMatch[3].toLowerCase().trim();
    } else {
      const qtdMatch = ing.quantidade ? ing.quantidade.trim().match(/^([\d.,]+)\s*(.*)$/) : null;
      if (qtdMatch) {
        val = parseFloat(qtdMatch[1].replace(',', '.'));
        unit = qtdMatch[2].toLowerCase().trim();
      }
    }

    if (!val || isNaN(val) || val <= 0) {
      alertas.push('Quantidade inválida ou vazia');
      return { custo: 0, isDynamic: false, alertas };
    }

    const alertaQtd = alertaQuantidade(val, unit);
    if (alertaQtd) alertas.push(alertaQtd);

    const parseNum = (v: any): number | null => {
      if (v === undefined || v === null || v.toString().trim() === '') return null;
      const n = parseFloat(v.toString().replace(',', '.'));
      return isNaN(n) || n < 0 ? null : n;
    };

    const aplicar = (unitCost: number, baseUnitRaw: string, origemNome: string, isDynamic: boolean) => {
      const baseUnit = (baseUnitRaw || 'un').toLowerCase();
      const conv = unitConversion(unit || baseUnit, baseUnit, ing.nome, val);
      if (!conv.ok) alertas.push(`Unidade não confere: receita em "${unit}", preço por "${baseUnitRaw.toUpperCase()}"`);
      return { custo: val * conv.mult * unitCost, isDynamic, unitCost, unit: baseUnitRaw, origemNome, alertas };
    };

    const manualCost = parseNum(ing.custoCompra);

    // A. Custo digitado à mão pelo usuário (inclusive R$ 0,00)
    if (ing.custoManual && manualCost !== null) {
      return aplicar(manualCost, ing.unidadeCompra || 'un', manualCost === 0 ? 'Custo Zero (Manual)' : 'Custo Manual', false);
    }

    const fonte = resolverFontePreco(ing, visited);
    if (fonte?.aproximado) alertas.push(`Preço puxado por nome aproximado: "${fonte.aproximado}"`);

    // B. Desmembramento de fardo/caixa: recalcula a partir do preço vivo da embalagem
    if (ing.isConvertido && typeof ing.fatorConversao === 'number' && ing.fatorConversao > 0) {
      const baseEmbalagem = fonte && fonte.unitCost > 0 ? fonte.unitCost : parseNum(ing.custoOriginalCompra);
      if (baseEmbalagem !== null) {
        return aplicar(
          baseEmbalagem / ing.fatorConversao,
          ing.unidadeCompra || 'un',
          `Convertido (${ing.unidadeOriginalCompra || 'FD'} → ${ing.unidadeCompra || 'KG'})`,
          !!fonte?.isDynamic
        );
      }
    }

    // C. Fonte viva (sub-receita, matéria-prima ou planilha)
    if (fonte) {
      return aplicar(fonte.unitCost, fonte.unit, fonte.origemNome, fonte.isDynamic);
    }

    // D. Sem fonte: usa o último custo salvo na ficha (legado), sinalizado
    if (manualCost !== null) {
      alertas.push('Sem fonte de preço: usando custo salvo na ficha');
      return aplicar(manualCost, ing.unidadeCompra || 'un', 'Custo Salvo (sem fonte)', false);
    }
    if (typeof ing.custoCalculado === 'number' && ing.custoCalculado >= 0) {
      alertas.push('Sem fonte de preço: usando último valor calculado');
      return { custo: ing.custoCalculado, isDynamic: false, origemNome: 'Snapshot Firebase', alertas };
    }
    if (typeof (ing as any).custo === 'number' && (ing as any).custo >= 0) {
      alertas.push('Sem fonte de preço: custo legado');
      return { custo: (ing as any).custo, isDynamic: false, origemNome: 'Custo Legado', alertas };
    }

    alertas.push('Sem preço');
    return { custo: 0, isDynamic: false, alertas };
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

  // Auditoria: varre todas as fichas e aponta onde o custo não é confiável
  const [auditoriaSoProblemas, setAuditoriaSoProblemas] = useState<boolean>(true);
  const auditoria = useMemo(() => {
    const linhas: { ficha: FichaTecnica; ing: Ingrediente; info: ReturnType<typeof calcularCustoIngredienteInfo>; salvo: number | null; divergente: boolean; problema: boolean }[] = [];
    const porInsumo = new Map<string, { nome: string; variantes: Map<string, { unitCost: number; unit: string; fichas: string[] }> }>();

    fichas.forEach(ficha => {
      (ficha.ingredientes || []).forEach(ing => {
        const info = calcularCustoIngredienteInfo(ing, new Set([ficha.id!]));
        const salvo = typeof ing.custoCalculado === 'number' ? ing.custoCalculado : null;
        const divergente = salvo !== null && Math.abs(info.custo - salvo) > Math.max(0.05, salvo * 0.1);
        const problema = info.alertas.length > 0 || divergente;
        linhas.push({ ficha, ing, info, salvo, divergente, problema });

        if (info.unitCost !== undefined) {
          const key = normalizeText(ing.nome);
          if (!porInsumo.has(key)) porInsumo.set(key, { nome: ing.nome, variantes: new Map() });
          const g = porInsumo.get(key)!;
          const vKey = `${info.unitCost.toFixed(2)}|${(info.unit || '').toLowerCase()}`;
          if (!g.variantes.has(vKey)) g.variantes.set(vKey, { unitCost: info.unitCost, unit: info.unit || '', fichas: [] });
          g.variantes.get(vKey)!.fichas.push(ficha.nome);
        }
      });
    });

    const insumosInconsistentes = Array.from(porInsumo.values())
      .filter(g => g.variantes.size > 1)
      .map(g => ({ nome: g.nome, variantes: Array.from(g.variantes.values()) }));

    linhas.sort((a, b) => Number(b.problema) - Number(a.problema) || a.ficha.nome.localeCompare(b.ficha.nome));

    const linhasComAlerta = linhas.filter(l => l.info.alertas.length > 0).length;
    const linhasDivergentes = linhas.filter(l => l.divergente).length;
    const linhasManuais = linhas.filter(l => l.ing.custoManual).length;
    return {
      linhas, insumosInconsistentes, linhasComAlerta, linhasDivergentes, linhasManuais,
      totalProblemas: linhas.filter(l => l.problema).length,
    };
  }, [fichas, materiasPrimas, catalogoInsumos]);

  // Sugestões unificadas para o Combobox
  const todasSugestoes = useMemo<AutocompleteItem[]>(() => {
    const lista: AutocompleteItem[] = [];
    const nomesAdicionados = new Set<string>();

    // 1. Sub-receitas produzidas da pasta de insumos e receitas gerais
    fichas.forEach(subFicha => {
      const norm = normalizeText(subFicha.nome);
      const subCustoTotal = calcularCustoFicha(subFicha);
      const rendInfo = getFichaRendimentoInfo(subFicha);
      const subCustoUnitario = subCustoTotal / rendInfo.qtd;
      lista.push({
        id: subFicha.id,
        nome: subFicha.nome,
        origem: 'insumo',
        um: rendInfo.unidade || 'un',
        custo: subCustoUnitario,
        labelOrigem: subFicha.tipo === 'insumo' ? 'Insumo / Pasta' : 'Receita Própria'
      });
      nomesAdicionados.add(norm);
    });

    // 2. Matérias-Primas do Firebase (Prioritário sobre itens da planilha)
    materiasPrimas.forEach(mat => {
      const norm = normalizeText(mat.nome);
      if (!nomesAdicionados.has(norm)) {
        lista.push({
          id: mat.id,
          nome: mat.nome,
          origem: 'materia_prima',
          um: mat.unidade || 'un',
          custo: typeof mat.custo === 'number' ? mat.custo : 0,
          labelOrigem: mat.custo === 0 ? 'Matéria-Prima (Custo Zero)' : 'Matéria-Prima'
        });
        nomesAdicionados.add(norm);
      }
    });

    // 3. Insumos da Planilha (Catálogo e Compras integrados)
    catalogoInsumos.forEach(item => {
      const norm = normalizeText(item.nome);
      if (!nomesAdicionados.has(norm)) {
        lista.push({
          nome: item.nome,
          origem: item.origemPlanilha === 'compras' ? 'compras' : 'catalogo',
          um: item.um || 'UN',
          custo: item.custo || 0,
          labelOrigem: item.origemPlanilha === 'compras' ? 'Planilha Compras' : 'Planilha',
          fornecedor: item.fornecedor
        });
        nomesAdicionados.add(norm);
      }
    });

    return lista;
  }, [catalogoInsumos, fichas, materiasPrimas]);

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

  const handleSelectSuggestion = (index: number, item: AutocompleteItem) => {
    const newIngredientes = [...ingredientes];
    newIngredientes[index] = {
      ...newIngredientes[index],
      nome: item.nome,
      unidadeCompra: item.um || 'UN',
      custoCompra: item.custo >= 0 ? item.custo.toString() : '0',
      origem: item.origem,
      isCadastrado: item.origem === 'insumo',
      custoOriginalCompra: item.custo >= 0 ? item.custo : 0,
      unidadeOriginalCompra: item.um || 'UN',
      fatorConversao: undefined,
      isConvertido: false,
      custoManual: false
    };
    setIngredientes(newIngredientes);
    if (conversaoAbertaIndex === index) {
      setConversaoAbertaIndex(null);
    }
  };

  const handleIngredienteChange = (index: number, field: keyof Ingrediente, value: string) => {
    const newIngredientes = [...ingredientes];
    (newIngredientes[index] as any)[field] = value;

    // Digitar custo ou unidade = o usuário assumiu o preço desta linha
    if (field === 'custoCompra' || field === 'unidadeCompra') {
      newIngredientes[index].custoManual = true;
    }
    
    if (field === 'nome') {
      newIngredientes[index].custoManual = false;
      const match = todasSugestoes.find(s => normalizeText(s.nome) === normalizeText(value));
      if (match) {
        if (!newIngredientes[index].unidadeCompra) newIngredientes[index].unidadeCompra = match.um;
        if (newIngredientes[index].custoCompra === '' || newIngredientes[index].custoCompra === undefined) {
          newIngredientes[index].custoCompra = typeof match.custo === 'number' && match.custo >= 0 ? match.custo.toString() : '0';
        }
        newIngredientes[index].origem = match.origem;
      }
      newIngredientes[index].isConvertido = false;
      newIngredientes[index].fatorConversao = undefined;
    }
    
    setIngredientes(newIngredientes);
  };

  const handleRemoveIngrediente = (index: number) => {
    if (ingredientes.length === 1) return;
    const newIngredientes = [...ingredientes];
    newIngredientes.splice(index, 1);
    setIngredientes(newIngredientes);
    if (conversaoAbertaIndex === index) {
      setConversaoAbertaIndex(null);
    }
  };

  // Funções de Desmembramento / Conversão de Unidade de Compra (Fardo/Caixa/Galão para KG/L/etc)
  const handleToggleConversao = (idx: number) => {
    if (conversaoAbertaIndex === idx) {
      setConversaoAbertaIndex(null);
    } else {
      const ing = ingredientes[idx];
      setConversaoAbertaIndex(idx);
      setConversaoDraft({
        fator: ing.fatorConversao?.toString() || "",
        novaUnidade: (ing.unidadeCompra && ['KG', 'L', 'G', 'ML', 'UN'].includes(ing.unidadeCompra.toUpperCase()))
          ? ing.unidadeCompra.toUpperCase()
          : "KG"
      });
    }
  };

  const handleAplicarConversao = (idx: number) => {
    const fatorNum = parseFloat(conversaoDraft.fator.replace(',', '.'));
    if (!fatorNum || fatorNum <= 0) {
      alert("Por favor, informe uma quantidade válida maior que zero no fardo/caixa (ex: 30 para 30kg ou 6 para 6 unidades).");
      return;
    }

    const currentIng = ingredientes[idx];
    const baseCost = currentIng.custoOriginalCompra ?? (parseFloat(currentIng.custoCompra?.replace(',', '.') || '0') || 0);
    const originalUnit = currentIng.unidadeOriginalCompra || currentIng.unidadeCompra || 'UN';

    if (baseCost <= 0) {
      alert("O custo do ingrediente precisa ser maior que zero para calcular o desmembramento.");
      return;
    }

    const novoCustoUnitario = baseCost / fatorNum;

    const newIngredientes = [...ingredientes];
    newIngredientes[idx] = {
      ...currentIng,
      custoOriginalCompra: baseCost,
      unidadeOriginalCompra: originalUnit,
      custoCompra: novoCustoUnitario.toFixed(2),
      unidadeCompra: conversaoDraft.novaUnidade.toUpperCase(),
      fatorConversao: fatorNum,
      isConvertido: true,
      custoManual: false
    };

    setIngredientes(newIngredientes);
    setConversaoAbertaIndex(null);
  };

  const handleDesfazerConversao = (idx: number) => {
    const currentIng = ingredientes[idx];
    const newIngredientes = [...ingredientes];
    newIngredientes[idx] = {
      ...currentIng,
      custoCompra: currentIng.custoOriginalCompra ? currentIng.custoOriginalCompra.toFixed(2) : currentIng.custoCompra,
      unidadeCompra: currentIng.unidadeOriginalCompra || 'UN',
      fatorConversao: undefined,
      isConvertido: false,
      custoManual: false
    };

    setIngredientes(newIngredientes);
    setConversaoAbertaIndex(null);
  };

  const handleUsarPrecoVivo = (idx: number) => {
    const newIngredientes = [...ingredientes];
    newIngredientes[idx] = { ...newIngredientes[idx], custoManual: false };
    setIngredientes(newIngredientes);
  };

  // Salvamento: Salva array completo e precoVenda no Firebase
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
          custoCalculado: Number(custoCalculado.toFixed(2)),
          fatorConversao: ing.fatorConversao || null,
          unidadeOriginalCompra: ing.unidadeOriginalCompra || null,
          custoOriginalCompra: ing.custoOriginalCompra || null,
          isConvertido: !!ing.isConvertido,
          custoManual: !!ing.custoManual
        };
      });

      const precoVendaNumber = parseFloat(precoVenda.replace(',', '.')) || 0;

      const novaFicha: any = {
        tipo,
        nome: nome.trim(),
        categoria,
        recipiente,
        precoVenda: precoVendaNumber,
        ingredientes: ingredientesParaSalvar,
        modoPreparo,
        dataCriacao: new Date().toISOString()
      };
      
      const rendQtdParsed = parseFloat(rendimentoQtd.replace(',', '.')) || 1;
      novaFicha.rendimentoQtd = rendQtdParsed > 0 ? rendQtdParsed : 1;
      novaFicha.rendimentoUnidade = rendimentoUnidade || (tipo === 'insumo' ? 'l' : 'un');
      
      if (editingId) {
        const existingFicha = fichas.find(f => f.id === editingId);
        if (existingFicha && existingFicha.dataCriacao) {
          novaFicha.dataCriacao = existingFicha.dataCriacao;
        }
        await appDb.update("fichas_tecnicas", editingId, novaFicha);
      } else {
        await appDb.add("fichas_tecnicas", novaFicha);
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
      doc.text("Ficha Técnica & Análise Financeira", 14, 22);

      doc.setFontSize(16);
      doc.setTextColor(50);
      doc.text(ficha.nome, 14, 32);

      doc.setFontSize(10);
      doc.setTextColor(100);
      let yPos = 40;
      doc.text(`Tipo: ${ficha.tipo === 'bebida' ? 'Bebida/Bar' : ficha.tipo === 'comida' ? 'Comida/Cozinha' : 'Insumo/Preparo'}`, 14, yPos);
      if (ficha.categoria) {
        doc.text(`Categoria: ${ficha.categoria}`, 100, yPos);
      }
      yPos += 6;
      
      if (ficha.recipiente) {
        doc.text(`Recipiente: ${ficha.recipiente}`, 14, yPos);
      }
      doc.text(`Data: ${ficha.dataCriacao ? new Date(ficha.dataCriacao).toLocaleDateString('pt-BR') : '-'}`, 100, yPos);
      yPos += 7;

      // Resumo Financeiro no PDF
      const custoTotalFicha = calcularCustoFicha(ficha);
      const rendInfo = getFichaRendimentoInfo(ficha);
      const custoUnitarioFicha = custoTotalFicha / rendInfo.qtd;
      const hasRendimento = rendInfo.qtd > 1 || ficha.tipo === 'insumo';
      const custoParaResumo = hasRendimento ? custoUnitarioFicha : custoTotalFicha;
      const fin = calcularResumoFinanceiro(custoParaResumo, ficha.precoVenda);
      doc.setFontSize(10);
      doc.setTextColor(40);
      const rendTexto = hasRendimento ? ` | Rendimento: ${rendInfo.qtd} ${rendInfo.unidade} (Custo Unit.: R$ ${custoUnitarioFicha.toFixed(2)}/${rendInfo.unidade})` : '';
      const resumoPdf = `Custo Total: R$ ${custoTotalFicha.toFixed(2)}${rendTexto} | Preço de Venda: ${fin.precoVenda > 0 ? 'R$ ' + fin.precoVenda.toFixed(2) : 'Não informado'} | Lucro: ${fin.precoVenda > 0 ? 'R$ ' + fin.lucroBruto.toFixed(2) : '-'} | CMV: ${fin.cmvPercentual ? fin.cmvPercentual.toFixed(1) + '%' : '-'}`;
      doc.text(resumoPdf, 14, yPos);
      yPos += 8;

      doc.setFontSize(13);
      doc.setTextColor(0);
      doc.text("Ingredientes & Insumos", 14, yPos);

      const tableData = ficha.ingredientes.map(i => {
        const c = calcularCustoIngrediente(i);
        const nomeIng = i.isConvertido && i.fatorConversao
          ? `${i.nome} (Desmembrado 1/${i.fatorConversao} ${i.unidadeCompra || 'UN'})`
          : i.nome;
        return [nomeIng, i.quantidade, c > 0 ? `R$ ${c.toFixed(2)}` : '-'];
      });

      autoTable(doc, {
        startY: yPos + 3,
        head: [["Ingrediente", "Qtd Utilizada", "Custo (R$)"]],
        body: tableData,
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129] },
        styles: { fontSize: 10 }
      });

      let finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(13);
      doc.setTextColor(0);
      doc.text("Modo de Preparo", 14, finalY);

      doc.setFontSize(10);
      doc.setTextColor(80);
      const splitModo = doc.splitTextToSize(ficha.modoPreparo, 180);
      doc.text(splitModo, 14, finalY + 7);
    });

    doc.save(`fichas_tecnicas_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === fichasFiltradas.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(fichasFiltradas.map(f => f.id!));
    }
  };

  const handleSetFilterTipo = (t: "bebida" | "comida" | "insumo" | "materias_primas" | "auditoria") => {
    setFilterTipo(t);
    setFilterCategoria("todas");
  };

  const fichasFiltradas = useMemo(() => {
    return fichas.filter(f => {
      const matchTipo = f.tipo === filterTipo;
      const matchCategoria = filterCategoria === "todas" || f.categoria === filterCategoria;
      const matchSearch = f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.ingredientes.some(i => i.nome.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchTipo && matchCategoria && matchSearch;
    });
  }, [fichas, filterTipo, filterCategoria, searchTerm]);

  // Cálculo ao vivo do resumo financeiro no formulário do modal
  const custoTotalAtualModal = useMemo(() => {
    return ingredientes.reduce((acc, ing) => acc + calcularCustoIngrediente(ing), 0);
  }, [ingredientes, catalogoInsumos, fichas, materiasPrimas]);

  const rendQtdAtualModal = useMemo(() => {
    const q = parseFloat(rendimentoQtd.replace(',', '.'));
    return (q && !isNaN(q) && q > 0) ? q : 1;
  }, [rendimentoQtd]);

  const custoUnitarioAtualModal = useMemo(() => {
    return custoTotalAtualModal / rendQtdAtualModal;
  }, [custoTotalAtualModal, rendQtdAtualModal]);

  const resumoModal = useMemo(() => {
    // Para cálculo de margem e CMV no cardápio, utiliza o custo unitário (por litro/porção)
    const custoParaResumo = (tipo === 'insumo' || rendQtdAtualModal > 1) 
      ? custoUnitarioAtualModal 
      : custoTotalAtualModal;
    return calcularResumoFinanceiro(custoParaResumo, precoVenda);
  }, [custoTotalAtualModal, custoUnitarioAtualModal, rendQtdAtualModal, tipo, precoVenda]);

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
            Fichas Técnicas & Centro Financeiro
          </h1>
          <p className="text-slate-400 mt-1 text-sm">
            Gestão de receitas, custos de insumos, preço de cardápio e controle rigoroso de CMV / Margem.
          </p>
          
          {/* Status da Ingestão da Planilha */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {loadingCatalogo ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                <RefreshCw className="h-3 w-3 animate-spin" /> Conectando às planilhas (Catálogo & Compras)...
              </span>
            ) : catalogoInsumos.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-medium">
                <Sparkles className="h-3 w-3" /> Preços sincronizados ({catalogoInsumos.length} insumos da planilha disponíveis)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/80 border border-slate-700 px-2.5 py-0.5 rounded-full">
                {todasSugestoes.length} insumos disponíveis na sua pasta
              </span>
            )}
            <button
              onClick={fetchCatalogo}
              disabled={loadingCatalogo}
              className="text-xs text-slate-400 hover:text-slate-200 underline flex items-center gap-1 transition-colors disabled:opacity-50"
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

      {/* AVISO DO GOOGLE APPS SCRIPT (SE HOUVER) */}
      {apiError && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-xs text-amber-300 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-amber-200 text-sm">
              Aviso na sincronização de planilhas
            </p>
            <p className="text-slate-300 font-mono text-[11px] bg-slate-950/70 p-2 rounded border border-amber-500/20">
              {apiError}
            </p>
            <p className="text-slate-400 text-xs">
              O sistema continua funcionando perfeitamente com os insumos da pasta e valores salvos.
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
          <button
            onClick={() => handleSetFilterTipo("auditoria")}
            className={`flex-1 min-w-[140px] py-4 text-sm font-medium transition-colors border-b-2 flex items-center justify-center gap-2 ${
              filterTipo === "auditoria" 
                ? "border-rose-500 text-rose-400 bg-rose-500/5" 
                : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Auditoria{auditoria.totalProblemas > 0 ? ` (${auditoria.totalProblemas})` : ''}
          </button>
        </div>

        {filterTipo === 'auditoria' && (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-white font-semibold">Auditoria de custos</h3>
                <p className="text-xs text-slate-400">
                  Linha por linha: de onde vem o preço, o custo atual e o que foi salvo na ficha. Corrija editando a ficha.
                </p>
              </div>
              <label className="text-xs text-slate-300 flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={auditoriaSoProblemas} onChange={(e) => setAuditoriaSoProblemas(e.target.checked)} />
                Mostrar só problemas
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Linhas com alerta', auditoria.linhasComAlerta],
                ['Custo mudou vs salvo', auditoria.linhasDivergentes],
                ['Preço manual travado', auditoria.linhasManuais],
                ['Insumos c/ preço diferente', auditoria.insumosInconsistentes.length],
              ].map(([label, n]) => (
                <div key={label as string} className="bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                  <div className={`text-2xl font-bold ${Number(n) > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{n as number}</div>
                  <div className="text-[11px] text-slate-400 uppercase tracking-wide">{label as string}</div>
                </div>
              ))}
            </div>

            {auditoria.insumosInconsistentes.length > 0 && (
              <div className="bg-rose-500/5 border border-rose-500/30 rounded-lg p-3 space-y-1">
                <p className="text-sm font-semibold text-rose-300">Mesmo insumo com custo unitário diferente entre fichas</p>
                {auditoria.insumosInconsistentes.map(g => (
                  <p key={g.nome} className="text-xs text-slate-300">
                    <strong className="text-white">{g.nome}</strong>: {g.variantes.map(v => `R$ ${v.unitCost.toFixed(2)}/${v.unit} (${v.fichas.join(', ')})`).join(' · ')}
                  </p>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="text-left py-2 pr-2">Ficha</th>
                    <th className="text-left py-2 pr-2">Ingrediente</th>
                    <th className="text-left py-2 pr-2">Qtd</th>
                    <th className="text-left py-2 pr-2">Fonte do preço</th>
                    <th className="text-right py-2 pr-2">R$ unit.</th>
                    <th className="text-right py-2 pr-2">Custo atual</th>
                    <th className="text-right py-2 pr-2">Salvo</th>
                    <th className="text-left py-2">Alertas</th>
                  </tr>
                </thead>
                <tbody>
                  {auditoria.linhas
                    .filter(l => !auditoriaSoProblemas || l.problema)
                    .map((l, i) => (
                    <tr key={i} className={`border-b border-slate-800/50 ${l.problema ? 'bg-rose-500/5' : ''}`}>
                      <td className="py-1.5 pr-2 text-slate-200">
                        <button type="button" className="hover:underline text-left" onClick={() => handleEdit(l.ficha)}>{l.ficha.nome}</button>
                      </td>
                      <td className="py-1.5 pr-2 text-slate-300">{l.ing.nome}</td>
                      <td className="py-1.5 pr-2 font-mono text-slate-400">{l.ing.quantidade}</td>
                      <td className="py-1.5 pr-2 text-slate-400">{l.info.origemNome || '—'}{l.ing.custoManual ? ' · MANUAL' : ''}</td>
                      <td className="py-1.5 pr-2 text-right font-mono text-slate-300">{l.info.unitCost !== undefined ? `${l.info.unitCost.toFixed(2)}/${l.info.unit}` : '—'}</td>
                      <td className="py-1.5 pr-2 text-right font-mono text-emerald-400">{l.info.custo.toFixed(2)}</td>
                      <td className={`py-1.5 pr-2 text-right font-mono ${l.divergente ? 'text-amber-400' : 'text-slate-500'}`}>{l.salvo !== null ? l.salvo.toFixed(2) : '—'}</td>
                      <td className="py-1.5 text-rose-300">{l.info.alertas.join(' · ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filterTipo !== 'materias_primas' && filterTipo !== 'auditoria' && (
        <>
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder={`Buscar em ${filterTipo === 'bebida' ? 'Bebidas' : filterTipo === 'comida' ? 'Comidas' : 'Insumos'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm"
              />
            </div>
            
            <div className="flex gap-2 items-center">
              <span className="text-xs text-slate-400 whitespace-nowrap">Categoria:</span>
              <select
                value={filterCategoria}
                onChange={(e) => setFilterCategoria(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
              >
                <option value="todas">Todas as Categorias</option>
                {categoriasLista
                  .filter(c => c.tipo === filterTipo)
                  .map(c => (
                    <option key={c.id || c.nome} value={c.nome}>{c.nome}</option>
                  ))
                }
              </select>
            </div>
          </div>

          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 px-2.5 py-1.5 rounded transition-colors"
                >
                  {selectedIds.length === fichasFiltradas.length && fichasFiltradas.length > 0 ? (
                    <CheckSquare className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {selectedIds.length === fichasFiltradas.length && fichasFiltradas.length > 0 ? "Desmarcar Todos" : "Marcar Todos"}
                </button>
                <span className="text-xs text-slate-500">
                  {selectedIds.length} selecionada(s)
                </span>
              </div>
              <span className="text-xs text-slate-400">
                Total: <strong className="text-white">{fichasFiltradas.length}</strong> receitas
              </span>
            </div>

            {fichasFiltradas.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <ChefHat className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Nenhuma ficha técnica cadastrada nesta categoria.</p>
                <button 
                  onClick={handleOpenAdd}
                  className="mt-4 text-emerald-400 hover:underline text-sm inline-flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Cadastrar Primeira Ficha
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {fichasFiltradas.map((ficha) => {
                  const custoTotalFicha = calcularCustoFicha(ficha);
                  const rendInfo = getFichaRendimentoInfo(ficha);
                  const custoUnitarioFicha = custoTotalFicha / rendInfo.qtd;
                  const hasRendimento = rendInfo.qtd > 1 || ficha.tipo === 'insumo';
                  const custoParaResumo = hasRendimento ? custoUnitarioFicha : custoTotalFicha;
                  const isExpanded = expandedId === ficha.id;
                  const isSelected = selectedIds.includes(ficha.id!);
                  const fin = calcularResumoFinanceiro(custoParaResumo, ficha.precoVenda);

                  return (
                    <div 
                      key={ficha.id} 
                      className={`bg-slate-800/40 border rounded-xl overflow-hidden transition-all ${
                        isSelected ? "border-emerald-500/50 bg-emerald-500/[0.02]" : "border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => handleToggleSelect(ficha.id!)}
                            className="text-slate-400 hover:text-white"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-5 w-5 text-emerald-500" />
                            ) : (
                              <Square className="h-5 w-5" />
                            )}
                          </button>
                          
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-white text-base truncate">{ficha.nome}</h3>
                              {ficha.categoria && (
                                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                                  {ficha.categoria}
                                </span>
                              )}
                              {hasRendimento && (
                                <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 border border-indigo-500/30">
                                  <FlaskConical className="h-3 w-3" />
                                  Rende: {rendInfo.qtd} {rendInfo.unidade} • R$ {custoUnitarioFicha.toFixed(2)}/{rendInfo.unidade}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {ficha.ingredientes.length} ingrediente(s)
                              {ficha.recipiente && ` • ${ficha.recipiente}`}
                            </p>
                          </div>
                        </div>

                        {/* CARDS DE CUSTO, PREÇO E MARGEM NO CABEÇALHO DO ITEM */}
                        <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-700/50 flex-wrap">
                          <div className="flex items-center gap-3">
                            <div className="text-left sm:text-right">
                              <span className="text-[10px] text-slate-500 block uppercase font-medium">
                                {hasRendimento ? `Custo / ${rendInfo.unidade.toUpperCase()}` : "Custo"}
                              </span>
                              <span className="text-emerald-400 font-mono font-bold text-sm">
                                R$ {custoUnitarioFicha.toFixed(2)}
                              </span>
                              {hasRendimento && (
                                <span className="text-[10px] text-slate-400 block font-mono">
                                  (R$ {custoTotalFicha.toFixed(2)} total • {rendInfo.qtd} {rendInfo.unidade})
                                </span>
                              )}
                            </div>

                            {fin.precoVenda > 0 ? (
                              <div className="text-left sm:text-right">
                                <span className="text-[10px] text-slate-500 block uppercase font-medium">Venda</span>
                                <span className="text-white font-mono font-bold text-sm">
                                  R$ {fin.precoVenda.toFixed(2)}
                                </span>
                              </div>
                            ) : (
                              <div className="text-left sm:text-right">
                                <span className="text-[10px] text-slate-500 block uppercase font-medium">Venda</span>
                                <span className="text-slate-500 text-xs italic">Não inf.</span>
                              </div>
                            )}

                            {/* BADGE DE CMV */}
                            {fin.cmvPercentual !== null && (
                              <span className={`text-xs px-2.5 py-1 rounded-full font-mono font-bold border inline-flex items-center gap-1 ${
                                fin.statusMargem === 'excelente' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : fin.statusMargem === 'atencao'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : fin.statusMargem === 'perigo'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                {fin.statusMargem === 'perigo' && <AlertTriangle className="h-3 w-3" />}
                                CMV: {fin.cmvPercentual.toFixed(1)}%
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : ficha.id!)}
                              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                              title={isExpanded ? "Recolher detalhes" : "Expandir receita e finanças"}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleEdit(ficha)}
                              className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-lg transition-colors text-xs font-medium"
                              title="Editar Ficha"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(ficha.id!)}
                              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-700 rounded-lg transition-colors"
                              title="Excluir Ficha"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* CONTEÚDO EXPANDIDO: PAINEL FINANCEIRO DOS 4 PILARES E INGREDIENTES */}
                      {isExpanded && (
                        <div className="border-t border-slate-700/60 p-4 bg-slate-900/60 space-y-4">
                          {/* PAINEL DE RESUMO FINANCEIRO (DASHBOARD DA FICHA) */}
                          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 shadow-inner">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-slate-800/80 pb-2">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-emerald-400" />
                                <span className="text-xs font-bold text-white uppercase tracking-wider">
                                  Resumo Financeiro da Receita
                                </span>
                              </div>
                              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 w-fit ${
                                fin.statusMargem === 'excelente' 
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : fin.statusMargem === 'atencao'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : fin.statusMargem === 'perigo'
                                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                {fin.statusMargem === 'perigo' && <AlertTriangle className="h-3 w-3" />}
                                {fin.mensagemMargem}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                              {/* Pilar 1: Custo */}
                              <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                                  {hasRendimento ? `Custo / ${rendInfo.unidade.toUpperCase()}` : "Custo Total"}
                                </span>
                                <span className="text-base font-bold font-mono text-emerald-400 mt-0.5 block">
                                  R$ {custoUnitarioFicha.toFixed(2)}
                                </span>
                                <span className="text-[10px] text-slate-500 block">
                                  {hasRendimento 
                                    ? `R$ ${custoTotalFicha.toFixed(2)} total ÷ ${rendInfo.qtd} ${rendInfo.unidade}` 
                                    : "Soma dos insumos"}
                                </span>
                              </div>

                              {/* Pilar 2: Preço de Venda */}
                              <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Preço de Venda</span>
                                <span className="text-base font-bold font-mono text-white mt-0.5 block">
                                  {fin.precoVenda > 0 ? `R$ ${fin.precoVenda.toFixed(2)}` : 'Não definido'}
                                </span>
                                <span className="text-[10px] text-slate-500">Cardápio</span>
                              </div>

                              {/* Pilar 3: Lucro Bruto */}
                              <div className="bg-slate-900/80 border border-slate-800/80 rounded-lg p-3">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Lucro Bruto</span>
                                <span className={`text-base font-bold font-mono mt-0.5 block ${
                                  fin.lucroBruto > 0 ? 'text-emerald-400' : fin.lucroBruto < 0 ? 'text-rose-400' : 'text-slate-400'
                                }`}>
                                  {fin.precoVenda > 0 ? `R$ ${fin.lucroBruto.toFixed(2)}` : '---'}
                                </span>
                                <span className="text-[10px] text-slate-500">Venda - Custo</span>
                              </div>

                              {/* Pilar 4: CMV % */}
                              <div className={`border rounded-lg p-3 ${
                                fin.statusMargem === 'excelente' 
                                  ? 'bg-emerald-500/10 border-emerald-500/30'
                                  : fin.statusMargem === 'atencao'
                                  ? 'bg-amber-500/10 border-amber-500/30'
                                  : fin.statusMargem === 'perigo'
                                  ? 'bg-rose-500/10 border-rose-500/30'
                                  : 'bg-slate-900/80 border-slate-800/80'
                              }`}>
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">CMV (%)</span>
                                <span className={`text-base font-bold font-mono mt-0.5 block ${
                                  fin.statusMargem === 'excelente'
                                    ? 'text-emerald-400'
                                    : fin.statusMargem === 'atencao'
                                    ? 'text-amber-400'
                                    : fin.statusMargem === 'perigo'
                                    ? 'text-rose-400'
                                    : 'text-slate-400'
                                }`}>
                                  {fin.cmvPercentual !== null ? `${fin.cmvPercentual.toFixed(1)}%` : '---'}
                                </span>
                                <span className="text-[10px] text-slate-500">Meta: ≤ 28%</span>
                              </div>
                            </div>
                          </div>

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
                                        {ing.isConvertido ? (
                                          <span 
                                            className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-1.5 py-0.2 rounded font-medium inline-flex items-center gap-1"
                                            title={`Convertido de ${ing.unidadeOriginalCompra || 'Fardo'}: R$ ${Number(ing.custoOriginalCompra || 0).toFixed(2)} ÷ ${ing.fatorConversao}`}
                                          >
                                            <ArrowLeftRight className="h-2.5 w-2.5 text-indigo-400" /> Desmembrado (1/{ing.fatorConversao} {ing.unidadeCompra})
                                          </span>
                                        ) : custoInfo.isDynamic ? (
                                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-medium inline-flex items-center gap-1">
                                            <Sparkles className="h-2.5 w-2.5" /> {custoInfo.origemNome || 'Planilha'}
                                          </span>
                                        ) : custoInfo.origemNome && (
                                          <span className="text-[10px] bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.2 rounded font-medium">
                                            {custoInfo.origemNome}
                                          </span>
                                        )}
                                        {custoInfo.alertas.map((a, ai) => (
                                          <span key={ai} className="text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/30 px-1.5 py-0.2 rounded font-medium inline-flex items-center gap-1">
                                            <AlertTriangle className="h-2.5 w-2.5" /> {a}
                                          </span>
                                        ))}
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
                                          <span className="text-slate-600 font-mono text-xs">R$ 0,00</span>
                                        )}
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>

                            <div>
                              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">Modo de Preparo</p>
                              <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800/80 text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {ficha.modoPreparo}
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Package className="h-5 w-5 text-emerald-400" />
                  Catálogo de Matérias-Primas (Precedência Direta)
                </h3>
                <p className="text-sm text-slate-400">
                  Ingredientes base cadastrados que têm precedência máxima sobre planilhas. Itens com Custo R$ 0,00 (como Água) são calculados como gratuitos.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenAddMateria}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                <Plus className="h-4 w-4" /> Nova Matéria-Prima
              </button>
            </div>

            {/* Sugestão de Água Gratuita se ainda não cadastrada */}
            {!materiasPrimas.some(m => normalizeText(m.nome) === 'agua') && (
              <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-300">Cadastrar Água com Custo R$ 0,00</h4>
                    <p className="text-xs text-slate-300">
                      Garante que a água utilizada nas receitas e xaropes seja calculada com custo zero (grátis), sem puxar outros itens.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSeedAgua}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors shadow"
                >
                  <Plus className="h-3.5 w-3.5" /> Adicionar Água (R$ 0,00/L)
                </button>
              </div>
            )}

            {materiasPrimas.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>Nenhuma matéria-prima cadastrada.</p>
                <button
                  type="button"
                  onClick={handleOpenAddMateria}
                  className="mt-3 text-emerald-400 hover:underline text-sm inline-flex items-center gap-1"
                >
                  <Plus className="h-4 w-4" /> Cadastrar Primeira Matéria-Prima
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {materiasPrimas.map((mat) => {
                  const isZeroCost = mat.custo === 0;
                  return (
                    <div key={mat.id || mat.nome} className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between hover:border-slate-600 transition-colors">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs text-slate-400 font-mono uppercase bg-slate-900 px-2 py-0.5 rounded border border-slate-700/50">
                            {mat.unidade}
                          </span>
                          {isZeroCost ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                              Custo Zero (Grátis)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 bg-slate-700/50 px-2 py-0.5 rounded-full">
                              Matéria-Prima
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-white truncate text-base" title={mat.nome}>{mat.nome}</h4>
                        <p className={`font-mono font-bold text-lg mt-2 ${isZeroCost ? "text-slate-400" : "text-emerald-400"}`}>
                          R$ {mat.custo.toFixed(2)} <span className="text-xs font-normal text-slate-400">/{mat.unidade}</span>
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 mt-4 pt-3 border-t border-slate-700/50">
                        <button
                          type="button"
                          onClick={() => handleEditMateria(mat)}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-700/60 rounded-lg transition-colors"
                          title="Editar Matéria-Prima"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteMateria(mat.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 rounded-lg transition-colors"
                          title="Excluir Matéria-Prima"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL RESPONSIVO PARA ADICIONAR / EDITAR FICHA TÉCNICA */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-[95%] sm:w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Header Fixo */}
            <div className="p-4 sm:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-10 shrink-0">
              <div className="flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-emerald-500" />
                <h3 className="text-lg font-bold text-white">
                  {editingId ? "Editar Ficha Técnica" : "Nova Ficha Técnica"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowAddModal(false); resetForm(); }}
                className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-lg transition-colors"
                title="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Formulário com Scroll Interno */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
              <div className="p-4 sm:p-6 space-y-6 flex-1">
                {/* CABEÇALHO DO FORMULÁRIO COM PREÇO DE VENDA */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-sm font-medium text-slate-300">Tipo da Ficha</label>
                    <select
                      value={tipo}
                      onChange={(e) => {
                        const t = e.target.value as "bebida" | "comida" | "insumo";
                        setTipo(t);
                        setCategoria("");
                      }}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-sm"
                    >
                      <option value="bebida">Bebida / Bar</option>
                      <option value="comida">Comida / Cozinha</option>
                      <option value="insumo">Insumo / Sub-preparo</option>
                    </select>
                  </div>

                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-sm font-medium text-slate-300">Nome do Produto / Prato</label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder={tipo === 'bebida' ? "Ex: Gin Tônica Especial" : tipo === 'comida' ? "Ex: Risoto de Filé" : "Ex: Xarope Simples"}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-sm"
                    />
                  </div>

                  {/* NOVO CAMPO: PREÇO DE VENDA (R$) */}
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-sm font-medium text-slate-300 flex items-center justify-between">
                      <span>Preço de Venda</span>
                      <span className="text-xs text-slate-400 font-normal">Cardápio (R$)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={precoVenda}
                        onChange={(e) => setPrecoVenda(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-sm font-bold"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-medium text-slate-300">Categoria</label>
                    {showAddCategoria ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={novaCategoriaNome}
                          onChange={(e) => setNovaCategoriaNome(e.target.value)}
                          placeholder="Nova categoria..."
                          className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
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
                  
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-sm font-medium text-slate-300">Recipiente <span className="text-slate-500 font-normal">(Opcional)</span></label>
                    <input
                      type="text"
                      value={recipiente}
                      onChange={(e) => setRecipiente(e.target.value)}
                      placeholder={tipo === 'bebida' ? "Ex: Highball, Taça..." : "Ex: Prato Raso..."}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-sm"
                    />
                  </div>
                  
                  {(tipo === 'insumo' || parseFloat(rendimentoQtd) > 1) && (
                    <div className="md:col-span-3 bg-slate-800/40 p-4 rounded-xl border border-emerald-500/20 my-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                          <FlaskConical className="h-4 w-4" /> Rendimento Final da Receita (Base para calcular o custo unitário)
                        </h4>
                        {rendQtdAtualModal > 1 && (
                          <span className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                            Divisão automática: Custo Total ÷ {rendQtdAtualModal} {rendimentoUnidade.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mb-3">
                        Informe quanto a receita produz ao todo (ex: 6 Litros de xarope, 12 Porções). O sistema calculará o custo unitário exato por litro/kg/porção.
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">Quantidade que Rende</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={rendimentoQtd}
                            onChange={(e) => setRendimentoQtd(e.target.value)}
                            placeholder="Ex: 6"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm font-mono"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-slate-300">Unidade de Medida</label>
                          <select
                            value={rendimentoUnidade}
                            onChange={(e) => setRendimentoUnidade(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
                          >
                            <option value="l">Litro (L)</option>
                            <option value="kg">Quilograma (Kg)</option>
                            <option value="ml">Mililitro (ml)</option>
                            <option value="g">Grama (g)</option>
                            <option value="un">Unidade / Porção (Un)</option>
                            <option value="cx">Caixa (Cx)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* PAINEL DE RESUMO FINANCEIRO (DASHBOARD DA FICHA NO MODAL) */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 shadow-inner">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 border-b border-slate-800/80 pb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Painel Financeiro & Margem da Receita
                      </span>
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1.5 w-fit ${
                      resumoModal.statusMargem === 'excelente' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : resumoModal.statusMargem === 'atencao'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : resumoModal.statusMargem === 'perigo'
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {resumoModal.statusMargem === 'perigo' && <AlertTriangle className="h-3 w-3" />}
                      {resumoModal.mensagemMargem}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    {/* Pilar 1: Custo */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                        {(tipo === 'insumo' || rendQtdAtualModal > 1) ? `Custo / ${rendimentoUnidade.toUpperCase()}` : "Custo Total"}
                      </span>
                      <span className="text-base font-bold font-mono text-emerald-400 mt-0.5 block">
                        R$ {((tipo === 'insumo' || rendQtdAtualModal > 1) ? custoUnitarioAtualModal : custoTotalAtualModal).toFixed(2)}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate">
                        {(tipo === 'insumo' || rendQtdAtualModal > 1)
                          ? `Total R$ ${custoTotalAtualModal.toFixed(2)} ÷ ${rendQtdAtualModal} ${rendimentoUnidade}`
                          : "Soma dos insumos"}
                      </span>
                    </div>

                    {/* Pilar 2: Preço de Venda */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Preço de Venda</span>
                      <span className="text-base font-bold font-mono text-white mt-0.5 block">
                        {resumoModal.precoVenda > 0 ? `R$ ${resumoModal.precoVenda.toFixed(2)}` : 'R$ 0,00'}
                      </span>
                      <span className="text-[10px] text-slate-500">Valor no cardápio</span>
                    </div>

                    {/* Pilar 3: Lucro Bruto */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5">
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Lucro Bruto</span>
                      <span className={`text-base font-bold font-mono mt-0.5 block ${
                        resumoModal.precoVenda > 0 
                          ? resumoModal.lucroBruto > 0 
                            ? 'text-emerald-400' 
                            : 'text-rose-400'
                          : 'text-slate-400'
                      }`}>
                        {resumoModal.precoVenda > 0 
                          ? `R$ ${resumoModal.lucroBruto.toFixed(2)}` 
                          : '---'}
                      </span>
                      <span className="text-[10px] text-slate-500">Venda - Custo</span>
                    </div>

                    {/* Pilar 4: CMV (%) com Alertas Visuais */}
                    <div className={`border rounded-lg p-2.5 transition-colors ${
                      resumoModal.statusMargem === 'excelente' 
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : resumoModal.statusMargem === 'atencao'
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : resumoModal.statusMargem === 'perigo'
                        ? 'bg-rose-500/10 border-rose-500/30'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}>
                      <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">CMV (%)</span>
                      <span className={`text-base font-bold font-mono mt-0.5 block ${
                        resumoModal.statusMargem === 'excelente'
                          ? 'text-emerald-400'
                          : resumoModal.statusMargem === 'atencao'
                          ? 'text-amber-400'
                          : resumoModal.statusMargem === 'perigo'
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}>
                        {resumoModal.cmvPercentual !== null 
                          ? `${resumoModal.cmvPercentual.toFixed(1)}%` 
                          : '---'}
                      </span>
                      <span className="text-[10px] text-slate-500">Meta: ≤ 28%</span>
                    </div>
                  </div>
                </div>

                {/* SEÇÃO DE INGREDIENTES COM AUTOCOMPLETE UNIFICADO */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <label className="text-sm font-medium text-slate-300">Ingredientes / Insumos</label>
                      <p className="text-xs text-slate-400">
                        Busque no catálogo da planilha (750+ itens sincronizados) ou na pasta de insumos para auto-preencher unidade e custo.
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
                                Nome do Ingrediente (Busca na Planilha e Pasta de Insumos)
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
                                  placeholder="Digite cenoura, tomate, filé, açúcar, tanqueray..."
                                />
                              )}
                            </div>

                            <div className="w-1/3 min-w-[120px]">
                              <label className="text-[11px] font-medium text-slate-400 mb-1 block">Qtd Utilizada</label>
                              <input
                                type="text"
                                required
                                placeholder="Ex: 150g, 50ml, 2"
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
                                  value={ing.custoManual
                                    ? (ing.custoCompra || '')
                                    : (custoInfo.unitCost !== undefined ? Number(custoInfo.unitCost.toFixed(4)).toString() : (ing.custoCompra || ''))}
                                  onChange={(e) => handleIngredienteChange(idx, 'custoCompra', e.target.value)}
                                  title={ing.custoManual ? 'Custo digitado à mão (não acompanha a planilha)' : 'Preço vivo: acompanha a planilha / sub-receita. Digite para travar um valor manual.'}
                                  className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono focus:border-emerald-500 focus:outline-none"
                                />
                              </div>

                              {/* BOTÃO DE DESMEMBRAMENTO / CONVERSÃO DE UNIDADE (FARDO/CAIXA PARA KG/L/ETC) */}
                              <button
                                type="button"
                                onClick={() => handleToggleConversao(idx)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                                  ing.isConvertido 
                                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-500/30' 
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-indigo-500/50 hover:text-white'
                                }`}
                                title="Desmembrar Fardo ou Caixa (ex: R$ 47.30 fardo com 30kg → R$ 1.58 / KG)"
                              >
                                <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-400" />
                                <span>{ing.isConvertido ? `Desmembrado (1/${ing.fatorConversao} ${ing.unidadeCompra})` : "Desmembrar / Converter"}</span>
                              </button>

                              {/* TAG / BADGE TRANSPARENTE DE CONVERSÃO */}
                              {ing.isConvertido ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 font-mono">
                                  <Scale className="h-3 w-3 text-indigo-400" />
                                  Convertido: R$ {Number(ing.custoOriginalCompra || 0).toFixed(2)} ÷ {ing.fatorConversao} ({ing.unidadeOriginalCompra || 'FD'} → {ing.unidadeCompra})
                                </span>
                              ) : custoInfo.isDynamic ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                                  <Sparkles className="h-3 w-3" /> {custoInfo.origemNome || 'Planilha'}
                                </span>
                              ) : custoInfo.origemNome && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-medium">
                                  {custoInfo.origemNome}
                                </span>
                              )}

                              {ing.custoManual && (
                                <button
                                  type="button"
                                  onClick={() => handleUsarPrecoVivo(idx)}
                                  className="inline-flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 font-medium hover:bg-amber-500/20"
                                  title="Voltar a puxar o preço da planilha / sub-receita"
                                >
                                  <RotateCcw className="h-3 w-3" /> Manual · usar preço vivo
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1 font-mono text-xs">
                              <span className="text-slate-400">Subtotal:</span>
                              <span className={`font-bold ${custoInfo.custo > 0 ? "text-emerald-400" : "text-slate-500"}`}>
                                R$ {custoInfo.custo.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {custoInfo.alertas.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {custoInfo.alertas.map((a, ai) => (
                                <span key={ai} className="text-[11px] bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded inline-flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> {a}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* GAVETA IN-LINE DE CONVERSÃO / DESMEMBRAMENTO */}
                          {conversaoAbertaIndex === idx && (
                            <div className="mt-2.5 p-3.5 bg-slate-950/95 border border-indigo-500/40 rounded-xl space-y-3 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                                <div className="flex items-center gap-2">
                                  <ArrowLeftRight className="h-4 w-4 text-indigo-400" />
                                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                                    Desmembrar Embalagem (Fardo, Caixa, Galão)
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400">
                                  Custo da Embalagem: <strong className="text-white font-mono">R$ {Number(ing.custoOriginalCompra || parseFloat(ing.custoCompra?.replace(',', '.') || '0') || 0).toFixed(2)}</strong> / {ing.unidadeOriginalCompra || ing.unidadeCompra || 'UN'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[11px] font-medium text-slate-300 block">
                                    Este item / fardo contém:
                                  </label>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0.001"
                                    value={conversaoDraft.fator}
                                    onChange={(e) => setConversaoDraft(prev => ({ ...prev, fator: e.target.value }))}
                                    placeholder="Ex: 30 (para 30kg ou 30 unidades)"
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                                    autoFocus
                                  />
                                  <span className="text-[10px] text-slate-500 block">Ex: Fardo de arroz com 30kg digite 30</span>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] font-medium text-slate-300 block">
                                    Nova Unidade de Consumo:
                                  </label>
                                  <select
                                    value={conversaoDraft.novaUnidade}
                                    onChange={(e) => setConversaoDraft(prev => ({ ...prev, novaUnidade: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-indigo-500"
                                  >
                                    <option value="KG">Quilograma (KG)</option>
                                    <option value="L">Litro (L)</option>
                                    <option value="G">Grama (G)</option>
                                    <option value="ML">Mililitro (ML)</option>
                                    <option value="UN">Unidade (UN)</option>
                                    <option value="DOSE">Dose (DOSE)</option>
                                  </select>
                                  <span className="text-[10px] text-slate-500 block">Unidade usada na receita</span>
                                </div>
                              </div>

                              {/* Preview do cálculo em tempo real */}
                              {parseFloat(conversaoDraft.fator.replace(',', '.')) > 0 && (
                                <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/20 rounded-lg flex items-center justify-between text-xs flex-wrap gap-2">
                                  <span className="text-indigo-200">
                                    Cálculo: R$ {Number(ing.custoOriginalCompra || parseFloat(ing.custoCompra?.replace(',', '.') || '0') || 0).toFixed(2)} ÷ {conversaoDraft.fator}
                                  </span>
                                  <span className="font-mono font-bold text-emerald-400 text-sm">
                                    = R$ {(Number(ing.custoOriginalCompra || parseFloat(ing.custoCompra?.replace(',', '.') || '0') || 0) / parseFloat(conversaoDraft.fator.replace(',', '.'))).toFixed(2)} / {conversaoDraft.novaUnidade}
                                  </span>
                                </div>
                              )}

                              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/60 flex-wrap">
                                {ing.isConvertido && (
                                  <button
                                    type="button"
                                    onClick={() => handleDesfazerConversao(idx)}
                                    className="text-xs text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded border border-amber-500/30 hover:bg-amber-500/10 flex items-center gap-1 transition-colors mr-auto"
                                  >
                                    <RotateCcw className="h-3 w-3" /> Desfazer Desmembramento
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setConversaoAbertaIndex(null)}
                                  className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded transition-colors"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAplicarConversao(idx)}
                                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-1.5 rounded-lg flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-colors"
                                >
                                  <Check className="h-3.5 w-3.5" /> Aplicar Conversão
                                </button>
                              </div>
                            </div>
                          )}
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
              
              <div className="p-4 sm:p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-900 sticky bottom-0 z-10 shrink-0 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-emerald-500/20"
                >
                  Salvar Ficha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA ADICIONAR / EDITAR MATÉRIA-PRIMA */}
      {showMateriaModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-emerald-500" />
                {editingMateriaId ? "Editar Matéria-Prima" : "Nova Matéria-Prima"}
              </h3>
              <button
                type="button"
                onClick={() => setShowMateriaModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMateria} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Nome da Matéria-Prima
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Água, Gelo filtrado, Sal..."
                  value={materiaNome}
                  onChange={(e) => setMateriaNome(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Custo Unitário (R$)
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    required
                    placeholder="0.00"
                    value={materiaCusto}
                    onChange={(e) => setMateriaCusto(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500 text-sm"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">Para água/grátis, use 0</span>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Unidade de Medida
                  </label>
                  <select
                    value={materiaUnidade}
                    onChange={(e) => setMateriaUnidade(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-sm"
                  >
                    <option value="L">Litro (L)</option>
                    <option value="KG">Quilograma (KG)</option>
                    <option value="ML">Mililitro (ML)</option>
                    <option value="G">Grama (G)</option>
                    <option value="UN">Unidade (UN)</option>
                    <option value="CX">Caixa (CX)</option>
                    <option value="DOSE">Dose (DOSE)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowMateriaModal(false)}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMateria}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                >
                  {savingMateria ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
