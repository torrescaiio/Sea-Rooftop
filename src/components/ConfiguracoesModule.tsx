import React, { useState, useEffect } from "react";
import { appAuth, appDb } from "../firebase";
import { useAuth, UserRole } from "../context/AuthContext";
import { 
  Lock, UserPlus, ShieldCheck, AlertCircle, Save, User as UserIcon, 
  Database, CheckSquare, Shield, ChefHat, Wine, Trash2, Edit3, X, Check, RefreshCw
} from "lucide-react";
import { MENU_ITEMS } from "./Sidebar";

interface ConfiguracoesModuleProps {
  user?: any;
}

export default function ConfiguracoesModule({ user: propUser }: ConfiguracoesModuleProps) {
  const { user: authUser, role, isAdmin } = useAuth();
  const currentUser = authUser || propUser;

  // Apenas a gerência pode criar usuários e gerenciar permissões
  const isManager = isAdmin || role === "admin" || currentUser?.role === "admin" || currentUser?.email?.toLowerCase() === "caiot360@gmail.com";

  // Estado do formulário de criação de novo usuário
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("chef_cozinha");
  const [newSetor, setNewSetor] = useState<"cozinha" | "bar" | "geral">("cozinha");
  const [selectedModules, setSelectedModules] = useState<string[]>([
    "gestao_compras", "fichas_tecnicas", "checklist"
  ]);
  const [createLoad, setCreateLoad] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Alteração de senha do usuário atual
  const [actualPassword, setActualPassword] = useState("");
  const [newTargetPassword, setNewTargetPassword] = useState("");
  const [changePassLoad, setChangePassLoad] = useState(false);
  const [changePassMsg, setChangePassMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Perfil do usuário atual
  const [profileName, setProfileName] = useState("");
  const [profileRole, setProfileRole] = useState("");
  const [profileLoad, setProfileLoad] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Listagem de usuários cadastrados
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoad, setUsersLoad] = useState(true);

  // Modal para editar permissões/cargo de um usuário existente
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editRole, setEditRole] = useState<UserRole>("chef_cozinha");
  const [editSetor, setEditSetor] = useState<"cozinha" | "bar" | "geral">("cozinha");
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editLoad, setEditLoad] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Sincroniza dados do usuário logado
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.displayName || currentUser.name || "");
      setProfileRole(currentUser.role || "");
    }
  }, [currentUser]);

  // Carrega lista de usuários do Firestore
  const fetchUsers = async () => {
    setUsersLoad(true);
    try {
      const roles = await appDb.getAll("user_roles");
      setUsersList(roles);
    } catch (err) {
      console.error("Erro ao carregar lista de usuários:", err);
    } finally {
      setUsersLoad(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Atualiza módulos sugeridos quando o cargo selecionado muda no cadastro
  const handleRoleChange = (roleChoice: UserRole) => {
    setNewRole(roleChoice);
    if (roleChoice === "admin") {
      setNewSetor("geral");
      setSelectedModules(MENU_ITEMS.map(m => m.id));
    } else if (roleChoice === "chef_cozinha") {
      setNewSetor("cozinha");
      setSelectedModules(["gestao_compras", "fichas_tecnicas", "checklist"]);
    } else if (roleChoice === "chef_bar") {
      setNewSetor("bar");
      setSelectedModules(["gestao_compras", "fichas_tecnicas", "vinhos", "checklist"]);
    }
  };

  // Presets rápidos de permissão
  const handleApplyPreset = (preset: "todos" | "nenhum" | "padrao") => {
    if (preset === "todos") {
      setSelectedModules(MENU_ITEMS.map(m => m.id));
    } else if (preset === "nenhum") {
      setSelectedModules([]);
    } else {
      if (newRole === "admin") setSelectedModules(MENU_ITEMS.map(m => m.id));
      else if (newRole === "chef_cozinha") setSelectedModules(["gestao_compras", "fichas_tecnicas", "checklist"]);
      else setSelectedModules(["gestao_compras", "fichas_tecnicas", "vinhos", "checklist"]);
    }
  };

  // Atualiza o perfil pessoal do usuário logado
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) return;

    setProfileLoad(true);
    setProfileMsg(null);
    try {
      await appAuth.updateProfile(profileName.trim(), profileRole.trim());
      setProfileMsg({ type: "success", text: "Perfil atualizado com sucesso!" });
    } catch (err: any) {
      setProfileMsg({ type: "error", text: "Erro ao atualizar perfil: " + err.message });
    } finally {
      setProfileLoad(false);
    }
  };

  // CRIAÇÃO DE CONTA SEM DESLOGAR O ADMINISTRADOR
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) {
      alert("Apenas a gerência possui autorização para criar usuários.");
      return;
    }

    if (!newEmail.trim() || !newPassword) {
      setCreateMsg({ type: "error", text: "Preencha o e-mail e a senha provisória." });
      return;
    }

    if (newPassword.length < 6) {
      setCreateMsg({ type: "error", text: "A senha provisória deve ter no mínimo 6 caracteres." });
      return;
    }

    setCreateLoad(true);
    setCreateMsg(null);
    try {
      // Cria a conta no Firebase Auth sem alterar a sessão atual do administrador
      const newCred = await appAuth.createUserWithoutSwitchingSession(
        newEmail.trim(), 
        newPassword, 
        newDisplayName.trim() || newEmail.split("@")[0]
      );

      // Salva os dados de cargo e módulos na coleção 'user_roles' no Firestore
      await appDb.set("user_roles", newCred.uid, {
        email: newEmail.trim(),
        displayName: newDisplayName.trim() || newEmail.split("@")[0],
        role: newRole,
        setor: newSetor,
        allowedModules: selectedModules,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.email || "gerente"
      });

      setCreateMsg({ 
        type: "success", 
        text: `Usuário ${newEmail} cadastrado com sucesso com cargo ${newRole === 'admin' ? 'Gerente' : newRole === 'chef_cozinha' ? 'Chef de Cozinha' : 'Chef de Bar'}! Sua sessão de Gerente continua ativa.` 
      });

      // Limpa os campos do formulário
      setNewDisplayName("");
      setNewEmail("");
      setNewPassword("");
      handleRoleChange("chef_cozinha");

      // Atualiza a tabela imediatamente
      fetchUsers();
    } catch (err: any) {
      setCreateMsg({ type: "error", text: "Erro ao criar conta: " + err.message });
    } finally {
      setCreateLoad(false);
    }
  };

  // Alterar a própria senha
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actualPassword || !newTargetPassword) return;

    if (newTargetPassword.length < 6) {
      setChangePassMsg({ type: "error", text: "A nova senha deve ter pelo menos 6 caracteres." });
      return;
    }

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

  // Abrir modal de edição de usuário existente
  const handleOpenEditUser = (userDoc: any) => {
    setEditingUser(userDoc);
    setEditRole(userDoc.role || "chef_cozinha");
    setEditSetor(userDoc.setor || (userDoc.role === "chef_cozinha" ? "cozinha" : userDoc.role === "chef_bar" ? "bar" : "geral"));
    setEditModules(
      Array.isArray(userDoc.allowedModules) 
        ? userDoc.allowedModules 
        : userDoc.allowedModules === "ALL" 
        ? MENU_ITEMS.map(m => m.id) 
        : ["gestao_compras", "fichas_tecnicas"]
    );
    setEditMsg(null);
  };

  // Salvar alterações de cargo e permissões do usuário
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setEditLoad(true);
    setEditMsg(null);
    try {
      await appDb.update("user_roles", editingUser.id || editingUser.uid, {
        role: editRole,
        setor: editSetor,
        allowedModules: editModules,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser?.email || "gerente"
      });

      setEditMsg({ type: "success", text: "Permissões e cargo atualizados com sucesso!" });
      setTimeout(() => {
        setEditingUser(null);
        fetchUsers();
      }, 1000);
    } catch (err: any) {
      setEditMsg({ type: "error", text: "Erro ao atualizar: " + err.message });
    } finally {
      setEditLoad(false);
    }
  };

  // Excluir usuário do cadastro
  const handleDeleteUser = async (userDoc: any) => {
    if (!window.confirm(`Deseja realmente remover as permissões do usuário ${userDoc.email}?`)) {
      return;
    }

    try {
      await appDb.delete("user_roles", userDoc.id || userDoc.uid);
      fetchUsers();
    } catch (err: any) {
      alert("Erro ao excluir usuário: " + err.message);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto font-sans pb-12">
      
      {/* HEADER PRINCIPAL */}
      <header className="border-b border-slate-800 pb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Configurações & Gestão de Acessos
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Gerenciamento de perfil, senhas e controle de permissões por cargo (RBAC)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wider flex items-center gap-1.5 ${
              isManager 
                ? "bg-purple-500/10 text-purple-400 border-purple-500/30" 
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            }`}>
              {isManager ? <Shield className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
              {isManager ? "Acesso Gerencial Autorizado" : "Acesso de Colaborador"}
            </span>
          </div>
        </div>
      </header>

      {/* SEÇÃO 1: PERFIL PESSOAL & ALTERAÇÃO DE SENHA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Meu Perfil */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-5">
              <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                <UserIcon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Meu Perfil</h2>
                <p className="text-xs text-slate-400">Dados da sua conta conectada</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {profileMsg && (
                <div className={`p-3 text-xs rounded-xl flex items-center gap-2 ${profileMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                  {profileMsg.type === "success" ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{profileMsg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  E-mail Conectado
                </label>
                <input
                  type="text"
                  disabled
                  value={currentUser?.email || ""}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-lg p-2.5 text-slate-400 text-sm cursor-not-allowed font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Nome de Exibição
                </label>
                <input
                  type="text"
                  required
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="Ex. Caio Gerência"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={profileLoad}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium rounded-lg transition border border-slate-700 hover:border-slate-600 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer min-h-[44px]"
                >
                  {profileLoad ? "Salvando..." : <><Save className="w-4 h-4"/> Atualizar Nome</>}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Alterar Minha Senha */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-5">
              <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-400">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Alterar Minha Senha</h2>
                <p className="text-xs text-slate-400">Atualizar sua credencial de acesso</p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              {changePassMsg && (
                <div className={`p-3 text-xs rounded-xl flex items-center gap-2 ${changePassMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                  {changePassMsg.type === "success" ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{changePassMsg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Senha Atual
                </label>
                <input
                  type="password"
                  required
                  value={actualPassword}
                  onChange={(e) => setActualPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Nova Senha (Mín. 6 dígitos)
                </label>
                <input
                  type="password"
                  required
                  value={newTargetPassword}
                  onChange={(e) => setNewTargetPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none min-h-[44px]"
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={changePassLoad}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-medium rounded-lg transition border border-slate-700 hover:border-slate-600 disabled:opacity-50 flex justify-center items-center gap-2 cursor-pointer min-h-[44px]"
                >
                  {changePassLoad ? "Processando..." : <><Save className="w-4 h-4"/> Confirmar Nova Senha</>}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* SEÇÃO 2: GESTÃO DE USUÁRIOS & PERMISSÕES (EXCLUSIVA PARA GERÊNCIA)        */}
      {/* ========================================================================= */}
      {!isManager ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
          <Shield className="h-10 w-10 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">Gestão de Usuários e Permissões</h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            Apenas o usuário da <strong>Gerência Geral (Admin)</strong> possui autorização para cadastrar novos colaboradores, definir cargos operacionais e configurar permissões de acesso aos módulos.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* CARD DE CRIAR NOVO USUÁRIO */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl space-y-6">
            
            <div className="flex items-center space-x-3 border-b border-slate-800 pb-4">
              <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Cadastrar Novo Usuário & Definir Cargo</h2>
                <p className="text-xs text-slate-400">
                  Crie credenciais e determine o cargo e módulos acessíveis sem desconectar sua sessão de Gerente
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-6">
              
              {createMsg && (
                <div className={`p-4 text-xs rounded-xl flex items-center gap-3 ${
                  createMsg.type === "success" 
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30" 
                    : "bg-rose-500/10 text-rose-300 border border-rose-500/30"
                }`}>
                  {createMsg.type === "success" ? <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" /> : <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />}
                  <span>{createMsg.text}</span>
                </div>
              )}

              {/* Linha 1: Nome, E-mail e Senha */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    Nome do Colaborador
                  </label>
                  <input
                    type="text"
                    required
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                    placeholder="Ex: Chef Rodrigo"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                    E-mail de Login
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="cozinha@searooftop.com.br"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none min-h-[44px]"
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none min-h-[44px]"
                  />
                </div>
              </div>

              {/* Linha 2: Cargo Operacional (RBAC) */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-300 mb-2 font-bold">
                  Cargo Operacional (Role no Sistema):
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* Option: Chef Cozinha */}
                  <div 
                    onClick={() => handleRoleChange("chef_cozinha")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      newRole === "chef_cozinha"
                        ? "bg-emerald-500/10 border-emerald-500 text-white shadow-md shadow-emerald-500/10"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                      <ChefHat className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Chef de Cozinha</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Setor: Cozinha. Acesso direto ao módulo de Requisição de Compras e Fichas Técnicas.
                      </p>
                    </div>
                  </div>

                  {/* Option: Chef Bar */}
                  <div 
                    onClick={() => handleRoleChange("chef_bar")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      newRole === "chef_bar"
                        ? "bg-cyan-500/10 border-cyan-500 text-white shadow-md shadow-cyan-500/10"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
                      <Wine className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Chef de Bar</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Setor: Bar. Acesso direto a Requisições de Bar, Carta de Vinhos e Fichas.
                      </p>
                    </div>
                  </div>

                  {/* Option: Admin / Gerente */}
                  <div 
                    onClick={() => handleRoleChange("admin")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                      newRole === "admin"
                        ? "bg-purple-500/10 border-purple-500 text-white shadow-md shadow-purple-500/10"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 shrink-0">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Gerente Geral (Admin)</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Acesso irrestrito a todos os módulos, aprovação de compras e corte de excessos.
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Linha 3: Permissões de Acesso (Módulos do Menu) */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-300 font-bold">
                    Permissões de Acesso aos Módulos ({selectedModules.length} selecionados):
                  </label>

                  {/* Presets Rápidos */}
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500 text-[11px]">Presets:</span>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset("padrao")}
                      className="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 hover:bg-slate-700 text-[11px]"
                    >
                      Padrão do Cargo
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset("todos")}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px]"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset("nenhum")}
                      className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 hover:bg-slate-700 text-[11px]"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 bg-slate-950 border border-slate-800 rounded-xl p-4 max-h-[260px] overflow-y-auto">
                  {MENU_ITEMS.map(module => {
                    const isChecked = selectedModules.includes(module.id);
                    return (
                      <label 
                        key={module.id} 
                        className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer transition-colors ${
                          isChecked ? "bg-slate-900 border border-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <div className="relative flex items-center justify-center shrink-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedModules([...selectedModules, module.id]);
                              } else {
                                setSelectedModules(selectedModules.filter(m => m !== module.id));
                              }
                            }}
                            className="peer appearance-none w-5 h-5 rounded-md border border-slate-700 bg-slate-900 checked:bg-cyan-500 checked:border-cyan-500 transition-colors"
                          />
                          <CheckSquare className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                        </div>
                        <div className="flex items-center space-x-2 text-xs font-medium truncate">
                          <module.icon className={`h-4 w-4 shrink-0 ${isChecked ? "text-cyan-400" : "text-slate-500"}`} />
                          <span className="truncate">{module.name}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Botão de Criação */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={createLoad}
                  className="w-full sm:w-auto min-h-[44px] px-8 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {createLoad ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" /> Cadastrando no Firebase...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" /> Cadastrar Usuário com Cargo Selecionado
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

          {/* TABELA DE USUÁRIOS CADASTRADOS & GESTÃO DE ROLES */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">Usuários Cadastrados & Perfis RBAC</h2>
                  <p className="text-xs text-slate-400">Lista completa com cargos e módulos liberados</p>
                </div>
              </div>

              <button
                type="button"
                onClick={fetchUsers}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors min-h-[36px]"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${usersLoad ? 'animate-spin' : ''}`} /> Atualizar Lista
              </button>
            </div>

            {usersLoad ? (
              <div className="text-center py-8 text-slate-500">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-400 mx-auto mb-2" />
                <p className="text-xs">Carregando usuários do Firestore...</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Colaborador / E-mail</th>
                      <th className="py-3 px-4">Cargo (Role)</th>
                      <th className="py-3 px-4">Setor</th>
                      <th className="py-3 px-4">Módulos Liberados</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {usersList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 px-4 text-slate-500 text-center">
                          Nenhum usuário cadastrado no banco de permissões.
                        </td>
                      </tr>
                    ) : (
                      usersList.map((u, i) => {
                        const userRole = u.role || (u.email?.includes("cozinha") ? "chef_cozinha" : u.email?.includes("bar") ? "chef_bar" : "admin");
                        const userSetor = u.setor || (userRole === "chef_cozinha" ? "cozinha" : userRole === "chef_bar" ? "bar" : "geral");
                        const modulesCount = Array.isArray(u.allowedModules) ? u.allowedModules.length : (u.allowedModules === "ALL" ? MENU_ITEMS.length : 0);

                        return (
                          <tr key={u.id || i} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4">
                              <p className="text-slate-100 font-semibold">{u.displayName || u.email?.split("@")[0]}</p>
                              <p className="text-slate-400 font-mono text-[11px]">{u.email}</p>
                            </td>

                            <td className="py-3 px-4">
                              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider inline-flex items-center gap-1 ${
                                userRole === "admin"
                                  ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                                  : userRole === "chef_cozinha"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                              }`}>
                                {userRole === "admin" ? "👑 Gerente" : userRole === "chef_cozinha" ? "🍳 Chef Cozinha" : "🍸 Chef Bar"}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className="text-[11px] font-medium text-slate-300 uppercase">
                                {userSetor}
                              </span>
                            </td>

                            <td className="py-3 px-4">
                              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                                {modulesCount === MENU_ITEMS.length ? "Acesso Total (Todos)" : `${modulesCount} módulo(s)`}
                              </span>
                            </td>

                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUser(u)}
                                  className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-800 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                                  title="Editar cargo e permissões"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
                                  title="Excluir permissões"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* MODAL DE EDIÇÃO DE CARGO & PERMISSÕES DO USUÁRIO */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Editar Cargo e Permissões</h3>
                <p className="text-xs text-slate-400">Usuário: {editingUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              
              {editMsg && (
                <div className={`p-3 text-xs rounded-xl flex items-center gap-2 ${
                  editMsg.type === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                }`}>
                  {editMsg.type === "success" ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                  <span>{editMsg.text}</span>
                </div>
              )}

              {/* Cargo */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Cargo Operacional (Role):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setEditRole("admin"); setEditSetor("geral"); }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      editRole === "admin"
                        ? "bg-purple-600 text-white border-purple-500"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    👑 Gerente
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditRole("chef_cozinha"); setEditSetor("cozinha"); }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      editRole === "chef_cozinha"
                        ? "bg-emerald-600 text-white border-emerald-500"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    🍳 Cozinha
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditRole("chef_bar"); setEditSetor("bar"); }}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                      editRole === "chef_bar"
                        ? "bg-cyan-600 text-white border-cyan-500"
                        : "bg-slate-950 text-slate-400 border-slate-800 hover:text-white"
                    }`}
                  >
                    🍸 Bar
                  </button>
                </div>
              </div>

              {/* Setor */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Setor Atribuído:
                </label>
                <select
                  value={editSetor}
                  onChange={(e) => setEditSetor(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white text-xs min-h-[44px]"
                >
                  <option value="cozinha">🍳 Cozinha</option>
                  <option value="bar">🍸 Bar</option>
                  <option value="geral">📦 Geral</option>
                </select>
              </div>

              {/* Módulos */}
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                  Módulos Habilitados:
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 p-3 rounded-xl">
                  {MENU_ITEMS.map((m) => {
                    const checked = editModules.includes(m.id);
                    return (
                      <label key={m.id} className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer p-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setEditModules([...editModules, m.id]);
                            else setEditModules(editModules.filter(id => id !== m.id));
                          }}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-500"
                        />
                        <span className="truncate">{m.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:bg-slate-800 min-h-[44px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoad}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white min-h-[44px] flex items-center gap-1.5"
                >
                  {editLoad ? "Salvando..." : <><Check className="h-4 w-4" /> Salvar Alterações</>}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
