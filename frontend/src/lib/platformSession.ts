import type { ChatAnalyzeResult, PathologyImagingGradeResult, PlatformDiagnosis } from "../api/platform";
import type { PetCtInterviewRecord } from "../api/client";

const SESSION_KEY = "pmp_platform_session";

export type PlatformSession = {
  diagnosis: PlatformDiagnosis | null;
  record: PetCtInterviewRecord | null;
  fusionSummary: string;
  savedExamId: string | null;
  pathologyImaging: PathologyImagingGradeResult | null;
  uploadedFileNames: string[];
  updatedAt: string;
};

const EMPTY: PlatformSession = {
  diagnosis: null,
  record: null,
  fusionSummary: "",
  savedExamId: null,
  pathologyImaging: null,
  uploadedFileNames: [],
  updatedAt: "",
};

export function loadPlatformSession(): PlatformSession {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) } as PlatformSession;
  } catch {
    /* ignore */
  }
  return { ...EMPTY };
}

export function savePlatformSession(partial: Partial<PlatformSession>) {
  const next = { ...loadPlatformSession(), ...partial, updatedAt: new Date().toISOString() };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
}

export function setAnalysisResult(result: ChatAnalyzeResult) {
  savePlatformSession({
    diagnosis: result.diagnosis,
    record: result.record,
    fusionSummary: result.fusion_summary,
    savedExamId: null,
    pathologyImaging: result.pathology_imaging ?? null,
  });
}

export function setPathologyImagingResult(result: PathologyImagingGradeResult, fileNames: string[] = []) {
  savePlatformSession({
    pathologyImaging: result,
    uploadedFileNames: fileNames,
    savedExamId: null,
  });
}

export function markSaved(examId: string) {
  savePlatformSession({ savedExamId: examId });
}

export function clearPlatformSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getDiagnosisOrNull(): PlatformDiagnosis | null {
  return loadPlatformSession().diagnosis;
}

export function getPathologyImagingOrNull(): PathologyImagingGradeResult | null {
  return loadPlatformSession().pathologyImaging;
}
