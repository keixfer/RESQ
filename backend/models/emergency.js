const mongoose = require("mongoose");

const emergencySchema = new mongoose.Schema(
    {
        emergencyId: {
            type: String,
            required: true,
            unique: true
        },

        location: {
            type: String,
            required: true
        },

        peopleTrapped: {
            type: Number,
            required: true
        },

        injured: {
            type: Number,
            required: true
        },

        severity: {
            type: Number,
            required: true,
            min: 1,
            max: 10
        },

        disasterType: {
            type: String,
            required: true
        },

        priority: {
            type: Number,
            default: 0
        },

        status: {
            type: String,
            default: "Pending"
        },

        assignedTeam: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Emergency", emergencySchema);