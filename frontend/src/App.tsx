import { Navigate, Route, Routes } from "react-router-dom";
import PlatformLayout from "./layouts/PlatformLayout";
import BasicLayout from "./layouts/BasicLayout";
import DashboardHome from "./pages/DashboardHome";
import PlatformChatPage from "./pages/platform/PlatformChatPage";
import PlatformCohortAnalysisPage from "./pages/platform/PlatformCohortAnalysisPage";
import PlatformGeneticsDbPage from "./pages/platform/PlatformGeneticsDbPage";
import PlatformImagingDbPage from "./pages/platform/PlatformImagingDbPage";
import PlatformKnowledgePage from "./pages/platform/PlatformKnowledgePage";
import PlatformPathologyDbPage from "./pages/platform/PlatformPathologyDbPage";
import PlatformPlaceholderPage from "./pages/platform/PlatformPlaceholderPage";
import PlatformPrognosisPage from "./pages/platform/PlatformPrognosisPage";
import PlatformResearchChartsPage from "./pages/platform/PlatformResearchChartsPage";
import PlatformResearchPptPage from "./pages/platform/PlatformResearchPptPage";
import PlatformResearchReviewPage from "./pages/platform/PlatformResearchReviewPage";
import PlatformResearchStatsPage from "./pages/platform/PlatformResearchStatsPage";
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
        <Route path="db/patients" element={<PlatformChatPage />} />
        <Route path="db/imaging" element={<PlatformImagingDbPage />} />
        <Route path="db/pathology" element={<PlatformPathologyDbPage />} />
        <Route path="db/genetics" element={<PlatformGeneticsDbPage />} />
        <Route path="db/literature" element={<Navigate to="/knowledge" replace />} />
        <Route path="analysis/diagnosis" element={<PlatformWorkflowPage />} />
        <Route path="analysis/treatment" element={<PlatformTreatmentPage />} />
        <Route path="analysis/prognosis" element={<PlatformPrognosisPage />} />
        <Route path="analysis/cohort" element={<PlatformCohortAnalysisPage />} />
        <Route path="knowledge" element={<PlatformKnowledgePage />} />
        <Route path="research/stats" element={<PlatformResearchStatsPage />} />
        <Route path="research/charts" element={<PlatformResearchChartsPage />} />
        <Route path="research/review" element={<PlatformResearchReviewPage />} />
        <Route path="research/ppt" element={<PlatformResearchPptPage />} />
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
