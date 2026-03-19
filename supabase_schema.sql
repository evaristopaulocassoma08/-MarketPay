-- 0. Limpar tudo para garantir nomes de colunas corretos
DROP TABLE IF EXISTS trades CASCADE;
DROP TABLE IF EXISTS positions CASCADE;
DROP TABLE IF EXISTS price_history CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS finance_requests CASCADE;
DROP TABLE IF EXISTS markets CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Tabela de Categorias
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir categorias iniciais
INSERT INTO categories (name, icon) VALUES 
('Geral', 'Globe'),
('Política', 'Gavel'),
('Economia', 'TrendingUp'),
('Petróleo', 'Droplets'),
('Crypto', 'Bitcoin'),
('Desporto', 'Trophy'),
('Tech', 'Cpu'),
('Cultura', 'Music');

-- 2. Tabela de Utilizadores
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  balance DECIMAL(12, 2) DEFAULT 1000.00,
  is_admin BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'pending_verification')),
  wallet_address TEXT,
  avatar_url TEXT,
  blocked_markets TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Mercados
CREATE TABLE markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- Pode referenciar categories.name
  image_url TEXT,
  yes_price DECIMAL(5, 4) DEFAULT 0.5,
  no_price DECIMAL(5, 4) DEFAULT 0.5,
  pool_yes DECIMAL(15, 2) DEFAULT 1000.00,
  pool_no DECIMAL(15, 2) DEFAULT 1000.00,
  volume DECIMAL(15, 2) DEFAULT 2000.00,
  resolved BOOLEAN DEFAULT FALSE,
  winning_outcome TEXT CHECK (winning_outcome IN ('Yes', 'No')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'cancelled')),
  tags TEXT[] DEFAULT '{}',
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Transações (Trades)
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('Buy', 'Sell')),
  outcome TEXT NOT NULL CHECK (outcome IN ('Yes', 'No')),
  amount DECIMAL(15, 2) NOT NULL,
  shares DECIMAL(15, 6) NOT NULL,
  price DECIMAL(5, 4) NOT NULL,
  fee DECIMAL(15, 2) DEFAULT 0.00,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de Posições
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('Yes', 'No')),
  shares DECIMAL(15, 6) NOT NULL,
  avg_price DECIMAL(5, 4) NOT NULL,
  UNIQUE(user_id, market_id, outcome)
);

-- 6. Tabela de Comentários
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tabela de Histórico de Preços
CREATE TABLE price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
  yes_price DECIMAL(5, 4) NOT NULL,
  no_price DECIMAL(5, 4) NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Tabela de Pedidos Financeiros
CREATE TABLE finance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_email TEXT,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount DECIMAL(15, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  proof_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ativar Segurança (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Public read markets" ON markets FOR SELECT USING (true);
CREATE POLICY "Public read price_history" ON price_history FOR SELECT USING (true);
CREATE POLICY "Public read comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Public read categories" ON categories FOR SELECT USING (true);

CREATE POLICY "Users manage own profile" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users manage own positions" ON positions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own trades" ON trades FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own finance" ON finance_requests FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users add comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin Policies
CREATE POLICY "Admins full access users" ON users FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE POLICY "Admins full access markets" ON markets FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE POLICY "Admins full access finance" ON finance_requests FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
);
CREATE POLICY "Admins full access categories" ON categories FOR ALL USING (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Configuração de Tempo Real
ALTER PUBLICATION supabase_realtime ADD TABLE markets, trades, users, finance_requests, comments, price_history, categories;
