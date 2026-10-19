
const express = require("express");
const Victim = require("../models/victim");
const {
    authenticateToken,
    requireRole
} = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

// List victims.
router.get("/", async (req, res) => {
    try {
        const victims = await Victim.find().sort({ createdAt: -1 });
        res.json(victims);
    } catch (error) {
        res.status(500).json({
            message: "Unable to load victims",
            error: error.message
        });
    }
});

// Add a victim.
router.post(
    "/add",
    requireRole("admin", "rescuer"),
    async (req, res) => {
        try {
            const {
                victimId,
                name,
                age,
                location,
                emergencyId,
                condition
            } = req.body;

            if (
                typeof victimId !== "string" ||
                !victimId.trim() ||
                typeof name !== "string" ||
                !name.trim() ||
                typeof location !== "string" ||
                !location.trim()
            ) {
                return res.status(400).json({
                    message: "Victim ID, name, and location are required"
                });
            }

            if (
                age !== undefined &&
                age !== null &&
                age !== "" &&
                (!Number.isInteger(Number(age)) ||
                    Number(age) < 0 ||
                    Number(age) > 120)
            ) {
                return res.status(400).json({
                    message: "Age must be a valid number between 0 and 120"
                });
            }

            const victim = await Victim.create({
                victimId: victimId.trim(),
                name: name.trim(),
                location: location.trim(),
                age: age === "" || age == null ? undefined : Number(age),
                emergencyId: emergencyId || null,
                condition: condition || "Injured"
            });

            res.status(201).json({
                message: "Victim saved successfully",
                victim
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({
                    message: "Victim ID already exists"
                });
            }

            res.status(400).json({
                message: "Unable to save victim",
                error: error.message
            });
        }
    }
);

// Delete a victim.
router.delete(
    "/:victimId",
    requireRole("admin", "rescuer"),
    async (req, res) => {
        try {
            const victim = await Victim.findOneAndDelete({
                victimId: req.params.victimId
            });

            if (!victim) {
                return res.status(404).json({
                    message: "Victim not found"
                });
            }

            res.json({
                message: "Victim deleted successfully",
                victim
            });
        } catch (error) {
            res.status(500).json({
                message: "Unable to delete victim",
                error: error.message
            });
        }
    }
);

module.exports = router;
