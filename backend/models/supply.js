const mongoose = require("mongoose");

const supplySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "Other", trim: true },
    quantity: { type: Number, required: true, min: 0, validate: Number.isInteger },
    unit: { type: String, default: "units", trim: true },
    lowStockAt: { type: Number, default: 5, min: 0, validate: Number.isInteger },
    status: { type: String, default: "Available" }
}, { timestamps: true });

supplySchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

module.exports = mongoose.model("Supply", supplySchema);
