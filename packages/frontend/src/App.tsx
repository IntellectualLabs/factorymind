import { BrowserRouter, Routes, Route } from "react-router";
import Shell from "@/components/layout/Shell";
import CommandCenter from "@/pages/CommandCenter";
import WorkforceDashboard from "@/pages/WorkforceDashboard";
import MachineDashboard from "@/pages/MachineDashboard";
import SchedulePlanner from "@/pages/SchedulePlanner";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<CommandCenter />} />
          <Route path="/scheduler" element={<SchedulePlanner />} />
          <Route path="/analytics/workforce" element={<WorkforceDashboard />} />
          <Route path="/analytics/machines" element={<MachineDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
