import passport from "passport";

// Hard auth — rejects anonymous (mutations)
export const auth = passport.authenticate("user-token", { session: false });

// Soft auth — allows anonymous, sets req.user if token present (reads)
export const optionalAuth = passport.authenticate(
    ["user-token", "anonymous"],
    { session: false, failWithError: false }
);
