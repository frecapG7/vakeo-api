




import express from "express";
import { getLinkPreview } from "link-preview-js";
import dns from "node:dns";
import { isValidUrl } from "../utils/validator.mjs";




const app = express();



app.post("/link-preview", async (req, res) => {
    try {
        const { url } = req.body;
        if (!isValidUrl(url)) return res.status(500).json({ error: "Invalid url" });

        const preview = await getLinkPreview(url, {
            imagesPropertyType: "og",
            headers: {
                "user-agent": "googlebot"
            },
            timeout: 30000,
            resolveDNSHost: async (url) => {
                return new Promise((resolve, reject) => {
                    const hostname = new URL(url).hostname;
                    console.log(hostname);
                    dns.lookup(hostname, (err, address, family) => {
                        if (err) {
                            console.warn(err);
                            reject(err);
                            return;
                        }
                        resolve(address);
                    })
                })
            }
        });
        return res.status(200).json(preview);

    } catch (err) {
        return res.status(500).json({ error: "Cannot generate preview" });
    }
})


export default app;