import Link from "next/link";

const REPO = "https://github.com/pr1gramm-com/bildkeller";

/** Site chrome footer, pinned bottom-left like the reference board. */
export default function Footer() {
  return (
    <footer id="footer-links">
      <Link href="/faq">FAQ</Link>
      <Link href="/principles">Grundsätze</Link>
      <Link href="/datasafety">Datenschutz</Link>
      <Link href="/imprint">Impressum</Link>
      <Link href="/changelog">Log</Link>
      <Link href="/contact">Kontakt</Link>
      <a href={REPO} rel="noreferrer noopener">Quellcode</a>
      <a href={`${REPO}/blob/main/LICENSE`} rel="noreferrer noopener">Lizenz</a>
      <a href={`${REPO}/blob/main/docs/api-spec.md`} rel="noreferrer noopener">API</a>
      <a href={`${REPO}/blob/main/docs/self-hosting.md`} rel="noreferrer noopener">Selbst hosten</a>
    </footer>
  );
}
