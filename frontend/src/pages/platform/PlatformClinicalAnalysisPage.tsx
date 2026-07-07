import { Spin } from "antd";
import { useEffect, useMemo, useState } from "react";
import { platformListPatients } from "../../api/platform";
import ClinicalAnalysisWorkbench from "../../components/platform/clinicalDataset/ClinicalAnalysisWorkbench";
import { buildClinicalDatasetFromFollowUpCases } from "../../lib/clinicalDataset/buildFromFollowUpCases";
import {
  buildCohortFromBatchRefs,
  buildCohortFromPatients,
  buildDemoPmpCohort,
  RESEARCH_COHORT_DATASET_ID,
} from "../../lib/clinicalDataset/patientCohortDataset";
import { getClinicalDataset, saveClinicalDataset } from "../../lib/clinicalDataset/store";
import { consumeBatchSelection } from "../../lib/platformBatchSelection";
import { getResearchBatchPatients, loadResearchBatchContext } from "../../lib/researchBatchContext";
import { loadFollowUpBatch } from "../../lib/followUpBatchStore";

export default function PlatformClinicalAnalysisPage() {
  const researchClinical = useMemo(() => getResearchBatchPatients("clinical"), []);
  const batch = useMemo(() => {
    if (researchClinical.length) return { patients: researchClinical };
    return consumeBatchSelection("clinical");
  }, [researchClinical]);
  const [ready, setReady] = useState(false);
  const [batchCount, setBatchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      const ctx = loadResearchBatchContext();
      const followUpBatch = loadFollowUpBatch();
      let existing = getClinicalDataset(RESEARCH_COHORT_DATASET_ID);

      if (batch?.patients.length && ctx?.source === "patient_db") {
        try {
          const all = await platformListPatients({});
          const ids = new Set(batch.patients.map((p) => p.id));
          const selected = all.filter((p) => ids.has(p.id));
          const payload =
            selected.length > 0
              ? buildCohortFromPatients(selected, `患者库批次（${selected.length} 例）`)
              : buildCohortFromBatchRefs(batch.patients, `患者库批次（${batch.patients.length} 例）`);
          saveClinicalDataset({ ...payload, id: RESEARCH_COHORT_DATASET_ID });
          if (!cancelled) {
            setBatchCount(selected.length || batch.patients.length);
            setReady(true);
          }
          return;
        } catch {
          const payload = buildCohortFromBatchRefs(
            batch.patients,
            `患者库批次（${batch.patients.length} 例）`,
          );
          saveClinicalDataset({ ...payload, id: RESEARCH_COHORT_DATASET_ID });
          if (!cancelled) {
            setBatchCount(batch.patients.length);
            setReady(true);
          }
          return;
        }
      }

      if (!existing?.rows.length && followUpBatch?.cases.length) {
        saveClinicalDataset({
          ...buildClinicalDatasetFromFollowUpCases(
            followUpBatch.cases,
            `随访批量 · ${followUpBatch.excelFileName || followUpBatch.zipFileName || "队列"}`,
          ),
          id: RESEARCH_COHORT_DATASET_ID,
        });
        existing = getClinicalDataset(RESEARCH_COHORT_DATASET_ID);
      }

      if (!existing) {
        saveClinicalDataset({ ...buildDemoPmpCohort(), id: RESEARCH_COHORT_DATASET_ID });
        existing = getClinicalDataset(RESEARCH_COHORT_DATASET_ID);
      }

      if (!cancelled) {
        const n =
          existing?.rows.length ||
          ctx?.clinical.length ||
          followUpBatch?.cases.length ||
          0;
        setBatchCount(n);
        setReady(true);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [batch]);

  if (!ready) {
    return (
      <div className="pmp-section" style={{ textAlign: "center", padding: 48 }}>
        <Spin tip="加载临床数据…" />
      </div>
    );
  }

  return (
    <ClinicalAnalysisWorkbench
      datasetId={RESEARCH_COHORT_DATASET_ID}
      batchCount={batchCount}
      defaultTab="advanced"
    />
  );
}
