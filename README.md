# Lifeline

Verified help when the power goes out. An offline-ready web app (PWA) for San José with:

- **Resident app:** search, category tiles, a map and place details for 45 places from Soup's verified sheet. It works with no signal and is available in English, Spanish and Vietnamese.
- **Leslie:** an AI assistant on Amazon Bedrock (Claude Haiku 4.5). She answers only from the verified list, cites places, says "I don't have verified info" instead of guessing, and refuses medical advice.
- **Results map and routes:** each answer fills the screen with a color-coded map of Leslie's places (plus nearby matches) as numbered pins. Tap a number to pop up its card with real routes from Amazon Location Service: fastest walk, easiest walk (least uphill, then fewest turns), fastest drive, and bus or train when the sheet lists it. Each pin shows its walking time, and turn-by-turn steps come in the resident's language. With no signal, the pins and place details still work, and the card says routes need a signal.
- **Disaster-aware answers:** a quick Bedrock call (Claude Haiku 4.5) first works out the emergency, where it is, where the person is, and what they need. Amazon Location place search turns place names like "SJSU" or "Spartan Village" into map points; made-up or out-of-area names are rejected, not guessed. Places are then ranked for the situation (`rankForSituation` in `shared/resources.ts`): open first, then closest, with places within 1 mile of the hazard flagged "may be affected, call first" and moved down; Soup's hazard ratings, 24 hours plus backup power, medical needs and wheelchair access move places up or down. The map draws the hazard area as a red circle, with a key. Distances start from a place the person names, then GPS, then their ZIP.
- **Accessibility:** high contrast (WCAG AAA colors), larger text, reduce motion, read answers aloud, and battery saver in Settings (the first two are also on the Welcome screen). It follows the phone's own contrast and motion settings by default. There's a skip link, visible focus outlines, labeled switches, and a list alternative for every map.

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

3. Open http://localhost:4173. Use your browser's device toolbar (F12, then the phone icon) to show the phone layout.

While you edit code, use `npm run dev:local` instead (hot reload at http://localhost:5173).

If Leslie says she can't answer and the terminal shows `AWS sign-in expired`, run `aws login --profile lifeline` again, then restart `npm run demo`.

### How it fits together

```
Phone/browser (PWA, offline cache of all 45 places)
   |  /api/leslie, /api/routes
   v
Vite server (proxy)  ->  server/index.ts on 127.0.0.1:8787  ->  Amazon Bedrock (us-east-1)
                                     uses shared/bedrock.ts       Claude Haiku 4.5, Amazon Location
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
