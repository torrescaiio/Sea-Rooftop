import React, { useEffect, useState } from "react";
import { appDb } from "../firebase";
import { ChecklistItem, ChecklistCategory } from "../types";
import { 
  CheckSquare, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronLeft, 
  Clock, 
  CheckCircle, 
  X,
  PlusCircle,
  Tag,
  Kanban,
  ListTodo,
  FileDown
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function ChecklistModule() {
  const [tasks, setTasks] = useState<ChecklistItem[]>([]);
  const [dbCategories, setDbCategories] = useState<ChecklistCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [showManageCatModal, setShowManageCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [tarefa, setTarefa] = useState("");
  const [categoria, setCategoria] = useState<ChecklistItem["categoria"]>("");
  const [status, setStatus] = useState<ChecklistItem["status"]>("Pendente");
  const [link, setLink] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [dataLimite, setDataLimite] = useState("");
  const [prioridade, setPrioridade] = useState<ChecklistItem["prioridade"]>("Média");
  const [observacoes, setObservacoes] = useState("");

  // Tab View state: "kanban" (desktop ideal) or "list"
  const [layoutMode, setLayoutMode] = useState<"kanban" | "list">("kanban");
  const [categoryFilter, setCategoryFilter] = useState<string>("todos");

  useEffect(() => {
    const unsubTasks = appDb.subscribe("checklist_gerencial", 
      (data) => {
        setTasks(data as ChecklistItem[]);
        setLoading(false);
      },
      (err) => {
        setError("Erro ao ler checklist: " + err.message);
        setLoading(false);
      }
    );

    const unsubCats = appDb.subscribe("checklist_categorias", 
      (data) => {
        setDbCategories(data as ChecklistCategory[]);
      },
      (err) => {
        console.error("Erro ao ler categorias: ", err);
      }
    );

    return () => {
      unsubTasks();
      unsubCats();
    };
  }, []);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarefa.trim()) return;

    try {
      const data = {
        tarefa: tarefa.trim(),
        categoria,
        status,
        link: link.trim(),
        responsavel: responsavel.trim(),
        dataLimite,
        prioridade,
        observacoes: observacoes.trim()
      };

      await appDb.add("checklist_gerencial", data);
      appDb.dispatchUpdate();
      
      setTarefa("");
      setLink("");
      setResponsavel("");
      setDataLimite("");
      setPrioridade("Média");
      setObservacoes("");
      setShowModal(false);
    } catch (err: any) {
      alert("Erro ao salvar tarefa: " + err.message);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await appDb.delete("checklist_gerencial", id);
      appDb.dispatchUpdate();
    } catch (err: any) {
      alert("Erro ao remover tarefa: " + err.message);
    }
  };

  const handleUpdateStatus = async (id: string, nextStatus: ChecklistItem["status"]) => {
    try {
      await appDb.update("checklist_gerencial", id, { status: nextStatus });
      appDb.dispatchUpdate();
    } catch (err: any) {
      alert("Erro ao mudar status: " + err.message);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await appDb.add("checklist_categorias", { nome: newCatName.trim() });
      appDb.dispatchUpdate();
      setNewCatName("");
    } catch (err: any) {
      alert("Erro ao adicionar categoria: " + err.message);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if(!window.confirm(`Remover a categoria "${name}"? Isso não apagará as tarefas relativas.`)) return;
    try {
      await appDb.delete("checklist_categorias", id);
      appDb.dispatchUpdate();
    } catch (err: any) {
      alert("Erro ao deletar categoria: " + err.message);
    }
  };

  // Categories Color helpers
  const getCategoryColor = (cat: string) => {
    const defaultClasses = ["text-purple-400 bg-purple-500/10 border-purple-500/20", "text-cyan-400 bg-cyan-500/10 border-cyan-500/20", "text-rose-400 bg-rose-500/10 border-rose-500/20", "text-amber-400 bg-amber-500/10 border-amber-500/20", "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"];
    let hash = 0;
    for (let i = 0; i < cat.length; i++) {
        hash = cat.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % defaultClasses.length;
    return defaultClasses[index];
  };

  const categories = dbCategories.map(c => c.nome);

  // Filter tasks by database
  const filteredTasks = tasks.filter(t => categoryFilter === "todos" || t.categoria === categoryFilter);

  // Grouped tasks by status
  const tasksPending = filteredTasks.filter(t => t.status === "Pendente");
  const tasksInProgress = filteredTasks.filter(t => t.status === "Em Andamento");
  const tasksCompleted = filteredTasks.filter(t => t.status === "Concluído");

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.text("Relatório de Checklist", 14, 15);
    
    const tableColumn = ["Tarefa", "Categoria", "Status"];
    const tableRows: any[] = [];
    
    filteredTasks.forEach(task => {
      const taskData = [
        task.tarefa,
        task.categoria,
        task.status
      ];
      tableRows.push(taskData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });
    
    doc.save("checklist-export.pdf");
  };

  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="h-6 w-6 text-cyan-400" />
            Checklist Gerencial
          </h2>
          <p className="text-sm text-slate-400">
            Acompanhe tarefas operacionais de salão, bar, cozinha e recepção para manter o alto nível do Rooftop.
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
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg hover:shadow-cyan-500/10 transition-all cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            Nova Tarefa
          </button>
        </div>
      </div>

      {/* Toolbar / Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-slate-500 uppercase mr-1 flex items-center gap-1">
            <button
              onClick={() => setShowManageCatModal(true)}
              className="p-1 border border-slate-800 bg-slate-900 rounded-md hover:bg-slate-800 text-slate-400 transition cursor-pointer"
              title="Gerenciar Categorias"
            >
              <Tag className="w-3 h-3 text-cyan-500" />
            </button>
            Filtrar Categoria:
          </span>
          <button
            onClick={() => setCategoryFilter("todos")}
            className={`px-3 py-1 text-xs rounded-full border transitions ${
              categoryFilter === "todos"
                ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30 font-semibold"
                : "bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-800"
            }`}
          >
            Todas
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 text-xs rounded-full border transitions ${
                categoryFilter === cat
                  ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30 font-semibold"
                  : "bg-slate-950 text-slate-400 border-slate-850 hover:bg-slate-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Layout Toggler (Kanban vs List) */}
        <div className="flex space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-850">
          <button
            onClick={() => setLayoutMode("kanban")}
            className={`p-1.5 rounded-md flex items-center space-x-1.5 text-xs font-medium cursor-pointer ${
              layoutMode === "kanban" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Visualização Kanban"
          >
            <Kanban className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Quadro Kanban</span>
          </button>
          <button
            onClick={() => setLayoutMode("list")}
            className={`p-1.5 rounded-md flex items-center space-x-1.5 text-xs font-medium cursor-pointer ${
              layoutMode === "list" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-white"
            }`}
            title="Visualização Lista"
          >
            <ListTodo className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Lista Livre</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 rounded-lg text-rose-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 border-t-2 border-r-2 border-cyan-400 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* 1. KANBAN BOARD VIEW STATE */}
          {layoutMode === "kanban" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Columns components helper */}
              {[
                { title: "Pendente", list: tasksPending, next: "Em Andamento" as const, prev: null },
                { title: "Em Andamento", list: tasksInProgress, next: "Concluído" as const, prev: "Pendente" as const },
                { title: "Concluído", list: tasksCompleted, next: null, prev: "Em Andamento" as const }
              ].map((column) => (
                <div key={column.title} className="flex flex-col bg-slate-950/45 rounded-xl border border-slate-850/70 p-4 min-h-[380px]">
                  
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-850/60">
                    <div className="flex items-center space-x-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${
                        column.title === "Pendente" 
                          ? "bg-slate-500" 
                          : column.title === "Em Andamento" 
                          ? "bg-amber-400 animate-pulse" 
                          : "bg-emerald-400"
                      }`} />
                      <h4 className="text-sm font-semibold text-slate-200 tracking-tight">{column.title}</h4>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-900 border border-slate-800/80 p-0.5 px-2 rounded-md">
                      {column.list.length}
                    </span>
                  </div>

                  {/* Tasks Container */}
                  <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px] pr-1">
                    {column.list.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-6 text-center border border-dashed border-slate-850 rounded-lg">
                        <p className="text-xs text-slate-500 italic">Coluna limpa.</p>
                      </div>
                    ) : (
                      column.list.map((task) => (
                        <div 
                          key={task.id} 
                          className="p-4 rounded-lg bg-slate-900 border border-slate-800/80 hover:border-slate-750 transition shadow-xs flex flex-col justify-between space-y-3.5 group relative"
                        >
                          <div className="space-y-2">
                            {/* Badgeline */}
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-semibold border ${getCategoryColor(task.categoria)}`}>
                              {task.categoria}
                            </span>
                            <p className="text-xs leading-relaxed text-slate-100 font-semibold break-words">
                              {task.tarefa}
                            </p>
                            {(task.prioridade || task.dataLimite || task.responsavel) && (
                              <div className="flex flex-wrap gap-2 pt-1 text-[10px] text-slate-400">
                                {task.prioridade && (
                                  <span className={`px-1.5 py-0.5 rounded border ${
                                    task.prioridade === 'Alta' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                    task.prioridade === 'Média' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                    'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                  }`}>
                                    {task.prioridade}
                                  </span>
                                )}
                                {task.dataLimite && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {new Date(task.dataLimite).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                                {task.responsavel && (
                                  <span className="truncate max-w-[100px]" title={task.responsavel}>
                                    👤 {task.responsavel}
                                  </span>
                                )}
                              </div>
                            )}
                            {task.link && (
                              <a href={task.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300 underline block truncate">
                                🔗 {task.link}
                              </a>
                            )}
                            {task.observacoes && (
                              <p className="text-[10px] text-slate-500 italic line-clamp-2" title={task.observacoes}>
                                {task.observacoes}
                              </p>
                            )}
                          </div>

                          {/* Controls bar */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-850/60">
                            {/* Navigation State controls */}
                            <div className="flex space-x-1.5">
                              {column.prev && (
                                <button
                                  onClick={() => handleUpdateStatus(task.id, column.prev!)}
                                  title={`Mover para ${column.prev}`}
                                  className="p-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                  <ChevronLeft className="h-3 w-3" />
                                </button>
                              )}
                              {column.next && (
                                <button
                                  onClick={() => handleUpdateStatus(task.id, column.next!)}
                                  title={`Mover para ${column.next}`}
                                  className="p-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                  <ChevronRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>

                            {/* Trash button */}
                            <button
                              onClick={() => handleDeleteTask(task.id)}
                              title="Remover"
                              className="p-1 border border-slate-850 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 2. REGULAR SELECTABLE LIST VIEW STATE */}
          {layoutMode === "list" && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              {filteredTasks.length === 0 ? (
                <div className="p-12 text-center text-slate-500 italic">
                  Sem tarefas nesta categoria no momento.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/60">
                  {filteredTasks.map((task) => (
                    <div key={task.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:bg-slate-850/15">
                      <div className="flex items-start space-x-3.5">
                        <input
                          type="checkbox"
                          checked={task.status === "Concluído"}
                          onChange={() => handleUpdateStatus(task.id, task.status === "Concluído" ? "Pendente" : "Concluído")}
                          className="mt-1 h-4 w-4 bg-slate-950 border-slate-800 rounded text-cyan-500 focus:ring-0 focus:outline-none cursor-pointer"
                        />
                        <div>
                          <p className={`text-sm text-slate-100 font-medium ${
                            task.status === "Concluído" ? "line-through text-slate-500" : ""
                          }`}>
                            {task.tarefa}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono border ${getCategoryColor(task.categoria)}`}>
                              {task.categoria}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-mono border ${
                              task.status === "Pendente"
                                ? "bg-slate-950 text-slate-500 border-slate-850"
                                : task.status === "Em Andamento"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            }`}>
                              {task.status}
                            </span>
                            {task.prioridade && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-mono border ${
                                task.prioridade === 'Alta' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                task.prioridade === 'Média' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                'bg-slate-500/10 text-slate-400 border-slate-500/20'
                              }`}>
                                {task.prioridade}
                              </span>
                            )}
                            {task.dataLimite && (
                               <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-850">
                                 <Clock className="w-3 h-3" /> {new Date(task.dataLimite).toLocaleDateString('pt-BR')}
                               </span>
                            )}
                            {task.responsavel && (
                               <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-850">
                                 👤 {task.responsavel}
                               </span>
                            )}
                          </div>
                          {(task.link || task.observacoes) && (
                            <div className="mt-2 space-y-1">
                              {task.link && (
                                <a href={task.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-400 hover:text-cyan-300 underline block truncate max-w-xs">
                                  🔗 {task.link}
                                </a>
                              )}
                              {task.observacoes && (
                                <p className="text-[10px] text-slate-500 italic max-w-sm">
                                  {task.observacoes}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
                        <select
                          value={task.status}
                          onChange={(e) => handleUpdateStatus(task.id, e.target.value as any)}
                          className="bg-slate-950 text-slate-300 border border-slate-800 rounded-lg py-1 px-2.5 text-xs focus:ring-0 focus:outline-none focus:border-cyan-500 font-mono"
                        >
                          <option value="Pendente">Pendente</option>
                          <option value="Em Andamento">Em Andamento</option>
                          <option value="Concluído">Concluído</option>
                        </select>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1.5 border border-slate-800 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Manage Categories Overlay Modal */}
      {showManageCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-5 border-b border-slate-800 shrink-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><Tag className="w-5 h-5 text-cyan-400"/> Gerenciar Categorias</h3>
              <button 
                onClick={() => setShowManageCatModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 overflow-y-auto">
              <form onSubmit={handleAddCategory} className="flex space-x-2">
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Nome da categoria..."
                  className="flex-1 bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                />
                <button type="submit" className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg transition border border-slate-700 min-h-[44px]">Adicionar</button>
              </form>

              <div className="mt-6 space-y-2">
                {dbCategories.length === 0 ? (
                  <p className="text-sm text-slate-500 italic text-center py-4">Nenhuma categoria cadastrada.</p>
                ) : (
                  dbCategories.map(cat => (
                    <div key={cat.id} className="flex justify-between items-center p-3 bg-slate-950 border border-slate-850 rounded-lg">
                      <span className="text-sm font-medium text-slate-300">{cat.nome}</span>
                      <button onClick={() => handleDeleteCategory(cat.id, cat.nome)} className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay Slide-over Modal for Adding Checklist items */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-y-auto max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Nova Tarefa Operacional</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddTask} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Descrição da Tarefa
                </label>
                <textarea
                  required
                  value={tarefa}
                  onChange={(e) => setTarefa(e.target.value)}
                  placeholder="Ex: Monitorar temperatura de conservação das garrafas de vinho VIP..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-3 text-slate-200 text-xs leading-relaxed focus:border-cyan-500 focus:outline-none resize-none font-sans"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                    <span>Setor / Categoria</span>
                    <button type="button" onClick={() => setShowManageCatModal(true)} className="text-cyan-400 hover:text-cyan-300 normal-case shrink-0 underline text-[10px] cursor-pointer">Gerenciar</button>
                  </label>
                  <select
                    required
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="" disabled>Selecione uma categoria...</option>
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Status Inicial
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Concluído">Concluído</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Responsável
                  </label>
                  <input
                    type="text"
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                    placeholder="Nome do responsável"
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Data Limite
                  </label>
                  <input
                    type="date"
                    value={dataLimite}
                    onChange={(e) => setDataLimite(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Prioridade
                  </label>
                  <select
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Link de Referência
                  </label>
                  <input
                    type="url"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Observações
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Notas adicionais sobre a tarefa..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-3 text-slate-200 text-xs leading-relaxed focus:border-cyan-500 focus:outline-none resize-none font-sans"
                />
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
                  Adicionar Tarefa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
