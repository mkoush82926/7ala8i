"use client";

import React, { useMemo } from "react";
import { Copy, FileText } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "@/components/ui/toast";
import { metaTemplateDrafts } from "@/lib/messaging/templates";

const card = "flex flex-col gap-4 rounded-xl border border-line bg-card p-4 sm:p-6";

/**
 * Day-1 deliverable of WS-1C: the Arabic/English WhatsApp utility templates
 * the owner submits to Meta (WhatsApp Manager → Message templates). Names,
 * bodies with {{n}} variables, sample values and buttons are generated from
 * the engine's own catalogue so the approved text always matches what the
 * dispatcher sends.
 */
export function TemplateDrafts() {
  const { t } = useTranslation();
  const tm = t.messaging;
  const drafts = useMemo(() => metaTemplateDrafts(typeof window !== "undefined" ? window.location.origin : undefined), []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(tm.copied);
    } catch {
      toast.error(tm.copyFailed);
    }
  }

  return (
    <section aria-labelledby="msg-templates" className={card}>
      <details className="group">
        <summary className="focus-ring flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-lg">
          <FileText size={18} aria-hidden="true" className="shrink-0 text-ink-soft" />
          <span className="min-w-0 flex-1">
            <span id="msg-templates" className="block text-base font-bold text-ink">
              {tm.templatesTitle}
            </span>
            <span className="block text-sm text-ink-soft">{tm.templatesHelp}</span>
          </span>
        </summary>
        <ul role="list" className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
          {drafts.map((d) => {
            const text = [
              `${tm.draftName}: ${d.name}`,
              `${tm.draftCategory}: ${d.category}`,
              `${tm.draftLanguage}: ${d.language}`,
              "",
              d.body,
              "",
              `${tm.draftSamples}: ${d.example.join(" | ")}`,
              ...d.buttons.map((b) => `${tm.draftButton}: ${b.text}${b.type === "URL" ? ` → ${b.url}` : ""}`),
            ].join("\n");
            return (
              <li key={`${d.name}-${d.language}`} className="rounded-xl bg-sunken p-3">
                <div className="flex items-center justify-between gap-2">
                  <code className="truncate text-xs font-semibold text-ink" dir="ltr">
                    {d.name} · {d.language}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(text)}
                    className="focus-ring inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-card hover:text-ink"
                    aria-label={`${t.common.copy} ${d.name} ${d.language}`}
                  >
                    <Copy size={16} aria-hidden="true" />
                  </button>
                </div>
                <p className="m-0 mt-1 whitespace-pre-line text-sm text-ink-soft" dir={d.language === "ar" ? "rtl" : "ltr"}>
                  {d.body}
                </p>
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
