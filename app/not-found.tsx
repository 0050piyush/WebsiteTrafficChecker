import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="text-sm font-medium text-accent-ink">404</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink">Page not found</h1>
      <p className="mt-2 text-ink-2">Ironic, for an SEO tool. Let&apos;s get you back on track.</p>
      <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-lg bg-accent px-5 text-sm font-medium text-on-accent hover:bg-accent-hover">
        Go to the homepage
      </Link>
    </div>
  );
}
