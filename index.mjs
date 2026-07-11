import express from "express";
import passport from "./config/passportConfig.mjs";
import routes from "./routes/index.mjs";
import cors from "cors";
import morgan from "morgan";
import config from "./config.mjs";
import connect from "./config/dbConfig.mjs";
import { handleError } from "./middlewares/errorMiddleware.mjs";
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
});

const app = express();
app.set('trust proxy', 1);
app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());


connect();

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

// Error handler must be declared last
app.use(handleError);

app.listen(config.port, () => {
  console.log(`Server for env : ${config.environment} is now running on port ${config.port}`);
});
