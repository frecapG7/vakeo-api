import express from "express";
import { getLinkPreview } from "link-preview-js";
import dns from "node:dns";
import { isValidUrl } from "../utils/validator.mjs";

const app = express();

  const errorKeywords = [
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
    /cloudflare/i,
    /security\s+check/i,
    /sorry,\s+you\s+have\s+been\s+blocked/i,
  ];

const isAccessDenied = (preview) => {
    if(!preview?.title) return true;
    return errorKeywords.some(keyword => keyword.test(preview.title));
}

const selectBestImage = (images) => {
    if (!images || images.length === 0) return null;
    return images.reduce((best, current) =>
        (current.width || 0) > (best.width || 0) ? current : best
    );
}

app.post("/link-preview", async (req, res) => {
    try {
        const { url } = req.body;
        if (!isValidUrl(url)) return res.status(500).json({ error: "Invalid url" });

        const preview = await getLinkPreview(url, {
            imagesPropertyType: "og",
            headers: {
                "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "accept-language": "en-US,en;q=0.5",
                "referer": "https://www.google.com/"
            },
            timeout: 30000,
            resolveDNSHost: async (url) => {
                return new Promise((resolve, reject) => {
                    const hostname = new URL(url).hostname;
                    dns.lookup(hostname, (err, address, family) => {
                        if (err) {
                            console.warn(err);
                            reject(err);
                            return;
                        }
                        resolve(address);
                    })
                })
            },
            followRedirects: `manual`,
            handleRedirects: (baseURL, forwardedURL) => {
                const urlObj = new URL(baseURL);
                const forwardedURLObj = new URL(forwardedURL);
                if (
                    forwardedURLObj.hostname === urlObj.hostname ||
                    forwardedURLObj.hostname === "www." + urlObj.hostname ||
                    "www." + forwardedURLObj.hostname === urlObj.hostname
                ) {
                    return true;
                } else {
                    return false;
                }
            },
        });

        const success = !isAccessDenied(preview);
        const bestImage = selectBestImage(preview?.images);

        return res.status(200).json({
            success,
            ...(success && {
                data: {
                    url: preview.url,
                    title: preview.title,

                    image: bestImage,
                    icon: preview?.favicons[0]
                }
            })
        });

    } catch (err) {
        return res.status(500).json({ error: "Cannot generate preview" });
    }
})


export default app;