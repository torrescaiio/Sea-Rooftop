import React, { useEffect, useState } from "react";
import { appDb } from "../firebase";
import { Contact } from "../types";
import { BookOpen, Plus, Search, Trash2, Edit2, Phone, Briefcase, Hash, User, Building } from "lucide-react";

export default function ContatosModule() {
  const [contatos, setContatos] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);

  // Form State
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<Contact["categoria"]>("Extras");
  const [telefone, setTelefone] = useState("");
  const [detalhes, setDetalhes] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [catFilter, setCatFilter] = useState<string>("todos");

  useEffect(() => {
    const unsubscribe = appDb.subscribe("contatos", (data) => {
      setContatos(data as Contact[]);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !telefone.trim()) {
      alert("Nome e telefone/ramal são obrigatórios.");
      return;
    }

    try {
      const data: any = {
        nome: nome.trim(),
        categoria,
        telefone: telefone.trim(),
      };
      
      if (detalhes.trim()) {
        data.detalhes = detalhes.trim();
      } else {
        data.detalhes = null;
      }

      if (editItemId) {
        await appDb.update("contatos", editItemId, data);
      } else {
        await appDb.add("contatos", data);
      }

      appDb.dispatchUpdate();
      closeForm();
    } catch (err: any) {
      alert("Erro ao salvar contato: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Deseja deletar este contato permanentemente?")) {
      try {
        await appDb.delete("contatos", id);
        appDb.dispatchUpdate();
      } catch (err: any) {
        alert("Erro ao excluir: " + err.message);
      }
    }
  };

  const openForm = (item?: Contact) => {
    if (item) {
      setEditItemId(item.id);
      setNome(item.nome);
      setCategoria(item.categoria);
      setTelefone(item.telefone);
      setDetalhes(item.detalhes || "");
    } else {
      setEditItemId(null);
      setNome("");
      setCategoria("Extras");
      setTelefone("");
      setDetalhes("");
    }
    setShowModal(true);
  };

  const closeForm = () => {
    setEditItemId(null);
    setNome("");
    setCategoria("Extras");
    setTelefone("");
    setDetalhes("");
    setShowModal(false);
  };

  const getCategoryColor = (cat: Contact["categoria"]) => {
    switch (cat) {
      case "Músicos": return "text-purple-400 bg-purple-500/10 border-purple-500/20";
      case "Extras": return "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
      case "Prestador de Serviços": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
      case "Hotel": return "text-rose-400 bg-rose-500/10 border-rose-500/20";
      case "Outros": return "text-slate-300 bg-slate-500/10 border-slate-500/20";
      default: return "text-slate-400 border-slate-800";
    }
  };

  const getCategoryIcon = (cat: Contact["categoria"]) => {
    switch (cat) {
      case "Músicos": return <User className="h-4 w-4" />;
      case "Extras": return <User className="h-4 w-4" />;
      case "Prestador de Serviços": return <Briefcase className="h-4 w-4" />;
      case "Hotel": return <Building className="h-4 w-4" />;
      case "Outros": return <Hash className="h-4 w-4" />;
      default: return <User className="h-4 w-4" />;
    }
  };

  const filteredContatos = contatos.filter((c) => {
    const matchCat = catFilter === "todos" || c.categoria === catFilter;
    const matchSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (c.detalhes && c.detalhes.toLowerCase().includes(searchTerm.toLowerCase())) ||
                        c.telefone.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 rounded-xl border border-cyan-500/30 text-cyan-400">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">Agenda de Contatos</h1>
              <p className="text-sm font-mono text-slate-400 mt-1">Diretório Operacional • Músicos, Serviços e Hotel</p>
            </div>
          </div>
          
          <button
            onClick={() => openForm()}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg hover:shadow-cyan-500/10 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Novo Contato
          </button>
        </div>

        {/* Filters */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou detalhe..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-lg pl-9 py-2 pr-4 text-slate-300 text-sm focus:border-cyan-500 focus:outline-none"
            />
          </div>
          <div>
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-lg py-2 px-3 text-slate-300 text-sm focus:border-cyan-500 focus:outline-none"
            >
              <option value="todos">Todas as Categorias</option>
              <option value="Músicos">Músicos</option>
              <option value="Extras">Extras</option>
              <option value="Prestador de Serviços">Prestador de Serviços</option>
              <option value="Hotel">Ramais do Hotel</option>
              <option value="Outros">Outros</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 font-mono text-sm animate-pulse">
          Carregando contatos...
        </div>
      ) : filteredContatos.length === 0 ? (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl">
          <BookOpen className="h-10 w-10 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Nenhum contato encontrado.</p>
          <p className="text-sm text-slate-500 font-mono mt-1">Sua busca não retornou resultados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredContatos.map((contato) => (
            <div key={contato.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition duration-150">
              <div className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-xl flex items-center justify-center border ${getCategoryColor(contato.categoria)}`}>
                      {getCategoryIcon(contato.categoria)}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-200 truncate pr-2 max-w-[200px]" title={contato.nome}>
                        {contato.nome}
                      </h3>
                      <span className={`text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded border ${getCategoryColor(contato.categoria)}`}>
                        {contato.categoria}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => openForm(contato)}
                      className="p-1.5 text-slate-500 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition"
                      title="Editar Contato"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(contato.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                      title="Excluir Contato"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 mt-auto">
                  <div className="flex items-center space-x-2 text-sm text-slate-300">
                    <Phone className="h-4 w-4 text-slate-500 shrink-0" />
                    <a href={`tel:${contato.telefone.replace(/\D/g,'')}`} className="hover:text-cyan-400 transition hover:underline">
                      {contato.telefone}
                    </a>
                  </div>

                  {contato.detalhes && (
                    <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
                      <p className="text-xs text-slate-400 leading-relaxed font-mono whitespace-pre-wrap">
                        {contato.detalhes}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-y-auto max-h-[90vh] pb-8 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {editItemId ? 'Editar Contato' : 'Adicionar Novo Contato'}
              </h3>
              <button 
                onClick={closeForm}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Nome do Contato
                </label>
                <input
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do profissional, empresa ou ramal..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Categoria
                </label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value as Contact["categoria"])}
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                >
                  <option value="Músicos">🎶 Músicos & Atrações</option>
                  <option value="Extras">👤 Staff Extras</option>
                  <option value="Prestador de Serviços">🛠️ Prestadores de Serviço</option>
                  <option value="Hotel">🏨 Ramais do Hotel</option>
                  <option value="Outros">🏷️ Outros (Diversos)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Telefone / Ramal
                </label>
                <input
                  type="text"
                  required
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 99999-9999 ou Ramal 401"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Detalhes Adicionais (Especialidade, PIX, etc.)
                </label>
                <textarea
                  value={detalhes}
                  onChange={(e) => setDetalhes(e.target.value)}
                  rows={3}
                  placeholder="Informações adicionais como Chave PIX, e-mail, especialidade (ex: Saxofonista, Conserto de Geladeira)..."
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeForm}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition shadow-lg shadow-cyan-500/20"
                >
                  Salvar Contato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
