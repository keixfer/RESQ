const mongoose = require("mongoose");

const historySchema = new mongoose.Schema({
    type: { type: String, default: "Emergency" },
    action: { type: String, required: true, trim: true },
    details: { type: String, default: "" },
    timestamp: { type: Date, default: Date.now },
    emergencyId: { type: String, default: "" },
    performedBy: { type: String, default: "System" },
    location: { type: String, default: "" },
    description: { type: String, default: "" },
    status: { type: String, enum: ["Ongoing", "Resolved", "Escalated", "Dispatched", "Available"], default: "Ongoing" }
}, { timestamps: true });

historySchema.index({ timestamp: -1 });

module.exports = mongoose.model("History", historySchema);
