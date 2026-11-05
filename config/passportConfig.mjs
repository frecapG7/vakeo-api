import passport from "passport";
import { HeaderAPIKeyStrategy  } from "passport-headerapikey";
import AnonymousStrategy from "passport-anonymous";
import config from "../config.mjs";
import { getTripUserByToken } from "../services/tripUserService.mjs";

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

// Strategy for x-user-token validation (v3 — token-based identity)
passport.use(
  "user-token",
  new HeaderAPIKeyStrategy(
    { header: "x-user-token", prefix: "" },
    false,
    async (token, done) => {
      try {
        const user = await getTripUserByToken(token);
        if (user) {
          return done(null, user);
        }
        return done(null, false, { message: "Invalid or expired token" });
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.use(new AnonymousStrategy());

export default passport;
