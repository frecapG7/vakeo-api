import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxLength: 150
    },
    startDate: {
        type: Date,
        required: false
    },
    endDate: {
        type: Date,
        required: false,
    },
    trip: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trip",
        required: true,
    },
    owners: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "TripUser",
    },
    attendees: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "TripUser",
    },
    type: {
        type: String,
        required: true,
        enum: ["MEAL", "RESTAURANT", "SPORT", "PARTY", "VISITATION",  "ACTIVITY", "OTHER"]
    },
    details: {
        type: String,
        required: false,
        maxLength: 255
    }
}, { timestamps: true });



export default mongoose.model("Event", eventSchema);