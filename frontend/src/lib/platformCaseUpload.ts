/** In-memory store for case files uploaded on the workbench (not persisted across refresh). */

let pendingFiles: File[] = [];

export function setPendingCaseFiles(files: File[]) {
  pendingFiles = [...files];
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
