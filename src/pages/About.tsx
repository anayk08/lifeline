// About and contact, as the App Store asks for: who provides the app and how to reach them.
import { Page } from "../components/Shell";
import { LifelineMark } from "../components/figma";
import { APP_BUILD, APP_VERSION } from "../config/business";
import { Biz, Card, Doc, H, In, P } from "../legal/parts";

export default function About() {
  return (
    <Page back="history">
      <div lang="en">
        <Doc title="About Lifeline">
          <div className="flex items-center gap-2">
            <LifelineMark size={40} />
            <p className="text-[0.875rem] text-on-surface-variant">
              Version {APP_VERSION} (build {APP_BUILD})
            </p>
          </div>
          <P>
            Lifeline helps people in San José find verified help that’s open right now during power outages, heat waves, smoke,
            earthquakes, floods and fires, even with no signal. It started at SpartHill Hacks 2026 at San José State University.
          </P>

          <H>Contact</H>
          <Card>
            <p className="font-semibold">
              <Biz k="LEGAL_ENTITY" />
            </p>
            <p>
              <Biz k="ADDRESS" />
            </p>
            <p>
              Email: <Biz k="SUPPORT_EMAIL" />
            </p>
            <p>
              Support: <Biz k="SUPPORT_URL" />
            </p>
          </Card>

          <H>Where the information comes from</H>
          <P>
            Places: checked by our team against each place’s public listing. Alerts: U.S. Geological Survey, National Weather
            Service and CAL FIRE. Safety steps: Ready.gov, the American Red Cross, the National Weather Service and 211. Maps:
            OpenStreetMap contributors. AI: Anthropic’s Claude on Amazon Bedrock.
          </P>

          <H>More</H>
          <ul className="flex flex-col gap-1.5">
            <li><In to="help">Help & FAQ</In></li>
            <li><In to="legal/terms">Terms & Conditions</In></li>
          </ul>
        </Doc>
      </div>
    </Page>
  );
}
