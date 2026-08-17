"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            textAlign: "center",
            background: "#0A0A0A",
            color: "#FAFAFA",
          }}
        >
          <div style={{ maxWidth: 400 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 24, opacity: 0.7 }}>
              {error.message || "An unexpected error occurred. Please try again."}
            </p>
            <button
              onClick={reset}
              style={{
                height: 44,
                padding: "0 24px",
                borderRadius: 12,
                background: "#00E5A0",
                color: "#0A0A0A",
                fontWeight: 600,
                fontSize: 14,
                border: "none",
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
