
require("dotenv").config();

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../logmodel/user");
const readline = require("readline");

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function createAdmin() {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error("MONGO_URI is missing from .env");
        }

        const username = await new Promise(resolve => {
            rl.question("Admin username: ", resolve);
        });

        const password = await new Promise(resolve => {
            rl.question("Admin password (minimum 12 characters): ", resolve);
        });

        if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
            throw new Error("Username must be 3–30 valid characters");
        }

        if (password.length < 12 || password.length > 128) {
            throw new Error("Password must be 12–128 characters");
        }

        await mongoose.connect(process.env.MONGO_URI);

        const existing = await User.findOne({
            username: username.toLowerCase()
        });

        if (existing) {
            throw new Error("That username already exists");
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await User.create({
            username: username.toLowerCase(),
            password: hashedPassword,
            role: "admin",
            active: true
        });

        console.log("Admin account created successfully.");
    } catch (error) {
        console.error("Error:", error.message);
        process.exitCode = 1;
    } finally {
        rl.close();
        await mongoose.disconnect().catch(() => {});
    }
}

createAdmin();
