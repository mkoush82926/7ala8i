"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SpyTab {
  id: string;
  label: string;
}

/**
 * Picks the active section: the last section whose top has passed the
 * offset line, or the first section when none has.
 */
export function activeSectionId(tops: ReadonlyArray<{ id: string; top: number }>, offset: number): string | null {
  if (tops.length === 0) return null;
  let active = tops[0].id;
  for (const s of tops) {
    if (s.top - offset <= 1) active = s.id;
  }
  return active;
}

/** Tracks which section is under the sticky header while scrolling. */
export function useScrollSpy(ids: readonly string[], offset = 120): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  const key = ids.join("|");
  useEffect(() => {
    const list = key ? key.split("|") : [];
    let frame = 0;
    const update = () => {
      frame = 0;
      const tops = list
        .map((id) => {
          const el = document.getElementById(id);
          return el ? { id, top: el.getBoundingClientRect().top } : null;
        })
        .filter((v): v is { id: string; top: number } => !!v);
      // At the very bottom, the last section wins even if it is short.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setActive(atBottom && tops.length ? tops[tops.length - 1].id : activeSectionId(tops, offset));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key, offset]);
  return active;
}

/**
 * Sticky in-page tab bar. Links are real anchors (work without JS); the
 * active tab follows the scroll position and scrolls itself into view.
 */
export function ScrollSpyTabs({
  tabs,
  label,
  top = 64,
  className,
}: {
  tabs: readonly SpyTab[];
  label: string;
  /** Sticky offset (px) below the fixed top bar. */
  top?: number;
  className?: string;
}) {
  const active = useScrollSpy(
    tabs.map((t) => t.id),
    top + 64,
  );
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!active || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-tab="${CSS.escape(active)}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  if (tabs.length < 2) return null;

  const jump = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const y = target.getBoundingClientRect().top + window.scrollY - (top + 56);
    window.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
    history.replaceState(null, "", `#${id}`);
    // Move focus for keyboard and screen-reader users.
    target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  };

  return (
    <nav
      aria-label={label}
      className={cn("sticky z-30 bg-[var(--bg-primary)]/95 backdrop-blur border-b border-[var(--border-subtle)]", className)}
      style={{ top }}
    >
      <ul ref={listRef} className="max-w-6xl mx-auto px-4 sm:px-8 flex gap-1 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id} className="shrink-0">
              <a
                href={`#${tab.id}`}
                data-tab={tab.id}
                onClick={(e) => jump(e, tab.id)}
                aria-current={isActive ? "location" : undefined}
                className={cn(
                  "focus-ring relative inline-flex items-center h-12 px-3 text-sm font-bold transition-colors",
                  isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                )}
              >
                {tab.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-opacity",
                    isActive ? "opacity-100 bg-[var(--text-primary)]" : "opacity-0",
                  )}
                />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default ScrollSpyTabs;
