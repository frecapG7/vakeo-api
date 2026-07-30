import express from "express";
import passport from "passport";
import { getTrip, createTrip, deleteTrip, updateTrip, dashboard, search } from "../services/tripService.mjs";
import { createTripUsers } from "../services/tripUserService.mjs";
import { generateJWT } from "../services/tokenService.mjs";
import { encodeId } from "../services/idEncoderService.mjs";
import { verifyUser } from "../services/validationService.mjs";
import { ForbiddenError, InvalidError } from "../utils/errors.mjs";

const app = express();

app.get("/", async (req, res) => {

  const trips = await search(req.query);
  return res.status(200).json(trips);
});

app.get("/:id", async (req, res) => {
  const includeStops = String(req.query?.includeStops).toLowerCase() === "true";
  const trip = await getTrip(req.params.id, includeStops);

  await trip.populate("users");
  return res.status(200).json(trip);
});

app.post("", async (req, res) => {
  // Check all users have unique key
  const { users } = req.body;
  if (users?.length === 0 || users?.length > 20)
    throw new InvalidError("Cannot create trip: a trip must have between 1 and 20 users");

  const tripUsers = await createTripUsers(users);
  const trip = await createTrip({ ...req.body, users: tripUsers });
  return res.status(201).json(trip);
});

// Should we restrict who can do this ?
app.put("/:id", async (req, res) => {
  const trip = await getTrip(req.params.id);

  const savedTrip = await updateTrip(trip, req.body);
  await savedTrip.populate("users");
  return res.status(200).json(savedTrip);
});


app.delete("/:id", async (req, res) => {
  const trip = await deleteTrip(req.params.id);
  return res.status(200);
})

app.post("/:id/share", async (req, res) => {
  const trip = await getTrip(req.params.id);
  const jwt = await generateJWT(trip?._id, "24w");
  return res.status(200).json({
    value: Buffer.from(jwt, "utf-8").toString('base64url')
  });
});

app.get("/:id/share", async (req, res) => {
  const trip = await getTrip(req.params.id);
  const obfuscatedId = await encodeId(trip._id.toString());
  return res.json({ value: Buffer.from(obfuscatedId).toString('base64url') });
});


app.get("/:id/dashboard",
  passport.authenticate('user-header', { session: false, failWithError: false }),
  async (req, res) => {
    const trip = await getTrip(req.params.id);
    const userId = req.user?._id;

    if (trip.isPrivate) {
      if (!userId) throw new ForbiddenError("Private trip requires authenticated user");
      verifyUser(trip, { _id: userId });
    }

    const result = await dashboard(trip, userId);
    return res.status(200).json(result);
  }
);



export default app;
