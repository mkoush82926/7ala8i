import Link from "next/link";
import { ADMIN_COPY } from "@/lib/admin/dictionary";

/**
 * Deliberately generic: a non-platform visitor must not learn that /admin
 * exists, so this mirrors an ordinary 404 and links to the public site.
 */
export default function AdminNotFound() {
  const c = ADMIN_COPY.meta;
  return (
    <main
      id="main"
      aria-labelledby="nf-title"
      className="flex min-h-[100dvh] items-center justify-center bg-[var(--bg-primary)] px-4 py-12"
    >
      <div className="w-full max-w-md text-center">
        <p
          aria-hidden="true"
          className="mb-4 select-none text-[56px] font-extrabold leading-none tracking-tight text-[var(--border-subtle)]"
        >
          404
        </p>
        <h1 id="nf-title" className="text-xl font-semibold text-[var(--text-primary)]">
          {c.notFoundTitle}
        </h1>
        <p className="mt-2 text-[15px] text-[var(--text-secondary)]">{c.notFoundBody}</p>
        <Link href="/" className="btn btn-secondary mt-6">
          {c.notFoundCta}
        </Link>
      </div>
    </main>
  );
}
