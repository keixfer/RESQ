const express = require("express");
const Emergency = require("../models/emergency");
const PriorityQueue = require("../dsa/PriorityQueue");
const router = express.Router();

// Add a new emergency
router.post("/", async (req, res) => {
    try {
        const emergency = new Emergency(req.body);
        const savedEmergency = await emergency.save();

        res.status(201).json(savedEmergency);
    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
});

// Get all emergencies
router.get("/", async (req, res) => {
    try {
        const emergencies = await Emergency.find();
        res.json(emergencies);
    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});
router.get("/priority", async (req, res) => {
    try {
        const emergencies = await Emergency.find();

        const queue = new PriorityQueue();

        emergencies.forEach((emergency) => {
            queue.insert(emergency);
        });

        const sortedEmergencies = [];

        while (queue.getAll().length > 0) {
            sortedEmergencies.push(queue.extractMax());
        }

        res.json(sortedEmergencies);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

module.exports = router;