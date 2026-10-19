
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../logmodel/user");
const { authenticateToken, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                message: "Username and password are required"
            });
        }

        const user = await User.findOne({
            username: username.trim().toLowerCase()
        });

        if (!user || !user.active) {
            return res.status(401).json({
                message: "Invalid credentials or inactive account"
            });
        }

        const validPassword = await bcrypt.compare(
            password,
            user.password
        );

        if (!validPassword) {
            return res.status(401).json({
                message: "Invalid credentials"
            });
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({
                message: "Authentication configuration error"
            });
        }

        const token = jwt.sign(
            {
                id: user._id.toString(),
                username: user.username,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: "8h" }
        );

        res.json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({
            message: "Login failed"
        });
    }
});

router.get("/me", authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("username role active");

        if (!user || !user.active) {
            return res.status(401).json({
                message: "Account not found or inactive"
            });
        }

        res.json({
            id: user._id,
            username: user.username,
            role: user.role
        });
    } catch (error) {
        res.status(500).json({
            message: "Unable to verify account"
        });
    }
});

router.post(
    "/users",
    authenticateToken,
    requireRole("admin"),
    async (req, res) => {
        try {
            const { username, password, role } = req.body;

            if (
                typeof username !== "string" ||
                !/^[a-zA-Z0-9_.-]{3,30}$/.test(username) ||
                typeof password !== "string" ||
                password.length < 12 ||
                password.length > 128 ||
                !["admin", "rescuer"].includes(role)
            ) {
                return res.status(400).json({
                    message: "Use a valid username, a password of 12–128 characters, and role admin or rescuer"
                });
            }

            const existingUser = await User.findOne({
                username: username.toLowerCase()
            });

            if (existingUser) {
                return res.status(409).json({
                    message: "Username already exists"
                });
            }

            const hashedPassword = await bcrypt.hash(password, 12);

            const newUser = await User.create({
                username: username.toLowerCase(),
                password: hashedPassword,
                role
            });

            res.status(201).json({
                message: "Account created successfully",
                user: {
                    id: newUser._id,
                    username: newUser.username,
                    role: newUser.role
                }
            });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(409).json({
                    message: "Username already exists"
                });
            }

            res.status(500).json({
                message: "Unable to create account"
            });
        }
    }
);

module.exports = router;
