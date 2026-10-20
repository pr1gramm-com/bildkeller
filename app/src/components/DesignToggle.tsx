"use client";
import { useState } from "react";
import { applyDesign, readDesign, useDesignLayoutEffect, writeDesign, type Design } from "@/lib/design";

/** Bottom-right slider that swaps between the pr0gramm.com look and the pr0.app redesign. */
export default function DesignToggle() {
  const [design, setDesign] = useState<Design>("classic");

  useDesignLayoutEffect(() => {
    setDesign(readDesign());
    applyDesign();
    // React resets the attribute on every re-render of the root layout (router.refresh).
    const mo = new MutationObserver(() => applyDesign());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-design"] });
    return () => mo.disconnect();
  }, []);

  const label = design === "classic" ? "Design: pr0gramm.com" : "Design: pr0.app";

  return (
    <button
      id="design-toggle"
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={design === "app"}
      onClick={() => {
        // read the live theme, not the React state: the two can drift apart
        const next: Design = document.documentElement.dataset.design === "app" ? "classic" : "app";
        setDesign(next);
        writeDesign(next);
      }}
    >
      <span className="dt-thumb" />
      <span className="dt-label dt-classic">pr0gramm</span>
      <span className="dt-label dt-app">pr0.app</span>
    </button>
  );
}
