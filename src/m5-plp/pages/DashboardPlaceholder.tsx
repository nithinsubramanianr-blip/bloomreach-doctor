import { Link } from 'react-router-dom';

/**
 * DashboardPlaceholder — temporary stub for /doctor.
 *
 * Spec 005 (M4 PPD Dashboard) is a later round. When it lands, swap this
 * for `src/m4-dashboard/App` in `src/App.tsx`. DO NOT import from
 * `src/m4-dashboard/` here — it doesn't exist yet.
 */
export default function DashboardPlaceholder() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header
        className="flex h-16 items-center justify-between px-6"
        style={{ backgroundColor: '#2D1BB5' }}
      >
        <span className="text-lg font-semibold text-white">
          PPD Dashboard — coming in spec 005
        </span>
        <Link
          to="/"
          className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20"
        >
          Back to PLP
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold text-ppd-navy">
          Dashboard placeholder
        </h1>
        <p className="mt-3 text-slate-700">
          The Personalization Performance Doctor dashboard (Modules A, B, C)
          will mount here once spec 005 is implemented. This route is wired so
          the shared app shell is ready ahead of time.
        </p>
      </main>
    </div>
  );
}
