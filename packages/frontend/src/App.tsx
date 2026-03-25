import { BrowserRouter, Routes, Route } from "react-router";
import Shell from "@/components/layout/Shell";
import WorkforceDashboard from "@/pages/WorkforceDashboard";
import MachineDashboard from "@/pages/MachineDashboard";
import SchedulePlanner from "@/pages/SchedulePlanner";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<WorkforceDashboard />} />
          <Route path="/machines" element={<MachineDashboard />} />
          <Route path="/scheduler" element={<SchedulePlanner />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
