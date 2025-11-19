import mongoose from "mongoose";

const goodSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxLength: 155
    },
    quantity: {
        type: String,
        default: "",
        maxLength: 155
    },
    checked: {
        type: Boolean,
        default: false
    },
    trip: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trip",
        required: true,
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TripUser",
        required: true,
    }
}, { timestamps: true });

export default mongoose.model("Good", goodSchema);