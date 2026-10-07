import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchUrl, probeUrl, FetchError, decodeBody } from "@/lib/net/fetcher";
import { assertFetchableUrl, isPublicIp } from "@/lib/net/guard";
import { startFixtureSite, type FixtureSite } from "./helpers/fixture-site";

describe("SSRF guard", () => {
  it("classifies public and private addresses", () => {
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("2606:4700::1111")).toBe(true);
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "0.0.0.0", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "100.64.0.1"]) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
  });

  it("rejects private hosts, odd ports and credentials", () => {
    delete process.env.ALLOW_PRIVATE_HOSTS;
    const bad = ["http://127.0.0.1/", "http://localhost/", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "http://intranet/", "http://example.com:22/", "http://user:pw@example.com/", "ftp://example.com/", "http://printer.local/"];
    for (const u of bad) expect(() => assertFetchableUrl(new URL(u)), u).toThrow();
    expect(() => assertFetchableUrl(new URL("https://example.com/"))).not.toThrow();
    expect(() => assertFetchableUrl(new URL("http://example.com:8080/"))).not.toThrow();
  });

  it("blocks loopback fetches unless explicitly allowed", async () => {
    delete process.env.ALLOW_PRIVATE_HOSTS;
    await expect(fetchUrl("http://127.0.0.1:9/")).rejects.toMatchObject({ code: "BLOCKED_URL" });
  });
});

describe("fetcher against a live local server", () => {
  let site: FixtureSite;
  beforeAll(async () => {
    process.env.ALLOW_PRIVATE_HOSTS = "true";
    site = await startFixtureSite();
  });
  afterAll(async () => {
    await site.close();
    delete process.env.ALLOW_PRIVATE_HOSTS;
  });

  it("decompresses gzip and reports transfer size", async () => {
    const res = await fetchUrl(`${site.origin}/`);
    expect(res.status).toBe(200);
    expect(res.contentEncoding).toBe("gzip");
    expect(res.transferBytes).toBeGreaterThan(0);
    expect(res.transferBytes).toBeLessThan(res.body.length);
    expect(decodeBody(res.body, res.headers["content-type"])).toContain("Welcome to the fixture");
    expect(res.remoteAddress).toBe("127.0.0.1");
    expect(res.timing.ttfbMs).toBeGreaterThanOrEqual(0);
  });

  it("follows and records redirect chains", async () => {
    const res = await fetchUrl(`${site.origin}/chain1`);
    expect(res.status).toBe(200);
    expect(res.finalUrl).toBe(`${site.origin}/about`);
    expect(res.redirects.map((r) => r.status)).toEqual([301, 302]);
  });

  it("returns the redirect itself when maxRedirects is 0", async () => {
    const res = await fetchUrl(`${site.origin}/old`, { maxRedirects: 0 });
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe("/about");
  });

  it("detects redirect loops", async () => {
    await expect(fetchUrl(`${site.origin}/loop-a`)).rejects.toMatchObject({ code: "REDIRECT_LOOP" });
  });

  it("truncates bodies over maxBytes", async () => {
    const res = await fetchUrl(`${site.origin}/big`, { maxBytes: 1000 });
    expect(res.truncated).toBe(true);
    expect(res.body.length).toBe(1000);
  });

  it("times out slow responses", async () => {
    const err = await fetchUrl(`${site.origin}/slow`, { timeoutMs: 300 }).catch((e) => e);
    expect(err).toBeInstanceOf(FetchError);
    expect(err.code).toBe("TIMEOUT");
  });

  it("probes link status with HEAD/GET", async () => {
    expect((await probeUrl(`${site.origin}/broken`)).status).toBe(404);
    expect((await probeUrl(`${site.origin}/img/ok.png`)).status).toBe(200);
    const refused = await probeUrl("http://127.0.0.1:1/");
    expect(refused.status).toBe(0);
    expect(refused.code).toBe("ECONNREFUSED");
  });
});
