/**
 * Technology fingerprinting from response headers, cookies and HTML. Each signature
 * lists the evidence it needs; a detection always reports *why* it matched so the
 * result is verifiable rather than a black box.
 */

export type TechCategory =
  | "CMS"
  | "Ecommerce"
  | "Framework"
  | "JavaScript library"
  | "Analytics"
  | "Tag manager"
  | "Advertising"
  | "CDN"
  | "Hosting"
  | "Web server"
  | "Language"
  | "Marketing"
  | "Live chat"
  | "Payments"
  | "Security"
  | "Consent"
  | "Fonts"
  | "SEO plugin"
  | "Monitoring"
  | "A/B testing"
  | "Static site generator";

interface Signature {
  name: string;
  category: TechCategory;
  /** header name -> regex tested against its value (empty regex = header present). */
  headers?: Record<string, RegExp>;
  cookies?: RegExp;
  html?: RegExp;
  scripts?: RegExp;
  generator?: RegExp;
  /** Extract a version from the generator meta tag. */
  version?: RegExp;
}

const SIGNATURES: Signature[] = [
  // CMS & site builders
  { name: "WordPress", category: "CMS", html: /\/wp-(?:content|includes)\//i, generator: /wordpress/i, version: /wordpress\s*([\d.]+)/i },
  { name: "Drupal", category: "CMS", headers: { "x-generator": /drupal/i, "x-drupal-cache": /./ }, html: /drupal-settings-json|\/sites\/default\/files\//i, generator: /drupal/i, version: /drupal\s*([\d.]+)/i },
  { name: "Joomla", category: "CMS", generator: /joomla/i, html: /\/media\/jui\/|option=com_/i },
  { name: "Ghost", category: "CMS", generator: /ghost/i, version: /ghost\s*([\d.]+)/i },
  { name: "Wix", category: "CMS", headers: { "x-wix-request-id": /./ }, html: /static\.wixstatic\.com|wix-bolt|_wixCIDX/i },
  { name: "Squarespace", category: "CMS", html: /static1\.squarespace\.com|squarespace-cdn\.com|Static\.SQUARESPACE_CONTEXT/i },
  { name: "Webflow", category: "CMS", html: /data-wf-(?:site|page)=|assets\.website-files\.com|cdn\.prod\.website-files\.com/i, generator: /webflow/i },
  { name: "Framer", category: "CMS", html: /framerusercontent\.com|data-framer-/i, generator: /framer/i },
  { name: "HubSpot CMS", category: "CMS", headers: { "x-hs-hub-id": /./ }, html: /hs-sites\.com|hubspotusercontent/i },
  { name: "Blogger", category: "CMS", generator: /blogger/i, html: /blogger\.com\/static|blogblog\.com/i },
  { name: "Typo3", category: "CMS", generator: /typo3/i },
  { name: "Contentful", category: "CMS", html: /images\.ctfassets\.net/i },
  { name: "Sanity", category: "CMS", html: /cdn\.sanity\.io/i },
  { name: "Notion", category: "CMS", html: /notion-static\.com|<meta[^>]+notion-site/i },
  { name: "Mintlify", category: "CMS", html: /mintlify\.s3|mintcdn\.com|generator" content="Mintlify/i },

  // Ecommerce
  { name: "Shopify", category: "Ecommerce", headers: { "x-shopid": /./, "x-shopify-stage": /./ }, html: /cdn\.shopify\.com|Shopify\.theme/i },
  { name: "WooCommerce", category: "Ecommerce", html: /woocommerce/i },
  { name: "Magento", category: "Ecommerce", cookies: /(?:^|\s)(?:frontend|mage-cache-storage)=/i, html: /Mage\.Cookies|\/static\/version\d+\/frontend\//i },
  { name: "BigCommerce", category: "Ecommerce", html: /cdn\d*\.bigcommerce\.com/i },
  { name: "PrestaShop", category: "Ecommerce", generator: /prestashop/i, html: /prestashop/i },
  { name: "Salesforce Commerce Cloud", category: "Ecommerce", html: /demandware\.static|dwanalytics/i },

  // Frameworks
  { name: "Next.js", category: "Framework", headers: { "x-powered-by": /next\.js/i, "x-nextjs-cache": /./ }, html: /__NEXT_DATA__|\/_next\/static\//i },
  { name: "Nuxt", category: "Framework", html: /__NUXT__|\/_nuxt\//i },
  { name: "Gatsby", category: "Static site generator", html: /___gatsby|gatsby-image/i, generator: /gatsby/i },
  { name: "Astro", category: "Framework", html: /<astro-island|astro-[a-z0-9]{6,}/i, generator: /astro/i, version: /astro\s*v?([\d.]+)/i },
  { name: "SvelteKit", category: "Framework", html: /__sveltekit|data-sveltekit/i },
  { name: "Remix", category: "Framework", html: /__remixContext|__remixManifest/i },
  { name: "Angular", category: "Framework", html: /ng-version="|ng-app=/i },
  { name: "React", category: "JavaScript library", html: /data-reactroot|__REACT_DEVTOOLS|react-dom(?:\.production)?(?:\.min)?\.js/i, scripts: /react(?:-dom)?(?:\.production)?(?:\.min)?\.js/i },
  { name: "Vue.js", category: "JavaScript library", html: /data-v-[0-9a-f]{8}|__VUE__/i, scripts: /vue(?:\.runtime)?(?:\.global)?(?:\.prod)?(?:\.min)?\.js/i },
  { name: "Svelte", category: "JavaScript library", html: /class="[^"]*svelte-[a-z0-9]{5,}/i },
  { name: "Alpine.js", category: "JavaScript library", html: /\sx-data=|alpinejs/i },
  { name: "htmx", category: "JavaScript library", html: /\shx-(?:get|post|target|swap)=/i, scripts: /htmx/i },
  { name: "jQuery", category: "JavaScript library", scripts: /jquery[.-]?(?:\d[\d.]*)?(?:\.min)?\.js/i },
  { name: "Bootstrap", category: "JavaScript library", html: /bootstrap(?:\.bundle)?(?:\.min)?\.(?:css|js)/i },
  { name: "Tailwind CSS", category: "JavaScript library", html: /tailwindcss|class="[^"]*\b(?:sm|md|lg):(?:flex|grid|hidden|block)\b/i },
  { name: "Docusaurus", category: "Static site generator", generator: /docusaurus/i },
  { name: "Hugo", category: "Static site generator", generator: /hugo/i, version: /hugo\s*([\d.]+)/i },
  { name: "Jekyll", category: "Static site generator", generator: /jekyll/i },
  { name: "Eleventy", category: "Static site generator", generator: /eleventy/i },
  { name: "VitePress", category: "Static site generator", generator: /vitepress/i },
  { name: "Laravel", category: "Framework", cookies: /laravel_session=/i },
  { name: "Django", category: "Framework", cookies: /csrftoken=/i, html: /csrfmiddlewaretoken/i },
  { name: "Ruby on Rails", category: "Framework", headers: { "x-runtime": /^[\d.]+$/ }, html: /<meta name="csrf-param" content="authenticity_token"/i },
  { name: "ASP.NET", category: "Framework", headers: { "x-aspnet-version": /./, "x-powered-by": /asp\.net/i }, html: /__VIEWSTATE/i, cookies: /ASP\.NET_SessionId/i },
  { name: "Express", category: "Framework", headers: { "x-powered-by": /express/i } },
  { name: "PHP", category: "Language", headers: { "x-powered-by": /php/i }, cookies: /PHPSESSID=/i },

  // Analytics & tags
  { name: "Google Analytics", category: "Analytics", html: /googletagmanager\.com\/gtag\/js\?id=G-|google-analytics\.com\/(?:analytics|ga)\.js|gtag\(['"]config['"],\s*['"]G-/i },
  { name: "Google Tag Manager", category: "Tag manager", html: /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/i },
  { name: "Plausible", category: "Analytics", html: /plausible\.io\/js/i },
  { name: "Fathom", category: "Analytics", html: /cdn\.usefathom\.com/i },
  { name: "Matomo", category: "Analytics", html: /matomo\.js|piwik\.js|_paq\.push/i },
  { name: "Simple Analytics", category: "Analytics", html: /scripts\.simpleanalyticscdn\.com/i },
  { name: "Umami", category: "Analytics", html: /data-website-id=[^>]+umami|umami\.is\/script/i },
  { name: "PostHog", category: "Analytics", html: /posthog\.init\(|[a-z]+\.posthog\.com\/static|posthog-js/i },
  { name: "Mixpanel", category: "Analytics", html: /cdn\.mxpnl\.com|mixpanel\.init/i },
  { name: "Amplitude", category: "Analytics", html: /cdn\.amplitude\.com|amplitude\.getInstance/i },
  { name: "Heap", category: "Analytics", html: /cdn\.heapanalytics\.com/i },
  { name: "Segment", category: "Analytics", html: /cdn\.segment\.com\/analytics\.js/i },
  { name: "Hotjar", category: "Analytics", html: /static\.hotjar\.com|hotjar\.com\/c\/hotjar-/i },
  { name: "Microsoft Clarity", category: "Analytics", html: /clarity\.ms\/tag/i },
  { name: "Vercel Analytics", category: "Analytics", html: /\/_vercel\/insights\/script\.js|va\.vercel-scripts\.com/i },
  { name: "Cloudflare Web Analytics", category: "Analytics", html: /static\.cloudflareinsights\.com\/beacon/i },
  { name: "Adobe Analytics", category: "Analytics", html: /assets\.adobedtm\.com|s_code\.js|AppMeasurement/i },

  // Advertising & marketing pixels
  { name: "Google AdSense", category: "Advertising", html: /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle/i },
  { name: "Google Ad Manager", category: "Advertising", html: /securepubads\.g\.doubleclick\.net/i },
  { name: "Google Ads", category: "Advertising", html: /googleadservices\.com|gtag\(['"]config['"],\s*['"]AW-/i },
  { name: "Meta Pixel", category: "Advertising", html: /connect\.facebook\.net\/[^"']*\/fbevents\.js|fbq\(['"]init/i },
  { name: "LinkedIn Insight", category: "Advertising", html: /snap\.licdn\.com\/li\.lms-analytics/i },
  { name: "TikTok Pixel", category: "Advertising", html: /analytics\.tiktok\.com/i },
  { name: "X (Twitter) Pixel", category: "Advertising", html: /static\.ads-twitter\.com/i },
  { name: "HubSpot", category: "Marketing", html: /js\.hs-scripts\.com|js\.hsforms\.net/i },
  { name: "Mailchimp", category: "Marketing", html: /chimpstatic\.com|list-manage\.com/i },
  { name: "Klaviyo", category: "Marketing", html: /static\.klaviyo\.com/i },
  { name: "Marketo", category: "Marketing", html: /munchkin\.marketo\.net/i },

  // Live chat & support
  { name: "Intercom", category: "Live chat", html: /widget\.intercom\.io|intercomSettings/i },
  { name: "Drift", category: "Live chat", html: /js\.driftt\.com/i },
  { name: "Zendesk", category: "Live chat", html: /static\.zdassets\.com/i },
  { name: "Crisp", category: "Live chat", html: /client\.crisp\.chat/i },
  { name: "Tawk.to", category: "Live chat", html: /embed\.tawk\.to/i },
  { name: "LiveChat", category: "Live chat", html: /cdn\.livechatinc\.com/i },

  // Payments
  { name: "Stripe", category: "Payments", html: /js\.stripe\.com/i },
  { name: "PayPal", category: "Payments", html: /paypal\.com\/sdk\/js|paypalobjects\.com/i },

  // Security & consent
  { name: "reCAPTCHA", category: "Security", html: /google\.com\/recaptcha|recaptcha\/api\.js/i },
  { name: "hCaptcha", category: "Security", html: /hcaptcha\.com\/1\/api\.js/i },
  { name: "Cloudflare Turnstile", category: "Security", html: /challenges\.cloudflare\.com\/turnstile/i },
  { name: "OneTrust", category: "Consent", html: /cdn\.cookielaw\.org|optanon/i },
  { name: "Cookiebot", category: "Consent", html: /consent\.cookiebot\.com/i },
  { name: "CookieYes", category: "Consent", html: /cdn-cookieyes\.com/i },

  // Fonts
  { name: "Google Fonts", category: "Fonts", html: /fonts\.googleapis\.com|fonts\.gstatic\.com/i },
  { name: "Adobe Fonts", category: "Fonts", html: /use\.typekit\.net/i },
  { name: "Font Awesome", category: "Fonts", html: /font-?awesome(?:\.min)?\.css|kit\.fontawesome\.com|use\.fontawesome\.com/i },

  // SEO plugins
  { name: "Yoast SEO", category: "SEO plugin", html: /yoast seo|yoast-schema-graph/i },
  { name: "Rank Math", category: "SEO plugin", html: /rank math|rank-math/i },
  { name: "All in One SEO", category: "SEO plugin", html: /all in one seo|aioseo/i },

  // Monitoring & testing
  { name: "Sentry", category: "Monitoring", html: /browser\.sentry-cdn\.com|sentry\.io\/api|Sentry\.init/i },
  { name: "New Relic", category: "Monitoring", html: /js-agent\.newrelic\.com|NREUM/i },
  { name: "Datadog RUM", category: "Monitoring", html: /datadoghq-browser-agent|DD_RUM/i },
  { name: "Optimizely", category: "A/B testing", html: /cdn\.optimizely\.com/i },
  { name: "VWO", category: "A/B testing", html: /dev\.visualwebsiteoptimizer\.com/i },

  // CDN / edge
  { name: "Cloudflare", category: "CDN", headers: { "cf-ray": /./, server: /cloudflare/i } },
  { name: "Fastly", category: "CDN", headers: { "x-fastly-request-id": /./, "fastly-debug-digest": /./, "x-served-by": /cache-[a-z]{3}/i } },
  { name: "Akamai", category: "CDN", headers: { server: /akamai/i, "x-akamai-transformed": /./, "akamai-grn": /./ } },
  { name: "Amazon CloudFront", category: "CDN", headers: { "x-amz-cf-id": /./, via: /cloudfront/i } },
  { name: "Bunny CDN", category: "CDN", headers: { server: /bunnycdn/i, "cdn-requestid": /./ } },
  { name: "Azure Front Door", category: "CDN", headers: { "x-azure-ref": /./ } },
  { name: "Google Cloud CDN", category: "CDN", headers: { via: /1\.1 google/i } },
  { name: "Varnish", category: "CDN", headers: { "x-varnish": /./, via: /varnish/i } },
  { name: "jsDelivr", category: "CDN", html: /cdn\.jsdelivr\.net/i },
  { name: "cdnjs", category: "CDN", html: /cdnjs\.cloudflare\.com/i },
  { name: "unpkg", category: "CDN", html: /unpkg\.com/i },

  // Hosting / platforms
  { name: "Vercel", category: "Hosting", headers: { "x-vercel-id": /./, server: /vercel/i } },
  { name: "Netlify", category: "Hosting", headers: { "x-nf-request-id": /./, server: /netlify/i } },
  { name: "GitHub Pages", category: "Hosting", headers: { server: /github\.com/i, "x-github-request-id": /./ } },
  { name: "Heroku", category: "Hosting", headers: { via: /vegur/i } },
  { name: "Fly.io", category: "Hosting", headers: { "fly-request-id": /./, server: /fly\/[a-f0-9]+/i } },
  { name: "Render", category: "Hosting", headers: { "x-render-origin-server": /./, "rndr-id": /./ } },
  { name: "Firebase Hosting", category: "Hosting", headers: { "x-firebase-hosting": /./ } },
  { name: "Amazon S3", category: "Hosting", headers: { server: /amazons3/i } },
  { name: "WP Engine", category: "Hosting", headers: { "x-powered-by": /wp engine/i, "wpe-backend": /./ } },
  { name: "Kinsta", category: "Hosting", headers: { "x-kinsta-cache": /./ } },
  { name: "Pantheon", category: "Hosting", headers: { "x-pantheon-styx-hostname": /./ } },
  { name: "Cloudflare Pages", category: "Hosting", headers: { "cf-pages": /./ } },

  // Web servers
  { name: "Nginx", category: "Web server", headers: { server: /nginx/i } },
  { name: "Apache", category: "Web server", headers: { server: /apache/i } },
  { name: "LiteSpeed", category: "Web server", headers: { server: /litespeed/i } },
  { name: "Microsoft IIS", category: "Web server", headers: { server: /microsoft-iis/i } },
  { name: "Caddy", category: "Web server", headers: { server: /caddy/i } },
  { name: "OpenResty", category: "Web server", headers: { server: /openresty/i } },
  { name: "Envoy", category: "Web server", headers: { server: /envoy/i, "x-envoy-upstream-service-time": /./ } },
  { name: "Google Web Server", category: "Web server", headers: { server: /^gws$|^gfe/i } },
];

export interface DetectedTech {
  name: string;
  category: TechCategory;
  version: string | null;
  evidence: string;
}

export interface TechInput {
  html: string;
  headers: Record<string, string>;
  scripts: string[];
  generator: string | null;
}

export function detectTechnologies({ html, headers, scripts, generator }: TechInput): DetectedTech[] {
  const found: DetectedTech[] = [];
  const cookies = headers["set-cookie"] ?? "";
  // Limit regex work on huge documents.
  const doc = html.length > 1_500_000 ? html.slice(0, 1_500_000) : html;
  const scriptList = scripts.join("\n");

  for (const sig of SIGNATURES) {
    let evidence: string | null = null;
    if (sig.headers) {
      for (const [name, re] of Object.entries(sig.headers)) {
        const v = headers[name];
        if (v !== undefined && re.test(v)) {
          evidence = `Header ${name}: ${v.slice(0, 60)}`;
          break;
        }
      }
    }
    if (!evidence && sig.generator && generator && sig.generator.test(generator)) evidence = `Generator meta tag: ${generator.slice(0, 60)}`;
    if (!evidence && sig.cookies && sig.cookies.test(cookies)) evidence = "Cookie set by server";
    if (!evidence && sig.scripts && sig.scripts.test(scriptList)) evidence = "Script URL";
    if (!evidence && sig.html) {
      const m = sig.html.exec(doc);
      if (m) evidence = `HTML contains “${m[0].slice(0, 50)}”`;
    }
    if (!evidence) continue;
    const version = sig.version && generator ? (sig.version.exec(generator)?.[1] ?? null) : null;
    found.push({ name: sig.name, category: sig.category, version, evidence });
  }
  return found;
}
