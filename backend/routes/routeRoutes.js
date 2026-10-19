
const express = require("express");

const router = express.Router();

function haversineMeters(a, b) {
    const toRadians = (degrees) => (degrees * Math.PI) / 180;

    const lat1 = Number(a.lat);
    const lon1 = Number(a.lng ?? a.lon);
    const lat2 = Number(b.lat);
    const lon2 = Number(b.lng ?? b.lon);

    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
        throw new Error("Invalid coordinates");
    }

    const earthRadius = 6371000;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const value =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
            Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) ** 2;

    return 2 * earthRadius *
        Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

router.post("/distance", (req, res) => {
    try {
        const { start, end } = req.body;

        if (!start || !end) {
            return res.status(400).json({
                message: "Start and end coordinates are required"
            });
        }

        const distance = haversineMeters(start, end);

        res.json({
            distanceMeters: Math.round(distance),
            distanceKm: Number((distance / 1000).toFixed(2))
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;
