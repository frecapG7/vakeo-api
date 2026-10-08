import { getLinkPreview } from "link-preview-js";
import dns from "node:dns";
import { InvalidError, ForbiddenError } from "../utils/errors.mjs";

const TIMEOUT_MS = 10000;

/**
 * Two distinct, realistic browser header sets. The second one is the retry
 * profile used when the first is bounced by bot detection — many sites
 * (booking.com among them) rate-limit or block a single UA fingerprint.
 */
const BROWSER_PROFILES = [
    {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7",
        "sec-ch-ua": "\"Not A Brand\";v=\"8\", \"Chromium\";v=\"131\", \"Google Chrome\";v=\"131\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
    },
    {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "fr-FR,fr;q=0.9",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
    },
];

/**
 * Page titles that mean the site bounced us to a bot wall instead of the
 * actual content (Cloudflare interstitials, 403/404 pages, etc.).
 */
const DENIED_KEYWORDS = [
    /access\s+denied/i,
    /denied/i,
    /forbidden/i,
    /blocked/i,
    /403/i,
    /404/i,
    /restricted/i,
    /not\s+allowed/i,
    /not\s+found/i,
    /bot\s+detected/i,
    /unavailable/i,
    /service\s+unavailable/i,
    /please\s+enable\s+javascript/i,
    /security\s+check/i,
    /just\s+a\s+moment/i,
    /attention\s+required/i,
    /unusual\s+traffic/i,
    /verify\s+(you\s+are|that\s+you're)/i,
    /checking\s+(if|your)\s+browser/i,
    /captcha/i,
];

const isAccessDenied = (preview) =>
    !preview?.title || DENIED_KEYWORDS.some((keyword) => keyword.test(preview.title));

/**
 * True if the resolved address belongs to a range the API must never fetch:
 * loopback, private networks, CGNAT, link-local (cloud metadata), multicast,
 * and their IPv6 equivalents. The IPv4-mapped IPv6 form is unwrapped first.
 * @param {string} address - resolved IP address
 * @param {number} [family=4] - 4 or 6
 * @returns {boolean}
 */
export const isPrivateAddress = (address, family = 4) => {
    const value = String(address || "").toLowerCase();

    const mappedMatch = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mappedMatch)
        return isPrivateAddress(mappedMatch[1], 4);

    if (family === 6 || value.includes(":")) {
        if (value === "::" || value === "::1")
            return true; // unspecified / loopback
        if (value.startsWith("fc") || value.startsWith("fd"))
            return true; // fc00::/7 unique local
        return /^fe[89ab]/.test(value); // fe80::/10 link-local
    }

    const [a, b] = value.split(".").map(Number);
    if ([0, 10, 127].includes(a))
        return true; // this-network, private, loopback
    if (a === 100 && b >= 64 && b <= 127)
        return true; // CGNAT 100.64/10
    if (a === 169 && b === 254)
        return true; // link-local — cloud metadata endpoints
    if (a === 172 && b >= 16 && b <= 31)
        return true; // private 172.16/12
    if (a === 192 && b === 168)
        return true; // private 192.168/16
    if (a === 198 && (b === 18 || b === 19))
        return true; // benchmarking 198.18/15
    if (a >= 224)
        return true; // multicast + reserved
    return false;
};

/**
 * Resolves the URL's host and rejects non-public addresses — the SSRF guard.
 * Also handed to link-preview-js as `resolveDNSHost` so redirects to private
 * ranges are re-validated by the lib on every hop.
 * @param {string} url - absolute https URL
 * @returns {Promise<string>} the resolved public address
 * @throws {InvalidError} unresolvable host
 * @throws {ForbiddenError} host resolves to a private range
 */
export const resolvePublicAddress = (url) => new Promise((resolve, reject) => {
    const { hostname } = new URL(url);
    dns.lookup(hostname, (err, address, family) => {
        if (err)
            return reject(new InvalidError(`Cannot resolve host "${hostname}"`));
        if (isPrivateAddress(address, family))
            return reject(new ForbiddenError("URL resolves to a private address"));
        resolve(address);
    });
});

const validateUrl = (rawUrl) => {
    let parsed;
    try {
        parsed = new URL(rawUrl);
    } catch (err) {
        throw new InvalidError("Invalid url");
    }
    if (parsed.protocol !== "https:")
        throw new InvalidError("Only https URLs are supported");
    if (!parsed.hostname.includes("."))
        throw new InvalidError("Invalid url");
    return parsed.toString();
};

/**
 * Same-site redirect policy: allow the same host, its www variant, and its
 * subdomains (booking.com bounces across fr.booking.com, secure.booking.com,
 * www.booking.com). Redirect targets are still DNS-guarded via resolveDNSHost.
 */
export const isSameSiteRedirect = (baseURL, forwardedURL) => {
    const forwardedUrl = new URL(forwardedURL);
    // No https → http downgrade on manually followed redirects
    if (forwardedUrl.protocol !== "https:")
        return false;
    const base = new URL(baseURL).hostname.toLowerCase();
    const forwarded = forwardedUrl.hostname.toLowerCase();
    const root = base.replace(/^www\./, "");
    return forwarded === base
        || forwarded === `www.${root}`
        || `www.${forwarded}` === base
        || forwarded.endsWith(`.${root}`);
};

const attemptPreview = async (url, headers) => {
    const preview = await getLinkPreview(url, {
        headers,
        imagesPropertyType: "og",
        timeout: TIMEOUT_MS,
        followRedirects: "manual",
        handleRedirects: isSameSiteRedirect,
        resolveDNSHost: resolvePublicAddress,
    });
    return {
        success: true,
        data: {
            url: preview.url,
            title: preview.title,
            description: preview.description ?? null,
            image: preview?.images?.[0] ?? null,
            icon: preview?.favicons?.[0] ?? null,
            fallback: false,
        },
    };
};

/**
 * Builds a preview card for a URL.
 * - Validates the URL (https only) and the resolved address (SSRF guard).
 * - Tries each browser profile until one gets real content.
 * - Degrades to a domain-based fallback card (fallback: true) when every
 *   attempt is bot-blocked or fails, so clients can still render something.
 * @param {string} rawUrl - the URL to preview
 * @returns {Promise<{success: boolean, data: object}>}
 * @throws {InvalidError} malformed/unsupported URL or unresolvable host (422)
 * @throws {ForbiddenError} URL targets a private address (403)
 */
export const getPreview = async (rawUrl) => {
    const url = validateUrl(rawUrl);
    await resolvePublicAddress(url);

    for (const headers of BROWSER_PROFILES) {
        try {
            const result = await attemptPreview(url, headers);
            if (!isAccessDenied(result.data))
                return result;
        } catch (err) {
            if (err instanceof InvalidError || err instanceof ForbiddenError)
                throw err;
        }
    }

    const { hostname } = new URL(url);
    return {
        success: true,
        data: {
            url,
            title: hostname.replace(/^www\./, ""),
            description: null,
            image: null,
            icon: null,
            fallback: true,
        },
    };
};