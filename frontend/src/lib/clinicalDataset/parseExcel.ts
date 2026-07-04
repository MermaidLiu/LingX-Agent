import * as XLSX from "xlsx";
import {
  CATEGORY_LABELS,
  DEFAULT_PURCHASED_MODULES,
  type ClinicalRecord,
  type ClinicalVariable,
  type ColumnCategory,
  type FileLinkKey,
  type ParseExcelOptions,
  type ParseExcelResult,
  type PurchasedModules,
  type VariableType,
} from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const FILE_LINK_RE = /\{([^}]+)\}/;
const PATIENT_ID_RE = /患者\s*ID/i;

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function forwardFillCategories(row: string[]): string[] {
  const out: string[] = [];
  let last = "";
  for (const c of row) {
    if (c) last = c;
    out.push(last);
  }
  return out;
}

function normalizeCategory(label: string, varName: string): ColumnCategory {
  const s = `${label}${varName}`;
  if (PATIENT_ID_RE.test(varName) || PATIENT_ID_RE.test(label)) return "patient_id";
  if (/影像/.test(s)) return "imaging_file";
  if (/病理/.test(s)) return "pathology_file";
  if (/波形|心电|脑电|ECG|EEG/.test(s)) return "waveform_file";
  if (/患者信息|实验室|检查|临床/.test(s)) return "patient_info";
  return "unknown";
}

function parseFileLinkKey(varName: string): FileLinkKey | undefined {
  const m = varName.match(FILE_LINK_RE);
  if (!m) return undefined;
  const key = m[1].trim();
  if (key === "患者ID" || key === "检查号" || key === "文件名") return key;
  return "文件名";
}

function displayVarName(raw: string): string {
  return raw.replace(FILE_LINK_RE, "").trim() || raw.trim();
}

function isModulePurchased(cat: ColumnCategory, modules: PurchasedModules): boolean {
  if (cat === "imaging_file") return modules.imaging;
  if (cat === "pathology_file") return modules.pathology;
  if (cat === "waveform_file") return modules.waveform;
  return true;
}

