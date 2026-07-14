import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import { REQUIRED_EXCEL_SHEET_NAME, parseBulkUsersWorkbook } from "./excel-import";

describe("excel bulk user import", () => {
  it("parses the required sheet and aliases the expected columns", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Nombre Completo", "Email", "Rol", "Contraseña"],
      ["Juan Pérez", "juan@example.com", "student", "TempPass123!"],
    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, REQUIRED_EXCEL_SHEET_NAME);

    const rows = parseBulkUsersWorkbook(workbook);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      fullName: "Juan Pérez",
      email: "juan@example.com",
      role: "student",
      password: "TempPass123!",
    });
  });
});
