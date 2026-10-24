// Legal and info pages at #/legal/<doc>. The texts are English-only for now (see COMPLIANCE_TODO.md).
import type { ComponentType } from "react";
import { Page } from "../components/Shell";
import Accessibility from "../legal/Accessibility";
import DataDeletion from "../legal/DataDeletion";
import Disclaimer from "../legal/Disclaimer";
import Licenses from "../legal/Licenses";
import PrivacyPolicy from "../legal/PrivacyPolicy";
import StoragePolicy from "../legal/StoragePolicy";
import Terms from "../legal/Terms";
import NotFound from "./NotFound";

const LEGAL_DOCS: Record<string, ComponentType> = {
  privacy: PrivacyPolicy,
  terms: Terms,
  cookies: StoragePolicy,
  disclaimer: Disclaimer,
  accessibility: Accessibility,
  licenses: Licenses,
  "data-deletion": DataDeletion,
};

export default function Legal({ doc }: { doc: string }) {
  const Content = LEGAL_DOCS[doc];
  if (!Content) return <NotFound />;
  return (
    <Page back="history">
      <div lang="en">
        <Content />
      </div>
    </Page>
  );
}
