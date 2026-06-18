/**
 * Script para verificar la conexión con Supabase.
 * Para ejecutarlo:
 * node --env-file=.env.local scripts/test-db.js
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('\x1b[31m%s\x1b[0m', '❌ ERROR: Faltan variables de entorno en .env.local');
  console.log('Asegúrate de configurar:');
  console.log(' - NEXT_PUBLIC_SUPABASE_URL');
  console.log(' - NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('Intentando conectar a Supabase en:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  try {
    // 1. Probar consulta básica a la tabla profiles
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);

    if (error) {
      throw error;
    }

    console.log('\x1b[32m%s\x1b[0m', '✅ CONEXIÓN EXITOSA: La base de datos está conectada y respondiendo.');
    console.log('La tabla "profiles" existe y está accesible.');
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', '❌ ERROR DE CONEXIÓN CON LA BASE DE DATOS:');
    console.error(err.message || err);
    console.log('\nPosibles causas:');
    console.log(' 1. No has ejecutado el script SQL unificado en el SQL Editor de Supabase (las tablas no existen).');
    console.log(' 2. Las credenciales de .env.local son incorrectas.');
    console.log(' 3. Las políticas RLS están bloqueando el acceso de lectura pública (puedes loguearte primero para probar).');
  }
}

testConnection();
