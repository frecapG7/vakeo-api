import mongoose from "mongoose";


const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxLength: 50
    },
    uuid: {
        type: String,
        required: true

    }
});



const tripSchema = new mongoose.Schema({
    name: {
     type: String,
     required: true,
     maxLength: 50,
    },
}, {timestamps: true});


export default mongoose.model("Trip", tripSchema);