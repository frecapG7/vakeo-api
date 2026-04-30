import mongoose from "mongoose";
import locationSchema from "./locationModel.mjs";

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
    // Future fields (e.g., duration, order, notes)
});

export default tripStopSchema;