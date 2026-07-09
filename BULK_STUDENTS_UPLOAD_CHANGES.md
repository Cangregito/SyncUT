# Implementación de Carga Masiva de Estudiantes

## Resumen de Cambios

Se ha creado un nuevo módulo de **carga masiva de estudiantes** que permite a los administradores importar múltiples estudiantes a través de un archivo CSV. El módulo mantiene la estética Material Design 3 del proyecto y se integra perfectamente con el sistema existente.

---

## Archivos Creados

### 1. **Componente Principal**
**Ubicación:** `apps/web/components/modules/bulk-students-upload/bulk-students-upload.tsx`

**Funcionalidades:**
- ✅ Carga y validación de archivos CSV
- ✅ Previsualización de datos (primeros 5 registros)
- ✅ Procesamiento en lotes de 10 estudiantes
- ✅ Validación de campos requeridos
- ✅ Creación automática de contraseña por defecto
- ✅ Descarga de plantilla CSV
- ✅ Registro detallado de errores
- ✅ Resumen de resultados

**Características del Componente:**

```typescript
// Interfaz de datos de estudiante
interface StudentRow {
  fullName: string;
  email: string;
  studentId: string;
  carrera: string;
  rowNumber: number;
}

// Interfaz de resultados
interface ProcessingResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    email: string;
    error: string;
  }>;
}
```

**Estados Manejados:**
- `file` - Archivo CSV seleccionado
- `isProcessing` - Indicador de procesamiento en curso
- `processingStatus` - Mensaje de estado actual
- `results` - Resultados del proceso
- `errorMsg` - Mensajes de error
- `successMsg` - Mensajes de éxito
- `previewData` - Datos de previsualización

---

### 2. **Página de Ruta**
**Ubicación:** `apps/web/app/(dashboard)/bulk-students/page.tsx`

**Características:**
- Requiere rol de administrador (`await requireRole(["admin"])`)
- Renderiza el componente `BulkStudentsUpload`
- Protección de seguridad integrada

```typescript
export default async function BulkStudentsPage() {
  await requireRole(["admin"]);
  return (
    <div className="min-h-screen bg-background p-6 lg:p-8">
      <BulkStudentsUpload />
    </div>
  );
}
```

---

## Funcionalidades Principales

### 📤 Carga de Archivos
- Acepta archivos CSV únicamente
- Máximo 5MB de tamaño
- Validación de formato automática
- Arrastrar y soltar habilitado en la UI

### 📋 Validación de Datos
El archivo CSV debe contener las siguientes columnas:
- **Nombre Completo** (requerido)
- **Email** (requerido)
- **ID Estudiante** (requerido)
- **Carrera** (opcional)

### 👁️ Vista Previa
- Muestra los primeros 5 registros del archivo
- Formato tabular para fácil verificación
- Se actualiza automáticamente al seleccionar archivo

### ⚙️ Procesamiento
- Procesa estudiantes en lotes de 10
- Crea cuenta automáticamente en Supabase Auth
- Asigna contraseña por defecto: `{studentId}Sync@2024`
- Incluye campos personalizados: `full_name`, `student_id`, `carrera`, `user_type`

### 📊 Resultados
- Resumen de registros exitosos y fallidos
- Tabla detallada de errores
- Línea exacta del error en el CSV
- Descripción del problema para cada fallo

### 📥 Plantilla
- Botón para descargar plantilla CSV de ejemplo
- Formato predefinido con ejemplos reales
- Facilita la preparación de datos

---

## Interfaz de Usuario

### Diseño Responsive
- **Escritorio:** Layout de 2 columnas (upload + información)
- **Móvil:** Layout de columna única

### Componentes Visuales
Mantiene la estética del proyecto:
- Iconos Material Symbols Outlined
- Esquema de colores Material Design 3
- Bordes `outline-variant`
- Fondo `surface-container`
- Transiciones suaves
- Sombras consistentes

### Estados Visuales
```
✅ Estado de éxito: Fondo verde claro + ícono
❌ Estado de error: Fondo rojo claro + ícono
ℹ️ Estado de procesamiento: Fondo azul claro + spinner animado
```

