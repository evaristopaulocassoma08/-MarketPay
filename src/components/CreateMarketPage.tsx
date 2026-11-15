import React, { useState, useEffect } from 'react';
import { Plus, Check, Loader2, Award, Coins, Compass, Info, FileText, ArrowLeftRight, Activity } from 'lucide-react';
import { firebaseService } from '../lib/firebase-service';
import { Market, Category, User } from '../types';

interface CreateMarketPageProps {
  user: User | null;
  categories: Category[];
  markets: Market[];
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshData: () => void;
  setActiveTab: (tab: string) => void;
}

const PRESET_IMAGES = [
  { name: 'Tecnologia & Futuro', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80' },
  { name: 'Desporto & Competição', url: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80' },
  { name: 'Cripto & Finanças', url: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=800&q=80' },
  { name: 'Política & Sociedade', url: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=800&q=80' },
  { name: 'Entretenimento & Pop', url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80' }
];

export const CreateMarketPage: React.FC<CreateMarketPageProps> = ({
  user,
  categories,
  markets,
  addToast,
  onRefreshData,
  setActiveTab
}) => {
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || 'Finanças');
  const [selectedImage, setSelectedImage] = useState(PRESET_IMAGES[0].url);
  const [customImage, setCustomImage] = useState('');
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );

  useEffect(() => {
    if (categories && categories.length > 0) {
      if (!category || !categories.some(c => c.name === category)) {
        setCategory(categories[0].name);
      }
    }
  }, [categories, category]);

  // Filter markets created by current user
  const userMarkets = markets.filter(m => m.creator_id === user?.id);

  // Calculate earned fees from user's created markets
  const totalEarnedFromUserMarkets = userMarkets.reduce((acc, m) => {
    return acc + (Number((m as any).creator_fee_earned) || 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      addToast('Faça login para criar um mercado.', 'error');
      return;
    }

    if (user.balance < 2000) {
      addToast(`Saldo insuficiente. O custo total é 2000 KZ (Taxa de Criação: 1000 KZ + Liquidez Inicial: 1000 KZ). Seu saldo: ${user.balance.toFixed(2)} KZ.`, 'error');
      return;
    }

    if (!question.trim()) {
      addToast('Insira uma pergunta para o mercado.', 'error');
      return;
    }

    setLoading(true);
    try {
      const imageUrl = customImage.trim() || selectedImage;
      const marketPayload = {
        question: question.trim(),
        category,
        description: description.trim() || `Este mercado resolve baseado no resultado oficial do evento descrito para ${question.trim()}.`,
        image_url: imageUrl,
        tags: [category, 'Usuário'],
        end_date: new Date(endDate).toISOString(),
        is_multi: false,
        b: 1000,
        status: 'active'
      };

      await firebaseService.createUserMarket(user.id, marketPayload);
      addToast('Parabéns! Mercado criado com sucesso. 2000 KZ deduzidos do saldo.', 'success');
      
      // Reset form
      setQuestion('');
      setDescription('');
      onRefreshData();
    } catch (error: any) {
      console.error(error);
      addToast(error.message || 'Erro ao criar o mercado.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12 animate-fade-in text-white">
      {/* Intro Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-market-border/40">
        <div>
          <span className="text-[10px] font-black uppercase text-market-green tracking-widest block font-mono">Controle de Compartilhamento Polymarket</span>
          <h1 className="text-3xl font-black text-white mt-1 uppercase tracking-tight">Criar Mercado de Previsão</h1>
          <p className="text-sm text-market-text-muted mt-2 max-w-xl">
            Crie seu próprio mercado de previsões Sim ou Não de forma 100% autônoma. Ganhe 50% de todas as taxas de negociação (2% do volume operado) ocorridas no seu mercado!
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="bg-market-card border border-market-green/30 p-4 rounded-2xl flex items-center gap-4">
            <Coins className="w-8 h-8 text-market-green animate-pulse" />
            <div>
              <span className="text-[10px] font-black uppercase text-market-text-muted tracking-wide block">Seu Saldo</span>
              <span className="text-xl font-black text-white block">{user ? `${user.balance.toLocaleString()} KZ` : '--- KZ'}</span>
            </div>
          </div>

          <div className="bg-market-card border border-purple-500/30 p-4 rounded-2xl flex items-center gap-4">
            <Award className="w-8 h-8 text-purple-400" />
            <div>
              <span className="text-[10px] font-black uppercase text-market-text-muted tracking-wide block">Seus Lucros de Criador</span>
              <span className="text-xl font-black text-white block">{(user as any)?.creator_fees_earned_total ? `${((user as any).creator_fees_earned_total).toLocaleString()} KZ` : `${totalEarnedFromUserMarkets.toLocaleString()} KZ`}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Creation Form */}
        <div className="lg:col-span-7 bg-market-card border border-market-border/70 p-8 rounded-3xl space-y-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-market-green/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            <h2 className="text-lg font-black uppercase text-white flex items-center gap-3">
              <Plus className="w-5 h-5 text-market-green" />
              Configure Seu Mercado
            </h2>
            <p className="text-xs text-market-text-muted mt-1 font-mono">Dedução de 2000 KZ (1000 KZ Liquidez pools + 1000 KZ registro)</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Input Pergunta */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-market-text-muted block">Qual pergunta os usuários vão responder?</label>
              <input
                type="text"
                placeholder="Exemplo: O Interclube de Luanda ganhará a liga angolana em 2026?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={100}
                required
                className="w-full bg-market-bg border border-market-border/80 focus:border-market-green/70 rounded-2xl p-4 text-sm font-medium text-white transition-all outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category selector */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-market-text-muted block">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-market-bg border border-market-border/80 focus:border-market-green/70 rounded-2xl p-4 text-sm font-medium text-white transition-all outline-none appearance-none"
                >
                  {categories && categories.length > 0 ? (
                    categories.map((cat) => (
                      <option key={cat.id} value={cat.name} className="bg-market-bg text-white">
                        {cat.name}
                      </option>
                    ))
                  ) : (
                    ['Finanças', 'Angola', 'Crypto', 'Desporto', 'Política', 'Economia', 'Tech'].map((name) => (
                      <option key={name} value={name} className="bg-market-bg text-white">
                        {name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Data Limite */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-market-text-muted block">Data & Hora de Encerramento</label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full bg-market-bg border border-market-border/80 focus:border-market-green/70 rounded-2xl p-4 text-sm font-medium text-white transition-all outline-none"
                />
              </div>
            </div>

            {/* Descrição e regras de resolução */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-market-text-muted block">Descrição / Regras de Resolução</label>
              <textarea
                placeholder="Especifique a fonte confiável e sob quais condições exatas o mercado resolverá como SIM ou NÃO."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-market-bg border border-market-border/80 focus:border-market-green/70 rounded-2xl p-4 text-sn font-medium text-white transition-all outline-none resize-none"
              />
            </div>

            {/* Imagem Preset / URL */}
            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-wider text-market-text-muted block">Imagem Ilustrativa</label>
              
              <div className="flex flex-wrap gap-2">
                {PRESET_IMAGES.map((img) => (
                  <button
                    key={img.name}
                    type="button"
                    onClick={() => {
                      setSelectedImage(img.url);
                      setCustomImage('');
                    }}
                    className={`px-3 py-2 rounded-xl text-[10px] font-extrabold uppercase border flex items-center gap-2 transition-all ${
                      selectedImage === img.url && !customImage
                        ? 'bg-market-green text-market-bg border-market-green'
                        : 'bg-market-bg border-market-border/75 text-market-text-muted hover:text-white'
                    }`}
                  >
                    {selectedImage === img.url && !customImage && <Check className="w-3.5 h-3.5" />}
                    {img.name}
                  </button>
                ))}
              </div>

              <div className="space-y-2 pt-2">
                <span className="text-[10px] text-market-text-muted font-bold tracking-wide block uppercase">Ou use uma URL de imagem customizada:</span>
                <input
                  type="url"
                  placeholder="Link de imagem personalizado (URL do link de imagem)"
                  value={customImage}
                  onChange={(e) => {
                    setCustomImage(e.target.value);
                  }}
                  className="w-full bg-market-bg border border-market-border/80 focus:border-market-green/70 rounded-2xl p-4 text-sm font-medium text-white transition-all outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-market-green text-market-bg uppercase font-black text-xs tracking-widest py-4.5 rounded-2xl hover:bg-opacity-90 disabled:bg-opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Deduzindo Saldo e Inicializando Pools...
                </>
              ) : (
                'Criar Mercado Autônomo e Inserir 1000 KZ Liquidez'
              )}
            </button>
          </form>
        </div>

        {/* Info panel & Owned mercados side panel */}
        <div className="lg:col-span-5 space-y-8">
          {/* Rules info */}
          <div className="bg-market-card border border-market-border/50 p-6 rounded-3xl space-y-4">
            <h3 className="text-xs font-black uppercase text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-market-green" />
              Regras do Mercado de Compartilhamento
            </h3>

            <div className="space-y-3 text-xs text-market-text-muted font-mono leading-relaxed">
              <div className="flex gap-3">
                <span className="text-market-green font-bold">1.</span>
                <p>Taxa de criação de 2000 KZ para abrir o mercado: 1000 KZ são adicionados diretamente às pools de SIM/NÃO para dar liquidez inicial, e 1000 KZ são taxa fixa cobrada do utilizador.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-market-green font-bold">2.</span>
                <p>A taxa de negociação cobrada de traders é de 4%. Desses 4%, 2% (50%) vão diretamente de forma automática para o saldo de Kwanza do criador do mercado, e os outros 2% vão para a plataforma admin.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-market-green font-bold">3.</span>
                <p>O criador do mercado é incentivado a promover o mercado em redes sociais e comunidades para gerar volume de trade e acumular lucros passivos.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-market-green font-bold">4.</span>
                <p>A resolução do mercado é gerenciada de maneira auditável e imparcial pelos administradores, garantindo transparência e segurança de payout para todos os participantes.</p>
              </div>
            </div>
          </div>

          {/* User's Created markets */}
          <div className="bg-market-card border border-market-border/50 p-6 rounded-3xl space-y-6">
            <div>
              <h3 className="text-xs font-black uppercase text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-purple-400" />
                Seus Mercados Regulados ({userMarkets.length})
              </h3>
              <p className="text-[10px] text-market-text-muted mt-1">Sua arrecadação por taxas de volume real e operado por bots</p>
            </div>

            {userMarkets.length === 0 ? (
              <div className="text-center py-8 bg-market-bg border border-dashed border-market-border/40 rounded-2xl">
                <FileText className="w-8 h-8 text-market-border mx-auto mb-2" />
                <p className="text-xs text-market-text-muted uppercase">Você ainda não criou nenhum mercado autónomo.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                {userMarkets.map((m) => (
                  <div key={m.id} className="p-4 bg-market-bg border border-market-border/40 rounded-2xl space-y-3">
                    <div className="flex justify-between items-start gap-4">
                      <span className="text-xs font-black text-white hover:text-market-green cursor-pointer block leading-snug line-clamp-2">
                        {m.question}
                      </span>
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-extrabold uppercase ${
                        m.resolved 
                          ? 'bg-purple-500/25 text-purple-400' 
                          : 'bg-market-green/20 text-market-green'
                      }`}>
                        {m.resolved ? 'Resolvido' : 'Ativo'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-1 font-mono text-[10px] border-t border-market-border/25">
                      <div>
                        <span className="text-market-text-muted uppercase block">Volume Total:</span>
                        <span className="text-white font-extrabold">{m.volume?.toLocaleString() || '0'} KZ</span>
                      </div>
                      <div>
                        <span className="text-market-text-muted uppercase block">Taxas Acumuladas:</span>
                        <span className="text-market-green font-black">+{(Number((m as any).creator_fee_earned) || 0).toFixed(2)} KZ</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
