# Hackathon brief (AWS track, SpartHill Hacks 2026)

Summary of the AWS track deck Anay shared. Build every feature against this.

## The challenge

Track: AI-Driven Automation & Critical Service Continuity.
Pick a persona (a role or a fictional person) whose job is to keep a critical
service (food, medicine, information) running during a crisis, and build an AI
app that helps them do it. Suggested shapes: a routing/logistics agent, a
fail-safe communication app, or a continuity/triage system that detects a
disruption and acts automatically.

## What judges look for

1. A real persona and a genuine need
2. A working application that actually runs
3. Meaningful use of Amazon Bedrock doing real work (summarize, triage, route,
   decide), integral rather than bolted on. Bedrock is required.
4. The team understands what it built
5. Polish: something a real person would trust
6. Going above and beyond

## Submission

- A 5-minute video showing: the architecture, the app with its persona and
  need, and Bedrock working inside it.
- Upload to the track's Box folder (QR code in the deck).
- Hard deadline: 11:00 AM Saturday, Oct 24, 2026. Late entries are not judged.
- AWS mentor hours: Friday 2-6 PM, Saturday 10-11 AM.

## How Lifeline maps to it

- **Main persona: Maria Tran** (fictional), a San José case manager with
  about 12 vulnerable clients: people on home oxygen or insulin, people with
  limited mobility or limited English, and people who live alone. When the
  power goes out she has to work out, fast, who is in danger, where each
  person can get help that is actually open, and how to reach them in their
  language. The residents are the people she serves, and they use the same
  app directly.
- Bedrock doing real work:
  - **Maria's caseload console:** Maria marks the outage ZIPs. Bedrock triages
    her clients by urgency with stated reasons (oxygen and power loss come
    first), matches each client to the nearest open verified resource for
    their need, and drafts a check-in message in the client's language.
    Maria reviews and approves each message, sends it (SMS simulator or
    in-app), and marks clients reached or safe. All client data is fictional
    and labeled that way in the app.
  - **Leslie, the resident assistant:** answers only from the verified
    dataset, cites listings, says "I don't have verified info" instead of
    guessing, refuses medical advice, and replies in English, Spanish or
    Vietnamese.
- Fail-safe: the PWA caches the whole dataset, so search, listings and the
  map keep working offline.

## Priority order (agreed with Anay)

1. Dataset, offline resident app, and Leslie, deployed tonight
2. Maria's caseload triage console
3. If time allows: SMS via the AWS simulator, stale-listing flags, the CDC
   Social Vulnerability Index map
