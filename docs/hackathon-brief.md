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

- **Persona (set by Anay, Oct 23):** people in San José caught in a natural
  disaster or emergency (a power outage, heat wave, wildfire smoke or
  earthquake) who don't know where or how to get help. Often their power is
  out, their phone battery is low, the signal is weak, and English may be
  their second language. Their need is to find verified help that is
  actually open right now, and to know how to get there.
- **For the video, show one specific person** (fictional), for example:
  "Lan, 68, lives alone in East San José and speaks Vietnamese. The power has
  been out for six hours in a heat wave, and she needs to keep her insulin
  cold." One concrete person makes the need real to judges.
- This matches the track's "fail-safe communication app" idea: keeping
  people accurately informed when the usual channels go down.
- Bedrock doing real work:
  - **Leslie, the assistant:** answers only from the verified dataset, cites
    places, says "I don't have verified info" instead of guessing, refuses
    medical advice, and replies in English, Spanish or Vietnamese.
  - **Map and routes:** each answer opens a map of the matching places.
    Tapping a numbered pin shows a card with real walking and driving routes
    from Amazon Location Service (fastest walk, easiest walk, fastest drive,
    transit).
- Fail-safe: the PWA caches the whole dataset, so search, listings and the
  map pins keep working offline.
- Accessibility: high contrast, larger text, reduce motion and read-aloud.

## Priority order

1. Dataset, offline resident app, and Leslie with the map and routes
2. If time allows: stale-listing flags, the CDC Social Vulnerability Index map
3. Set aside for now: the case manager triage console (in git history,
   commit 3274216 and earlier)