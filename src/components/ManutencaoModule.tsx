import React, { useEffect, useState } from "react";
import { appDb } from "../firebase";
import { MaintenanceRepair, MaintenancePurchase } from "../types";
import { 
  Wrench, 
  Trash2, 
  Plus, 
  AlertOctagon, 
  DollarSign, 
  CheckCircle, 
  HelpCircle,
  X,
  PlusCircle,
  Hammer,
  Truck,
  Check
} from "lucide-react";

export default function ManutencaoModule() {
  // Sub-module 5.1 (Repairs)
  const [repairs, setRepairs] = useState<MaintenanceRepair[]>([]);
  // Sub-module 5.2 (Purchases)
  const [purchases, setPurchases] = useState<MaintenancePurchase[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Form Modals states
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  // Repair Form Fields
  const [repairItem, setRepairItem] = useState("");
  const [repairLocal, setRepairLocal] = useState("");
  const [repairPrioridade, setRepairPrioridade] = useState<MaintenanceRepair["prioridade"]>("Média");
  const [repairStatus, setRepairStatus] = useState<MaintenanceRepair["status"]>("Pendente");

  // Purchase Form Fields
  const [purchaseItem, setPurchaseItem] = useState("");
  const [purchaseFornecedor, setPurchaseFornecedor] = useState("");
  const [purchaseValorEstimado, setPurchaseValorEstimado] = useState<number>(150);
  const [purchaseStatus, setPurchaseStatus] = useState<MaintenancePurchase["status"]>("A Orçar");

  // Load datasets
  useEffect(() => {
    let unsubs: (() => void)[] = [];
    
    try {
      const unsubRepairs = appDb.subscribe("manutencao_reparos", (data) => {
        setRepairs(data as MaintenanceRepair[]);
      });
      unsubs.push(unsubRepairs);

      const unsubPurchases = appDb.subscribe("manutencao_compras", (data) => {
        setPurchases(data as MaintenancePurchase[]);
        setLoading(false);
      });
      unsubs.push(unsubPurchases);
    } catch (err: any) {
      setErrorStatus("Erro ao sincronizar manutenção: " + err.message);
      setLoading(false);
    }

    return () => {
      unsubs.forEach(fn => fn());
    };
  }, []);

  // CRUD Repairs (5.1)
  const handleAddRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repairItem.trim() || !repairLocal.trim()) {
      alert("Por favor preencha o item e o local do reparo.");
      return;
    }

    try {
      const data = {
        item: repairItem.trim(),
        local: repairLocal.trim(),
        prioridade: repairPrioridade,
        status: repairStatus
      };

      await appDb.add("manutencao_reparos", data);
      appDb.dispatchUpdate();

      setRepairItem("");
      setRepairLocal("");
      setShowRepairModal(false);
    } catch (err: any) {
      alert("Erro ao salvar reparo: " + err.message);
    }
  };

  const handleDeleteRepair = async (id: string) => {
    try {
      await appDb.delete("manutencao_reparos", id);
      appDb.dispatchUpdate();
    } catch (err: any) {
      alert("Erro ao remover: " + err.message);
    }
  };

  const handleUpdateRepairStatus = async (id: string, next: MaintenanceRepair["status"]) => {
    try {
      await appDb.update("manutencao_reparos", id, { status: next });
      appDb.dispatchUpdate();
    } catch (err: any) {
      alert("Erro ao mudar status: " + err.message);
    }
  };

  // CRUD Purchases (5.2)
  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseItem.trim() || !purchaseFornecedor.trim()) {
      alert("Por favor preencha o item e o fornecedor.");
      return;
    }

    try {
      const data = {
        item: purchaseItem.trim(),
        fornecedor: purchaseFornecedor.trim(),
        valorEstimado: Number(purchaseValorEstimado),
        status: purchaseStatus
      };

      await appDb.add("manutencao_compras", data);
      appDb.dispatchUpdate();

      setPurchaseItem("");
      setPurchaseFornecedor("");
      setPurchaseValorEstimado(150);
      setShowPurchaseModal(false);
    } catch (err: any) {
      alert("Erro ao salvar compra: " + err.message);
    }
  };

  const handleDeletePurchase = async (id: string) => {
    try {
      await appDb.delete("manutencao_compras", id);
      appDb.dispatchUpdate();
    } catch (err: any) {
      alert("Erro ao remover: " + err.message);
    }
  };

  const handleUpdatePurchaseStatus = async (id: string, next: MaintenancePurchase["status"]) => {
    try {
      await appDb.update("manutencao_compras", id, { status: next });
      appDb.dispatchUpdate();
    } catch (err: any) {
      alert("Erro ao mudar status: " + err.message);
    }
  };

  // Auxiliary metrics
  const totalRepairsActive = repairs.filter(r => r.status !== "Resolvido").length;
  const totalPurchaseEstimates = purchases
    .filter(p => p.status !== "Comprado")
    .reduce((sum, p) => sum + p.valorEstimado, 0);

  const getPriorityColor = (prio: MaintenanceRepair["prioridade"]) => {
    switch (prio) {
      case "Urgente": return "text-rose-400 bg-rose-500/10 border-rose-500/25";
      case "Média": return "text-amber-400 bg-amber-500/10 border-amber-500/25";
      default: return "text-slate-400 bg-slate-500/10 border-slate-505/25";
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Module Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Wrench className="h-6 w-6 text-cyan-400" />
            Manutenção & Facilities
          </h2>
          <p className="text-sm text-slate-400">
            Controle de forma ágil pequenas reformas estruturais secundárias e compras físicas de facilities.
          </p>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400">Reformas & Consertos Pendentes</p>
            <p className="text-3xl font-extrabold font-mono text-rose-400">{totalRepairsActive}</p>
          </div>
          <div className="p-3 bg-rose-500/10 rounded-xl text-rose-400 border border-rose-500/15">
            <Hammer className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-slate-400 font-medium">Orçamento de Facilities Aberto</p>
            <p className="text-3xl font-extrabold font-mono text-emerald-400">
              R$ {totalPurchaseEstimates.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/15">
            <DollarSign className="h-5 w-5" />
          </div>
        </div>
      </div>

      {errorStatus && (
        <div className="p-4 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-sm rounded-lg">
          {errorStatus}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="h-8 w-8 border-t-2 border-r-2 border-cyan-400 rounded-full animate-spin" />
        </div>
      ) : (
        /* Left and Right columns divided layout */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* SUB-MODULE 5.1: REPAIRS */}
          <div className="space-y-4 bg-slate-900/40 p-5 rounded-2xl border border-slate-850">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <Hammer className="h-4 w-4 text-cyan-400" />
                <h3 className="text-base font-bold text-slate-200">5.1 - Lista de Reparos e Consertos</h3>
              </div>
              <button
                onClick={() => setShowRepairModal(true)}
                className="p-1 px-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:text-cyan-400 text-slate-300 font-semibold text-xs transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {repairs.length === 0 ? (
                <p className="text-xs text-slate-505 text-center py-8 italic">Nenhum reparo ativo necessário.</p>
              ) : (
                repairs.map(rep => (
                  <div key={rep.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 flex justify-between items-center gap-4 hover:border-slate-750 transition">
                    <div className="space-y-1.5 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate font-mono">{rep.item}</h4>
                      <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 items-center">
                        <span className="font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-850">Local: {rep.local}</span>
                        <span className={`px-2 py-0.5 rounded font-bold border uppercase ${getPriorityColor(rep.prioridade)}`}>
                          {rep.prioridade}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <select
                        value={rep.status}
                        onChange={(e) => handleUpdateRepairStatus(rep.id, e.target.value as any)}
                        className={`py-1 px-2.5 rounded-lg text-xs font-semibold uppercase leading-tight bg-slate-950 font-mono border ${
                          rep.status === "Resolvido"
                            ? "text-emerald-400 border-emerald-500/20"
                            : rep.status === "Em Andamento"
                            ? "text-amber-400 border-amber-500/20"
                            : "text-slate-400 border-slate-800"
                        }`}
                      >
                        <option value="Pendente">Pendente</option>
                        <option value="Em Andamento">Em Andamento</option>
                        <option value="Resolvido">Resolvido</option>
                      </select>
                      <button
                        onClick={() => handleDeleteRepair(rep.id)}
                        className="p-1.5 border border-slate-850 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SUB-MODULE 5.2: PURCHASES */}
          <div className="space-y-4 bg-slate-900/40 p-5 rounded-2xl border border-slate-850">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <Truck className="h-4 w-4 text-emerald-400" />
                <h3 className="text-base font-bold text-slate-200">5.2 - Compras de Facilities</h3>
              </div>
              <button
                onClick={() => setShowPurchaseModal(true)}
                className="p-1 px-2.5 rounded-lg bg-slate-950 border border-slate-800 hover:text-emerald-400 text-slate-300 font-semibold text-xs transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {purchases.length === 0 ? (
                <p className="text-xs text-slate-505 text-center py-8 italic">Nenhuma compra pendente de compras de manutenção.</p>
              ) : (
                purchases.map(pur => (
                  <div key={pur.id} className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 flex justify-between items-center gap-4 hover:border-slate-750 transition">
                    <div className="space-y-1.5 min-w-0">
                      <h4 className="text-sm font-semibold text-white truncate font-mono">{pur.item}</h4>
                      <div className="flex flex-wrap gap-2 text-[10px] text-slate-400 items-center">
                        <span className="font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-850">Fornecedor: {pur.fornecedor}</span>
                        <span className="font-bold text-emerald-400 font-mono">
                          R$ {pur.valorEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <select
                        value={pur.status}
                        onChange={(e) => handleUpdatePurchaseStatus(pur.id, e.target.value as any)}
                        className={`py-1 px-2.5 rounded-lg text-xs font-semibold uppercase leading-tight bg-slate-950 font-mono border ${
                          pur.status === "Comprado"
                            ? "text-emerald-400 border-emerald-500/20"
                            : pur.status === "Aprovado"
                            ? "text-cyan-400 border-cyan-500/20"
                            : "text-slate-400 border-slate-800"
                        }`}
                      >
                        <option value="A Orçar">A Orçar</option>
                        <option value="Aprovado">Aprovado</option>
                        <option value="Comprado">Comprado</option>
                      </select>
                      <button
                        onClick={() => handleDeletePurchase(pur.id)}
                        className="p-1.5 border border-slate-850 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* Modal Sub-Module 5.1 Repair ADD */}
      {showRepairModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Novo Reparo Estrutural</h3>
              <button 
                onClick={() => setShowRepairModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddRepair} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Item a Reparar
                </label>
                <input
                  type="text"
                  required
                  value={repairItem}
                  onChange={(e) => setRepairItem(e.target.value)}
                  placeholder="Ex: Trocar lâmpada spot dicroica"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Localização / Área
                </label>
                <input
                  type="text"
                  required
                  value={repairLocal}
                  onChange={(e) => setRepairLocal(e.target.value)}
                  placeholder="Ex: Banheiro Feminino, Estação do Bar"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Prioridade
                  </label>
                  <select
                    value={repairPrioridade}
                    onChange={(e) => setRepairPrioridade(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média (Padrão)</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Status Inicial
                  </label>
                  <select
                    value={repairStatus}
                    onChange={(e) => setRepairStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Resolvido">Resolvido</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRepairModal(false)}
                  className="px-4 py-2 border border-slate-800 text-slate-400 hover:text-white rounded-lg text-sm font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg text-sm font-medium shadow-md transition cursor-pointer"
                >
                  Gravar Conserte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Sub-Module 5.2 Purchase ADD */}
      {showPurchaseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">Nova Compra de Instalação / Ins</h3>
              <button 
                onClick={() => setShowPurchaseModal(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddPurchase} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Item / Equipamento
                </label>
                <input
                  type="text"
                  required
                  value={purchaseItem}
                  onChange={(e) => setPurchaseItem(e.target.value)}
                  placeholder="Ex: Aquecedor para deck externo"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Fornecedor Indicado / Preferencial
                </label>
                <input
                  type="text"
                  required
                  value={purchaseFornecedor}
                  onChange={(e) => setPurchaseFornecedor(e.target.value)}
                  placeholder="Ex: Heating & Gas Ltda"
                  className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Valor Estimado (R$)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={purchaseValorEstimado}
                    onChange={(e) => setPurchaseValorEstimado(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Fase da Compra
                  </label>
                  <select
                    value={purchaseStatus}
                    onChange={(e) => setPurchaseStatus(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="A Orçar">A Orçar</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Comprado">Comprado</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPurchaseModal(false)}
                  className="px-4 py-2 border border-slate-850 text-slate-400 hover:text-white rounded-lg text-sm font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium shadow-md transition cursor-pointer"
                >
                  Registrar Orçamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
