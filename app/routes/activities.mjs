import express from "express";
import {
  createActivity,
  deleteActivity,
  getActivities,
  getActivity,
  updateActivity,
} from "../services/activitiesService.mjs";
const app = express();

app.get("/", async (req, res) => {
  const results = await getActivities(req);
  return res.status(200).json(results);
});

app.get("/:activityId", async (req, res) => {
  const result = await getActivity(req);
  return res.status(200).json(result);
});

app.post("/", async (req, res) => {
  const results = await createActivity(req);
  return res.status(201).json(results);
});

app.put("/:activityId", async (req, res) => {
  const result = await updateActivity(req);
  return res.status(200).json(result);
});

app.delete("/:activityId", async (req, res) => {
  await deleteActivity(req);
  return res.status(204).send();
});

export default app;
