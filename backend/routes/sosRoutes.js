const express = require("express");
const SOS = require("../models/sos");
const Emergency = require("../models/emergency");

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const {
            latitude,
            longitude,
            location,
            cause,
            people
        } = req.body;

        const sosId = `SOS-${Date.now()}`;

        const sos = new SOS({
            sosId,
            latitude,
            longitude,
            location,
            cause,
            people,
            priority: 100,
            status: "Active"
        });

        const savedSOS = await sos.save();

        const emergency = new Emergency({
            emergencyId: sosId,
            location: location || "SOS Location",
            peopleTrapped: Number(people),
            injured: 0,
            severity: 10,
            disasterType: cause,
            priority: 100,
            status: "Pending",
            assignedTeam: null
        });

        const savedEmergency = await emergency.save();

        res.status(201).json({
            message: "SOS signal received and added to emergencies",
            sos: savedSOS,
            emergency: savedEmergency
        });

    } catch (error) {
        res.status(400).json({
            message: error.message
        });
    }
});

router.get("/", async (req, res) => {
    try {
        const signals = await SOS.find()
            .sort({ createdAt: -1 });

        res.json(signals);

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

router.patch("/:sosId/resolve", async (req, res) => {
    try {
        const sos = await SOS.findOneAndUpdate(
            { sosId: req.params.sosId },
            { status: "Resolved" },
            { new: true }
        );

        if (!sos) {
            return res.status(404).json({
                message: "SOS signal not found"
            });
        }

        await Emergency.findOneAndUpdate(
            { emergencyId: req.params.sosId },
            { status: "Resolved" }
        );

        res.json({
            message: "SOS resolved",
            sos
        });

    } catch (error) {
        res.status(500).json({
            message: error.message
        });
    }
});

module.exports = router;