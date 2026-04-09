import mongoose from "mongoose";
import locationSchema from "./locationModel.mjs";

const tripSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxLength: 50,
    },
    description : {
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
    location: {
        type: locationSchema,
        required: false
    },
    isPrivate : {
        type: Boolean,
        default: false,
    },
    splittingLink: {
        type : {
            url: {
                type: String, 
                required : false
            },
            icon: {
                type: String,
                required: false
            },
            title : {
                type: String,
                required: false
            }
        },
        required: false,
    }

}, { timestamps: true });


export default mongoose.model("Trip", tripSchema);