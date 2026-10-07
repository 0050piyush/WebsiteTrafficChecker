import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { PAGE_GROUPS } from "@/lib/pages";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: {
    default: "TrafficLens — Free Website Traffic Checker & SEO Toolkit",
    template: "%s · TrafficLens",
  },
  description:
    "Check any website's traffic, audit its SEO, analyze pages and find keyword ideas. Free, no sign-up, open source, and every metric explains its source.",
  applicationName: "TrafficLens",
  openGraph: {
    title: "TrafficLens — Free Website Traffic Checker & SEO Toolkit",
    description: "Traffic estimates, live site audits, on-page SEO checks and keyword ideas. Free and open source.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

// Applied before paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8">
          {children}
        </main>
        <footer className="border-t border-line">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 text-sm text-ink-3 lg:grid-cols-5">
            <div className="col-span-2 lg:col-span-1">
              <div className="font-semibold text-ink">{SITE.name}</div>
              <p className="mt-2">A free, open-source SEO toolkit. Live data, transparent methods, no account required.</p>
            </div>
            {PAGE_GROUPS.map((group) => (
              <nav key={group.title} aria-label={group.title}>
                <div className="text-xs font-semibold uppercase tracking-wide text-ink-2">{group.title}</div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {group.pages.map((p) => (
                    <li key={p.href}>
                      <Link className="hover:text-ink" href={p.href}>
                        {p.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          <div className="border-t border-line">
            <div className="mx-auto max-w-6xl px-4 py-5 text-xs text-ink-3">
              © {new Date().getFullYear()} {SITE.name}. Free tools, no sign-up.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
