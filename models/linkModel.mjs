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
    image: {
        type: String,
        required: false,
    },
    icon: {
        type: String,
        required: false,
    },
});

export default linkSchema;