import JSZip from "jszip";
import type { PlatformPatient } from "../api/platform";
import { parseClinicalExcelBuffer } from "./clinicalDataset/parseExcel";
import { RESEARCH_COHORT_DATASET_ID } from "./clinicalDataset/patientCohortDataset";
import { saveClinicalDataset } from "./clinicalDataset/store";
import { isNiiFileName } from "./caseFileClassifier";
import { readClinicalExcelFile } from "./clinicalExcelSheet";
import { cacheNiiVolume, parseNiiVolume, resolveNiiRole } from "./niiVolumeStore";
import { loadPatients, savePatients } from "./platformPatients";
import {
  batchCasesToImagingRecords,
  batchCasesToPlatformPatients,
  loadFollowUpBatch,
  normalizeVisitId,
  padVisitId,
  findVisitIdInFileName,
  parseVisitIdFromNiiFileName,
  saveFollowUpBatch,
  visitIdsEqual,
  type FollowUpBatchCase,
  type FollowUpBatchState,
} from "./followUpBatchStore";

export type FollowUpBatchImportResult = FollowUpBatchState & {
  warnings: string[];
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function parseAge(raw: string): string {
  return raw || "";
}

function resolvePathologyGrade(raw: Record<string, string>, pathologyText: string): string {
  const gradeRaw =
    raw.病理分级 ?? raw["病理分级"] ?? raw.grade ?? raw.Grade ?? raw.GRADE ?? "";
  const v = cellStr(gradeRaw);
  if (v === "1" || v === "1.0") return "高级别";
  if (v === "0" || v === "0.0") return "低级别";
  if (/^高/.test(v) || /高级别|PMCA|高度/i.test(v)) return "高级别";
  if (/^低/.test(v) || /低级别|DPAM|低度/i.test(v)) return "低级别";
  const t = pathologyText || "";
  if (/低级别|DPAM|假粘液|低度/i.test(t) && !/高级别|PMCA|腹膜粘液癌|印戒|高度/i.test(t)) return "低级别";
  if (/高级别|PMCA|腹膜粘液癌|印戒|高度/i.test(t)) return "高级别";
  return "未确定";
}

function resolveVisitId(raw: Record<string, string>, line: unknown[]): string {
  const candidates = [
    raw.就诊号,
    raw["就诊号"],
    raw.VisitId,
    raw.ID,
    raw.id,
    raw["患者ID"],
    cellStr(line[0]),
  ].filter(Boolean);
  const id = cellStr(candidates[0]);
  if (/^\d+$/.test(id)) return padVisitId(id);
  return id;
}

function inferDiagnosis(pathology: string): string {
  if (/腹膜假粘液|PMP|DPAM|PMCA|腹膜粘液/i.test(pathology)) return "腹膜假粘液瘤（PMP）";
  if (/阑尾/i.test(pathology)) return "阑尾来源腹膜肿瘤";
  return pathology.slice(0, 40) || "待明确";
}

async function parseClinicalRows(
  file: File,
): Promise<{ rows: Omit<FollowUpBatchCase, "niiVolumeId" | "niiFileName" | "ctVolumeId" | "ctFileName" | "importedAt">[]; sheetName: string }> {
  const { matrix, sheetName, headerRowIndex } = await readClinicalExcelFile(file);
  if (matrix.length < headerRowIndex + 2) return { rows: [], sheetName };

  const headers = matrix[headerRowIndex].map((h) => cellStr(h));
  const rows: Omit<FollowUpBatchCase, "niiVolumeId" | "niiFileName" | "ctVolumeId" | "ctFileName" | "importedAt">[] = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const line = matrix[i];
    if (!line || line.every((c) => !cellStr(c))) continue;
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) raw[h] = cellStr(line[idx]);
    });

    const visitId = resolveVisitId(raw, line);
    if (!visitId) continue;

    const pathology = raw.病理 || raw.pathology || "";
    const pciRaw = raw.PCI评分 || raw.PCI || raw.pci;
    const pciScore = pciRaw != null && pciRaw !== "" ? Number(pciRaw) : null;

    const labs: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (["就诊号", "ID", "姓名", "性别", "年龄", "病理", "PCI评分", "PCI", "病理分级"].includes(k)) continue;
      if (v) labs[k] = v;
    }
    if (labs["CA-199"]) labs["CA19-9"] = labs["CA-199"];

    rows.push({
      visitId,
      name: raw.姓名 || raw.name || visitId,
      gender: raw.性别 || "",
      age: parseAge(raw.年龄 || ""),
      pciScore: Number.isFinite(pciScore) ? pciScore : null,
      pathology,
      gradeLabel: resolvePathologyGrade(raw, pathology),
      diagnosis: inferDiagnosis(pathology),
      labs,
      raw,
    });
  }
  return { rows, sheetName };
}

async function extractNiiFromZip(
  zipFile: File,
  clinicalVisitIds: string[],
): Promise<{ name: string; data: ArrayBuffer; visitId: string | null }[]> {
  const zip = await JSZip.loadAsync(zipFile);
  const out: { name: string; data: ArrayBuffer; visitId: string | null }[] = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const base = path.split("/").pop() || path;
    if (!isNiiFileName(base)) continue;
    const visitId =
      parseVisitIdFromNiiFileName(base) || findVisitIdInFileName(base, clinicalVisitIds);
    out.push({ name: base, data: await entry.async("arraybuffer"), visitId });
  }
  return out;
}

