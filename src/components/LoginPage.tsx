import React, { useState } from 'react';
import { User } from '../types';
import { LogIn, Mail } from 'lucide-react';
import { supabase } from '../supabase';

export const LoginPage = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);

  // Check if Supabase is properly initialized
  const isSupabaseConfigured = !!supabase;

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setError('Erro de configuração: O cliente Supabase não foi inicializado corretamente.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (signUpError) {
          if (signUpError.message.includes('Email confirmation')) {
            setError('Registo efetuado! Por favor, verifique o seu email para confirmar a conta antes de entrar.');
            setLoading(false);
            return;
          }
          throw signUpError;
        }
        
        if (data.user) {
          // Create user profile in 'users' table
          const { error: profileError } = await supabase
            .from('users')
            .insert([{
              id: data.user.id,
              name: email.split('@')[0],
              email: email,
              balance: 1000, // Initial bonus
              is_admin: email.toLowerCase() === 'evaristopaulocassoma00@gmail.com',
              status: 'active'
            }]);
          
          if (profileError) {
            console.error('Profile creation error:', profileError);
            // Even if profile creation fails here, the auth account is created.
            // The user might need to log in to trigger the profile creation logic in handleAuth (signIn branch)
            setError('Conta criada, mas houve um erro ao criar o perfil. Tente fazer login.');
          } else {
            alert('Conta criada com sucesso!');
            setIsSignUp(false);
          }
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;

        if (data.user) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*, positions(*)')
            .eq('id', data.user.id)
            .single();
          
          if (userError) {
            // If profile doesn't exist (e.g. after OAuth), create it
            const { data: newProfile, error: createError } = await supabase
              .from('users')
              .insert([{
                id: data.user.id,
                name: data.user.email?.split('@')[0] || 'Utilizador',
                email: data.user.email,
                balance: 1000,
                is_admin: data.user.email?.toLowerCase() === 'evaristopaulocassoma00@gmail.com',
                status: 'active'
              }])
              .select('*, positions(*)')
              .single();
            
            if (createError) throw createError;
            onLogin(newProfile);
          } else {
            onLogin(userData);
          }
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      if (err.message === 'Invalid login credentials') {
        setError('Email ou senha incorretos.');
      } else if (err.message.includes('Email not confirmed')) {
        setError('Por favor, confirme o seu email antes de entrar.');
      } else if (err.message.includes('Database error saving new user')) {
        setError('Erro ao guardar perfil. Verifique se executou o script SQL no Supabase.');
      } else {
        setError(err.message || 'Ocorreu um erro na autenticação.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Por favor, insira o seu email primeiro.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setResetEmailSent(true);
      alert('Email de recuperação enviado! Verifique a sua caixa de entrada.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="market-card w-full max-w-md p-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-market-green rounded-2xl flex items-center justify-center text-market-bg font-bold text-3xl mx-auto mb-6">
            MP
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isSignUp ? 'Criar Conta' : 'Bem-vindo ao MarketPay'}
          </h1>
          <p className="text-sm text-market-text-muted">
            {isSignUp ? 'Registe-se para começar a negociar' : 'Inicie sessão para começar a negociar'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="market-input w-full"
              placeholder="seu@email.com"
              required
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest">Password</label>
              {!isSignUp && (
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[10px] text-market-green hover:underline font-bold uppercase tracking-widest"
                >
                  Esqueceu a senha?
                </button>
              )}
            </div>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="market-input w-full"
              placeholder="••••••••"
              required
            />
          </div>
          {error && <p className="text-market-red text-xs font-bold">{error}</p>}
          {isSignUp && (
            <p className="text-[10px] text-market-text-muted italic">
              Nota: Pode ser necessário confirmar o seu email antes de conseguir entrar.
            </p>
          )}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full market-button-primary py-3 flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? 'A processar...' : (isSignUp ? 'Registar' : 'Entrar com Email')}
          </button>
        </form>

        <div className="text-center">
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-market-green hover:underline font-bold uppercase tracking-widest"
          >
            {isSignUp ? 'Já tem conta? Entre aqui' : 'Não tem conta? Registe-se'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-market-border"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-market-card px-2 text-market-text-muted uppercase tracking-widest font-bold">Ou</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white text-black hover:bg-gray-100 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continuar com Google
          </button>
        </div>

        <p className="text-center text-[10px] text-market-text-muted">
          Ao iniciar sessão, concorda com os nossos <a href="#" className="text-market-green hover:underline">Termos de Serviço</a> e <a href="#" className="text-market-green hover:underline">Política de Privacidade</a>.
        </p>
      </div>
    </div>
  );
};
