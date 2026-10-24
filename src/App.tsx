import { lazy, Suspense, useEffect } from "react";
import { useApp, useRoute } from "./lib/app";
import { flushPendingReports } from "./lib/backend";
import Ask from "./pages/Ask";
import Home from "./pages/Home";
import ListPage from "./pages/ListPage";
import Place from "./pages/Place";
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

  const [page, arg] = route;
  if (!settings.onboarded) return <Welcome />;

  return (
    <Suspense fallback={<div className="p-6 text-body-lg">…</div>}>
      {page === "ask" ? (
        <Ask />
      ) : page === "map" ? (
        <MapPage />
      ) : page === "list" ? (
        <ListPage category={arg ?? "all"} />
      ) : page === "place" && arg ? (
        <Place id={arg} />
      ) : page === "settings" ? (
        <Settings />
      ) : (
        <Home />
      )}
    </Suspense>
  );
}
