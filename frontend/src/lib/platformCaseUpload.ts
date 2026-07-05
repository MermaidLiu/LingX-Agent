import type { UploadFile } from "antd/es/upload/interface";

let pendingFiles: File[] = [];

export function toNativeFiles(list: UploadFile[] | File[]): File[] {
  return list.map((f) => {
    if (f instanceof File) return f;
    const rc = f as UploadFile;
    return (rc.originFileObj ?? rc) as File;
  });
}

export function setPendingCaseFiles(files: File[] | UploadFile[]) {
  const native = toNativeFiles(files);
  const seen = new Set<string>();
  pendingFiles = native.filter((f) => {
    const key = `${f.name}\0${f.size}\0${f.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function getPendingCaseFiles(): File[] {
  return [...pendingFiles];
}

export function hasPendingCaseFiles(): boolean {
  return pendingFiles.length > 0;
}

export function getPendingCaseFileNames(): string[] {
  return pendingFiles.map((f) => f.name);
}

/** Stable id for same upload batch (name + size + lastModified). */
export function pendingCaseFilesFingerprint(): string {
  return pendingFiles
    .map((f) => `${f.name}\0${f.size}\0${f.lastModified}`)
    .sort()
    .join("\n");
}

export function pendingCaseFilesChanged(storedNames: string[], storedFingerprint = ""): boolean {
  if (!pendingFiles.length) return false;
  const fp = pendingCaseFilesFingerprint();
  if (storedFingerprint && fp === storedFingerprint) return false;
  const a = pendingFiles.map((f) => f.name).sort().join("\0");
  const b = [...storedNames].sort().join("\0");
  return a !== b;
}

export function clearPendingCaseFiles() {
  pendingFiles = [];
}

/** Convert native File list to Ant Design UploadFile for composer UI. */
export function filesToUploadFiles(files: File[]) {
  return files.map((f, i) => ({
    uid: `wf-${f.name}-${f.size}-${f.lastModified}-${i}`,
    name: f.name,
    size: f.size,
    type: f.type,
    originFileObj: f as unknown as UploadFile["originFileObj"],
  })) as UploadFile[];
}

/** Merge workbench pending files with composer attachments (deduped). */
export function mergeAnalysisFiles(extra: File[] = []): File[] {
  const seen = new Set<string>();
  const out: File[] = [];
  for (const f of [...pendingFiles, ...extra]) {
    const key = `${f.name}\0${f.size}\0${f.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/** DICOM / ZIP files from the workbench for imaging tasks. */
export function getPendingDicomFiles(): File[] {
  return pendingFiles.filter((f) => {
    const lower = f.name.toLowerCase();
    return lower.endsWith(".dcm") || lower.endsWith(".dicom") || lower.endsWith(".zip");
  });
}
