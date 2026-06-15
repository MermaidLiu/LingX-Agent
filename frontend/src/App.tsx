import { Navigate, Route, Routes } from "react-router-dom";
import BasicLayout from "./layouts/BasicLayout";
import DashboardHome from "./pages/DashboardHome";
import ImagingLab from "./pages/ImagingLab";
import InterviewWorkbench from "./pages/InterviewWorkbench";
import ModuleCohort from "./pages/ModuleCohort";
import ModuleIngestion from "./pages/ModuleIngestion";
import ModuleKnowledge from "./pages/ModuleKnowledge";
import ModuleOutputs from "./pages/ModuleOutputs";
import ModulePathology from "./pages/ModulePathology";
import ModuleTreatment from "./pages/ModuleTreatment";
import ResearchLab from "./pages/ResearchLab";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BasicLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="ingestion" element={<ModuleIngestion />} />
        <Route path="pathology" element={<ModulePathology />} />
        <Route path="treatment" element={<ModuleTreatment />} />
        <Route path="cohort" element={<ModuleCohort />} />
        <Route path="knowledge" element={<ModuleKnowledge />} />
        <Route path="outputs" element={<ModuleOutputs />} />
        <Route path="agent" element={<Navigate to="/outputs" replace />} />
        <Route path="interview" element={<InterviewWorkbench />} />
        <Route path="research" element={<ResearchLab />} />
        <Route path="imaging" element={<ImagingLab />} />
      </Route>
    </Routes>
  );
}
