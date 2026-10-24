// <!-- REVIEW WITH LAWYER -->
// Public page (no sign-in needed) for app-store "data deletion" URLs.
import { Biz, Doc, H, In, List, P, Updated } from "./parts";

export default function DataDeletion() {
  return (
    <Doc title="Delete your data">
      {/* <!-- REVIEW WITH LAWYER --> */}
      <Updated />
      <P>Lifeline has no accounts, so there’s no account to delete. Here’s how to remove everything else.</P>

      <H>Data on your device</H>
      <List>
        <li>
          Open <In to="settings">Settings</In> and tap <strong>Delete data on this device</strong>. This removes your settings,
          saved alerts, plans, location and offline copies.
        </li>
        <li>Or clear this site’s data in your browser’s settings, or uninstall the app from your home screen.</li>
      </List>

      <H>Reports you sent</H>
      <P>
        “Report wrong info” reports don’t include your name. To have one deleted, email <Biz k="SUPPORT_EMAIL" /> with the place
        name and roughly when you sent it. We’ll confirm once it’s deleted. Reports are also deleted automatically within{" "}
        <Biz k="REPORT_RETENTION" /> after they’re resolved.
      </P>

      <H>Questions to Leslie</H>
      <P>
        We don’t save your questions or typed places. They’re sent to our AI and map providers only to answer you; see the{" "}
        <In to="legal/privacy">Privacy Policy</In>.
      </P>
    </Doc>
  );
}
