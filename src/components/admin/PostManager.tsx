import React, { useState, useEffect } from 'react';
import { 
  List, Plus, Trash2, Edit, Ban, CheckCircle, Info, Heart, 
  MessageSquare, LayoutGrid, Eye, Sparkles, Loader2, FileText, Globe 
} from 'lucide-react';
import { firebaseService } from '../../lib/firebase-service';
import { motion, AnimatePresence } from 'motion/react';

export const PostManager = ({ 
  posts: initialPosts, 
  categories, 
  addToast,
  onRefreshData
}: { 
  posts: any[]; 
  categories: any[]; 
  addToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshData: () => void;
}) => {
  const [posts, setPosts] = useState<any[]>(initialPosts);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    category: 'Geral',
    image_url: 'https://picsum.photos/seed/post/800/400',
    status: 'published'
  });

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  // Analytics of registered posts ("analiza todo site os poste ja cadastrados")
  const totalPosts = posts.length;
  const publishedCount = posts.filter(p => p.status === 'published' || !p.status).length;
  const blockedCount = posts.filter(p => p.status === 'blocked').length;
  
  const totalLikes = posts.reduce((acc, p) => acc + (p.likes || 0), 0);
  const totalComments = posts.reduce((acc, p) => acc + (p.comments || 0), 0);
  const engagementRate = totalPosts > 0 
    ? (((totalLikes + totalComments) / totalPosts)).toFixed(1) 
    : '0.0';

  // Category distribution for posts
  const postCategoryCounts = posts.reduce((acc: any, p) => {
    const cat = p.category || 'Geral';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await firebaseService.createPost({
        ...newPost,
        author_id: 'admin',
        author_name: 'Admin Master',
        author_avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100',
        likes: 0,
        comments: 0
      });
      setShowCreatePost(false);
      setNewPost({ title: '', content: '', category: 'Geral', image_url: 'https://picsum.photos/seed/post/800/400', status: 'published' });
      onRefreshData();
      addToast('Anúncio / Publicação criada com sucesso!', 'success');
    } catch (error: any) {
      addToast('Erro ao criar publicação: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPost) return;
    setLoading(true);
    try {
      await firebaseService.updatePost(editingPost.id, {
        title: editingPost.title,
        content: editingPost.content,
        category: editingPost.category,
        image_url: editingPost.image_url,
        status: editingPost.status || 'published'
      });
      setEditingPost(null);
      onRefreshData();
      addToast('Publicação atualizada!', 'success');
    } catch (error: any) {
      addToast('Erro ao editar: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (window.confirm('Excluir permanentemente este artigo dos cadastros?')) {
      try {
        await firebaseService.deletePost(id);
        onRefreshData();
        addToast('Publicação removida com sucesso!', 'success');
      } catch (error: any) {
        addToast('Erro ao remover: ' + error.message, 'error');
      }
    }
  };

  const handleToggleBlockPost = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'blocked' ? 'published' : 'blocked';
    try {
      await firebaseService.updatePost(id, { status: nextStatus });
      onRefreshData();
      addToast(`Publicação ${nextStatus === 'blocked' ? 'bloqueada' : 'desbloqueada'}`, 'info');
    } catch (e: any) {
      addToast('Erro ao alterar status: ' + e.message, 'error');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Specialized Posts Deep Analytical Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-market-card-lighter/20 p-6 rounded-2xl border border-market-border">
        <div className="bg-market-bg/50 p-6 rounded-2xl border border-market-border space-y-2">
          <div className="flex items-center justify-between text-market-text-muted">
            <span className="text-[10px] uppercase font-black tracking-widest">Publicações Cadastradas</span>
            <FileText className="w-4 h-4 text-market-green" />
          </div>
          <div className="text-3xl font-black text-white">{totalPosts}</div>
          <p className="text-[10px] text-market-text-muted mt-2">
            {publishedCount} no ar / {blockedCount} suspensas
          </p>
        </div>

        <div className="bg-market-bg/50 p-6 rounded-2xl border border-market-border space-y-2">
          <div className="flex items-center justify-between text-market-text-muted">
            <span className="text-[10px] uppercase font-black tracking-widest">Atividade Acumulada</span>
            <Heart className="w-4 h-4 text-market-red" />
          </div>
          <div className="text-3xl font-black text-white">{totalLikes} <span className="text-sm text-market-text-muted font-bold">Apoios</span></div>
          <p className="text-[10px] text-market-text-muted mt-2">
            {totalComments} comentários registados
          </p>
        </div>

        <div className="bg-market-bg/50 p-6 rounded-2xl border border-market-border space-y-2">
          <div className="flex items-center justify-between text-market-text-muted">
            <span className="text-[10px] uppercase font-black tracking-widest">Índice Engajamento</span>
            <Sparkles className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-3xl font-black text-white">{engagementRate} <span className="text-sm text-market-text-muted font-bold">Médio</span></div>
          <p className="text-[10px] text-market-text-muted mt-2">
            Interações por publicador registado
          </p>
        </div>

        <div className="bg-market-bg/50 p-6 rounded-2xl border border-market-border p-4 space-y-1">
          <span className="text-[9px] uppercase font-black tracking-widest text-market-text-muted">Postagens por Categoria</span>
          <div className="space-y-1 overflow-y-auto max-h-[70px] pr-2 no-scrollbar text-[10px] text-white">
            {Object.keys(postCategoryCounts).length === 0 ? (
              <span className="italic text-market-text-muted">Nenhum post registrado</span>
            ) : (
              Object.entries(postCategoryCounts).map(([cat, count]: any) => (
                <div key={cat} className="flex justify-between items-center py-0.5 border-b border-market-border/30">
                  <span>{cat}</span>
                  <span className="font-bold text-market-green">{count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-market-card p-4 rounded-xl border border-market-border">
        <div className="flex items-center gap-3">
          <List className="w-5 h-5 text-market-green" />
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">
            Artigos, Tutoriais e Avisos Administrativos
          </h3>
        </div>
        <button
          onClick={() => setShowCreatePost(true)}
          className="market-button-primary flex items-center gap-2 px-6 py-2.5 text-xs shadow-md shadow-market-green/20 hover:scale-105 transition-all"
        >
          <Plus className="w-4 h-4" /> Nova Publicação
        </button>
      </div>

      {/* Posts List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {posts.map((post) => (
          <div 
            key={post.id} 
            className={`market-card overflow-hidden group border-2 ${
              post.status === 'blocked' ? 'border-market-red/20 opacity-70' : 'border-transparent hover:border-market-green/15'
            } transition-all flex flex-col`}
          >
            <div className="relative h-44 bg-market-card-lighter overflow-hidden shrink-0">
              <img 
                src={post.image_url} 
                alt={post.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-3 left-3 flex gap-2">
                <span className="px-2.5 py-1 bg-market-bg/90 backdrop-blur-md text-[9px] font-black uppercase text-market-green rounded border border-market-green/30">
                  {post.category}
                </span>

                <span className={`px-2.5 py-1 backdrop-blur-md text-[9px] font-black uppercase rounded border ${
                  post.status === 'blocked' 
                    ? 'bg-market-red/80 text-white border-market-red/50' 
                    : 'bg-market-green/20 text-market-green border-market-green/45'
                }`}>
                  {post.status === 'blocked' ? 'Bloqueado' : 'Visível'}
                </span>
              </div>
            </div>

            <div className="p-6 flex-1 flex flex-col space-y-4">
              <div className="flex items-center gap-2 text-[10px] text-market-text-muted font-bold uppercase tracking-wider">
                <span>Por {post.author_name}</span>
                <span>•</span>
                <span>{new Date(post.created_at).toLocaleDateString()}</span>
              </div>

              <h4 className="text-base font-bold text-white group-hover:text-market-green transition-colors leading-snug line-clamp-2">
                {post.title}
              </h4>

              <p className="text-xs text-market-text-muted line-clamp-3 leading-relaxed flex-1">
                {post.content}
              </p>

              <div className="flex items-center justify-between border-t border-market-border/40 pt-4 text-xs font-mono">
                <div className="flex items-center gap-3 text-market-text-muted">
                  <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-market-red/70" /> {post.likes || 0}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5 text-blue-400" /> {post.comments || 0}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setEditingPost(post)}
                    className="p-1.5 hover:bg-market-card-lighter rounded-lg text-market-text-muted hover:text-white transition-colors"
                    title="Editar"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleToggleBlockPost(post.id, post.status || 'published')}
                    className={`p-1.5 rounded-lg transition-colors border ${
                      post.status === 'blocked'
                        ? 'border-market-green/10 text-market-green hover:bg-market-green/10'
                        : 'border-market-red/10 text-market-red hover:bg-market-red/10'
                    }`}
                    title={post.status === 'blocked' ? "Desbloquear" : "Bloquear"}
                  >
                    {post.status === 'blocked' ? <CheckCircle className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="p-1.5 hover:bg-market-red/10 rounded-lg text-market-text-muted hover:text-market-red transition-colors"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Creation Modal */}
      <AnimatePresence>
        {showCreatePost && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-market-bg/85 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-xl bg-market-card p-6 rounded-2xl border border-market-border space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-market-border pb-3">
                <h4 className="text-base font-bold text-white uppercase tracking-widest">Nova Publicação</h4>
                <button onClick={() => setShowCreatePost(false)} className="text-market-text-muted hover:text-white font-bold">&times;</button>
              </div>

              <form onSubmit={handleCreatePost} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Título do Artigo</label>
                  <input 
                    type="text" 
                    required 
                    value={newPost.title} 
                    onChange={(e) => setNewPost({...newPost, title: e.target.value})} 
                    className="market-input w-full"
                    placeholder="Adicione um título atraente..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Categoria</label>
                    <select 
                      value={newPost.category} 
                      onChange={(e) => setNewPost({...newPost, category: e.target.value})} 
                      className="market-input w-full bg-market-card"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">URL da Imagem</label>
                    <input 
                      type="text" 
                      value={newPost.image_url} 
                      onChange={(e) => setNewPost({...newPost, image_url: e.target.value})} 
                      className="market-input w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Conteúdo</label>
                  <textarea 
                    required 
                    rows={6} 
                    value={newPost.content} 
                    onChange={(e) => setNewPost({...newPost, content: e.target.value})} 
                    className="market-input w-full resize-none h-32"
                    placeholder="Escreva conteúdo informativo utilizando o editor de avisos..."
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => setShowCreatePost(false)} className="market-button-outline flex-1 py-3">Cancelar</button>
                  <button type="submit" disabled={loading} className="market-button-primary flex-1 py-3 flex justify-center items-center">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Publicação'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Editing Modal */}
      <AnimatePresence>
        {editingPost && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-market-bg/85 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-xl bg-market-card p-6 rounded-2xl border border-market-border space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-market-border pb-3">
                <h4 className="text-base font-bold text-white uppercase tracking-widest">Editar Publicação</h4>
                <button onClick={() => setEditingPost(null)} className="text-market-text-muted hover:text-white font-bold">&times;</button>
              </div>

              <form onSubmit={handleUpdatePost} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Título do Artigo</label>
                  <input 
                    type="text" 
                    required 
                    value={editingPost.title} 
                    onChange={(e) => setEditingPost({...editingPost, title: e.target.value})} 
                    className="market-input w-full"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Categoria</label>
                    <select 
                      value={editingPost.category} 
                      onChange={(e) => setEditingPost({...editingPost, category: e.target.value})} 
                      className="market-input w-full bg-market-card"
                    >
                      {categories.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">URL da Imagem</label>
                    <input 
                      type="text" 
                      value={editingPost.image_url} 
                      onChange={(e) => setEditingPost({...editingPost, image_url: e.target.value})} 
                      className="market-input w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-market-text-muted uppercase mb-2">Conteúdo</label>
                  <textarea 
                    required 
                    rows={6} 
                    value={editingPost.content} 
                    onChange={(e) => setEditingPost({...editingPost, content: e.target.value})} 
                    className="market-input w-full resize-none h-32"
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button type="button" onClick={() => setEditingPost(null)} className="market-button-outline flex-1 py-3">Cancelar</button>
                  <button type="submit" disabled={loading} className="market-button-primary flex-1 py-3 flex justify-center items-center">
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Alterações'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
