const REPO = "https://github.com/pr1gramm-com/bildkeller";

/** Site chrome footer, pinned bottom-left like the reference board. */
export default function Footer() {
  return (
    <footer id="footer-links">
      <a href={REPO} rel="noreferrer noopener">Quellcode</a>
      <a href={`${REPO}/blob/main/LICENSE`} rel="noreferrer noopener">Lizenz</a>
      <a href={`${REPO}/blob/main/docs/api-spec.md`} rel="noreferrer noopener">API</a>
      <a href={`${REPO}/blob/main/docs/self-hosting.md`} rel="noreferrer noopener">Selbst hosten</a>
    </footer>
  );
}
