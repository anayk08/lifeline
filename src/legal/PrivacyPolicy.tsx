// <!-- REVIEW WITH LAWYER -->
// Written from what the app actually does (October 2026 code). If a feature changes what data
// is stored or sent, update this page and STORE_PRIVACY_ANSWERS.md together.
import { Biz, DataRow, Doc, Ext, H, In, List, P, Updated } from "./parts";

export default function PrivacyPolicy() {
  return (
    <Doc title="Privacy Policy">
      {/* <!-- REVIEW WITH LAWYER --> */}
      <Updated />
      <P>
        Lifeline is a free app that helps people in San José find open, verified help (pharmacies, hospitals, shelters, food,
        water, cooling centers and charging) during emergencies. It is provided by <Biz k="LEGAL_ENTITY" /> (“
        <Biz k="COMPANY_NAME" />”, “we”), <Biz k="ADDRESS" />.
      </P>

      <H>The short version</H>
      <List>
        <li>There are no accounts, no sign-in, no ads, no analytics and no cookies.</li>
        <li>We don’t sell or share your personal information, and we don’t use it for advertising.</li>
        <li>Your settings and saved data stay in your browser on this device. You can delete them any time in Settings.</li>
        <li>
          Some features need a service on the internet. When you use them, the details below are sent to that service so it can
          answer.
        </li>
      </List>

      <H>1. What stays on your device</H>
      <P>Lifeline saves these in your browser’s storage on this device only:</P>
      <List>
        <li>Your settings: language, ZIP code, an area you typed (its name and map coordinates), display and accessibility choices, demo mode, and whether you’ve seen the data notice.</li>
        <li>The latest list of emergency alerts and when it was fetched, so they show without a signal.</li>
        <li>Your “Are you affected?” answers, for 6 hours.</li>
        <li>The last location used for a plan and the last plan summary (only the latest one, never a history).</li>
        <li>“Report wrong info” reports waiting for a signal to send.</li>
        <li>An offline copy of the app, the place list, fonts and map areas you’ve viewed (up to about 1,500 map tiles, kept up to 30 days).</li>
      </List>
      <P>
        Delete all of it in <In to="settings">Settings → Delete data on this device</In>, or by clearing this site’s data in your
        browser. You can also download a copy in Settings.
      </P>

      <H>2. What is sent, to whom, and why</H>
      <DataRow
        what="Your question to Leslie, earlier questions and answers in the same conversation (up to the last 6), your language, your ZIP code, your location (GPS or the area you chose), and any active alerts"
        to={<>Our server, which uses Amazon Bedrock (Amazon Web Services, US East region) to run Anthropic’s Claude model</>}
        when="Only when you ask Leslie a question, after you’ve accepted the data notice"
        why="To understand the emergency and answer from the verified place list"
      />
      <DataRow
        what="The alert you said affects you, your language and your location"
        to="Our server and Amazon Bedrock"
        when="When you open “Your full plan” online"
        why="To write a short summary and choose safety steps from official guides"
      />
      <DataRow
        what="A place name or address you type (for example “Spartan Village”)"
        to="Our server and Amazon Location Service (Amazon Web Services)"
        when="When you search for your area"
        why="To turn the name into a point on the map"
      />
      <DataRow
        what="Your starting point and the destination’s coordinates"
        to="Our server and Amazon Location Service"
        when="When you open a place and have a location set"
        why="To show walking and driving routes"
      />
      <DataRow
        what="Your IP address, browser details and which part of the map you’re viewing"
        to={<Ext href="https://osmfoundation.org/wiki/Privacy_Policy">OpenStreetMap Foundation tile servers</Ext>}
        when="Whenever a map is shown"
        why="To load the street map images"
      />
      <DataRow
        what="Your voice"
        to="Your browser’s speech service (for example, Google in Chrome or Apple in Safari)"
        when="Only while you use the microphone button"
        why="To turn speech into text. This is handled by your browser under its own privacy terms."
      />
      <DataRow
        what="The place you’re reporting and the text you write"
        to="Our database (Amazon Web Services)"
        when="When you send “Report wrong info”"
        why="So a volunteer can re-check the place. Don’t include your name or contact details."
      />
      <P>
        Emergency alerts are fetched by our server from the U.S. Geological Survey, the National Weather Service and CAL FIRE. No
        information about you is sent to them. “Open in Maps” and phone links hand off to your maps app or phone dialer, whose
        own policies apply.
      </P>

      <H>3. Location</H>
      <P>
        Lifeline asks for your location only when you tap something that needs it (“Use my location”, “Get started”, or “Yes” on
        an alert). Your location stays on your device except when it’s sent as described above. You can use Lifeline with a ZIP
        code instead, or with no location at all.
      </P>

      <H>4. AI features</H>
      <P>
        Leslie is an AI assistant. Her answers can be wrong, so always confirm before you go, and call 911 in an emergency. She is
        told to answer only from the verified place list and to refuse medical advice. Our agreement with Amazon Web Services
        governs how Amazon Bedrock handles what you send. {/* VERIFY: confirm current AWS Bedrock data-use and retention terms. */}
      </P>

      <H>5. How long we keep information</H>
      <List>
        <li>On your device: until you delete it (6 hours for alert answers).</li>
        <li>Reports: until a volunteer resolves them, then deleted within <Biz k="REPORT_RETENTION" />.</li>
        <li>
          Our server logs record timing, errors and result counts, not your questions or typed places. Our cloud provider may keep
          its own operational logs under its terms.
        </li>
      </List>

      <H>6. Sharing</H>
      <P>
        We share information only with the service providers listed above, to provide the features you use. We don’t sell or
        “share” personal information as defined by the California Consumer Privacy Act, and we don’t use it for targeted
        advertising.
      </P>

      <H>7. Your rights</H>
      <P>
        Depending on where you live (for example the EU/UK under the GDPR, or California under the CCPA/CPRA), you may have the
        right to access, correct, delete or get a copy of your personal information, to object to or limit its use, and to
        complain to a data protection authority. Because Lifeline has no accounts, most of your data is on your device and in your
        control (see Settings). For anything we hold, such as a report you sent, see{" "}
        <In to="legal/data-deletion">how to request deletion</In> or email <Biz k="SUPPORT_EMAIL" />. We won’t treat you
        differently for using these rights.
      </P>
      <P>
        Legal bases (GDPR): providing the features you ask for (contract / your request), and your consent for sending data to
        the AI and map services, which you can withdraw in Settings.
      </P>

      <H>8. Children</H>
      <P>
        Lifeline is for a general audience and isn’t directed at children under 13 (or under 16 in the EU). We don’t knowingly
        collect personal information from children. If you think a child has sent us information, contact{" "}
        <Biz k="SUPPORT_EMAIL" /> and we’ll delete it.
      </P>

      <H>9. Security and international transfers</H>
      <P>
        Data sent by the app travels over HTTPS. Our services run in the United States. If you use Lifeline from outside the US,
        your information is processed there.
      </P>

      <H>10. Changes and contact</H>
      <P>
        We’ll update the effective date above when this policy changes. Questions: <Biz k="SUPPORT_EMAIL" />, <Biz k="ADDRESS" />.
      </P>
    </Doc>
  );
}
