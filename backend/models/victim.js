const mongoose = require("mongoose");

const victimSchema = new mongoose.Schema(
    {
        victimId: {
            type: String,
            required: true,
            unique: true
        },

        name: {
            type: String,
            required: true
        },

        age: {
            type: Number,
            required: false
        },

        location: {
            type: String,
            required: true
        },

        emergencyId: {
            type: String,
            required: false,
            default: null
        },

        condition: {
            type: String,
            enum: [
                "Injured",
                "Critical",
                "Safe",
                "Missing"
            ],
            default: "Injured"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Victim", victimSchema);