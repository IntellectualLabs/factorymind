import { Outlet } from "react-router";
import Sidebar from "./Sidebar";

export default function Shell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
