import express from "express";
import passport from "./config/passportConfig.mjs";
import routes from "./app/routes/index.mjs";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());

app.use(
  "/api",
  passport.authenticate("headerapikey", {
    session: false,
  }),
  routes
);

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
