import { Navigate, Route, Routes } from "react-router-dom";
import PlatformLayout from "./layouts/PlatformLayout";
import BasicLayout from "./layouts/BasicLayout";
import DashboardHome from "./pages/DashboardHome";
import PlatformChatPage from "./pages/platform/PlatformChatPage";
import PlatformCohortAnalysisPage from "./pages/platform/PlatformCohortAnalysisPage";
import PlatformImagingDbPage from "./pages/platform/PlatformImagingDbPage";
import PlatformKnowledgePage from "./pages/platform/PlatformKnowledgePage";
import PlatformPatientDbPage from "./pages/platform/PlatformPatientDbPage";
import PlatformPlaceholderPage from "./pages/platform/PlatformPlaceholderPage";
import PlatformPrognosisPage from "./pages/platform/PlatformPrognosisPage";
import PlatformTreatmentPage from "./pages/platform/PlatformTreatmentPage";
import PlatformWorkflowPage from "./pages/platform/PlatformWorkflowPage";

/** 旧版模块入口（保留兼容，不在主导航展示） */
import ModuleCohort from "./pages/ModuleCohort";
import ModuleIngestion from "./pages/ModuleIngestion";
import ModuleKnowledge from "./pages/ModuleKnowledge";
import ModuleOutputs from "./pages/ModuleOutputs";
import ModulePathology from "./pages/ModulePathology";
import ModuleTreatment from "./pages/ModuleTreatment";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PlatformLayout />}>
        <Route index element={<PlatformChatPage />} />
        <Route path="workflow" element={<PlatformWorkflowPage />} />
        <Route path="db/patients" element={<PlatformPatientDbPage />} />
        <Route path="db/imaging" element={<PlatformImagingDbPage />} />
        <Route path="db/pathology" element={<Navigate to="/db/patients" replace />} />
        <Route path="db/genetics" element={<Navigate to="/db/patients" replace />} />
        <Route path="db/literature" element={<Navigate to="/knowledge" replace />} />
        <Route path="analysis/diagnosis" element={<PlatformWorkflowPage />} />
        <Route path="analysis/treatment" element={<PlatformTreatmentPage />} />
        <Route path="analysis/prognosis" element={<PlatformPrognosisPage />} />
        <Route path="analysis/cohort" element={<PlatformCohortAnalysisPage />} />
        <Route path="knowledge" element={<PlatformKnowledgePage />} />
        <Route path="research/stats" element={<Navigate to="/knowledge" replace />} />
        <Route path="research/charts" element={<Navigate to="/knowledge" replace />} />
        <Route path="research/review" element={<Navigate to="/knowledge" replace />} />
        <Route path="research/ppt" element={<Navigate to="/knowledge" replace />} />
        <Route path="settings" element={<PlatformPlaceholderPage />} />
      </Route>

      <Route path="/legacy" element={<BasicLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="ingestion" element={<ModuleIngestion />} />
        <Route path="pathology" element={<ModulePathology />} />
        <Route path="treatment" element={<ModuleTreatment />} />
        <Route path="cohort" element={<ModuleCohort />} />
        <Route path="knowledge" element={<ModuleKnowledge />} />
        <Route path="outputs" element={<ModuleOutputs />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
