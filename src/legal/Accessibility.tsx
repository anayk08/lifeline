// <!-- REVIEW WITH LAWYER -->
import { Biz, Doc, H, In, List, P, Updated } from "./parts";

export default function Accessibility() {
  return (
    <Doc title="Accessibility">
      {/* <!-- REVIEW WITH LAWYER --> */}
      <Updated />
      <P>
        We want everyone to be able to use Lifeline, especially in an emergency. Our goal is to meet the Web Content Accessibility
        Guidelines (WCAG) 2.1 level AA.
      </P>

      <H>What’s built in</H>
      <List>
        <li>High contrast, larger text, reduce motion and dark mode in <In to="settings">Settings</In>. The app follows your phone’s contrast, motion and dark settings by default.</li>
        <li>English, Spanish and Vietnamese.</li>
        <li>Answers can be read aloud, and you can ask by voice where your browser supports it.</li>
        <li>Works with screen readers and keyboards, with a “skip to main content” link and visible focus outlines.</li>
        <li>Every map has a list alternative: the same places can be picked from a list without using the map.</li>
        <li>Buttons are at least 44 pixels tall, and status is never shown by color alone.</li>
      </List>

      <H>Known limitations</H>
      <List>
        <li>The street map image itself can’t be explored with a screen reader; use the place lists instead.</li>
        <li>The filter tab labels are small; turn on Larger text to enlarge them.</li>
        <li>Content from other sites we link to may not be accessible.</li>
      </List>

      <H>Feedback</H>
      <P>
        If something is hard to use, tell us at <Biz k="SUPPORT_EMAIL" /> and we’ll try to fix it.
      </P>
    </Doc>
  );
}