function inferVariableType(values: string[], isFile: boolean): VariableType {
  if (isFile) return "file";
  const nonEmpty = values.map((v) => v.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return "text";

  if (nonEmpty.every((v) => DATE_RE.test(v))) return "date";

  const allNumeric = nonEmpty.every((v) => !Number.isNaN(Number(v)) && v !== "");
  if (allNumeric) {
    const unique = new Set(nonEmpty).size;
    return unique > 20 ? "numerical" : "categorical";
  }

  const unique = new Set(nonEmpty).size;
  return unique <= 20 ? "categorical" : "text";
}

function calcFillRate(values: string[]): number {
  if (values.length === 0) return 0;
  const filled = values.filter((v) => v.trim() !== "").length;
  return Math.round((filled / values.length) * 10000) / 100;
}

export function parseClinicalExcelBuffer(
  buffer: ArrayBuffer,
  datasetName: string,
  options: ParseExcelOptions = {},
): ParseExcelResult {
  const modules = options.purchasedModules ?? DEFAULT_PURCHASED_MODULES;
  const warnings: string[] = [];
  const errors: string[] = [];

  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" }) as unknown[][];

  if (grid.length < 3) {
    errors.push("Excel 至少需要 3 行：第 1 行类型、第 2 行变量名、第 3 行起为数据");
    return {
      dataset: { name: datasetName, variables: [], rows: [], patientIdField: "", usedFileLinkKeys: [] },
      warnings,
      errors,
    };
  }

  const typeRow = forwardFillCategories(grid[0].map(cellStr));
  const varRow = grid[1].map(cellStr);

  const colCount = Math.max(typeRow.length, varRow.length);
  const columns: {
    index: number;
    categoryLabel: string;
    category: ColumnCategory;
    rawName: string;
    name: string;
    fileLinkKey?: FileLinkKey;
    skipped: boolean;
  }[] = [];

  for (let i = 0; i < colCount; i++) {
    const categoryLabel = typeRow[i] ?? "";
    const rawName = varRow[i] ?? "";
    if (!rawName && !PATIENT_ID_RE.test(categoryLabel)) continue;

    const name = rawName ? displayVarName(rawName) : displayVarName(categoryLabel);
    if (!name) continue;

    const category = normalizeCategory(categoryLabel, rawName || categoryLabel);
    const fileLinkKey = parseFileLinkKey(rawName);
    const isFileCat = category === "imaging_file" || category === "pathology_file" || category === "waveform_file";
    const skipped = isFileCat && !isModulePurchased(category, modules);

    columns.push({
      index: i,
      categoryLabel: categoryLabel || CATEGORY_LABELS[category],
      category,
      rawName: rawName || categoryLabel,
      name,
      fileLinkKey: isFileCat || fileLinkKey ? fileLinkKey ?? "文件名" : undefined,
      skipped,
    });
  }

  const nameCounts = new Map<string, number>();
  for (const c of columns) {
    nameCounts.set(c.name, (nameCounts.get(c.name) ?? 0) + 1);
  }
  for (const [n, count] of nameCounts) {
    if (count > 1) errors.push(`变量名重复：「${n}」出现 ${count} 次`);
  }

  const patientCol = columns.find((c) => c.category === "patient_id") ?? columns.find((c) => PATIENT_ID_RE.test(c.name));
  if (!patientCol) {
    errors.push("未找到「患者 ID」列，第一行类型或第二行变量名须包含患者 ID");
  }

  const dataRows = grid.slice(2).filter((row) => row.some((c) => cellStr(c) !== ""));
  const usedFileLinkKeys: string[] = [];

  const variables: ClinicalVariable[] = columns.map((col) => {
    const colValues = dataRows.map((row) => cellStr(row[col.index]));
    const isFile = col.fileLinkKey != null || col.category.includes("_file");
    let skipped = col.skipped;

    if (isFile && col.fileLinkKey && !skipped) {
      const linkId = `${col.category}:${col.fileLinkKey}`;
      if (usedFileLinkKeys.includes(linkId)) {
        warnings.push(`文件关联键「${col.fileLinkKey}」已在其他列使用，列「${col.name}」不会自动关联文件`);
        skipped = true;
      } else {
        usedFileLinkKeys.push(linkId);
      }
    }

    if (skipped && col.skipped) {
      warnings.push(`列「${col.name}」属于未购买模块，已跳过文件解析`);
    }

    const inferred = inferVariableType(colValues, isFile);
    return {
      id: `var_${col.index}_${col.name}`,
      name: col.name,
      category: col.category,
      categoryLabel: col.categoryLabel,
      type: inferred,
      fileLinkKey: col.fileLinkKey,
      skipped,
      fillRate: calcFillRate(colValues),
    };
  });

  const rows: ClinicalRecord[] = [];
  const patientIdField = patientCol?.name ?? "患者 ID";
  const seenIds = new Set<string>();

  for (const row of dataRows) {
    const record: ClinicalRecord = {};
    for (const col of columns) {
      record[col.name] = cellStr(row[col.index]);
    }
    const pid = record[patientIdField]?.trim();
    if (!pid) {
      warnings.push("存在患者 ID 为空的行，已跳过");
      continue;
    }
    if (seenIds.has(pid)) {
      errors.push(`患者 ID 重复：${pid}`);
      continue;
    }
    seenIds.add(pid);
    rows.push(record);
  }

  if (errors.length > 0) {
    return {
      dataset: { name: datasetName, variables, rows, patientIdField, usedFileLinkKeys },
      warnings,
      errors,
    };
  }

  return {
    dataset: {
      name: datasetName,
      variables,
      rows,
      patientIdField,
      usedFileLinkKeys,
    },
    warnings,
    errors,
  };
}

export async function parseClinicalExcelFile(
  file: File,
  datasetName?: string,
  options?: ParseExcelOptions,
): Promise<ParseExcelResult> {
  const buffer = await file.arrayBuffer();
  const name = datasetName?.trim() || file.name.replace(/\.(xlsx|xls|csv)$/i, "");
  return parseClinicalExcelBuffer(buffer, name, options);
}
