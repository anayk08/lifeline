# Notes for app reviewers

**No account or login is needed.** Every feature is available on first launch.

## What Lifeline does

It finds verified, open help in San José (pharmacies, hospitals, shelters, food, water, cooling centers,
phone charging) during emergencies, and keeps working offline. Leslie is an AI assistant that answers
only from the verified place list.

## How to see each feature

1. **First launch:** choose a language, then tap "Continue without location" (or "Get started" to allow location).
2. **Browse:** tap the category tabs under the map, then any place for hours, status, routes, "Open in Maps" and Call.
3. **Data notice:** ask Leslie anything (for example "where can I charge my phone"). A notice explains
   what's sent to the AI and map services. Choose Continue or Not now (Not now answers from saved places).
4. **Alerts and plans:** Settings → Demo → "Simulate a random hazard". Go back to Home: an alert card
   labeled **"Simulated demo"** appears. Tap **Yes** to see "Aid near you", then "Open your full plan".
   "Try a different hazard" switches between earthquake, heat, smoke, power outage, flood and wildfire.
   Real alerts (USGS, National Weather Service, CAL FIRE) appear automatically when there are any.
5. **Offline:** turn on airplane mode after one launch. Places, map pins, saved alerts and safety steps keep working.
6. **Privacy and data:** Settings → Your data (download, delete) and About & legal (all policies).
7. **Accessibility:** Settings → high contrast, larger text, reduce motion, dark mode, read answers aloud.

## Things that are expected

- Leslie, routes and place search need the backend to be signed in to AWS. Without it they show a
  friendly fallback, never a blank screen.
- Demo alerts are clearly labeled "Simulated demo" and are only on when turned on in Settings.
- The app never shows hospital capacity or pharmacy stock; it says "call ahead" when status isn't confirmed.

## Contact

{{SUPPORT_EMAIL}}