---

## Validaciones

### Validación de Archivo
- ✓ Tipo: Solo `.csv`
- ✓ Tamaño: Máximo 5MB
- ✓ Columnas requeridas presentes

### Validación de Datos
- ✓ Email válido y único (por Supabase)
- ✓ Todos los campos requeridos presentes
- ✓ No hay duplicados procesados

### Validación de Contraseña
- Creación automática con formato: `{studentId}Sync@2024`
- Cumple con requisitos mínimos de Supabase Auth

---

## Seguridad

- 🔒 Requiere autenticación de administrador
- 🔒 Validación en cliente y servidor
- 🔒 Uso de Supabase Auth para creación de usuarios
- 🔒 Contraseñas automatizadas (recomendación: cambiar en primer login)
- 🔒 Validación de email duplicado manejada por Supabase

---

## Flujo de Uso

```
1. Administrador accede a /dashboard/bulk-students
2. Descarga plantilla CSV (opcional)
3. Completa datos de estudiantes en CSV
4. Carga archivo en la plataforma
5. Sistema muestra vista previa
6. Administrador revisa y confirma carga
7. Sistema procesa en lotes de 10
8. Muestra resultados: éxitos y errores
9. Puede descargar reporte de errores para corrección
```

---

## Estructura de Carpetas Creadas

```
apps/web/
├── app/
│   └── (dashboard)/
│       └── bulk-students/
│           └── page.tsx          ← Página de ruta
└── components/
    └── modules/
        └── bulk-students-upload/
            └── bulk-students-upload.tsx  ← Componente principal
```

---

## Integración con Sistema Existente

### Relaciones con Otros Módulos
- ✅ Compatible con sistema de autenticación (Supabase Auth)
- ✅ Usa mismo esquema de roles: `requireRole(["admin"])`
- ✅ Estética consistente con signup y login
- ✅ Mismo sistema de componentes y utilidades

### Rutas Disponibles
- **Ruta principal:** `/dashboard/bulk-students`
- **Protección:** Solo administradores
- **Renderización:** Server-side (async component)

---

## Plantilla CSV de Ejemplo

```csv
Nombre Completo,Email,ID Estudiante,Carrera
Juan Pérez García,juan.perez@universidad.edu.mx,2024001,Ingeniería en Sistemas
María López González,maria.lopez@universidad.edu.mx,2024002,Ingeniería en Sistemas
Carlos Rodríguez Martínez,carlos.rodriguez@universidad.edu.mx,2024003,Administración de Empresas
```

---

## Próximas Mejoras Sugeridas

1. **Procesamiento en Background:**
   - Usar worker threads o Queueing system
   - Notificación por email al completar

2. **Autenticación Mejorada:**
   - Generar contraseñas seguras únicas por estudiante
   - Enviar credenciales por email

3. **Importar Datos Adicionales:**
   - Numero de contacto
   - Dirección
   - Información de programa académico

4. **Exportación de Reportes:**
   - Descargar reporte de errores
   - Descargar credenciales de nuevos estudiantes

5. **Caché y Optimización:**
   - Deduplicación de emails
   - Validación previa más robusta
   - Compresión de datos

---

## Notas Técnicas

- **Framework:** Next.js 14 (App Router)
- **Autenticación:** Supabase Auth
- **Procesamiento:** Cliente (Client Component)
- **Validación:** Combinada (cliente + servidor)
- **Estilos:** Tailwind CSS con variables de Material Design 3
- **Componentes:** Función react pura, hooks estándar

---

## Pruebas Recomendadas

- [ ] Descargar y llenar plantilla
- [ ] Cargar archivo con datos válidos
- [ ] Cargar archivo con emails duplicados
- [ ] Cargar archivo con campos faltantes
- [ ] Cargar archivo CSV malformado
- [ ] Verificar límite de tamaño (5MB)
- [ ] Revisar que estudiantes se creen en Auth
- [ ] Confirmar contraseñas por defecto funcionan
