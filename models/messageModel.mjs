import mongoose from "mongoose";


const modelSchema = new mongoose.Schema({
    text: {
        type: String,
        maxlength: 500,
        required: true
    },
    trip: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trip",
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TripUser",
        required: true
    },
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
        required: false
    }
}, {
    timestamps: true
});

// Add indexes for performance
modelSchema.index({ trip: 1, createdAt: -1 });
modelSchema.index({ event: 1, createdAt: -1 });


const Message = mongoose.model("Message", modelSchema);

export default Message;