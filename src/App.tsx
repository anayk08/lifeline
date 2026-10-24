import { lazy, Suspense, useEffect } from "react";
import ErrorScreen from "./components/ErrorScreen";
import { MAINTENANCE_MODE } from "./config/business";
import { useApp, useRoute } from "./lib/app";
import { flushPendingReports } from "./lib/backend";
import About from "./pages/About";
import Help from "./pages/Help";
import Home from "./pages/Home";
import Legal from "./pages/Legal";
import ListPage from "./pages/ListPage";
import NotFound from "./pages/NotFound";
import Place from "./pages/Place";
import Plan from "./pages/Plan";
import Settings from "./pages/Settings";
import Welcome from "./pages/Welcome";

// The map pulls in Leaflet, so it loads on first use (and is still precached for offline).
const MapPage = lazy(() => import("./pages/MapPage"));

export default function App() {
  const route = useRoute();
  const { settings, online } = useApp();

  useEffect(() => {
    if (online) flushPendingReports();
  }, [online]);

  // "#/ask?q=..." (older links and the plan) opens Home, which asks Leslie the question.
  const [page, arg] = route;
  if (MAINTENANCE_MODE) return <ErrorScreen maintenance />;
  if (!settings.onboarded) return <Welcome />;

  return (
    <Suspense fallback={<div className="p-6 text-body-lg">…</div>}>
      {page === "map" ? (
        <MapPage />
      ) : page === "list" ? (
        <ListPage category={arg ?? "all"} />
      ) : page === "place" && arg ? (
        <Place id={arg} />
      ) : page === "settings" ? (
        <Settings />
      ) : page === "plan" ? (
        <Plan />
      ) : page === "legal" ? (
        <Legal doc={arg ?? ""} />
      ) : page === "about" ? (
        <About />
      ) : page === "help" ? (
        <Help />
      ) : page === undefined || page === "ask" ? (
        <Home />
      ) : (
        <NotFound />
      )}
    </Suspense>
  );
}
