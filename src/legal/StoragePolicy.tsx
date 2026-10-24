// <!-- REVIEW WITH LAWYER -->
// The app sets no cookies and loads no analytics or ad scripts, so there's no cookie banner.
// This page explains the browser storage it does use and the outside requests a page makes.
import { Doc, Ext, H, In, List, P, Updated } from "./parts";

export default function StoragePolicy() {
  return (
    <Doc title="Cookies & Storage">
      {/* <!-- REVIEW WITH LAWYER --> */}
      <Updated />
      <H>Cookies</H>
      <P>Lifeline doesn’t set cookies and doesn’t use analytics, advertising or tracking scripts.</P>

      <H>Browser storage (on your device)</H>
      <P>These are needed for the app to work the way you asked, including offline:</P>
      <List>
        <li><code>lifeline.settings</code>: language, ZIP or chosen area, display and accessibility settings, demo mode, data-notice choice.</li>
        <li><code>lifeline.hazards</code>: the latest emergency alerts and when they were fetched.</li>
        <li><code>lifeline.alertResponses</code>: your “Are you affected?” answers, for 6 hours.</li>
        <li><code>lifeline.lastPosition</code> and <code>lifeline.lastPlan</code>: the last plan’s location and summary.</li>
        <li><code>lifeline.pendingFlags</code>: “Report wrong info” reports waiting for a signal.</li>
        <li>An offline cache (service worker) with the app, place list, fonts and map areas you’ve viewed.</li>
      </List>

      <H>Requests to other sites</H>
      <P>
        Map images load from OpenStreetMap’s servers, which receive your IP address (
        <Ext href="https://osmfoundation.org/wiki/Privacy_Policy">their privacy policy</Ext>). Fonts and icons are served by
        Lifeline itself. Features that use our server are described in the <In to="legal/privacy">Privacy Policy</In>.
      </P>

      <H>Clearing it</H>
      <P>
        Use <In to="settings">Settings → Delete data on this device</In>, or clear this site’s data in your browser settings.
      </P>
    </Doc>
  );
}
