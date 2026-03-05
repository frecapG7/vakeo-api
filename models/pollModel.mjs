import mongoose from "mongoose";
import { isValidUrl } from "../utils/validator.mjs";

const optionSchema = new mongoose.Schema({
    selectedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "TripUser"
    }]
}, {
    toJSON: {virtuals: true}
});


const pollSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true
    },
    trip: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Trip",
        required: true,
        index: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "TripUser",
        required: true
    },
    isSingleAnswer: {
        type: Boolean,
        default: false
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    isClosed: {
        type: Boolean,
        default: false
    },
    hasSelected: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "TripUser"
    }],
    options: [optionSchema]
},
    {
        discriminatorKey: "type",
        timestamps: true,
        toJSON: { virtuals: true }
    }
);

// Virtual pour le calcul du pourcentage
optionSchema.virtual('percent').get(function() {
    const selectedCount = this.selectedBy?.length || 0;
    const totalSelected = this.parent().hasSelected?.length || 1; // Évite la division par zéro
    const percent =  (selectedCount / totalSelected) * 100;
    return Number(percent).toFixed(2);
});

pollSchema.pre("save", async function () {
    const allSelectedUsers = this.options.flatMap(
        option => option.selectedBy.toString()
    );
    this.hasSelected = [...new Set(allSelectedUsers)];
});


export const Poll = mongoose.model("Poll", pollSchema);

export const DatesPoll = Poll.discriminator("DatesPoll", new mongoose.Schema({
    options: {
        type: [
            {
                startDate: {
                    type: Date,
                    required: true,
                },
                endDate: {
                    type: Date,
                    required: true,
                },
                selectedBy: [{
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "TripUser"
                }]
            }
        ]
    }
}));

export const HousingPoll = Poll.discriminator("HousingPoll", new mongoose.Schema({
    options: {
        type: [
            {
                title: {
                    type: String,
                    required: true
                },
                url: {
                    type: String,
                    required: true,
                    validate: {
                        validator: function (v) {
                            return isValidUrl(v);
                        },
                        message: props => `${props.value} is not a valid url`
                    }
                },
                image: {
                    type: String,
                    required: false
                },
                icon: {
                    type: String,
                    required: false,
                },
                selectedBy: [{
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "TripUser"
                }]
            }
        ]
    }
}));



export const OtherPoll = Poll.discriminator("OtherPoll", new mongoose.Schema({
    options: {
        type: [
            {
                value: {
                    type: String,
                    required: true
                },
                selectedBy: [{
                    type: mongoose.Schema.Types.ObjectId
                }]
            }
        ]
    }
}))



