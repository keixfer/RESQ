
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./logroutes/authRoutes");
const emergencyRoutes = require("./routes/emergencyRoutes");
const routeRoutes = require("./routes/routeRoutes");
const traversalRoutes = require("./routes/traversalRoutes");
const teamRoutes = require("./routes/teamRoutes");
const victimRoutes = require("./routes/victimRoutes");
const supplyRoutes = require("./routes/supplyRoutes");
const historyRoutes = require("./routes/historyRoutes");
const sosRoutes = require("./routes/sosRoutes");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

const allowedOrigins = (process.env.FRONTEND_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(
    cors({
        origin(origin, callback) {
            // Allow same-origin and non-browser requests without an Origin.
            if (!origin) return callback(null, true);

            if (
                process.env.NODE_ENV !== "production" &&
                allowedOrigins.length === 0
            ) {
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("Origin not allowed by CORS"));
        },
        methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);

app.get("/", (req, res) => {
    res.json({
        message: "RESQ Backend is running",
        database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
    });
});

app.get("/api/health", (req, res) => {
    res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
        status: mongoose.connection.readyState === 1 ? "ok" : "database_unavailable"
    });
});

app.use("/api/auth", authRoutes);
app.use("/api/emergencies", emergencyRoutes);
app.use("/api/routes", routeRoutes);
app.use("/api/traversal", traversalRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/victims", victimRoutes);
app.use("/api/supplies", supplyRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/sos", sosRoutes);

app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err.message === "Origin not allowed by CORS") {
        return res.status(403).json({ message: err.message });
    }

    console.error("Unhandled request error:", err.message);

    res.status(500).json({
        message: "Internal server error"
    });
});

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is missing from backend/.env");
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        throw new Error("JWT_SECRET must be configured with at least 32 characters");
    }

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`RESQ backend listening on port ${PORT}`);
    });
}

startServer().catch((error) => {
    console.error("RESQ startup failed:", error.message);
    process.exit(1);
});
