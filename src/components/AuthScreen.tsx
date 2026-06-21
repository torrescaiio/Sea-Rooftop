import React, { useState } from "react";
import { appAuth, isFirebaseActive } from "../firebase";
import { Flame, ShieldCheck, Lock, Mail, AlertCircle, Sparkles } from "lucide-react";

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const firebaseActive = isFirebaseActive();

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setErrorStatus("Por favor, preencha o campo de e-mail para recuperar a senha.");
      return;
    }
    setLoading(true);
    setErrorStatus(null);
    setSuccessMsg(null);
    try {
      await appAuth.resetPassword(email.trim());
      setSuccessMsg("Se o e-mail existir, você receberá um link para redefinir sua senha.");
    } catch (err: any) {
      setErrorStatus(err.message || "Erro ao solicitar recuperação de senha.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorStatus("Por favor, digite o e-mail e a senha.");
      return;
    }

    setLoading(true);
    setErrorStatus(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const user = await appAuth.signUp(email.trim(), password);
        setSuccessMsg("Conta de administrador criada com sucesso! Carregando...");
        setTimeout(() => {
          onAuthSuccess(user);
        }, 800);
      } else {
        const user = await appAuth.signIn(email.trim(), password);
        setSuccessMsg("Autenticado! Carregando Command Center...");
        setTimeout(() => {
          onAuthSuccess(user);
        }, 800);
      }
    } catch (err: any) {
      setErrorStatus(err.message || "Erro desconhecido na autenticação.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 font-sans relative overflow-hidden">
      
      {/* Background elegant flare */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-cyan-600/10 to-blue-600/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main card box container */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl relative z-10 overflow-hidden">
        
        {/* Banner for real-time offline feedback */}
        <div className="px-6 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
            <Lock className="h-3 w-3 text-slate-500" /> Segurança Integrada
          </span>
          {firebaseActive ? (
            <span className="text-[10px] text-emerald-400 font-bold tracking-wide flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              FIREBASE LIVE
            </span>
          ) : (
            <span className="text-[10px] text-amber-400 font-bold tracking-wide flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              MOCK PREVIEW
            </span>
          )}
        </div>

        <div className="p-8 space-y-6">
          {/* Logo & head text */}
          <div className="text-center space-y-3">
            <div className="inline-flex p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl shadow-xl shadow-cyan-500/10 mx-auto">
              <Flame className="h-7 w-7 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white font-sans sm:text-2xl">
                Sea Rooftop
              </h2>
              <p className="text-xs font-mono tracking-widest text-cyan-400 uppercase font-bold">
                Command Center
              </p>
            </div>
          </div>

          {/* Form container */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Display status or success messages */}
            {errorStatus && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorStatus}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">
                E-mail Corporativo
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="gerente@searooftop.com.br"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Senha Corporativa
                </label>
                {firebaseActive && (
                  <button 
                    type="button" 
                    onClick={handleResetPassword}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-mono cursor-pointer min-h-[44px]"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-10 pr-4 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Submit CTA button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold text-sm py-2.5 rounded-xl shadow-lg hover:shadow-cyan-500/15 transition-all outline-hidden flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50 min-h-[44px]"
            >
              {loading ? (
                <div className="h-5 w-5 border-t-2 border-r-2 border-white rounded-full animate-spin" />
              ) : isSignUp ? (
                "Criar Conta e Conectar"
              ) : (
                "Conectar ao Painel"
              )}
            </button>
          </form>

          {/* Toggle between register and login */}
          <div className="text-center mt-6">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-slate-400 hover:text-white underline transition cursor-pointer"
            >
              {isSignUp 
                ? "Já possuo uma credencial corporativa. Entrar" 
                : "Solicitar novo acesso operacional (Cadastrar)"
              }
            </button>
          </div>
        </div>

        {/* Demo Credentials Drawer helper if Firebase is offline */}
        {!firebaseActive && (
          <div className="bg-slate-950 p-5 border-t border-slate-800/80 space-y-2.5">
            <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest flex items-center gap-1 font-bold">
              <Sparkles className="h-3 w-3" /> CREDENCIAIS DE TESTE (DEMO PREVIEW)
            </span>
            <div className="text-xs text-slate-400 space-y-1 leading-relaxed">
              <p>O aplicativo está operando em <b>Modo Simulado Local</b> para visualização instantânea.</p>
              <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-[11px] space-y-0.5 font-mono mt-2 select-all">
                <div><span className="text-slate-500">Login:</span> gerente@searooftop.com.br</div>
                <div><span className="text-slate-500">Senha:</span> 123456</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-slate-600 text-[10px] font-mono">
        ESTAÇÕES DE CONTROLE INTEGRADO • SEA ROOFTOP VER 2.6
      </div>
    </div>
  );
}
