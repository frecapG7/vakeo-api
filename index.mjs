import express from "express";
import passport from "./config/passportConfig.mjs";
import routes from "./app/routes/index.mjs";
import cors from "cors";
import morgan from "morgan";
import config from "./config.mjs";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());


if(config.environment !== 'development'){
  console.log("TODO: prepare production environment");
  app.use(morgan("common"));
}else{
  app.use(morgan("dev"));
}



app.use(
  "/api",
  passport.authenticate("headerapikey", {
    session: false,
  }),
  routes
);

app.listen(config.port, () => {
  console.log(`Server for env : ${config.environment} is now running on port ${config.port}`);
});
