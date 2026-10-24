// Terms & Conditions at #/legal/terms (#/legal/privacy opens the same page at its Privacy part).
// The text is English-only for now (see COMPLIANCE_TODO.md).
import { Page } from "../components/Shell";
import TermsAndConditions from "../legal/TermsAndConditions";
import NotFound from "./NotFound";

export default function Legal({ doc }: { doc: string }) {
  if (doc !== "terms" && doc !== "privacy") return <NotFound />;
  return (
    <Page back="history">
      <div lang="en">
        <TermsAndConditions section={doc === "privacy" ? "privacy" : undefined} />
      </div>
    </Page>
  );
}
