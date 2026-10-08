"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent } from "react";
import { flushSync } from "react-dom";
import { Menu, Moon, Sun, X } from "lucide-react";
import { cx } from "./ui";
import { useAccount, type AccountUser } from "@/lib/client/account";
import { Logo } from "./Logo";

export const NAV = [
  { href: "/traffic", label: "Traffic checker" },
  { href: "/compare", label: "Compare" },
  { href: "/audit", label: "Site audit" },
  { href: "/analyzer", label: "Page analyzer" },
  { href: "/keywords", label: "Keywords" },
  { href: "/pricing", label: "Pricing" },
];

const MORE = [
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/api-docs", label: "API" },
  { href: "/methodology", label: "Methodology" },
];

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function ThemeToggle() {
  // The inline head script sets data-theme before paint; mirror it here.
  const theme = useSyncExternalStore(
    subscribeTheme,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => null,
  );
  // Counts switches so the icon remounts and spins on each one, but not on page load.
  const [spins, setSpins] = useState(0);
  // Only the latest switch cleans up, so a quick second tap isn't cut short by the first.
  const latest = useRef(0);

  const toggle = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement;
    const next = theme === "dark" ? "light" : "dark";
    const id = ++latest.current;
    const cleanUp = () => {
      if (latest.current === id) root.classList.remove("theme-switching", "theme-reveal");
    };
    const apply = () => {
      root.dataset.theme = next;
      try {
        localStorage.setItem("theme", next);
      } catch {
        /* storage unavailable */
      }
      // Render the new icon now so the transition captures it.
      flushSync(() => setSpins((n) => n + 1));
    };

    // Colors switch at once instead of fading through element transitions.
    root.classList.add("theme-switching");

    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply();
      void window.getComputedStyle(document.body).color;
      setTimeout(cleanUp, 1);
      return;
    }

    // Reveal the new theme in a circle that grows from the button to the farthest corner
    // (globals.css runs the animation). On iPhones the page also runs under the browser
    // toolbars, so measure to the bottom of the screen, not just the visible viewport.
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const height = Math.max(window.innerHeight, window.screen.height);
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, height - y));
    root.style.setProperty("--reveal-x", `${x}px`);
    root.style.setProperty("--reveal-y", `${y}px`);
    root.style.setProperty("--reveal-r", `${Math.ceil(radius)}px`);
    root.classList.add("theme-reveal");
    const transition = document.startViewTransition(apply);

    // While the circle grows, taps land on the page root instead of the button. Pass taps
    // on the button through, so tapping again switches straight back.
    const button = event.currentTarget;
    const forwardTap = (e: MouseEvent) => {
      const r = button.getBoundingClientRect();
      if (e.target !== root || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
      e.stopPropagation();
      button.click();
    };
    document.addEventListener("click", forwardTap, true);
    transition.finished
      .finally(() => {
        document.removeEventListener("click", forwardTap, true);
        cleanUp();
      })
      .catch(() => undefined);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink"
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title="Toggle theme"
    >
      <span key={spins} className={cx("inline-flex", spins > 0 && "theme-icon-spin")}>
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </span>
    </button>
  );
}

function Avatar({ user }: { user: AccountUser }) {
  const initial = (user.name ?? user.email ?? "?").trim().charAt(0).toUpperCase();
  return user.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.image} alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-full border border-line" referrerPolicy="no-referrer" />
  ) : (
    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink">{initial}</span>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const user = useAccount(pathname)?.user ?? null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur supports-[backdrop-filter]:bg-bg/75">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-ink" aria-label="TrafficLens home">
          <Logo />
          <span>TrafficLens</span>
        </Link>
        <nav className="ml-2 hidden items-center gap-0.5 lg:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors",
                pathname?.startsWith(item.href) ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/blog"
            aria-current={pathname?.startsWith("/blog") ? "page" : undefined}
            className={cx(
              "hidden rounded-lg px-3 py-1.5 text-sm hover:bg-surface-2 hover:text-ink lg:inline-block",
              pathname?.startsWith("/blog") ? "bg-surface-2 font-medium text-ink" : "text-ink-2",
            )}
          >
            Blog
          </Link>
          <Link href="/api-docs" className="hidden rounded-lg px-3 py-1.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink xl:inline-block">
            API
          </Link>
          <ThemeToggle />
          {user ? (
            <Link href="/account" className="ml-1 rounded-full" aria-label="Your account" title={user.email ?? "Your account"}>
              <Avatar user={user} />
            </Link>
          ) : (
            <Link
              href="/login"
              className={cx(
                "ml-1 hidden h-9 items-center rounded-lg border border-line-strong px-3 text-sm font-medium text-ink hover:bg-surface-2 sm:inline-flex",
                pathname === "/login" && "bg-surface-2",
              )}
            >
              Log in
            </Link>
          )}
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label="Menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" className="max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-line bg-surface px-4 py-2 lg:hidden" aria-label="Mobile">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-surface-2">
              {item.label}
            </Link>
          ))}
          <div className="my-1 border-t border-line" />
          {MORE.map((item) => (
            <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink">
              {item.label}
            </Link>
          ))}
          <div className="my-1 border-t border-line" />
          <Link href={user ? "/account" : "/login"} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-accent-ink hover:bg-surface-2">
            {user ? "Your account" : "Log in"}
          </Link>
        </nav>
      )}
    </header>
  );
}
