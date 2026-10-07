/**
 * robots.txt parsing and matching following Google's documented semantics (RFC 9309):
 * the most specific user-agent group applies; within it the longest matching rule
 * wins, and "allow" wins ties. Supports "*" wildcards and "$" end anchors.
 */

export interface RobotsRule {
  type: "allow" | "disallow";
  path: string;
}

export interface RobotsGroup {
  agents: string[];
  rules: RobotsRule[];
  crawlDelay: number | null;
}

export interface RobotsTxt {
  groups: RobotsGroup[];
  sitemaps: string[];
  /** Lines the parser did not understand (typos like "Dissallow"). */
  invalidLines: { line: number; text: string }[];
}

const KNOWN = new Set(["user-agent", "allow", "disallow", "sitemap", "crawl-delay", "host", "clean-param", "noindex", "request-rate", "visit-time"]);

export function parseRobots(text: string): RobotsTxt {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  const invalidLines: RobotsTxt["invalidLines"] = [];
  let current: RobotsGroup | null = null;
  let lastWasAgent = false;

  const lines = text.replace(/^﻿/, "").split(/\r\n|\r|\n/);
  lines.forEach((rawLine, i) => {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) return;
    const idx = line.indexOf(":");
    if (idx === -1) {
      invalidLines.push({ line: i + 1, text: rawLine.slice(0, 200) });
      return;
    }
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!KNOWN.has(key)) {
      invalidLines.push({ line: i + 1, text: rawLine.slice(0, 200) });
      return;
    }
    switch (key) {
      case "user-agent": {
        if (!current || !lastWasAgent) {
          current = { agents: [], rules: [], crawlDelay: null };
          groups.push(current);
        }
        current.agents.push(value.toLowerCase());
        lastWasAgent = true;
        return;
      }
      case "allow":
      case "disallow": {
        lastWasAgent = false;
        if (!current) return;
        // An empty Disallow means "allow everything" and adds no rule.
        if (value || key === "allow") current.rules.push({ type: key, path: value });
        return;
      }
      case "crawl-delay": {
        lastWasAgent = false;
        const n = Number(value);
        if (current && Number.isFinite(n) && n >= 0) current.crawlDelay = n;
        return;
      }
      case "sitemap": {
        if (value) sitemaps.push(value);
        return;
      }
      default:
        lastWasAgent = false;
    }
  });

  return { groups, sitemaps: [...new Set(sitemaps)], invalidLines };
}

/** Pick the rules for a crawler token, merging all groups that name it. */
export function groupFor(robots: RobotsTxt, userAgentToken: string): { rules: RobotsRule[]; crawlDelay: number | null; matchedAgent: string | null } {
  const token = userAgentToken.toLowerCase();
  let best = "";
  for (const g of robots.groups) {
    for (const a of g.agents) {
      if (a !== "*" && token.includes(a) && a.length > best.length) best = a;
    }
  }
  const agent = best || (robots.groups.some((g) => g.agents.includes("*")) ? "*" : null);
  if (!agent) return { rules: [], crawlDelay: null, matchedAgent: null };
  const matching = robots.groups.filter((g) => g.agents.includes(agent));
  return {
    rules: matching.flatMap((g) => g.rules),
    crawlDelay: matching.find((g) => g.crawlDelay !== null)?.crawlDelay ?? null,
    matchedAgent: agent,
  };
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

function normalizePathForMatch(path: string): string {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

export function matchRule(rules: RobotsRule[], pathAndQuery: string): RobotsRule | null {
  const target = normalizePathForMatch(pathAndQuery || "/");
  let winner: RobotsRule | null = null;
  for (const rule of rules) {
    if (!rule.path) continue;
    if (!patternToRegex(normalizePathForMatch(rule.path)).test(target)) continue;
    if (
      !winner ||
      rule.path.length > winner.path.length ||
      (rule.path.length === winner.path.length && rule.type === "allow")
    ) {
      winner = rule;
    }
  }
  return winner;
}

export interface RobotsAccess {
  googlebot: boolean;
  bingbot: boolean;
  /** Bots without rules of their own (the "*" group), which includes our crawler. */
  otherBots: boolean;
}

/**
 * Who may crawl a URL. SEO verdicts must come from the search engine bots: many sites
 * (e.g. instagram.com) allow Googlebot and Bingbot but block every other bot, and
 * that's a deliberate choice, not an indexing problem.
 */
export function robotsAccess(robots: RobotsTxt | null, url: string): RobotsAccess {
  return {
    googlebot: isAllowed(robots, url, "Googlebot"),
    bingbot: isAllowed(robots, url, "Bingbot"),
    otherBots: isAllowed(robots, url, "TrafficLensBot"),
  };
}

export function isAllowed(robots: RobotsTxt | null, url: string, userAgentToken: string): boolean {
  if (!robots) return true;
  let pathAndQuery = "/";
  try {
    const u = new URL(url);
    pathAndQuery = u.pathname + u.search;
  } catch {
    return true;
  }
  if (pathAndQuery === "/robots.txt") return true;
  const { rules } = groupFor(robots, userAgentToken);
  const rule = matchRule(rules, pathAndQuery);
  return !rule || rule.type === "allow";
}
