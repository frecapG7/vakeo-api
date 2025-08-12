import passport from "passport";
import { HeaderAPIKeyStrategy } from "passport-headerapikey";
import config from "../config.mjs";

passport.use(
  new HeaderAPIKeyStrategy(
    { header: "x-api-key", prefix: "" },
    false,
    (apiKey, done) => {
      if (apiKey === config.api_key) {
        return done(null, true);
      } else {
        console.error(`Invalid api key`);
        return done(null, false);
      }
    }
  )
);

export default passport;
