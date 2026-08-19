import mongoose from "mongoose";

const linkSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    icon: {
        type: String,
        required: false,
    },
    image: {
        type: String,
        required: false,
    },
    description: {
        type: String,
        required: false
    },
    trip: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trip",
        required: true

    },
    type: {
        type: String,
        enum: ['accommodation', 'general'],
        default: 'general'
    }
});

export default mongoose.model("Link", linkSchema);