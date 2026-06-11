import { Navigate, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ApiDocsPage from "./pages/ApiDocsPage";
import { ConsoleLayout, PlayaroundIndexPage } from "./layouts/ConsoleLayout";
import ServicesMonitorView from "./views/ServicesMonitorView";
import SessionView from "./views/SessionView";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/playaround" element={<ConsoleLayout />}>
        <Route index element={<PlayaroundIndexPage />} />
        <Route path="services" element={<ServicesMonitorView />} />
        <Route path="api" element={<ApiDocsPage />} />
        <Route path="session" element={<SessionView />} />
      </Route>
      <Route path="/docs" element={<Navigate to="/playaround/api" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
