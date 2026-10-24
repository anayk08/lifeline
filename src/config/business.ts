// Every piece of business information the legal, About and Help pages need, in one place.
// Replace each {{PLACEHOLDER}} before launch (see COMPLIANCE_TODO.md). Pages show the
// placeholder text as-is until then, so nothing is silently made up.
export const BUSINESS = {
  COMPANY_NAME: "{{COMPANY_NAME}}",
  LEGAL_ENTITY: "{{LEGAL_ENTITY}}",
  ADDRESS: "{{ADDRESS}}",
  SUPPORT_EMAIL: "{{SUPPORT_EMAIL}}",
  /** A public web page for support (App Store "Support URL"). */
  SUPPORT_URL: "{{SUPPORT_URL}}",
  JURISDICTION: "{{JURISDICTION}}",
  EFFECTIVE_DATE: "{{EFFECTIVE_DATE}}",
  /** How long "Report wrong info" reports are kept after they're resolved. */
  REPORT_RETENTION: "{{REPORT_RETENTION}}",
} as const;

/** Error-monitoring endpoint (e.g. a Sentry DSN). Empty means monitoring is off. */
export const MONITORING_DSN = "";

/** Turn on to show a maintenance notice instead of the app (e.g. during an outage of the data). */
export const MAINTENANCE_MODE = false;

export const isPlaceholder = (value: string) => /^\{\{.+\}\}$/.test(value);

/** Version from package.json and the build time, injected by Vite at build time. */
export const APP_VERSION: string = __APP_VERSION__;
export const APP_BUILD: string = __APP_BUILD__;
