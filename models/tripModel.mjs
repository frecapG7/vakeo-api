import mongoose from "mongoose";
import locationSchema from "./locationModel.mjs";
import tripStopSchema from "./tripStopModel.mjs";
import { encodeId } from "../services/idEncoderService.mjs";

const tripSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxLength: 50,
    },
    description: {
        type: String,
        required: false,
        maxLength: 500
    },
    users: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "TripUser",
    },
    image: {
        type: String,
        required: false,
    },
    startDate: {
        type: Date,
        required: false
    },
    endDate: {
        type: Date,
        required: false,
    },
    // Deprecated
    location: {
        type: locationSchema,
        required: false,
    },
    isPrivate: {
        type: Boolean,
        default: false,
    },
    // Public opaque trip identifier (AES-encoded _id). Minted once at
    // creation and never regenerated — serve THIS value everywhere (create,
    // share, join, batch echo), never a fresh encodeId(_id). Sparse so legacy
    // trips without the field don't collide on the unique index.
    encodedId: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
    },
    splittingLink: {
        type: {
            url: {
                type: String,
                required: false
            },
            icon: {
                type: String,
                required: false
            },
            title: {
                type: String,
                required: false
            }
        },
        required: false,
    }

}, { timestamps: true });

// Mint the public encodedId once, at creation — it must be stable for the
// lifetime of the trip so clients keying on it never see duplicates.
tripSchema.pre("save", function () {
    if (!this.encodedId)
        this.encodedId = encodeId(this._id.toString());
});


export default mongoose.model("Trip", tripSchema);