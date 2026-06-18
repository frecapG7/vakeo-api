import mongoose from "mongoose";
import { isValidUrl } from "../utils/validator.mjs";

// Base option fields shared across all poll types
const baseOptionFields = {
    selectedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "TripUser"
    }]
};

// Reusable option schema with virtuals
function createOptionSchema(extraFields = {}) {
    const schema = new mongoose.Schema({
        ...baseOptionFields,
        ...extraFields
    }, {
        toJSON: { virtuals: true }
    });
    
    // Virtual for percentage calculation
    schema.virtual('percent').get(function() {
        const selectedCount = this.selectedBy?.length || 0;
        const totalSelected = this.parent().hasSelected?.length || 1; // Avoid division by zero
        const percent = (selectedCount / totalSelected) * 100;
        return Number(percent).toFixed(2);
    });
    
    return schema;
}

const optionSchema = createOptionSchema();

const pollSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        maxlength: [500, "Question cannot exceed 500 characters"]
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
    options: {
        type: [optionSchema],
        validate: {
            validator: function (arr) { return arr.length <= 20; },
            message: "A poll cannot have more than 20 options"
        }
    }
}, {
    discriminatorKey: "type",
    timestamps: true,
    toJSON: { virtuals: true }
});

pollSchema.pre("save", async function () {
    const allSelectedUsers = this.options.flatMap(
        option => option.selectedBy.toString()
    );
    this.hasSelected = [...new Set(allSelectedUsers)];
});

export const Poll = mongoose.model("Poll", pollSchema);

export const DatesPoll = Poll.discriminator(
    "DatesPoll",
    new mongoose.Schema({
        options: [
            createOptionSchema({
                startDate: { type: Date, required: true },
                endDate: { type: Date, required: true }
            })
        ]
    })
);

export const HousingPoll = Poll.discriminator(
    "HousingPoll",
    new mongoose.Schema({
        options: [
            createOptionSchema({
                title: { type: String, required: true },
                url: {
                    type: String,
                    required: true,
                    validate: {
                        validator: function (v) { return isValidUrl(v); },
                        message: props => `${props.value} is not a valid url`
                    }
                },
                image: { type: String },
                icon: { type: String }
            })
        ]
    })
);

export const OtherPoll = Poll.discriminator(
    "OtherPoll",
    new mongoose.Schema({
        options: [
            createOptionSchema({
                value: { type: String, required: true }
            })
        ]
    })
);
