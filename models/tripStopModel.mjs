import mongoose from "mongoose";
import locationSchema from "./locationModel.mjs";
import linkSchema from "./linkModel.mjs";

const tripStopSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxLength: 100,
    },
    location: {
        type: locationSchema,
        required: false,
    },
    accommodation: {
        type: linkSchema,
        required: false,
    },
    polls: {
        type: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Poll"
        }],
        validate: {
            validator: function(arr) { return arr.length <= 10; },
            message: "A stop cannot have more than 10 polls"
        }
    },
    trip: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trip"
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TripUser",
        required: true
    },
    modifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TripUser"
    }
}, { timestamps: true });

export default mongoose.model("TripStop", tripStopSchema);