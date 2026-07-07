import type { ChatAnalyzeResult, PathologyImagingGradeResult, PlatformDiagnosis } from "../api/platform";
import type { PetCtInterviewRecord } from "../api/client";
import { cachePathologyImage, clearPathologyImageCache, fingerprintImageKey, loadPathologyImage } from "./pathologyImagingCache";

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
  uploadedFileFingerprint: string;
  updatedAt: string;
};

const EMPTY: PlatformSession = {
  diagnosis: null,
  record: null,
  fusionSummary: "",
  savedExamId: null,
  pathologyImaging: null,
  uploadedFileNames: [],
  uploadedFileFingerprint: "",
  updatedAt: "",
};

/** Strip large blobs before persisting to sessionStorage (~5MB quota). */
export function slimPathologyImaging(
  result: PathologyImagingGradeResult | null | undefined,
): PathologyImagingGradeResult | null {
  if (!result) return null;
  const raw = result.raw;
  const slimRaw =
    raw &&
    (raw.pci ||
      raw.pci_paths_tried ||
      raw.sessionId ||
      raw.selected_slice_filename ||
      raw.slice_manifest ||
      raw.fingerprint)
      ? {
          pci: raw.pci,
          pci_paths_tried: raw.pci_paths_tried,
          sessionId: raw.sessionId,
          selected_slice_filename: raw.selected_slice_filename,
          selected_slice_index: raw.selected_slice_index,
          fingerprint: raw.fingerprint,
          slice_manifest: raw.slice_manifest,
          slice_count: raw.slice_count,
        }
      : undefined;
  return {
    status: result.status,
    message: result.message,
    grade_label: result.grade_label,
    confidence: result.confidence,
    result_image_base64: "",
    dicom_count: result.dicom_count,
    exam_id: result.exam_id,
    saved: result.saved,
    annotation_dataset_id: result.annotation_dataset_id,
    annotation_slice_count: result.annotation_slice_count,
    annotation_slices_with_mask: result.annotation_slices_with_mask,
    pci: result.pci ?? null,
    raw: slimRaw,
  };
}

function rememberPathologyResult(result: PathologyImagingGradeResult, fileFingerprint = "") {
  pathologyImagingFull = result;
  const session = loadPlatformSession();
  const examId = result.exam_id || session.savedExamId;
  const fp = fileFingerprint || session.uploadedFileFingerprint;
  if (!result.result_image_base64) return;
  if (examId) void cachePathologyImage(examId, result.result_image_base64);
  if (fp) void cachePathologyImage(fingerprintImageKey(fp), result.result_image_base64);
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
    rememberPathologyResult(result.pathology_imaging, loadPlatformSession().uploadedFileFingerprint);
  }
  savePlatformSession({
    diagnosis: result.diagnosis,
    record: result.record,
    fusionSummary: result.fusion_summary,
    savedExamId: result.record?.patient_base_info?.exam_id ?? null,
    pathologyImaging: result.pathology_imaging ?? null,
  });
}

export function setPathologyImagingResult(
  result: PathologyImagingGradeResult,
  fileNames: string[] = [],
  fileFingerprint = "",
) {
  rememberPathologyResult(result, fileFingerprint);
  savePlatformSession({
    pathologyImaging: result,
    uploadedFileNames: fileNames,
    uploadedFileFingerprint: fileFingerprint,
    savedExamId: result.exam_id || null,
  });
}

export function markSaved(examId: string) {
  savePlatformSession({ savedExamId: examId });
}

export function clearPlatformSession() {
  pathologyImagingFull = null;
  void clearPathologyImageCache();
  sessionStorage.removeItem(SESSION_KEY);
}

export function getDiagnosisOrNull(): PlatformDiagnosis | null {
  return loadPlatformSession().diagnosis;
}

export function getPathologyImagingOrNull(): PathologyImagingGradeResult | null {
  return pathologyImagingFull ?? loadPlatformSession().pathologyImaging;
}

export function hasSuccessfulPathologyResult(): boolean {
  const r = getPathologyImagingOrNull();
  return Boolean(r && r.status === "ok");
}

/** Restore visualization image from IndexedDB when re-entering the analysis page. */
export async function hydratePathologyImagingResult(
  result: PathologyImagingGradeResult | null,
): Promise<PathologyImagingGradeResult | null> {
  if (!result || result.result_image_base64) return result;
  const session = loadPlatformSession();
  const keys = [
    result.exam_id,
    session.savedExamId,
    session.uploadedFileFingerprint ? fingerprintImageKey(session.uploadedFileFingerprint) : "",
  ].filter(Boolean) as string[];
  for (const key of keys) {
    const cached = await loadPathologyImage(key);
    if (cached) {
      const hydrated = { ...result, result_image_base64: cached };
      pathologyImagingFull = hydrated;
      return hydrated;
    }
  }
  return result;
}
