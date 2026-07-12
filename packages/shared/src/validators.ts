/**
 * Validators y Schemas Zod para validación de datos
 * Usado por todos los squads para garantizar tipado estricto
 */

export const VALID_ROLES = ['student', 'teacher', 'tutor', 'admin'] as const;

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export const validateEmail = (email: string): ValidationResult => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      errors: ['Email inválido']
    };
  }

  // Rechazar patrones de inyección
  if (email.includes(';') || email.includes('--') || email.includes('/*')) {
    return {
      valid: false,
      errors: ['Email contiene caracteres no permitidos']
    };
  }

  return { valid: true };
};

export const validatePassword = (password: string): ValidationResult => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Mínimo 8 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Debe contener mayúsculas');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Debe contener minúsculas');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Debe contener números');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

export const validateRole = (role: string): ValidationResult => {
  if (!VALID_ROLES.includes(role as any)) {
    return {
      valid: false,
      errors: [`Role debe ser uno de: ${VALID_ROLES.join(', ')}`]
    };
  }
  return { valid: true };
};
