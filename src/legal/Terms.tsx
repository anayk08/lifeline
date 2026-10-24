// <!-- REVIEW WITH LAWYER -->
// Part 1 of Terms & Conditions (see TermsAndConditions.tsx).
import { Biz, H, List, P, Part } from "./parts";

export default function TermsOfUse() {
  return (
    <section aria-labelledby="terms-of-use" className="flex flex-col gap-3">
      {/* <!-- REVIEW WITH LAWYER --> */}
      <Part id="terms-of-use">Terms of Use</Part>
      <P>
        These terms are an agreement between you and <Biz k="LEGAL_ENTITY" /> (“we”) about using Lifeline. By using Lifeline you
        agree to them. If you don’t agree, please don’t use the app.
      </P>

      <H>1. Not an emergency service</H>
      <P>
        Lifeline is not a substitute for 911 or emergency responders. If you or someone else is hurt, trapped or in danger, call
        911. For local services, call 211. Follow instructions from local officials over anything in this app.
      </P>

      <H>2. Information can be wrong or out of date</H>
      <P>
        “Verified” means our team checked a place against its public listing on the date shown. Hours, status, services and
        accessibility can change without notice, and offline data can be old. We never show stock levels or hospital capacity.
        Always confirm before you travel, and call ahead when the app says so.
      </P>

      <H>3. AI answers</H>
      <P>
        Leslie is an AI assistant. Her answers are generated automatically, may contain mistakes, and are not medical, legal or
        financial advice. Safety steps in “Your plan” come from official guides; follow the linked source if anything is unclear.
      </P>

      <H>4. Alerts and demo mode</H>
      <P>
        Live alerts come from the U.S. Geological Survey, the National Weather Service and CAL FIRE and may be delayed. Alerts
        labeled “Simulated demo” are made up for testing and are not real warnings.
      </P>

      <H>5. Acceptable use</H>
      <List>
        <li>Don’t send false reports or use the app to harass anyone.</li>
        <li>Don’t try to overload, scrape, reverse-engineer or get around limits on our services.</li>
        <li>Don’t put other people’s personal information in questions or reports.</li>
      </List>

      <H>6. Other services</H>
      <P>
        Maps, routes, speech input and links to phone or maps apps are provided by other companies under their own terms. Map data
        © OpenStreetMap contributors.
      </P>

      <H>7. No warranty</H>
      <P>
        Lifeline is provided free, “as is” and “as available”, without warranties of any kind, to the fullest extent allowed by
        law. We don’t guarantee the app will be available, accurate or error-free.
      </P>

      <H>8. Limitation of liability</H>
      <P>
        To the fullest extent allowed by law, we aren’t liable for indirect, incidental or consequential damages, or for decisions
        made using the app’s information. Nothing in these terms limits liability that can’t be limited by law.
      </P>

      <H>9. Changes, law and contact</H>
      <P>
        We may update these terms and will change the effective date when we do. These terms are governed by the laws of{" "}
        <Biz k="JURISDICTION" />. Questions: <Biz k="SUPPORT_EMAIL" />.
      </P>
    </section>
  );
}
