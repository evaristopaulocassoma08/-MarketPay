import React, { useState } from 'react';
import { User } from '../types';
import { LogIn, Mail } from 'lucide-react';

export const LoginPage = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (email === 'evaristopaulocassoma00@gmail.com' && password === 'bastante12@') {
      onLogin({
        id: 'admin_1',
        name: 'Evaristo Cassoma',
        walletAddress: '0xAdminWalletAddress',
        balance: 10000000,
        positions: [],
        isAdmin: true,
      });
    } else if (email && password) {
      onLogin({
        id: `user_${Date.now()}`,
        name: email.split('@')[0],
        walletAddress: '0xUserWalletAddress',
        balance: 10000,
        positions: [],
        isAdmin: false,
      });
    } else {
      setError('Por favor, preencha todos os campos.');
    }
  };

  const handleGoogleLogin = () => {
    onLogin({
      id: 'user_1',
      name: 'João Silva',
      walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      balance: 1250000,
      positions: [],
      isAdmin: false,
    });
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="market-card w-full max-w-md p-8 space-y-8">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-market-green rounded-2xl flex items-center justify-center text-market-bg font-bold text-3xl mx-auto mb-6">
            MP
          </div>
          <h1 className="text-2xl font-bold text-white">Bem-vindo ao MarketPay</h1>
          <p className="text-sm text-market-text-muted">Inicie sessão para começar a negociar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Email</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="market-input w-full"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-market-text-muted uppercase tracking-widest mb-2">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="market-input w-full"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-market-red text-xs font-bold">{error}</p>}
          <button type="submit" className="w-full market-button-primary py-3 flex items-center justify-center gap-3">
            <Mail className="w-4 h-4" />
            Entrar com Email
          </button>
        </form>

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
