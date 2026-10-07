import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

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
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-ink-3 sm:grid-cols-3">
            <div>
              <div className="font-semibold text-ink">TrafficLens</div>
              <p className="mt-2">A free, open-source SEO toolkit. Live data, transparent methods, no account required.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Link className="hover:text-ink" href="/traffic">Website traffic checker</Link>
              <Link className="hover:text-ink" href="/audit">Site audit</Link>
              <Link className="hover:text-ink" href="/analyzer">On-page SEO checker</Link>
              <Link className="hover:text-ink" href="/keywords">Keyword generator</Link>
            </div>
            <div className="flex flex-col gap-1.5">
              <Link className="hover:text-ink" href="/methodology">Methodology & data sources</Link>
              <Link className="hover:text-ink" href="/api-docs">REST API</Link>
              <a className="hover:text-ink" href="https://github.com/0050piyush/WebsiteTrafficChecker" target="_blank" rel="noreferrer">
                Source code on GitHub
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
