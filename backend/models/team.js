
const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema(
    {
        teamId: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        members: {
            type: Number,
            required: true,
            min: 1
        },
        location: {
            type: String,
            default: "Unknown"
        },
        status: {
            type: String,
            enum: ["Available", "Dispatched", "Unavailable"],
            default: "Available"
        },
        targetEmergencyId: {
            type: String,
            required: true
        },
        dispatchedAt: {
            type: Date,
            default: null
        }
    },
    { timestamps: true }
);

teamSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model("Team", teamSchema);
