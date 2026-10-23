# Lifeline

Verified help when the power goes out. An offline-ready web app (PWA) for San José with:

- **Resident app:** search, category tiles, a map and place details for 45 places from Soup's verified sheet. It works with no signal and is available in English, Spanish and Vietnamese.
- **Leslie:** an AI assistant on Amazon Bedrock (Claude Haiku 4.5). She answers only from the verified list, cites places, says "I don't have verified info" instead of guessing, and refuses medical advice.
- **Results map and routes:** under each answer, Leslie's places (plus nearby matches) appear as numbered pins with a matching list. Pick one to see distance and routes from Amazon Location Service: fastest walk, easiest walk (least uphill, then fewest turns), fastest drive, and bus or train when the sheet lists it. Turn-by-turn steps come in the resident's language. With no signal it shows straight-line distance and an estimated walking time.
- **Accessibility:** high contrast (WCAG AAA colors), larger text, reduce motion, read answers aloud, and battery saver in Settings (the first two are also on the Welcome screen). It follows the phone's own contrast and motion settings by default. There's a skip link, visible focus outlines, labeled switches, and a list alternative for every map.
- **Maria's caseload** (`#/caseload`): Bedrock (Claude Sonnet 5.5) triages a case manager's 12 fictional clients during an outage. It ranks them by urgency with reasons, matches each to an open place, and drafts a check-in in the client's language. Maria approves each one.

See `docs/hackathon-brief.md` for the persona and judging notes.

## Run it on your laptop (demo / video)

The hackathon AWS account can't create IAM roles yet, so Leslie's backend runs on the laptop for now and uses your AWS sign-in.

1. Sign in to AWS (once per session; the sign-in expires after several hours):

   ```bash
   aws login --profile lifeline
   ```

2. Build the app and start Leslie's server plus the web app together:

   ```bash
   npm run demo
   ```

3. Open http://localhost:4173. Use your browser's device toolbar (F12, then the phone icon) to show the phone layout. The case manager console is at http://localhost:4173/#/caseload.

While you edit code, use `npm run dev:local` instead (hot reload at http://localhost:5173).

If Leslie says she can't answer and the terminal shows `AWS sign-in expired`, run `aws login --profile lifeline` again, then restart `npm run demo`.

### How it fits together

```
Phone/browser (PWA, offline cache of all 45 places)
   |  /api/leslie, /api/triage
   v
Vite server (proxy)  ->  server/index.ts on 127.0.0.1:8787  ->  Amazon Bedrock (us-east-1)
                                     uses shared/bedrock.ts       Claude Haiku 4.5 / Sonnet 5.5
```

The AWS credentials stay on the laptop. The browser only talks to `/api`.

## Update the places list

Soup's Google Sheet is the source of truth. After editing it:

```bash
npm run import-data
```

This rewrites `data/resources.json` and prints any rows with problems. Missing hours, phones and languages stay empty; they are never guessed.

## Deploy on AWS (when IAM is unblocked)

The same Bedrock code (`shared/bedrock.ts`) is wired into an Amplify Gen 2 backend in `amplify/`: two Lambda functions behind AppSync with an API key. Once the account can create roles:

```bash
npx ampx sandbox --once --profile lifeline
```

That generates `amplify_outputs.json`. The app then uses Amplify instead of the laptop server automatically.
