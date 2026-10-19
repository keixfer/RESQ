const mongoose = require("mongoose");

const sosSchema = new mongoose.Schema(
    {
        sosId: {
            type: String,
            required: true,
            unique: true
        },

        latitude: {
            type: Number,
            required: true
        },

        longitude: {
            type: Number,
            required: true
        },

        location: {
            type: String,
            default: "Location coordinates available"
        },

        cause: {
            type: String,
            required: true
        },

        people: {
            type: Number,
            required: true,
            min: 1
        },

        priority: {
            type: Number,
            default: 100
        },

        status: {
            type: String,
            default: "Active"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("SOS", sosSchema);