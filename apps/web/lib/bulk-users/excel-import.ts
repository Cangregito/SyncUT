import * as XLSX from "xlsx";

export interface BulkUserImportRow {
  fullName: string;
  email: string;
  role: string;
  password: string;
  rowNumber: number;
}

export const REQUIRED_EXCEL_SHEET_NAME = "Usuarios";
export const ALLOWED_ROLES = ["admin", "coordinator", "teacher", "tutor", "student"];

const normalizeHeader = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export function parseBulkUsersWorkbook(workbook: XLSX.WorkBook): BulkUserImportRow[] {
  const sheetName = workbook.SheetNames.find(
    (name) => normalizeHeader(name) === normalizeHeader(REQUIRED_EXCEL_SHEET_NAME)
  );

  if (!sheetName) {
    throw new Error(`El archivo debe contener una hoja llamada "${REQUIRED_EXCEL_SHEET_NAME}".`);
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (!rows.length) {
    throw new Error("La hoja no tiene registros para procesar.");
  }

  return rows.map((row, index) => {
    const normalizedRow = Object.entries(row).reduce<Record<string, string>>(
      (acc, [key, value]) => {
        acc[normalizeHeader(key)] = String(value ?? "");
        return acc;
      },
      {}
    );

    const fullName =
      normalizedRow.full_name ||
      normalizedRow.nombre ||
      normalizedRow.nombre_completo ||
      "";

    const email = normalizedRow.email || normalizedRow.correo || "";

    const role = normalizedRow.role || normalizedRow.rol || "";

    const password = normalizedRow.password || normalizedRow.contrasena || "";

    return {
      fullName,
      email,
      role,
      password,
      rowNumber: index + 2,
    };
  });
}
