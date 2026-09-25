import mongoose from "mongoose";

/**
 * TripUser schema
 * User naming must stay reserved for UserAccount one day
 *
 * The `token` field is the seat-claim marker:
 * - null  = seat is free (no one has claimed it)
 * - value = seat is claimed (the value is the identity secret for v3 auth)
 * Tokens are minted by `claimSeat`, not at creation.
 */
const tripUserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxLength: 50
    },
    avatar: {
        type: String,
    },
    restrictions: {
        type: [String],
        required: false
    },
    token: {
        type: String,
        select: false,
        index: {
            unique: true,
            partialFilterExpression: { token: { $type: "string" } },
        },
    }
});



export default mongoose.model("TripUser", tripUserSchema);