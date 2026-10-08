/**
 * One-shot backfill: persist a stable encodedId on every Trip created before
 * the field existed (see docs/v3-notes.md — encodedId must be minted once and
 * never regenerated, otherwise clients keying on it create duplicates).
 *
 * Usage, from the repo root, against the target environment:
 *   node scripts/backfillEncodedIds.mjs
 *
 * Uses the same $exists-guarded $set as tripService.getOrCreateEncodedId:
 * safe to run while the API is live — first write wins, nothing is ever
 * overwritten, and concurrent lazy backfills from the API are harmless.
 */
import mongoose from "mongoose";
import connect from "../config/dbConfig.mjs";
import Trip from "../models/tripModel.mjs";
import { encodeId } from "../services/idEncoderService.mjs";

await connect();

const missing = await Trip.find({ encodedId: { $exists: false } }).select("_id").lean();
console.log(`Trips without encodedId: ${missing.length}`);

let backfilled = 0;
for (const { _id } of missing) {
    const encoded = encodeId(_id.toString());
    const res = await Trip.updateOne(
        { _id, encodedId: { $exists: false } },
        { $set: { encodedId: encoded } }
    );
    backfilled += res.modifiedCount;
}

const remaining = await Trip.countDocuments({ encodedId: { $exists: false } });
console.log(`Backfilled: ${backfilled} ; still missing: ${remaining}`);

await mongoose.disconnect();
process.exit(remaining === 0 ? 0 : 1);