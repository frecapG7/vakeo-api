import express from "express";
import { getTrip } from "../services/tripService.mjs";
import { verifyJWT } from "../services/tokenService.mjs";

const app = express();



const decrypt = (token) => Buffer.from(token, "base64url").toString("ascii");


app.post("/verify", async (req, res) => {
    try {
        const { token } = req.body;
        const payload = await verifyJWT(decrypt(token));
        return res.status(200).json({ valid: true });
    } catch (error) {
        return res.status(200).json({ valid: false, message: "Invalid token" });
    }
});



app.get("/:token", async (req, res) => {

    const token = req.params?.token;
    const payload = await verifyJWT(decrypt(token));
    const trip = await getTrip(payload.sub);
    return res.status(200).json({
        _id: trip?.id,
        image: trip?.image,
        name: trip?.name
    });
});


export default app;