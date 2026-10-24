import { useApp } from "../lib/app";

/** Small Privacy · Terms · Help · About links, at the bottom of Home and the Welcome screen. */
export default function LegalFooter() {
  const { t } = useApp();
  const links: [string, string][] = [
    ["legal/privacy", t.linkPrivacy],
    ["legal/terms", t.linkTerms],
    ["help", t.linkHelp],
    ["about", t.linkAbout],
  ];
  return (
    <nav aria-label={t.aboutLegal} className="flex flex-wrap justify-center gap-x-1 text-[0.75rem] text-on-surface-variant pt-2">
      {links.map(([to, label], i) => (
        <span key={to} className="flex items-center gap-x-1">
          {i > 0 && <span aria-hidden="true">·</span>}
          <a href={`#/${to}`} className="underline underline-offset-2 min-h-[2.75rem] inline-flex items-center px-1">
            {label}
          </a>
        </span>
      ))}
    </nav>
  );
}
