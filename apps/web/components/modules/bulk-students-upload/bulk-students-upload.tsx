"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { createSupabaseBrowserClient } from "@plataforma/sdk/client";

import {
  ALLOWED_ROLES,
  REQUIRED_EXCEL_SHEET_NAME,
  parseBulkUsersWorkbook,
} from "@/lib/bulk-users/excel-import";

interface StudentRow {
  fullName: string;
  email: string;
  studentId: string;
  carrera: string;
  rowNumber: number;
}

interface ProcessingResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    email: string;
    error: string;
  }>;
}

interface ExcelUserRow {
  fullName: string;
  email: string;
  role: string;
  password: string;
  rowNumber: number;
}

export function BulkStudentsUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [results, setResults] = useState<ProcessingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [previewData, setPreviewData] = useState<StudentRow[]>([]);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelIsProcessing, setExcelIsProcessing] = useState(false);
  const [excelProcessingStatus, setExcelProcessingStatus] = useState("");
  const [excelResults, setExcelResults] = useState<ProcessingResult | null>(null);
  const [excelErrorMsg, setExcelErrorMsg] = useState("");
  const [excelSuccessMsg, setExcelSuccessMsg] = useState("");
  const [excelPreviewData, setExcelPreviewData] = useState<ExcelUserRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  const parseCSV = (text: string): StudentRow[] => {
    const lines = text.trim().split("\n");
    const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());

    const fullNameIndex = headers.findIndex((h) =>
      h.includes("nombre") || h.includes("name")
    );
    const emailIndex = headers.findIndex((h) =>
      h.includes("email") || h.includes("correo")
    );
    const studentIdIndex = headers.findIndex((h) =>
      h.includes("id") || h.includes("matricula")
    );
    const carreraIndex = headers.findIndex((h) =>
      h.includes("carrera") || h.includes("program")
    );

    if (
      fullNameIndex === -1 ||
      emailIndex === -1 ||
      studentIdIndex === -1
    ) {
      throw new Error(
        "El archivo debe contener columnas: Nombre, Email y ID Estudiante"
      );
    }

    return lines.slice(1).map((line, index) => {
      const values = line.split(",").map((v) => v.trim());
      return {
        fullName: values[fullNameIndex] || "",
        email: values[emailIndex] || "",
        studentId: values[studentIdIndex] || "",
        carrera: carreraIndex !== -1 ? values[carreraIndex] || "" : "N/A",
        rowNumber: index + 2,
      };
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setErrorMsg("");
    setSuccessMsg("");
    setResults(null);

    // Validate file type
    if (!selectedFile.name.endsWith(".csv")) {
      setErrorMsg("Por favor, selecciona un archivo CSV.");
      return;
    }

    // Validate file size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setErrorMsg("El archivo no debe exceder 5MB.");
      return;
    }

    setFile(selectedFile);

    // Parse and preview
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = parseCSV(text);
        setPreviewData(data.slice(0, 5));
      } catch (error) {
        setErrorMsg(
          error instanceof Error
            ? error.message
            : "Error al procesar el archivo"
        );
        setFile(null);
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setErrorMsg("Selecciona un archivo CSV para continuar.");
      return;
    }

    setIsProcessing(true);
    setErrorMsg("");
    setSuccessMsg("");
    setResults(null);
    setProcessingStatus("Procesando archivo...");

    try {
      const text = await file.text();
      const students = parseCSV(text);

      const supabase = createSupabaseBrowserClient();
      const results: ProcessingResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      // Process students in batches to avoid overwhelming the server
      const batchSize = 10;
      for (let i = 0; i < students.length; i += batchSize) {
        const batch = students.slice(i, i + batchSize);
        setProcessingStatus(
          `Procesando ${i + batch.length} de ${students.length} estudiantes...`
        );

        for (const student of batch) {
          try {
            // Validate student data
            if (!student.email || !student.fullName || !student.studentId) {
              results.failed++;
              results.errors.push({
                row: student.rowNumber,
                email: student.email || "N/A",
                error: "Faltan campos requeridos",
              });
              continue;
            }

            // Create default password (student ID)
            const defaultPassword = `${student.studentId}Sync@2024`;

            // Sign up student
            const { data, error } = await supabase.auth.signUp({
              email: student.email.toLowerCase().trim(),
              password: defaultPassword,
              options: {
                data: {
                  full_name: student.fullName,
                  student_id: student.studentId,
                  carrera: student.carrera,
                  user_type: "student",
                },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
              },
            });

            if (error) {
              results.failed++;
              results.errors.push({
                row: student.rowNumber,
                email: student.email,
                error: error.message,
              });
            } else {
              results.success++;
            }
          } catch (error) {
            results.failed++;
            results.errors.push({
              row: student.rowNumber,
              email: student.email,
              error:
                error instanceof Error
                  ? error.message
                  : "Error desconocido",
            });
          }
        }
      }

      setResults(results);
      if (results.success > 0) {
        setSuccessMsg(
          `${results.success} estudiante(s) registrado(s) exitosamente.`
        );
      }
      if (results.failed > 0) {
        setErrorMsg(
          `${results.failed} estudiante(s) fallaron. Revisa los detalles abajo.`
        );
      }
    } catch (error) {
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Error al procesar el archivo"
      );
    } finally {
      setIsProcessing(false);
      setProcessingStatus("");
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewData([]);
    setResults(null);
    setErrorMsg("");
    setSuccessMsg("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExcelFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setExcelErrorMsg("");
    setExcelSuccessMsg("");
    setExcelResults(null);

    if (!selectedFile.name.toLowerCase().endsWith(".xlsx") && !selectedFile.name.toLowerCase().endsWith(".xls")) {
      setExcelErrorMsg("Por favor, selecciona un archivo Excel (.xlsx o .xls).");
      return;
    }

    try {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const parsedRows = parseBulkUsersWorkbook(workbook);

      setExcelFile(selectedFile);
      setExcelPreviewData(parsedRows.slice(0, 5));
    } catch (error) {
      setExcelErrorMsg(
        error instanceof Error ? error.message : "No se pudo leer el archivo Excel."
      );
      setExcelFile(null);
      setExcelPreviewData([]);
    }
  };

  const handleExcelUpload = async () => {
    if (!excelFile) {
      setExcelErrorMsg("Selecciona un archivo Excel para continuar.");
      return;
    }

    setExcelIsProcessing(true);
    setExcelErrorMsg("");
    setExcelSuccessMsg("");
    setExcelResults(null);
    setExcelProcessingStatus("Procesando archivo Excel...");

    try {
      const buffer = await excelFile.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const rows = parseBulkUsersWorkbook(workbook);

      const supabase = createSupabaseBrowserClient();
      const results: ProcessingResult = {
        success: 0,
        failed: 0,
        errors: [],
      };

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        setExcelProcessingStatus(`Procesando ${index + 1} de ${rows.length} usuarios...`);

        try {
          if (!row.email || !row.fullName || !row.role || !row.password) {
            results.failed++;
            results.errors.push({
              row: row.rowNumber,
              email: row.email || "N/A",
              error: "Faltan campos requeridos",
            });
            continue;
          }

          const normalizedRole = row.role.trim().toLowerCase();
          if (!ALLOWED_ROLES.includes(normalizedRole)) {
            results.failed++;
            results.errors.push({
              row: row.rowNumber,
              email: row.email,
              error: `Rol inválido: ${row.role}`,
            });
            continue;
          }

          const { error } = await supabase.auth.signUp({
            email: row.email.toLowerCase().trim(),
            password: row.password,
            options: {
              data: {
                full_name: row.fullName,
                role: normalizedRole,
                user_type: normalizedRole,
              },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });

          if (error) {
            results.failed++;
            results.errors.push({
              row: row.rowNumber,
              email: row.email,
              error: error.message,
            });
          } else {
            results.success++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            row: row.rowNumber,
            email: row.email,
            error: error instanceof Error ? error.message : "Error desconocido",
          });
        }
      }

      setExcelResults(results);
      if (results.success > 0) {
        setExcelSuccessMsg(`${results.success} usuario(s) registrado(s) correctamente.`);
      }
      if (results.failed > 0) {
        setExcelErrorMsg(`${results.failed} usuario(s) fallaron. Revisa los detalles.`);
      }
    } catch (error) {
      setExcelErrorMsg(
        error instanceof Error ? error.message : "Error al procesar el archivo Excel."
      );
    } finally {
      setExcelIsProcessing(false);
      setExcelProcessingStatus("");
    }
  };

  const handleExcelReset = () => {
    setExcelFile(null);
    setExcelPreviewData([]);
    setExcelResults(null);
    setExcelErrorMsg("");
    setExcelSuccessMsg("");
    if (excelFileInputRef.current) {
      excelFileInputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const template = `Nombre Completo,Email,ID Estudiante,Carrera
Juan Pérez García,juan.perez@universidad.edu.mx,2024001,Ingeniería en Sistemas
María López González,maria.lopez@universidad.edu.mx,2024002,Ingeniería en Sistemas
Carlos Rodríguez Martínez,carlos.rodriguez@universidad.edu.mx,2024003,Administración de Empresas`;

    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "template_estudiantes.csv";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadExcelTemplate = () => {
    const templateRows = [
      ["Nombre Completo", "Email", "Rol", "Contraseña"],
      ["Juan Pérez García", "juan.perez@syncut.edu.mx", "student", "TempPass123!"],
      ["María López", "maria.lopez@syncut.edu.mx", "teacher", "TempPass123!"],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, REQUIRED_EXCEL_SHEET_NAME);

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla_usuarios_syncut.xlsx";
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface-container border border-outline-variant shadow-lg shadow-black/50">
            <span className="material-symbols-outlined fill text-primary text-2xl">
              upload_file
            </span>
          </div>
          <div>
            <h1 className="font-headline text-2xl font-bold tracking-tight text-on-surface">
              Carga Masiva de Estudiantes
            </h1>
            <p className="text-on-surface-variant text-sm">
              Importa múltiples estudiantes a través de un archivo CSV
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Section */}
        <div className="lg:col-span-2">
          <div className="bg-surface-container border border-outline-variant rounded-xl p-8 shadow-2xl shadow-black/80">
            {/* File Upload Area */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-on-surface mb-3">
                Selecciona un archivo CSV
              </label>
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Subir archivo CSV para estudiantes"
                  title="Subir archivo CSV para estudiantes"
                  disabled={isProcessing}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="w-full flex flex-col items-center justify-center px-6 py-8 border-2 border-dashed border-outline-variant rounded-lg hover:border-primary hover:bg-surface-container-low transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">
                    cloud_upload
                  </span>
                  <span className="text-sm font-medium text-on-surface">
                    {file ? file.name : "Haz clic para seleccionar un archivo"}
                  </span>
                  <span className="text-xs text-on-surface-variant mt-1">
                    o arrastra un archivo CSV aquí
                  </span>
                </button>
              </div>
              <p className="text-xs text-on-surface-variant mt-2">
                Máximo 5MB. Formato: CSV con columnas Nombre, Email, ID
                Estudiante
              </p>
            </div>

            {/* Preview Section */}
            {previewData.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-on-surface mb-3">
                  Vista Previa (primeros 5 registros)
                </h3>
                <div className="overflow-x-auto bg-surface-container-low rounded-lg border border-outline-variant">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-container-highest border-b border-outline-variant">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-on-surface">
                          Nombre
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-on-surface">
                          Email
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-on-surface">
                          ID Estudiante
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-on-surface">
                          Carrera
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((student, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-outline-variant hover:bg-primary/5"
                        >
                          <td className="px-4 py-2 text-on-surface">
                            {student.fullName}
                          </td>
                          <td className="px-4 py-2 text-on-surface">
                            {student.email}
                          </td>
                          <td className="px-4 py-2 text-on-surface">
                            {student.studentId}
                          </td>
                          <td className="px-4 py-2 text-on-surface">
                            {student.carrera}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Notifications */}
            {errorMsg && (
              <div className="flex items-start gap-3 text-error bg-error/10 p-3 rounded-lg mb-4">
                <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">
                  error
                </span>
                <p className="text-sm">{errorMsg}</p>
              </div>
            )}

            {successMsg && (
              <div className="flex items-start gap-3 text-tertiary bg-tertiary/10 p-3 rounded-lg mb-4">
                <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">
                  check_circle
                </span>
                <p className="text-sm">{successMsg}</p>
              </div>
            )}

            {processingStatus && (
              <div className="flex items-start gap-3 text-primary bg-primary/10 p-3 rounded-lg mb-4">
                <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5 animate-spin">
                  progress_activity
                </span>
                <p className="text-sm">{processingStatus}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={!file || isProcessing}
                className="flex-1 flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-on-primary bg-primary hover:bg-primary-fixed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">
                  upload
                </span>
                {isProcessing ? "Procesando..." : "Cargar Estudiantes"}
              </button>
              <button
                onClick={handleReset}
                disabled={isProcessing}
                className="flex justify-center items-center gap-2 py-2.5 px-4 border border-outline rounded-lg text-sm font-bold text-on-surface hover:bg-surface-container-highest focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
                Cancelar
              </button>
            </div>
          </div>
        </div>

        {/* Info Panel */}
        <div>
          {/* Template Download */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-2xl shadow-black/80 mb-6">
            <h3 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                file_download
              </span>
              Plantilla CSV
            </h3>
            <p className="text-xs text-on-surface-variant mb-4">
              Descarga una plantilla CSV con el formato correcto.
            </p>
            <button
              onClick={downloadTemplate}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-primary rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">
                download
              </span>
              Descargar Plantilla
            </button>
          </div>

          {/* Instructions */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-6 shadow-2xl shadow-black/80">
            <h3 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">
                info
              </span>
              Instrucciones
            </h3>
            <ul className="space-y-2 text-xs text-on-surface-variant">
              <li className="flex gap-2">
                <span className="text-primary font-bold flex-shrink-0">1.</span>
                <span>Descarga la plantilla CSV</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold flex-shrink-0">2.</span>
                <span>Completa los datos de los estudiantes</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold flex-shrink-0">3.</span>
                <span>Guarda el archivo en formato CSV</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold flex-shrink-0">4.</span>
                <span>Carga el archivo aquí</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary font-bold flex-shrink-0">5.</span>
                <span>Revisa los resultados</span>
              </li>
            </ul>
          </div>

          {/* Results Summary */}
          {results && (
            <div className="mt-6 bg-surface-container border border-outline-variant rounded-xl p-6 shadow-2xl shadow-black/80">
              <h3 className="text-sm font-semibold text-on-surface mb-4">
                Resumen de Resultados
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center p-3 bg-tertiary/10 rounded-lg">
                  <span className="text-xs font-medium text-on-surface">
                    Exitosos
                  </span>
                  <span className="text-sm font-bold text-tertiary">
                    {results.success}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-error/10 rounded-lg">
                  <span className="text-xs font-medium text-on-surface">
                    Fallos
                  </span>
                  <span className="text-sm font-bold text-error">
                    {results.failed}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 bg-surface-container border border-outline-variant rounded-xl p-8 shadow-2xl shadow-black/80">
        <div className="flex items-center gap-3 mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-surface-container border border-outline-variant shadow-lg shadow-black/50">
            <span className="material-symbols-outlined text-primary text-2xl">description</span>
          </div>
          <div>
            <h2 className="font-headline text-xl font-bold tracking-tight text-on-surface">
              Alta masiva de usuarios desde Excel
            </h2>
            <p className="text-on-surface-variant text-sm">
              Usa un archivo Excel con la hoja "{REQUIRED_EXCEL_SHEET_NAME}" y columnas para registrar usuarios de forma masiva.
            </p>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-on-surface mb-3">
            Selecciona un archivo Excel
          </label>
          <div className="relative">
            <input
              ref={excelFileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelFileChange}
              className="hidden"
              aria-label="Subir archivo Excel para usuarios"
              title="Subir archivo Excel para usuarios"
              disabled={excelIsProcessing}
            />
            <button
              onClick={() => excelFileInputRef.current?.click()}
              disabled={excelIsProcessing}
              className="w-full flex flex-col items-center justify-center px-6 py-8 border-2 border-dashed border-outline-variant rounded-lg hover:border-primary hover:bg-surface-container-low transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-2">
                upload_file
              </span>
              <span className="text-sm font-medium text-on-surface">
                {excelFile ? excelFile.name : "Haz clic para seleccionar un archivo Excel"}
              </span>
              <span className="text-xs text-on-surface-variant mt-1">
                Se requiere una hoja llamada Usuarios con columnas: Nombre Completo, Email, Rol, Contraseña
              </span>
            </button>
          </div>
        </div>

        {excelPreviewData.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-on-surface mb-3">
              Vista previa (primeros 5 registros)
            </h3>
            <div className="overflow-x-auto bg-surface-container-low rounded-lg border border-outline-variant">
              <table className="w-full text-xs">
                <thead className="bg-surface-container-highest border-b border-outline-variant">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-on-surface">Nombre</th>
                    <th className="px-4 py-2 text-left font-semibold text-on-surface">Email</th>
                    <th className="px-4 py-2 text-left font-semibold text-on-surface">Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {excelPreviewData.map((user, idx) => (
                    <tr key={idx} className="border-b border-outline-variant hover:bg-primary/5">
                      <td className="px-4 py-2 text-on-surface">{user.fullName}</td>
                      <td className="px-4 py-2 text-on-surface">{user.email}</td>
                      <td className="px-4 py-2 text-on-surface">{user.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {excelErrorMsg && (
          <div className="flex items-start gap-3 text-error bg-error/10 p-3 rounded-lg mb-4">
            <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">error</span>
            <p className="text-sm">{excelErrorMsg}</p>
          </div>
        )}

        {excelSuccessMsg && (
          <div className="flex items-start gap-3 text-tertiary bg-tertiary/10 p-3 rounded-lg mb-4">
            <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">check_circle</span>
            <p className="text-sm">{excelSuccessMsg}</p>
          </div>
        )}

        {excelProcessingStatus && (
          <div className="flex items-start gap-3 text-primary bg-primary/10 p-3 rounded-lg mb-4">
            <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5 animate-spin">progress_activity</span>
            <p className="text-sm">{excelProcessingStatus}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleExcelUpload}
            disabled={!excelFile || excelIsProcessing}
            className="flex-1 flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-on-primary bg-primary hover:bg-primary-fixed transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[20px]">upload</span>
            {excelIsProcessing ? "Procesando..." : "Registrar usuarios"}
          </button>

          <button
            onClick={downloadExcelTemplate}
            className="flex justify-center items-center gap-2 py-2.5 px-4 border border-primary rounded-lg text-sm font-bold text-primary hover:bg-primary/10 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Plantilla Excel
          </button>

          <button
            onClick={handleExcelReset}
            disabled={excelIsProcessing}
            className="flex justify-center items-center gap-2 py-2.5 px-4 border border-outline rounded-lg text-sm font-bold text-on-surface hover:bg-surface-container-highest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
            Cancelar
          </button>
        </div>
      </div>

      {/* Detailed Errors Table */}
      {results && results.errors.length > 0 && (
        <div className="mt-8 bg-surface-container border border-outline-variant rounded-xl p-6 shadow-2xl shadow-black/80">
          <h3 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-error">
              report_problem
            </span>
            Errores Detallados
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-container-highest border-b border-outline-variant">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-on-surface">
                    Fila
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-on-surface">
                    Email
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-on-surface">
                    Descripción del Error
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.errors.map((error, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-outline-variant hover:bg-error/5"
                  >
                    <td className="px-4 py-2 text-on-surface font-medium">
                      {error.row}
                    </td>
                    <td className="px-4 py-2 text-on-surface">{error.email}</td>
                    <td className="px-4 py-2 text-error">{error.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
