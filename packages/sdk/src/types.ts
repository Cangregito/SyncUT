/**
 * Tipos principales exportados por el SDK
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'student' | 'teacher' | 'tutor' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthError {
  message: string;
  code?: string;
}

export interface AuthResponse<T = unknown> {
  data: T | null;
  error: AuthError | null;
}
