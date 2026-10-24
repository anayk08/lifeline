import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./fonts.css";
import "./index.css";
import { AppProvider } from "./lib/app";
import { DataNoticeProvider } from "./lib/dataNotice";
import "./lib/backend"; // configures Amplify when amplify_outputs.json exists

// Install the service worker right away so the dataset and app shell are cached on first visit.
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider>
      <DataNoticeProvider>
        <App />
      </DataNoticeProvider>
    </AppProvider>
  </React.StrictMode>,
);
