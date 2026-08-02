import mongoose from "mongoose";

const goodSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxLength: 155
    },
    //@deprecated
    quantity: {
        type: String,
        default: "",
        maxLength: 155
    },
    quantityNumber: {
        type: Number,
        validate: {
            validator: function(value) {
                return value == null || this.unit != null;
            },
            message: "unit is required when a quantityNumber is defined"
        }  
    },
    unit: {
        type: String,
        maxLength: 50,
        validate: {
            validator: function(value) {
                return value == null || this.quantityNumber != null;
            },
            message: "quantityNumber is required when an unit is defined"
        }
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