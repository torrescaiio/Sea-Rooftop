import React, { useState, useEffect } from "react";
import { appAuth } from "../firebase";
import { Lock, UserPlus, ShieldCheck, AlertCircle, Save, User as UserIcon, Database } from "lucide-react";

export default function ConfiguracoesModule({ user }: { user?: any }) {
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [createLoad, setCreateLoad] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [actualPassword, setActualPassword] = useState("");
  const [newTargetPassword, setNewTargetPassword] = useState("");
  const [changePassLoad, setChangePassLoad] = useState(false);
  const [changePassMsg, setChangePassMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [profileName, setProfileName] = useState("");
  const [profileRole, setProfileRole] = useState("");
  const [profileLoad, setProfileLoad] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setProfileName(user.displayName || user.name || "");
      setProfileRole(user.role || "");
    }
  }, [user]);

  const [migrationLoad, setMigrationLoad] = useState(false);
  const [migrationMsg, setMigrationMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    setProfileLoad(true);
    setProfileMsg(null);
    try {
      await appAuth.updateProfile(profileName.trim(), profileRole.trim());
      setProfileMsg({ type: "success", text: "Perfil atualizado com sucesso!" });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setProfileMsg({ type: "error", text: "Erro ao atualizar perfil: " + err.message });
    } finally {
      setProfileLoad(false);
    }
  };

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
      setTimeout(() => {
        window.location.reload();
      }, 1500);
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

  const handleMigrateContacts = async () => {
    if (!window.confirm("Deseja verificar os dados existentes e gerar os contatos automaticamente?")) {
      return;
    }
    setMigrationLoad(true);
    setMigrationMsg(null);
    try {
      // @ts-ignore
      const { appDb } = await import("../firebase");
      
      const extras = await appDb.getAll("extras_semana");
      const eventos = await appDb.getAll("agenda_eventos");
      const contatos = await appDb.getAll("agenda_contatos");

      let addedCount = 0;

      // Migrate Extras
      for (const extra of extras) {
        if (!extra.nome) continue;
        const exists = contatos.some(c => c.nome.toLowerCase() === extra.nome.toLowerCase());
        if (!exists) {
          await appDb.add("agenda_contatos", {
            nome: extra.nome.trim(),
            categoria: "Extras",
            telefone: extra.contato || "",
            detalhes: `Importado de Diárias (Função: ${extra.funcao})`
          });
          contatos.push({ nome: extra.nome.trim() }); // prevent duplicate in same run
          addedCount++;
        }
      }

      // Migrate Eventos
      for (const evento of eventos) {
        if (!evento.artistaNome) continue;
        const exists = contatos.some(c => c.nome.toLowerCase() === evento.artistaNome.toLowerCase());
        if (!exists) {
          await appDb.add("agenda_contatos", {
            nome: evento.artistaNome.trim(),
            categoria: "Músicos",
            telefone: "", // Not available in event
            detalhes: `Importado de Agenda (Chave PIX: ${evento.chavePix || "-"})`
          });
          contatos.push({ nome: evento.artistaNome.trim() });
          addedCount++;
        }
      }

      setMigrationMsg({ type: "success", text: `Migração concluída! ${addedCount} contatos novos gerados.` });
    } catch (err: any) {
      setMigrationMsg({ type: "error", text: "Erro na migração: " + err.message });
    } finally {
      setMigrationLoad(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-slate-100 font-sans tracking-tight">Configurações do Usuário</h1>
        <p className="text-sm font-mono text-slate-400 mt-1">Gerenciamento de perfil e credenciais</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Profile Settings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:col-span-2 lg:col-span-1">
          <div className="flex items-center space-x-3 mb-6 shrink-0">
            <div className="p-2.5 bg-blue-500/10 rounded-xl">
              <UserIcon className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Meu Perfil</h2>
              <p className="text-xs text-slate-400">Informações pessoais e cargo</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4 flex-1 flex flex-col">
            {profileMsg && (
              <div className={`p-3 text-xs rounded-xl flex items-center gap-2 ${profileMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                {profileMsg.type === "success" ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{profileMsg.text}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Ex. João Silva"
                className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                Cargo / Função
              </label>
              <input
                type="text"
                value={profileRole}
                onChange={(e) => setProfileRole(e.target.value)}
                placeholder="Ex. Gerente Geral"
                className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2.5 text-slate-200 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div className="pt-2 mt-auto">
              <button
                type="submit"
                disabled={profileLoad}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-blue-400 font-medium rounded-lg transition border border-slate-700 hover:border-slate-600 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer min-h-[44px]"
              >
                {profileLoad ? "Salvando..." : <><Save className="w-4 h-4"/> Atualizar Perfil</>}
              </button>
            </div>
          </form>
        </div>

        {/* Change password */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:col-span-2 lg:col-span-1">
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

        {/* Create new account */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col md:col-span-2">
          <div className="flex items-center space-x-3 mb-6 shrink-0">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl">
              <UserPlus className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Criar Nova Conta</h2>
              <p className="text-xs text-slate-400">Adicionar novo usuário ao sistema</p>
            </div>
          </div>

          <form onSubmit={handleCreateAccount} className="space-y-4 flex-1 flex flex-col md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {createMsg && (
              <div className={`p-3 text-xs rounded-xl flex items-center gap-2 md:col-span-2 ${createMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
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
            <div className="pt-2 md:col-span-2">
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

      </div>

      {/* Database Operations */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm mt-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2.5 bg-amber-500/10 rounded-xl">
            <Database className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Banco de Dados</h2>
            <p className="text-xs text-slate-400">Ferramentas e migrações de dados</p>
          </div>
        </div>

        {migrationMsg && (
          <div className={`p-3 mb-4 text-xs rounded-xl flex items-center gap-2 ${migrationMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
            {migrationMsg.type === "success" ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{migrationMsg.text}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl gap-4">
          <div>
            <p className="text-sm text-slate-200 font-medium">Sincronizar Contatos</p>
            <p className="text-xs text-slate-400 mt-1">Busca Músicos na Agenda e Extras nas Diárias para cadastrar automaticamente nos Contatos.</p>
          </div>
          <button
            onClick={handleMigrateContacts}
            disabled={migrationLoad}
            className="w-full sm:w-auto shrink-0 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-sm font-medium rounded-lg transition border border-slate-700 hover:border-slate-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {migrationLoad ? "Migrando..." : "Iniciar Sincronização"}
          </button>
        </div>
      </div>
    </div>
  );
}
