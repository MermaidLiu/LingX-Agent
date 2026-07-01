import type { ChatAnalyzeResult, PathologyImagingGradeResult, PlatformDiagnosis } from "../api/platform";
import type { PetCtInterviewRecord } from "../api/client";

const SESSION_KEY = "pmp_platform_session";

/** Full pathology result (incl. base64 image) — in-memory only, not sessionStorage. */
let pathologyImagingFull: PathologyImagingGradeResult | null = null;

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

/** Strip large blobs before persisting to sessionStorage (~5MB quota). */
export function slimPathologyImaging(
  result: PathologyImagingGradeResult | null | undefined,
): PathologyImagingGradeResult | null {
  if (!result) return null;
  return {
    status: result.status,
    message: result.message,
    grade_label: result.grade_label,
    confidence: result.confidence,
    result_image_base64: "",
    dicom_count: result.dicom_count,
  };
}

export function loadPlatformSession(): PlatformSession {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) } as PlatformSession;
  } catch {
    /* ignore */
  }
  return { ...EMPTY };
}

function persistSession(next: PlatformSession) {
  const payload: PlatformSession = {
    ...next,
    pathologyImaging: slimPathologyImaging(next.pathologyImaging),
  };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded — keep only essentials for cross-page navigation
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
          ...EMPTY,
          savedExamId: payload.savedExamId,
          uploadedFileNames: payload.uploadedFileNames.slice(0, 50),
          pathologyImaging: slimPathologyImaging(payload.pathologyImaging),
          updatedAt: payload.updatedAt,
        }),
      );
    } catch {
      /* sessionStorage unavailable or still too large */
    }
  }
}

export function savePlatformSession(partial: Partial<PlatformSession>) {
  const next = { ...loadPlatformSession(), ...partial, updatedAt: new Date().toISOString() };
  persistSession(next);
}

export function setAnalysisResult(result: ChatAnalyzeResult) {
  if (result.pathology_imaging) {
    pathologyImagingFull = result.pathology_imaging;
  }
  savePlatformSession({
    diagnosis: result.diagnosis,
    record: result.record,
    fusionSummary: result.fusion_summary,
    savedExamId: null,
    pathologyImaging: result.pathology_imaging ?? null,
  });
}

export function setPathologyImagingResult(result: PathologyImagingGradeResult, fileNames: string[] = []) {
  pathologyImagingFull = result;
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
  pathologyImagingFull = null;
  sessionStorage.removeItem(SESSION_KEY);
}

export function getDiagnosisOrNull(): PlatformDiagnosis | null {
  return loadPlatformSession().diagnosis;
}

export function getPathologyImagingOrNull(): PathologyImagingGradeResult | null {
  return pathologyImagingFull ?? loadPlatformSession().pathologyImaging;
}
