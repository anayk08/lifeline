// <!-- REVIEW WITH LAWYER -->
import { Doc, H, In, List, P, Updated } from "./parts";

export default function Disclaimer() {
  return (
    <Doc title="Disclaimer">
      {/* <!-- REVIEW WITH LAWYER --> */}
      <Updated />
      <H>Emergencies</H>
      <P>Lifeline is not an emergency service. In an emergency, call 911. For local services, call 211.</P>

      <H>Place information</H>
      <List>
        <li>“Verified” means our team checked the place against its public listing on the date shown. It doesn’t guarantee the place is open, has supplies, or can help you.</li>
        <li>“Call ahead” means we couldn’t confirm the place is operating.</li>
        <li>We never show stock levels or hospital capacity. Call to confirm.</li>
        <li>Information saved for offline use can be out of date.</li>
      </List>

      <H>AI-generated content</H>
      <P>
        Leslie’s answers and plan summaries are written by an AI model and can be wrong. They are not medical, legal or financial
        advice.
      </P>

      <H>Medical</H>
      <P>
        Nothing in Lifeline is medical advice. Ask a pharmacist or doctor about medicines and medical devices, and call 911 if
        someone is hurt.
      </P>

      <H>Alerts</H>
      <P>
        Live alerts come from the U.S. Geological Survey, the National Weather Service and CAL FIRE, and may be delayed. Alerts
        labeled “Simulated demo” are not real. Follow official instructions from local authorities.
      </P>
      <P>
        See the <In to="legal/terms">Terms of Use</In> for the full terms.
      </P>
    </Doc>
  );
}
