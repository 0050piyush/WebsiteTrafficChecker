import { parse } from "tldts";

/** A search market: the country and language keyword data is looked up for. */
export interface Market {
  /** Country code as search engines use it, e.g. "us", "gb". */
  gl: string;
  /** Language code, e.g. "en". */
  hl: string;
  name: string;
}

/** Countries with keyword data. `location` is the Google Ads geo ID used by DataForSEO. */
const COUNTRIES: Record<string, { name: string; hl: string; location: number }> = {
  us: { name: "United States", hl: "en", location: 2840 },
  gb: { name: "United Kingdom", hl: "en", location: 2826 },
  ca: { name: "Canada", hl: "en", location: 2124 },
  au: { name: "Australia", hl: "en", location: 2036 },
  in: { name: "India", hl: "en", location: 2356 },
  ie: { name: "Ireland", hl: "en", location: 2372 },
  nz: { name: "New Zealand", hl: "en", location: 2554 },
  za: { name: "South Africa", hl: "en", location: 2710 },
  de: { name: "Germany", hl: "de", location: 2276 },
  fr: { name: "France", hl: "fr", location: 2250 },
  es: { name: "Spain", hl: "es", location: 2724 },
  it: { name: "Italy", hl: "it", location: 2380 },
  nl: { name: "Netherlands", hl: "nl", location: 2528 },
  se: { name: "Sweden", hl: "sv", location: 2752 },
  br: { name: "Brazil", hl: "pt", location: 2076 },
  mx: { name: "Mexico", hl: "es", location: 2484 },
  jp: { name: "Japan", hl: "ja", location: 2392 },
};

/** Country-code TLDs that don't match their country code. */
const TLD_ALIASES: Record<string, string> = { uk: "gb" };

/** Where a language is mainly searched, for sites on generic TLDs such as .com. */
const LANGUAGE_COUNTRY: Record<string, string> = { en: "us", de: "de", fr: "fr", es: "es", it: "it", nl: "nl", sv: "se", pt: "br", ja: "jp" };

const market = (gl: string, hl?: string): Market => ({ gl, hl: hl ?? COUNTRIES[gl].hl, name: COUNTRIES[gl].name });

/**
 * Pick the market a site most likely serves: its country-code TLD when we have data for
 * that country (bbc.co.uk → United Kingdom), else the page's language and region
 * (lang="de" → Germany, "en-GB" → United Kingdom), else the United States, like Ahrefs.
 */
export function siteMarket(domain: string, pageLang?: string | null): Market {
  const [lang = "", region = ""] = (pageLang ?? "").toLowerCase().split(/[-_]/);
  const supportedLang = LANGUAGE_COUNTRY[lang] ? lang : null;

  const tld = (parse(domain).publicSuffix ?? "").split(".").pop() ?? "";
  const fromTld = TLD_ALIASES[tld] ?? tld;
  if (COUNTRIES[fromTld]) return market(fromTld, supportedLang ?? undefined);

  if (supportedLang) {
    const fromRegion = TLD_ALIASES[region] ?? region;
    // "en-GB" → United Kingdom, but only when that country searches in this language.
    if (COUNTRIES[fromRegion]?.hl === supportedLang) return market(fromRegion);
    return market(LANGUAGE_COUNTRY[supportedLang]);
  }
  return market("us");
}

/** DataForSEO location and language for a market. Its keyword database uses each country's main language. */
export function dataForSeoLocation(market: Market): { location_code: number; language_code: string } {
  const country = COUNTRIES[market.gl] ?? COUNTRIES.us;
  return { location_code: country.location, language_code: country.hl };
}
