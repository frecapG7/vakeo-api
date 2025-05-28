import express from "express";
import { searchLinks } from "../services/linksService.mjs";
const app = express();

app.get("/", async (req, res) => {
  const links = await searchLinks(req);
  return res.status(200).json(links);
});

export default app;
