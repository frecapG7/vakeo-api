import passport from "passport";
import { HeaderAPIKeyStrategy } from "passport-headerapikey";

passport.use(
  new HeaderAPIKeyStrategy(
    { header: "x-api-key", prefix: "" },
    false,
    (apiKey, done) => {
      if (apiKey === process.env.API_KEY) {
        return done(null, true);
      } else {
        return done(null, false);
      }
    }
  )
);

export default passport;
