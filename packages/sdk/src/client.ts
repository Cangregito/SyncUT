/**
 * Cliente Centralizado de Supabase para Componentes del Lado del Cliente
 * Este es el punto único de conexión para todas las operaciones de BD
 * 
 * @usage
 * import { createSupabaseBrowserClient } from '@plataforma/sdk';
 * const supabase = createSupabaseBrowserClient();
 * const { data, error } = await supabase.from('profiles').select('*');
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@plataforma/types';

const getPublicSupabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Supabase no está configurado. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    );
  }

  return { url, anonKey };
};

export const createSupabaseBrowserClient = () => {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
};

/**
 * Función auxiliar para inicializar auth en el cliente
 */
export const getSupabaseAuth = () => {
  const client = createSupabaseBrowserClient();
  return client.auth;
};

/**
 * Función auxiliar para queries de datos
 */
export const getSupabaseData = () => {
  const client = createSupabaseBrowserClient();
  return client;
};
