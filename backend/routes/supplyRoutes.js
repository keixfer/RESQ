const express = require("express");
const mongoose = require("mongoose");
const Supply = require("../models/supply");
const History = require("../models/history");
const HashTable = require("../dsa/HashTable");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken);

const defaultSupplies = [
    { name: "Drinking Water", category: "Water", quantity: 120, unit: "bottles", lowStockAt: 25 },
    { name: "Food Packs", category: "Food", quantity: 80, unit: "packs", lowStockAt: 20 },
    { name: "First-Aid Kits", category: "Medical", quantity: 35, unit: "kits", lowStockAt: 10 },
    { name: "Blankets", category: "Shelter", quantity: 45, unit: "pieces", lowStockAt: 10 }
];

const normalizeSupply = (doc) => ({
    id: String(doc._id),
    _id: String(doc._id),
    name: doc.name,
    category: doc.category || "Other",
    quantity: doc.quantity,
    unit: doc.unit || "units",
    lowStockAt: doc.lowStockAt ?? 5,
    status: doc.status || "Available",
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
});

async function logAction(action, details, performedBy = "Rescue Team") {
    return History.create({ type: "Supply", action, details, performedBy, timestamp: new Date() });
}

function validWholeNumber(value, allowZero = false) {
    const n = Number(value);
    return Number.isInteger(n) && (allowZero ? n >= 0 : n > 0);
}

router.get("/", async (req, res) => {
    try {
        let docs = await Supply.find().sort({ name: 1 });
        if (docs.length === 0) {
            await Supply.insertMany(defaultSupplies, { ordered: false }).catch(() => {});
            docs = await Supply.find().sort({ name: 1 });
        }

        // Build the DSA hash table from persisted records for fast name-based lookup.
        const index = new HashTable(Math.max(10, docs.length * 2));
        docs.forEach((doc) => index.set(doc.name.toLowerCase(), normalizeSupply(doc)));
        res.json({ supplies: index.getAll().map((entry) => entry.value) });
    } catch (error) {
        res.status(500).json({ message: "Unable to load supplies", error: error.message });
    }
});

router.post("/add", async (req, res) => {
    try {
        const name = String(req.body.name || "").trim();
        const category = String(req.body.category || "Other").trim();
        const unit = String(req.body.unit || "units").trim();
        const quantity = Number(req.body.quantity);
        const lowStockAt = Number(req.body.lowStockAt ?? 5);

        if (!name) return res.status(400).json({ message: "Supply name is required" });
        if (!validWholeNumber(quantity, true)) return res.status(400).json({ message: "Quantity must be a non-negative whole number" });
        if (!validWholeNumber(lowStockAt, true)) return res.status(400).json({ message: "Low-stock threshold must be a non-negative whole number" });
        if (!unit) return res.status(400).json({ message: "Unit is required" });

        let supply = (await Supply.find()).find((item) => item.name.toLowerCase() === name.toLowerCase());
        const isRestock = Boolean(supply);
        if (supply) {
            supply.quantity += quantity;
            supply.category = category;
            supply.unit = unit;
            supply.lowStockAt = lowStockAt;
            await supply.save();
        } else {
            supply = await Supply.create({ name, category, quantity, unit, lowStockAt });
        }

        const action = isRestock ? "Stock restocked" : "Supply added";
        await logAction(action, `${supply.name}: +${quantity} ${supply.unit}`, req.user?.username || req.user?.role || "Rescue Team");
        res.status(isRestock ? 200 : 201).json({ message: "Supply saved successfully", supply: normalizeSupply(supply) });
    } catch (error) {
        if (error.code === 11000) return res.status(409).json({ message: "A supply with this name already exists. Refresh and try again." });
        res.status(400).json({ message: error.message || "Unable to save supply" });
    }
});

router.post("/:id/distribute", async (req, res) => {
    try {
        const amount = Number(req.body.quantity);
        if (!validWholeNumber(amount)) return res.status(400).json({ message: "Distribution quantity must be a whole number greater than zero" });
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid supply ID" });

        const supply = await Supply.findById(req.params.id);
        if (!supply) return res.status(404).json({ message: "Supply not found" });
        if (amount > supply.quantity) return res.status(400).json({ message: `Not enough stock. Available: ${supply.quantity} ${supply.unit}.` });

        supply.quantity -= amount;
        await supply.save();
        await logAction("Supplies distributed", `${supply.name}: −${amount} ${supply.unit}`, req.user?.username || req.user?.role || "Rescue Team");
        res.json({ message: "Supplies distributed successfully", supply: normalizeSupply(supply) });
    } catch (error) {
        res.status(500).json({ message: error.message || "Unable to distribute supplies" });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: "Invalid supply ID" });
        const supply = await Supply.findByIdAndDelete(req.params.id);
        if (!supply) return res.status(404).json({ message: "Supply not found" });
        await logAction("Supply item removed", supply.name, req.user?.username || req.user?.role || "Rescue Team");
        res.json({ message: "Supply removed", supply: normalizeSupply(supply) });
    } catch (error) {
        res.status(500).json({ message: error.message || "Unable to remove supply" });
    }
});

module.exports = router;
