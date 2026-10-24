// Help & FAQ, with "Contact support" and "Report a bug" (email prefilled with the app version).
import type { ReactNode } from "react";
import { Page } from "../components/Shell";
import { APP_BUILD, APP_VERSION, BUSINESS, isPlaceholder } from "../config/business";
import { Biz, Card, Doc, H, In, P } from "../legal/parts";

const FAQ: [q: string, a: ReactNode][] = [
  ["Does Lifeline work without a signal?", "Yes. After you open it once, the list of places, the map pins you’ve seen, saved alerts and safety steps work offline. Leslie, routes and new alerts need a signal."],
  ["How do I set my location?", <>Tap the area under “Find help near you”, then use your location or type an address or ZIP code. You can also set a ZIP in <In to="settings">Settings</In>. Location is optional.</>],
  ["What do “Open now” and “Call ahead” mean?", "“Open now” is based on the listed hours. “Call ahead” means we couldn’t confirm the place is operating, so call before you go."],
  ["Who is Leslie?", "Leslie is an AI assistant. She answers from Lifeline’s verified place list, can make mistakes, and doesn’t give medical advice. In an emergency, call 911."],
  ["What happens to my data?", <>Your settings stay on your device. Questions and locations are sent to our AI and map providers only when you use those features. See the <In to="legal/privacy">Privacy Policy</In>.</>],
  ["What is demo mode?", "Demo mode adds a made-up alert (earthquake, heat wave, smoke, power outage, flood or wildfire) so you can try the “Are you affected?” plan. Demo alerts are always labeled “Simulated demo”."],
  ["A place has wrong information.", "Open the place, tap “More details”, then “Report wrong info”. A volunteer will re-check it."],
];

function mailto(subject: string) {
  const body = `\n\n---\nLifeline ${APP_VERSION} (build ${APP_BUILD})\n${navigator.userAgent}`;
  return `mailto:${BUSINESS.SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export default function Help() {
  const emailReady = !isPlaceholder(BUSINESS.SUPPORT_EMAIL);
  const button = "min-h-[2.75rem] flex-1 rounded-xl text-[0.875rem] font-semibold flex items-center justify-center px-3";
  return (
    <Page back="history">
      <div lang="en">
        <Doc title="Help & FAQ">
          <P>In an emergency, call 911. For local services like food, shelter and rides, call 211 (free, 24/7, many languages).</P>
          {FAQ.map(([q, a]) => (
            <Card key={q}>
              <p className="font-semibold">{q}</p>
              <p className="text-[0.875rem] leading-[1.375rem]">{a}</p>
            </Card>
          ))}

          <H>Contact us</H>
          {emailReady ? (
            <div className="flex gap-2">
              <a href={mailto("Lifeline support")} className={`${button} bg-primary text-white`}>
                Contact support
              </a>
              <a href={mailto("Lifeline bug report")} className={`${button} bg-surface-container-low text-primary`}>
                Report a bug
              </a>
            </div>
          ) : (
            <P>
              Email: <Biz k="SUPPORT_EMAIL" />
            </P>
          )}
          <p className="text-[0.8125rem] text-on-surface-variant">
            Version {APP_VERSION} (build {APP_BUILD}). <In to="about">About Lifeline</In>
          </p>
        </Doc>
      </div>
    </Page>
  );
}
