"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function DisclosurePanel({ id, title, description, children }: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function reveal() {
      if (!ref.current) return;
      ref.current.open = true;
      ref.current.scrollIntoView({ block: "start" });
    }
    function revealTarget() {
      if (window.location.hash === `#${id}`) reveal();
    }
    function revealFromLink(event: MouseEvent) {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (link?.hash === `#${id}` && link.pathname === window.location.pathname && link.origin === window.location.origin) reveal();
    }
    revealTarget();
    window.addEventListener("hashchange", revealTarget);
    document.addEventListener("click", revealFromLink);
    return () => {
      window.removeEventListener("hashchange", revealTarget);
      document.removeEventListener("click", revealFromLink);
    };
  }, [id]);

  return (
    <details ref={ref} id={id} className="group scroll-mt-24 rounded-xl border border-outline-variant bg-surface-container">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl p-5 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block text-base font-semibold text-on-surface">{title}</span>
          <span className="mt-1 block text-sm font-normal text-on-surface-variant">{description}</span>
        </span>
        <ChevronDown aria-hidden="true" className="h-5 w-5 shrink-0 text-primary transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-outline-variant p-5">{children}</div>
    </details>
  );
}
