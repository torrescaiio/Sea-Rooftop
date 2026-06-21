import React, { useState } from "react";
import { appAuth } from "../firebase";
import { Lock, UserPlus, ShieldCheck, AlertCircle, Save } from "lucide-react";

export default function ConfiguracoesModule() {
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createLoad, setCreateLoad] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [actualPassword, setActualPassword] = useState("");
  const [newTargetPassword, setNewTargetPassword] = useState("");
  const [changePassLoad, setChangePassLoad] = useState(false);
  const [changePassMsg, setChangePassMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword) return;

    if (!window.confirm("Atenção: Ao criar uma nova conta, o sistema conectará automaticamente com a nova credencial. Deseja continuar?")) {
      return;
    }

    setCreateLoad(true);
    setCreateMsg(null);
    try {
      await appAuth.signUp(newEmail.trim(), newPassword);
      setCreateMsg({ type: "success", text: "Conta criada com sucesso! Você foi conectado à nova conta." });
      setNewEmail("");
      setNewPassword("");
    } catch (err: any) {
      setCreateMsg({ type: "error", text: err.message });
    } finally {
      setCreateLoad(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actualPassword || !newTargetPassword) return;

    setChangePassLoad(true);
    setChangePassMsg(null);
    try {
      await appAuth.updatePassword(actualPassword, newTargetPassword);
      setChangePassMsg({ type: "success", text: "Senha atualizada com sucesso!" });
      setActualPassword("");
      setNewTargetPassword("");
    } catch (err: any) {
      setChangePassMsg({ type: "error", text: "Erro ao atualizar senha: " + err.message });
    } finally {
      setChangePassLoad(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 font-sans tracking-tight">Configurações de Acesso</h1>
        <p className="text-sm font-mono text-slate-400 mt-1">Gerenciamento de credenciais operacionais</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create new account */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center space-x-3 mb-6 shrink-0">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <UserPlus className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Criar Nova Conta</h2>
              <p className="text-xs text-slate-400">Adicionar novo usuário operacional</p>
            </div>
          </div>

          <form onSubmit={handleCreateAccount} className="space-y-4 flex-1 flex flex-col">
            {createMsg && (
              <div className={`p-3 text-xs rounded-xl flex items-center gap-2 ${createMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                {createMsg.type === "success" ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{createMsg.text}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="novo@searooftop.com.br"
                className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Senha Provisória
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="pt-2 mt-auto">
              <button
                type="submit"
                disabled={createLoad}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-medium rounded-lg transition border border-slate-700 hover:border-slate-600 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer min-h-[44px]"
              >
                {createLoad ? "Processando..." : "Criar Conta"}
              </button>
            </div>
          </form>
        </div>

        {/* Change password */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center space-x-3 mb-6 shrink-0">
            <div className="p-2.5 bg-cyan-500/10 rounded-xl">
              <Lock className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Alterar Minha Senha</h2>
              <p className="text-xs text-slate-400">Atualizar credencial atual</p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 flex-1 flex flex-col">
            {changePassMsg && (
              <div className={`p-3 text-xs rounded-xl flex items-center gap-2 ${changePassMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                {changePassMsg.type === "success" ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{changePassMsg.text}</span>
              </div>
            )}
            
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800/80">
               <p className="text-xs text-slate-400 leading-relaxed">
                 Para alterar sua senha, você deve fornecer a credencial atual.
               </p>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 mt-2">
                Senha Atual
              </label>
              <input
                type="password"
                required
                value={actualPassword}
                onChange={(e) => setActualPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Nova Senha
              </label>
              <input
                type="password"
                required
                value={newTargetPassword}
                onChange={(e) => setNewTargetPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="pt-2 mt-auto">
              <button
                type="submit"
                disabled={changePassLoad}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium rounded-lg transition border border-slate-700 hover:border-slate-600 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer min-h-[44px]"
              >
                {changePassLoad ? "Processando..." : <><Save className="w-4 h-4"/> Atualizar Senha</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
