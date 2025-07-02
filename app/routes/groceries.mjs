
import {getGroceries} from "../services/groceriesService.mjs"
import express from "express";
const app = express();


app.get("/", async (req, res) => {
    const result = await getGroceries(req);
    return res.status(200).json(result); 
});

export default app;