const express = require("express");
const History = require("../models/history");
const Stack = require("../dsa/Stack");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateToken);

// Return persisted actions newest-first, using the project's stack implementation.
router.get("/", async (req, res) => {
    try {
        const records = await History.find({ type: "Supply" }).sort({ timestamp: 1, createdAt: 1 }).limit(500);
        const stack = new Stack();
        records.forEach((record) => stack.push({
            id: String(record._id),
            _id: String(record._id),
            type: record.type || "Action",
            action: record.action,
            details: record.details || record.description || "",
            timestamp: record.timestamp || record.createdAt
        }));
        res.json({ history: stack.getAll() });
    } catch (error) {
        res.status(500).json({ message: "Unable to load history", error: error.message });
    }
});

// Kept for compatibility with existing Stack demonstrations; this records the action in MongoDB.
router.post("/add", async (req, res) => {
    try {
        const { action, details = "", type = "Action", timestamp } = req.body || {};
        if (!action || !String(action).trim()) return res.status(400).json({ message: "Action is required" });
        const entry = await History.create({
            type: String(type),
            action: String(action).trim(),
            details: String(details),
            timestamp: timestamp ? new Date(timestamp) : new Date(),
            performedBy: req.user?.username || req.user?.role || "Rescue Team"
        });
        res.status(201).json({
            message: "Action saved to history",
            latestAction: { id: String(entry._id), type: entry.type, action: entry.action, details: entry.details, timestamp: entry.timestamp }
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

router.delete("/supply-actions", async (req, res) => {
    try {
        const result = await History.deleteMany({ type: "Supply" });
        res.json({ message: "Supply action history cleared", deletedCount: result.deletedCount });
    } catch (error) {
        res.status(500).json({ message: error.message || "Unable to clear history" });
    }
});

// Undo only removes the newest logged action. It does not reverse the stock mutation.
router.post("/undo", async (req, res) => {
    try {
        const latest = await History.findOne({ type: "Supply" }).sort({ timestamp: -1, createdAt: -1 });
        if (!latest) return res.status(404).json({ message: "No actions in history" });
        await latest.deleteOne();
        res.json({ message: "Latest action removed from history", action: latest });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
