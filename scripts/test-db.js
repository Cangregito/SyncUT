/**
 * Script para verificar la conexión con Supabase.
 * Para ejecutarlo:
 * node --env-file=.env.local scripts/test-db.js
 */

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

async function testConnection() {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: {
        apikey: supabaseAnonKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase Auth respondió HTTP ${response.status}`);
    }

    console.log('\x1b[32m%s\x1b[0m', '✅ CONEXIÓN EXITOSA: La base de datos está conectada y respondiendo.');
    console.log('La API de autenticación está disponible.');
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', '❌ ERROR DE CONEXIÓN CON LA BASE DE DATOS:');
    console.error(err.message || err);
    console.log('\nPosibles causas:');
    console.log(' 1. La URL o la clave publishable son incorrectas.');
    console.log(' 2. El proyecto está pausado o presenta una incidencia.');
    console.log(' 3. La conexión de red no permite acceder a Supabase.');
  }
}

testConnection();
