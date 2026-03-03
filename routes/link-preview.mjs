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
    /restricted/i,
    /not\s+allowed/i,
    /bot\s+detected/i,
  ];
const isAccessDenied = (preview) => {
    if(!preview?.title) return true;
    return errorKeywords.some(keyword => keyword.test(preview.title));
}

app.post("/link-preview", async (req, res) => {
    try {
        const { url } = req.body;
        if (!isValidUrl(url)) return res.status(500).json({ error: "Invalid url" });

        const preview = await getLinkPreview(url, {
            imagesPropertyType: "og",
            headers: {
                // "user-agent": "googlebot"
                "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 YaBrowser/26.3.0.1879.10 YaApp_iOS/2603.0 YaApp_iOS_Browser/2603.0 Safari/604.1 SA/3 Version/26.2"
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

        return res.status(200).json({
            success,
            ...(success && {
                data: {
                    url: preview.url,
                    title: preview.title,

                    image: preview?.images[0],
                    icon: preview?.favicons[0]
                }
            })
        });

    } catch (err) {
        return res.status(500).json({ error: "Cannot generate preview" });
    }
})


export default app;