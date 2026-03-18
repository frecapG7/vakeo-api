

import mongoose from "mongoose";

const locationSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["Point"],
        default: "Point"
    },
    coordinates: {
        type: [Number], // longitude,latitude
        required: true,
        validate: {
            validator: function(v) {
                return v.length === 2
            },
            message: "Coordinates must contain 2 value, longitude and latitude"
        }
    },
    displayName: {
        type: String,
        required: true
    }
});

export default locationSchema;