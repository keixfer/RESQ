
const express = require("express");
const mongoose = require("mongoose");
const Team = require("../models/team");
const Emergency = require("../models/emergency");
const {
    authenticateToken,
    requireRole
} = require("../middleware/auth");

const router = express.Router();

router.use(authenticateToken);

// Get saved rescue teams.
router.get("/", async (req, res) => {
    try {
        const teams = await Team.find().sort({ createdAt: 1 });
        res.json(teams);
    } catch (error) {
        res.status(500).json({
            message: "Unable to load teams",
            error: error.message
        });
    }
});

// Add a team to the dispatch queue.
router.post(
    "/add",
    requireRole("admin", "rescuer"),
    async (req, res) => {
        try {
            const {
                teamId,
                name,
                members,
                location,
                targetEmergencyId
            } = req.body;

            if (
                typeof teamId !== "string" ||
                !teamId.trim() ||
                typeof name !== "string" ||
                !name.trim() ||
                !Number.isInteger(Number(members)) ||
                Number(members) < 1 ||
                typeof targetEmergencyId !== "string" ||
                !targetEmergencyId.trim()
            ) {
                return res.status(400).json({
                    message: "Provide a team ID, name, valid member count, and target emergency"
                });
            }

            const emergency = await Emergency.findOne({
                emergencyId: targetEmergencyId.trim()
            });

            if (!emergency) {
                return res.status(404).json({
                    message: "Target emergency not found"
                });
            }

            if (["Dispatched", "Resolved"].includes(emergency.status)) {
                return res.status(409).json({
                    message: "This emergency is already dispatched or resolved"
                });
            }

            const team = await Team.create({
                teamId: teamId.trim(),
                name: name.trim(),
                members: Number(members),
                location: location || "Unknown",
                status: "Available",
                targetEmergencyId: targetEmergencyId.trim()
            });

            res.status(201).json({
                message: "Rescue team saved successfully",
                team
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({
                    message: "Team ID already exists"
                });
            }

            res.status(500).json({
                message: "Unable to add rescue team",
                error: error.message
            });
        }
    }
);

// Dispatch the oldest available team.
router.post(
    "/dispatch",
    requireRole("admin", "rescuer"),
    async (req, res) => {
        const session = await mongoose.startSession();

        try {
            let result;

            await session.withTransaction(async () => {
                const team = await Team.findOneAndUpdate(
                    { status: "Available" },
                    { $set: { status: "Dispatched", dispatchedAt: new Date() } },
                    {
                        sort: { createdAt: 1 },
                        new: false,
                        session
                    }
                );

                if (!team) {
                    const error = new Error("No available rescue teams");
                    error.statusCode = 404;
                    throw error;
                }

                const emergency = await Emergency.findOne({
                    emergencyId: team.targetEmergencyId,
                    status: { $nin: ["Dispatched", "Resolved"] }
                }).session(session);

                if (!emergency) {
                    const error = new Error(
                        `Target emergency ${team.targetEmergencyId} is missing or already assigned`
                    );
                    error.statusCode = 409;
                    throw error;
                }

                emergency.status = "Dispatched";
                emergency.assignedTeam = team.teamId;
                await emergency.save({ session });

                result = {
                    message: "Rescue team dispatched successfully",
                    team: {
                        teamId: team.teamId,
                        name: team.name,
                        members: team.members,
                        status: "Dispatched"
                    },
                    emergency: {
                        emergencyId: emergency.emergencyId,
                        location: emergency.location,
                        status: emergency.status,
                        assignedTeam: emergency.assignedTeam
                    }
                };
            });

            res.json(result);
        } catch (error) {
            res.status(error.statusCode || 500).json({
                message: error.message || "Dispatch failed"
            });
        } finally {
            await session.endSession();
        }
    }
);

module.exports = router;
