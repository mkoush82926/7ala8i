"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import en from "@/i18n/en";
import ar from "@/i18n/ar";

/**
 * Last-resort boundary: replaces the root layout when it (or ThemeProvider)
 * throws, so it must render its own <html>/<body> and cannot rely on
 * globals.css, fonts or providers. Styles are inline and self-contained.
 * Never shows `error.message`; the digest matches the server log line from
 * src/instrumentation.ts.
 */

const C = {
  paper: "#ffffff",
  cream: "#f7f1e4",
  border: "#ede3cd",
  ink: "#1c1611",
  slate: "#5a5147",
  muted: "#746a5b",
  primary: "#7c4a1e",
};

function detectLocale(pathname: string | null): "en" | "ar" {
  if (pathname && /^\/ar(\/|$)/.test(pathname)) return "ar";
  if (pathname && /^\/en(\/|$)/.test(pathname)) return "en";
  if (typeof document !== "undefined") {
    const cookie = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=(en|ar)/);
    if (cookie) return cookie[1] as "en" | "ar";
  }
  return "en";
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const locale = detectLocale(pathname);
  const t = locale === "ar" ? ar : en;
  const dir = locale === "ar" ? "rtl" : "ltr";
  const font =
    locale === "ar"
      ? "'Segoe UI', Tahoma, 'Geeza Pro', Arial, sans-serif"
      : "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  useEffect(() => {
    console.error("[ui:global-error]", { digest: error.digest, name: error.name, message: error.message });
  }, [error]);

  const button: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    padding: "0 22px",
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 15,
    fontFamily: "inherit",
    cursor: "pointer",
    textDecoration: "none",
  };

  return (
    <html lang={locale} dir={dir}>
      <head>
        <title>{t.error.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
        <style>{`a:focus-visible,button:focus-visible{outline:2px solid ${C.primary};outline-offset:2px}`}</style>
      </head>
      <body style={{ margin: 0, fontFamily: font, background: C.paper, color: C.ink }}>
        <main
          aria-labelledby="global-error-title"
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 16px",
            boxSizing: "border-box",
            textAlign: "center",
          }}
        >
          <div style={{ width: "100%", maxWidth: 420 }}>
            <div
              aria-hidden="true"
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 24px",
                borderRadius: 16,
                background: C.cream,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 800,
                color: C.primary,
              }}
            >
              !
            </div>
            <h1 id="global-error-title" style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>
              {t.error.title}
            </h1>
            <p role="alert" style={{ fontSize: 15, lineHeight: 1.6, margin: "0 0 28px", color: C.slate }}>
              {t.error.message}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
              <button
                type="button"
                onClick={reset}
                style={{ ...button, background: C.primary, color: C.paper, border: "none" }}
              >
                {t.error.tryAgain}
              </button>
              {/* Full navigation (not <Link>) — the app shell itself failed. */}
              <a href={`/${locale}`} style={{ ...button, background: C.paper, color: C.ink, border: `1px solid ${C.border}` }}>
                {t.error.goHome}
              </a>
            </div>
            {error.digest && (
              <p style={{ marginTop: 32, fontSize: 12, color: C.muted }}>
                {t.error.reference}:{" "}
                <code dir="ltr" style={{ fontFamily: "ui-monospace, Menlo, monospace", userSelect: "all" }}>
                  {error.digest}
                </code>
              </p>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
