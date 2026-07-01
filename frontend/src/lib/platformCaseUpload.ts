/** In-memory store for case files uploaded on the workbench (not persisted across refresh). */

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
  pendingFiles = toNativeFiles(files);
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

export function clearPendingCaseFiles() {
  pendingFiles = [];
}
