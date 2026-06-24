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

// Add indexes for faster counting and querying
goodSchema.index({ event: 1 });          // For counting goods by event
goodSchema.index({ trip: 1 });           // For counting goods by trip
goodSchema.index({ trip: 1, event : 1, checked: 1 });   // For counting goods by trip & event & checked
goodSchema.index({ event: 1, checked: 1 }); // For counting checked/unchecked goods by event
goodSchema.index({ trip: 1, name: 1 });  // For name-based searches within a trip

export default mongoose.model("Good", goodSchema);