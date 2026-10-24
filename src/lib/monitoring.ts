// Error-monitoring hook. Off until MONITORING_DSN is set in src/config/business.ts; then wire
// your provider (e.g. Sentry) in `send`. Only the error message, stack and app version are
// reported, never questions, locations or settings.
import { APP_BUILD, APP_VERSION, MONITORING_DSN } from "../config/business";

interface ErrorReport {
  message: string;
  stack?: string;
  where: string;
  version: string;
}

function send(report: ErrorReport) {
  // TODO(monitoring): replace with your provider's SDK call, using MONITORING_DSN.
  void report;
}

export function reportError(error: unknown, where: string) {
  const err = error instanceof Error ? error : new Error(String(error));
  if (import.meta.env.DEV) console.error(`[${where}]`, err);
  if (!MONITORING_DSN) return;
  send({ message: err.message.slice(0, 500), stack: err.stack?.slice(0, 4000), where, version: `${APP_VERSION} (${APP_BUILD})` });
}

/** Catches errors outside React (event handlers, promises) too. */
export function installGlobalErrorHandlers() {
  window.addEventListener("error", (e) => reportError(e.error ?? e.message, "window.error"));
  window.addEventListener("unhandledrejection", (e) => reportError(e.reason, "unhandledrejection"));
}
