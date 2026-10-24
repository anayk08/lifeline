// <!-- REVIEW WITH LAWYER -->
// Terms & Conditions: the Terms of Use and the Privacy section on one page.
import { useEffect, type MouseEvent } from "react";
import PrivacyPolicy from "./PrivacyPolicy";
import TermsOfUse from "./Terms";
import { Doc, Updated } from "./parts";

/** `section` = "privacy" opens the page at the Privacy part (old #/legal/privacy links). */
export default function TermsAndConditions({ section }: { section?: "privacy" }) {
  useEffect(() => {
    if (section) document.getElementById(section)?.scrollIntoView({ block: "start" });
  }, [section]);
  return (
    <Doc title="Terms & Conditions">
      {/* <!-- REVIEW WITH LAWYER --> */}
      <Updated />
      <nav aria-label="On this page" className="flex gap-3 text-[0.875rem]">
        <a href="#/legal/terms" onClick={(e) => jump(e, "terms-of-use")} className="text-primary underline underline-offset-2 min-h-[2.75rem] inline-flex items-center">
          Terms of Use
        </a>
        <a href="#/legal/privacy" onClick={(e) => jump(e, "privacy")} className="text-primary underline underline-offset-2 min-h-[2.75rem] inline-flex items-center">
          Privacy
        </a>
      </nav>
      <TermsOfUse />
      <PrivacyPolicy />
    </Doc>
  );
}

/** Hash routing owns the URL fragment, so in-page links scroll instead of navigating. */
function jump(e: MouseEvent, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ block: "start" });
}