function findClinicalRow(
  rows: Omit<FollowUpBatchCase, "niiVolumeId" | "niiFileName" | "ctVolumeId" | "ctFileName" | "importedAt">[],
  roiVisitId: string,
) {
  return rows.find((r) => visitIdsEqual(r.visitId, roiVisitId));
}

function mergePatients(existing: PlatformPatient[], incoming: PlatformPatient[]): PlatformPatient[] {
  const map = new Map(existing.map((p) => [normalizeVisitId(p.id), p]));
  for (const p of incoming) {
    map.set(normalizeVisitId(p.id), p);
  }
  return Array.from(map.values());
}

export async function importFollowUpBatch(zipFile: File, excelFile: File): Promise<FollowUpBatchImportResult> {
  const warnings: string[] = [];
  const { rows: clinicalRows, sheetName } = await parseClinicalRows(excelFile);
  if (!clinicalRows.length) throw new Error("Excel 中未解析到有效病例（需含就诊号或 ID 列）");
  warnings.push(`已从工作表「${sheetName}」读取 ${clinicalRows.length} 例`);

  const clinicalVisitIds = clinicalRows.map((r) => r.visitId);
  const niiFiles = await extractNiiFromZip(zipFile, clinicalVisitIds);
  if (!niiFiles.length) {
    throw new Error("ZIP 中未找到 .nii / .nii.gz 预勾画文件");
  }

  const importedAt = new Date().toISOString();
  const fingerprint = `${zipFile.name}-${zipFile.size}-${excelFile.name}-${excelFile.size}`;
  const cases: FollowUpBatchCase[] = clinicalRows.map((r) => ({
    ...r,
    niiVolumeId: null,
    niiFileName: null,
    ctVolumeId: null,
    ctFileName: null,
    importedAt,
  }));

  const unmatchedNiiFiles: string[] = [];
  let ctLinkedCount = 0;

  for (const nii of niiFiles) {
    if (!nii.visitId) {
      unmatchedNiiFiles.push(nii.name);
      continue;
    }
    const row = findClinicalRow(clinicalRows, nii.visitId);
    if (!row) {
      unmatchedNiiFiles.push(nii.name);
      continue;
    }

    const vol = parseNiiVolume(
      nii.name,
      nii.data,
      `followup-${fingerprint}-${nii.visitId}-${nii.name.replace(/\W+/g, "_")}`,
    );
    await cacheNiiVolume(vol);
    const role = resolveNiiRole(nii.name, vol);
    const idx = cases.findIndex((c) => visitIdsEqual(c.visitId, row.visitId));
    if (idx < 0) continue;

    if (role === "roi") {
      cases[idx] = {
        ...cases[idx],
        niiVolumeId: vol.id,
        niiFileName: nii.name,
      };
    } else {
      cases[idx] = {
        ...cases[idx],
        ctVolumeId: vol.id,
        ctFileName: nii.name,
      };
      ctLinkedCount++;
    }
  }

  const matchedVisitIds = new Set(
    niiFiles
      .filter((n) => n.visitId && findClinicalRow(clinicalRows, n.visitId))
      .map((n) => padVisitId(n.visitId!)),
  );
  const unmatchedVisitIds = cases.filter((c) => !c.niiVolumeId).map((c) => c.visitId);

  if (unmatchedNiiFiles.length) {
    warnings.push(`${unmatchedNiiFiles.length} 个 NIfTI 未匹配到 Excel 就诊号：${unmatchedNiiFiles.slice(0, 3).join("、")}${unmatchedNiiFiles.length > 3 ? "…" : ""}`);
  }
  if (unmatchedVisitIds.length) {
    warnings.push(`${unmatchedVisitIds.length} 例临床记录未匹配到预勾画影像`);
  }
  if (ctLinkedCount > 0) {
    warnings.push(`${ctLinkedCount} 例已关联 CT 原图 NIfTI，预览将叠加显示`);
  }

  const state: FollowUpBatchState = {
    excelFileName: excelFile.name,
    zipFileName: zipFile.name,
    importedAt,
    cases,
    matchedCount: cases.filter((c) => c.niiVolumeId).length,
    unmatchedVisitIds,
    unmatchedNiiFiles,
  };
  saveFollowUpBatch(state);

  const excelBuf = await excelFile.arrayBuffer();
  const parsed = parseClinicalExcelBuffer(excelBuf, `随访批量 · ${excelFile.name}`);
  if (parsed.errors.length) {
    warnings.push(`临床数据集部分字段未按模板解析：${parsed.errors[0]}`);
  } else {
    const ds = parsed.dataset;
    if (ds.patientIdField && ds.patientIdField !== "就诊号") {
      ds.rows = ds.rows.map((row) => {
        const pid = row[ds.patientIdField];
        if (pid && !row.就诊号) return { ...row, 就诊号: pid };
        return row;
      });
    }
    saveClinicalDataset({ ...ds, id: RESEARCH_COHORT_DATASET_ID, name: `随访批量 · ${excelFile.name}` });
  }

  const patients = batchCasesToPlatformPatients(cases);
  savePatients(mergePatients(loadPatients(), patients));

  if (matchedVisitIds.size === 0) {
    warnings.push("未能完成任何就诊号与 ROI 的关联，请检查 Excel 就诊号与 roi_ 文件名前缀是否一致");
  }

  return { ...state, warnings };
}

export function listFollowUpBatchImaging() {
  const batch = loadFollowUpBatch();
  return batch ? batchCasesToImagingRecords(batch.cases) : [];
}
