import express from "express";
import v3 from "./v3/index.mjs";
const app = express();

// v3 — the only public surface (token auth + membership + encoded trip ids)
app.use("/v3", v3);

export default app;
