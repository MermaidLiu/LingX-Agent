import type { PlatformPatient } from "../api/platform";
import {
  loadFollowUpBatch,
  type FollowUpBatchCase,
} from "./followUpBatchStore";
import type { BatchOperationIntent, BatchPatientRef } from "./platformBatchSelection";
import { saveBatchSelection } from "./platformBatchSelection";

const CONTEXT_KEY = "pmp_research_batch_context";

export type ResearchBatchSource = "follow_up_batch" | "research_upload" | "patient_db";

export type ResearchBatchContext = {
  source: ResearchBatchSource;
  activatedAt: string;
  clinical: BatchPatientRef[];
  imaging: BatchPatientRef[];
  label: string;
};

function slimFromPatient(p: PlatformPatient): BatchPatientRef {
  return {
    id: p.id,
    name: p.name,
    examId: p.examId || p.admissionId || p.id,
    gradeLabel: p.gradeLabel,
    hasAnnotatedImage: p.hasAnnotatedImage,
    diagnosis: p.diagnosis,
    pciScore: p.pciScore,
  };
}

function slimFromFollowUpCase(c: FollowUpBatchCase): BatchPatientRef {
  return {
    id: c.visitId,
    name: c.name,
    examId: c.visitId,
    gradeLabel: c.gradeLabel,
    hasAnnotatedImage: Boolean(c.niiVolumeId),
    diagnosis: c.diagnosis,
    pciScore: c.pciScore,
    niiVolumeId: c.niiVolumeId ?? undefined,
    ctVolumeId: c.ctVolumeId ?? undefined,
  };
}

export function saveResearchBatchContext(ctx: ResearchBatchContext): void {
  try {
    sessionStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx));
  } catch {
    /* ignore */
  }
}

export function loadResearchBatchContext(): ResearchBatchContext | null {
  try {
    const raw = sessionStorage.getItem(CONTEXT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ResearchBatchContext;
  } catch {
    return null;
  }
}

export function getResearchBatchPatients(module: "clinical" | "imaging"): BatchPatientRef[] {
  const ctx = loadResearchBatchContext();
  if (!ctx) return [];
  return module === "imaging" ? ctx.imaging : ctx.clinical;
}

export function activateResearchFromFollowUpBatch(
  source: Extract<ResearchBatchSource, "follow_up_batch" | "research_upload">,
): ResearchBatchContext | null {
  const batch = loadFollowUpBatch();
  if (!batch?.cases.length) return null;

  const clinical = batch.cases.map(slimFromFollowUpCase);
  const imaging = batch.cases.filter((c) => c.niiVolumeId).map(slimFromFollowUpCase);
  const labelParts = [
    batch.excelFileName ? batch.excelFileName : null,
    batch.zipFileName ? batch.zipFileName : null,
  ].filter(Boolean);
  const label = `批量导入 · ${labelParts.join(" + ") || "随访队列"}（${batch.matchedCount}/${batch.cases.length} 已关联影像）`;

  const ctx: ResearchBatchContext = {
    source,
    activatedAt: new Date().toISOString(),
    clinical,
    imaging,
    label,
  };
  saveResearchBatchContext(ctx);
  return ctx;
}

export function activateResearchFromPatients(
  patients: PlatformPatient[],
  source: Extract<ResearchBatchSource, "patient_db">,
  intent: BatchOperationIntent,
): ResearchBatchContext {
  const clinical = patients.map(slimFromPatient);
  const imaging = patients.filter((p) => p.hasAnnotatedImage).map(slimFromPatient);
  const ctx: ResearchBatchContext = {
    source,
    activatedAt: new Date().toISOString(),
    clinical,
    imaging,
    label: `患者库多选 · ${patients.length} 例`,
  };
  saveResearchBatchContext(ctx);
  saveBatchSelection(patients, intent);
  return ctx;
}
