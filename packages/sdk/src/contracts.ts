import type { UserRole } from './types';

export type ModuleStatus = 'platform-ready' | 'squad-owned';

export interface PlatformModuleContract {
  key:
    | 'auth'
    | 'dashboard'
    | 'justifications'
    | 'appointments'
    | 'notifications'
    | 'incidents'
    | 'chatbot';
  route: string;
  owner: string;
  allowedRoles: readonly UserRole[];
  status: ModuleStatus;
  platformProvides: readonly string[];
  squadOwns: readonly string[];
}

export const PLATFORM_MODULES: readonly PlatformModuleContract[] = [
  {
    key: 'auth',
    route: '/login',
    owner: 'Platform Core / Squad 2',
    allowedRoles: ['student', 'teacher', 'tutor', 'admin', 'coordinator'],
    status: 'platform-ready',
    platformProvides: ['Supabase Auth', 'sesión SSR', 'perfil', 'roles', 'RLS'],
    squadOwns: ['experiencia de recuperación', 'MFA', 'auditoría funcional'],
  },
  {
    key: 'dashboard',
    route: '/dashboard',
    owner: 'Platform Core',
    allowedRoles: ['student', 'teacher', 'tutor', 'admin', 'coordinator'],
    status: 'platform-ready',
    platformProvides: ['layout protegido', 'navegación', 'contexto de identidad'],
    squadOwns: ['widgets y métricas específicas de cada módulo'],
  },
  {
    key: 'justifications',
    route: '/justificaciones',
    owner: 'Squad 1',
    allowedRoles: ['student', 'teacher', 'admin', 'coordinator'],
    status: 'squad-owned',
    platformProvides: ['ruta protegida', 'tablas base', 'storage privado', 'tipos'],
    squadOwns: ['reglas de negocio', 'formularios', 'revisión', 'pruebas'],
  },
  {
    key: 'appointments',
    route: '/citas',
    owner: 'Squad 3',
    allowedRoles: ['student', 'teacher', 'tutor', 'admin', 'coordinator'],
    status: 'squad-owned',
    platformProvides: ['ruta protegida', 'identidad', 'contrato de integración'],
    squadOwns: ['esquema final', 'disponibilidad', 'colisiones', 'agenda', 'pruebas'],
  },
  {
    key: 'notifications',
    route: '/notificaciones',
    owner: 'Squad 4',
    allowedRoles: ['student', 'teacher', 'tutor', 'admin', 'coordinator'],
    status: 'squad-owned',
    platformProvides: ['tablas base', 'cola protegida', 'tipos de evento'],
    squadOwns: ['workers', 'plantillas', 'reintentos', 'entrega', 'pruebas'],
  },
  {
    key: 'incidents',
    route: '/incidencias',
    owner: 'Squad 5',
    allowedRoles: ['student', 'teacher', 'tutor', 'admin', 'coordinator'],
    status: 'squad-owned',
    platformProvides: ['ruta protegida', 'identidad', 'contrato de integración'],
    squadOwns: ['esquema final', 'prioridades', 'SLA', 'seguimiento', 'pruebas'],
  },
  {
    key: 'chatbot',
    route: '/chatbot',
    owner: 'Squad 6',
    allowedRoles: ['student', 'teacher', 'tutor', 'admin', 'coordinator'],
    status: 'squad-owned',
    platformProvides: ['ruta protegida', 'identidad', 'contrato de escalamiento'],
    squadOwns: ['orquestación', 'FAQ', 'conversaciones', 'métricas', 'pruebas'],
  },
] as const;
