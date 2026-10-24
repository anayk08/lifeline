# Compliance TODO (things to do by hand)

Everything here needs a person: a decision, an account, a lawyer, or a real device. The code side is done
(see "What was added" at the bottom).

## 1. Fill in the placeholders

All in **`src/config/business.ts`**. Until filled in, pages show them highlighted so they can't be missed.

| Placeholder | Used on |
|---|---|
| `{{COMPANY_NAME}}` | Privacy Policy |
| `{{LEGAL_ENTITY}}` | Privacy Policy, Terms, About |
| `{{ADDRESS}}` | Privacy Policy, About |
| `{{SUPPORT_EMAIL}}` | Privacy, Terms, Accessibility, data deletion, About, Help (enables the Contact support / Report a bug buttons), `docs/REVIEW_NOTES.md` |
| `{{SUPPORT_URL}}` | About (App Store "Support URL") |
| `{{JURISDICTION}}` | Terms (governing law) |
| `{{EFFECTIVE_DATE}}` | Every legal page |
| `{{REPORT_RETENTION}}` | Privacy Policy, data deletion (how long resolved reports are kept, e.g. "90 days") |

Also in that file: `MONITORING_DSN` (crash reporting, off while empty) and `MAINTENANCE_MODE`.

## 2. Lawyer review

Every file below starts with `<!-- REVIEW WITH LAWYER -->`:

- `src/legal/PrivacyPolicy.tsx`, `Terms.tsx`, `StoragePolicy.tsx`, `Disclaimer.tsx`, `Accessibility.tsx`, `DataDeletion.tsx`, `Licenses.tsx`
- `docs/STORE_PRIVACY_ANSWERS.md`

Specific questions for them:

- [ ] **AWS Bedrock terms:** confirm how Amazon Bedrock and Anthropic handle and keep prompts. The policy only says our AWS agreement governs it (marked `VERIFY` in `PrivacyPolicy.tsx`).
- [ ] **react-leaflet license:** `react-leaflet` and `@react-leaflet/core` use the **Hippocratic License 2.1**, which isn't a standard open-source license and has ethical-use conditions. Confirm it's acceptable, or replace it with plain Leaflet (BSD-2).
- [ ] **American Red Cross content:** the safety steps are paraphrased with credit. Confirm that's acceptable, or keep only Ready.gov/NWS (public domain) items.
- [ ] **GDPR/CCPA wording** for an app with no accounts. Decide whether Lifeline needs an EU representative (only if it targets the EU).

## 3. Translate the legal pages

Legal, About and Help pages are **English only** (Settings marks them "(English)" in Spanish and
Vietnamese). After the lawyer signs off, translate them into Spanish and Vietnamese.

## 4. Hosting and store setup

- [ ] **Public privacy policy URL:** after deploying, the policy is at `https://<your-domain>/#/legal/privacy` and data deletion at `https://<your-domain>/#/legal/data-deletion`. Some store forms reject `#` links. If so, also publish them as static pages.
- [ ] **Link previews:** in `index.html`, change `og:image` to an absolute URL and add `og:url` once the domain is known.
- [ ] **Map tiles for production:** OpenStreetMap's free tile servers aren't for apps with real traffic ([tile usage policy](https://operations.osmfoundation.org/policies/tiles/)). Pick a tile provider (or host tiles) before launch, keep the © OpenStreetMap credit, and update the Privacy Policy with the new provider.
- [ ] **Rate limits on the deployed API:** the laptop server limits requests, but the Amplify/AppSync API (public API key) doesn't yet. Add an AWS WAF rate-based rule or AppSync limits, and budget alerts for Bedrock and Amazon Location.
- [ ] **Report retention:** add a scheduled job (or DynamoDB TTL) that deletes resolved reports after `{{REPORT_RETENTION}}`.
- [ ] **Crash monitoring:** pick a provider, set `MONITORING_DSN`, and wire its SDK in `src/lib/monitoring.ts` (`send`). Add it to the Privacy Policy and store answers.

## 5. If you publish to the App Store or Google Play

Lifeline is a web app today. To list it in the stores it must be wrapped (for example with Capacitor). Then:

- [ ] Fill in Apple's App Privacy and Google's Data safety forms from `docs/STORE_PRIVACY_ANSWERS.md`.
- [ ] Add an iOS `PrivacyInfo.xcprivacy` privacy manifest. Declare `UserDefaults` (required reason `CA92.1`) if the wrapper stores settings there, plus anything the wrapper's plugins need.
- [ ] Location and microphone permission strings (`NSLocationWhenInUseUsageDescription`, `NSMicrophoneUsageDescription`, `NSSpeechRecognitionUsageDescription`) matching the in-app reasons.
- [ ] Not needed today: App Tracking Transparency (no tracking), Sign in with Apple (no logins), in-app purchases and Restore Purchases (no payments), account deletion (no accounts), age gate (general audience, no accounts).
- [ ] Give reviewers `docs/REVIEW_NOTES.md`; no demo account is needed.
- [ ] App icons and launch screens at native sizes (the web icons are 64, 180, 192, 512 and maskable 512).

## 6. Check on real devices

- [ ] VoiceOver (iPhone) and TalkBack (Android): Home, a place card, the data notice, Settings, a legal page.
- [ ] "Open in Maps" on a real iPhone (Apple Maps) and Android phone (default maps app).
- [ ] Offline: airplane mode after one visit.
- [ ] Larger text: the filter tab labels are small (9px at normal size); consider a bigger default.

## 7. Smaller items found in the audit

- [ ] 14 lint warnings (`react-refresh/only-export-components`): they only affect hot reload during development.
- [ ] Data minimization: Leslie receives the last 6 messages of the conversation. Fewer would send less. Kept as is.
- [ ] Figma icons: they look like [Lucide](https://lucide.dev) (ISC license). Confirm with whoever made the Figma file and keep the credit on the licenses page.

## How to undo any of this

Nothing has been pushed. Everything is in local commits on `main`, with two restore points:

| Tag | What it is |
|---|---|
| `backup/before-redesign` | Before the Figma redesign (`ca794ea`) |
| `backup/before-compliance` | After the redesign, before any compliance work (`507b071`) |

- Undo **one** compliance change and keep the rest: `git revert <commit>` (commits listed with `git log --oneline backup/before-compliance..HEAD`).
- Undo **all** compliance work: `git reset --hard backup/before-compliance` (deletes uncommitted changes too).
- Undo the redesign as well: `git reset --hard backup/before-redesign`.

## What was added

| Commit | Change |
|---|---|
| Legal, About, Help | `src/config/business.ts`, `src/legal/*`, `#/legal/<doc>`, `#/about`, `#/help`, 404 page, footer links, version 1.0.0 + build stamp |
| Settings | Your data (download, delete on device, deletion request), About & legal links, version, turn AI/map services back off |
| Data notice | One-time notice before Leslie, place search, routes, plan summary and the mic send anything (EN/ES/VI) |
| Fonts | Self-hosted Inter and Material Symbols (`npm run fetch-fonts`), no requests to Google |
| Contrast | Darker pin colors: white text 5.1–5.9:1 (was 2.0–4.4:1) |
| Wording | "checked against an official source" → "against its public listing" |
| Dependencies | Removed unused `@aws-amplify/ui-react` |
| Robustness | Crash screen, error-monitoring hook, maintenance switch, link preview tags |
| Server | No personal text in logs; rate limits on AI and map requests |
| Docs | This file, `docs/STORE_PRIVACY_ANSWERS.md`, `docs/REVIEW_NOTES.md` |
