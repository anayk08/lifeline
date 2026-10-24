# Store privacy answers (draft)

<!-- REVIEW WITH LAWYER -->

Draft answers for Apple's **App Privacy** ("nutrition label") and Google Play's **Data safety** form.
Lifeline is currently a web app (installable PWA). These only apply if it's wrapped and published as a
native app. They're written from what the code does as of version 1.0.0. If a feature changes what's
stored or sent, update this file and `src/legal/PrivacyPolicy.tsx` together.

## Facts the answers are based on

- No accounts, sign-in, ads, analytics, tracking or cookies.
- Settings and saved data stay on the device (`localStorage` and the offline cache).
- Sent off the device only when a feature is used, and only after the in-app data notice is accepted:
  - **Leslie and the plan summary:** question text, the last 6 messages, language, ZIP, location (GPS or a
    typed area) and active alerts go to our server and **Amazon Bedrock** (Anthropic Claude). Not stored by us.
  - **Place search:** typed text goes to **Amazon Location Service**. Not stored by us.
  - **Routes:** start and destination coordinates go to **Amazon Location Service**. Not stored by us.
  - **Voice input:** handled by the platform's speech recognizer (browser or OS), not by our code.
- **Map images:** OpenStreetMap tile servers see the IP address (no notice needed; disclosed in the policy).
- **"Report wrong info":** place ID plus free text, stored in our database (AWS) until resolved. No identity.
- **Crash reports:** only if `MONITORING_DSN` is set. Message, stack and app version; no personal data.
- Our server logs don't include questions, places or coordinates.

## Apple App Privacy

| Question | Answer |
|---|---|
| Do you or your partners collect data? | **Yes** |
| Used for tracking? | **No** (no ATT prompt needed) |

Data types (all **Not linked to the user**, purpose **App Functionality**, none used for tracking):

| Data type | Collected? | Notes |
|---|---|---|
| Location: Precise Location | Yes | GPS sent with Leslie questions, plans and routes |
| Location: Coarse Location | Yes | ZIP code sent with Leslie questions |
| User Content: Other User Content | Yes | Questions to Leslie; "Report wrong info" text |
| User Content: Audio Data | No* | *Speech recognition is done by the OS/browser, not sent to us. Re-check if a native speech SDK is added |
| Diagnostics: Crash Data | Only if monitoring is turned on | Then: Not linked, App Functionality |
| Contact info, Health, Financial, Contacts, Browsing/Search History, Identifiers, Purchases, Usage Data, Sensitive Info | No | |

## Google Play Data safety

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **Yes** |
| Is all of the user data encrypted in transit? | **Yes** (HTTPS) |
| Do you provide a way for users to request that their data is deleted? | **Yes**: in-app "Delete data on this device" and the public page `#/legal/data-deletion` |

| Data type | Collected | Shared | Ephemeral | Required? | Purpose |
|---|---|---|---|---|---|
| Location: Approximate (ZIP) | Yes | No* | Yes | Optional | App functionality |
| Location: Precise (GPS) | Yes | No* | Yes | Optional | App functionality |
| Messages: Other in-app messages (Leslie questions) | Yes | No* | Yes | Optional | App functionality |
| App activity: Other user-generated content (reports) | Yes | No | No | Optional | App functionality |
| App info & performance: Crash logs | Only if monitoring is on | No | No | — | Analytics / diagnostics |

\* Data sent to service providers (AWS) to process on our behalf isn't "sharing" under Google's definitions.
