import express from "express";
import { createMeal, getMeals, getMeal } from "../services/mealsService.mjs";
const app = express();

app.get("/", async (req, res) => {
  const results = await getMeals(req);
  return res.status(200).json(results);
});

app.get("/:mealId", async (req, res) => {
  const result = await getMeal(req);
  return res.status(200).json(result);
});

app.post("/", async (req, res) => {
  const results = await createMeal(req);
  return res.status(201).json(results);
});

export default app;
