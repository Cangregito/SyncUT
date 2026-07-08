const UTCJ_STUDENT_EMAIL_PATTERN = /^al\d{8}@utcj\.edu\.mx$/i;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isUtcjStudentEmail(email: string): boolean {
  return UTCJ_STUDENT_EMAIL_PATTERN.test(normalizeEmail(email));
}
