import { createClient } from '@supabase/supabase-js';

// Helper to get environment variables with strict validation
const getSafeEnv = (key: string, fallback: string): string => {
  try {
    const value = (import.meta as any).env?.[key];
    if (typeof value === 'string' && value.trim() !== '' && value !== 'undefined' && value !== 'null') {
      return value.trim();
    }
  } catch (e) {
    console.warn(`Error accessing env var ${key}:`, e);
  }
  return fallback;
};

const rawUrl = getSafeEnv('VITE_SUPABASE_URL', 'https://wxcokshyiyeogvzsabuy.supabase.co');
let supabaseUrl = rawUrl;

// Auto-fix: If the user provided just the project ID (e.g. "wxcokshyiyeogvzsabuy")
if (!supabaseUrl.startsWith('http') && /^[a-z0-9]{20}$/.test(supabaseUrl)) {
  supabaseUrl = `https://${supabaseUrl}.supabase.co`;
} else if (!supabaseUrl.startsWith('http') && supabaseUrl.includes('.supabase.co')) {
  supabaseUrl = `https://${supabaseUrl}`;
}

const supabaseAnonKey = getSafeEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_ubw4M17MNyldAVmhReCBvQ_WfZOP-Vf');

// Final validation before initialization
if (!supabaseUrl.startsWith('http')) {
  throw new Error(`URL do Supabase Inválido: "${supabaseUrl}". Certifique-se de que inseriu o URL completo (ex: https://xyz.supabase.co) nas definições.`);
}

// Initialize Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
