import { useEffect, useMemo, useState } from "react";
import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    ZoomControl,
    useMap
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./RescueMap.css";

const DEFAULT_CENTER = [26.9124, 75.7873]; // Jaipur fallback; Locate Me uses the browser's actual location.

const pinIcon = (color, label) =>
    L.divIcon({
        className: "resq-map-marker-wrap",
        html: `<div class="resq-map-pin resq-map-pin-${color}"><span>${label}</span></div>`,
        iconSize: [34, 42],
        iconAnchor: [17, 37],
        popupAnchor: [0, -34]
    });

const currentLocationIcon = L.divIcon({
    className: "resq-map-current-wrap",
    html: '<div class="resq-map-current"><span></span></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14]
});

function FlyToLocation({ target, zoom = 14 }) {
    const map = useMap();

    useEffect(() => {
        if (target && Number.isFinite(target[0]) && Number.isFinite(target[1])) {
            map.flyTo(target, zoom, { duration: 0.8 });
        }
    }, [map, target, zoom]);

    return null;
}

function readCoordinates(item) {
    if (!item || typeof item !== "object") return null;

    const candidates = [
        [item.latitude, item.longitude],
        [item.lat, item.lng],
        [item.lat, item.lon],
        [item.coordinates?.latitude, item.coordinates?.longitude],
        [item.coordinates?.lat, item.coordinates?.lng],
        [item.location?.latitude, item.location?.longitude],
        [item.location?.lat, item.location?.lng],
        [item.location?.coordinates?.[1], item.location?.coordinates?.[0]]
    ];

    for (const pair of candidates) {
        const lat = Number(pair[0]);
        const lng = Number(pair[1]);
        if (
            pair[0] !== undefined &&
            pair[1] !== undefined &&
            Number.isFinite(lat) &&
            Number.isFinite(lng) &&
            Math.abs(lat) <= 90 &&
            Math.abs(lng) <= 180 &&
            (lat !== 0 || lng !== 0)
        ) {
            return [lat, lng];
        }
    }

    const locationText = typeof item.location === "string"
        ? item.location
        : typeof item.address === "string"
            ? item.address
            : "";

    // Accept stored coordinates in "lat, lng" form. Do not invent pins for plain addresses.
    const match = locationText.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (match) {
        const lat = Number(match[1]);
        const lng = Number(match[2]);
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lat, lng];
    }

    return null;
}

function getTitle(item, fallback) {
    return item.title || item.name || item.emergencyType || item.cause || item.type || fallback;
}

function getSeverity(item) {
    const value = String(item.priority || item.severity || item.status || "").toLowerCase();
    if (value.includes("critical") || value.includes("high") || value.includes("urgent")) return "red";
    if (value.includes("resolved") || value.includes("complete")) return "green";
    return "orange";
}

export default function RescueMap({ emergencies = [], teams = [], className = "" }) {
    const [userLocation, setUserLocation] = useState(null);
    const [locating, setLocating] = useState(false);
    const [locationMessage, setLocationMessage] = useState("");
    const [showEmergencies, setShowEmergencies] = useState(true);
    const [showTeams, setShowTeams] = useState(true);

    const emergencyPins = useMemo(
        () => emergencies
            .map((item, index) => ({ item, index, position: readCoordinates(item) }))
            .filter((entry) => entry.position),
        [emergencies]
    );

    const teamPins = useMemo(
        () => teams
            .map((item, index) => ({ item, index, position: readCoordinates(item) }))
            .filter((entry) => entry.position),
        [teams]
    );

    const requestLocation = () => {
        if (!navigator.geolocation) {
            setLocationMessage("This browser does not support location access.");
            return;
        }

        setLocating(true);
        setLocationMessage("Requesting your location…");

        navigator.geolocation.getCurrentPosition(
            ({ coords }) => {
                const next = [coords.latitude, coords.longitude];
                setUserLocation(next);
                setLocating(false);
                setLocationMessage("Your location is shown on the map.");
            },
            (error) => {
                setLocating(false);
                setLocationMessage(
                    error.code === 1
                        ? "Location permission was denied. Enable it in your browser to show your position."
                        : "Could not get your location. Check your device location settings and try again."
                );
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
        );
    };

    const mapCenter = userLocation || emergencyPins[0]?.position || teamPins[0]?.position || DEFAULT_CENTER;
    const visiblePinCount = (showEmergencies ? emergencyPins.length : 0) + (showTeams ? teamPins.length : 0);

    return (
        <section className={`resq-map-shell ${className}`}>
            <div className="resq-map-toolbar">
                <div className="resq-map-map-title">
                    <span className="resq-map-live-dot" />
                    <div>
                        <strong>RESQ Live Map</strong>
                        <small>OpenStreetMap · Live operational view</small>
                    </div>
                </div>

                <div className="resq-map-actions">
                    <button
                        type="button"
                        className={`resq-map-filter ${showEmergencies ? "is-active" : ""}`}
                        onClick={() => setShowEmergencies((value) => !value)}
                        aria-pressed={showEmergencies}
                    >
                        <span className="resq-map-legend-dot emergency-dot" />
                        Emergencies <b>{emergencyPins.length}</b>
                    </button>
                    <button
                        type="button"
                        className={`resq-map-filter ${showTeams ? "is-active" : ""}`}
                        onClick={() => setShowTeams((value) => !value)}
                        aria-pressed={showTeams}
                    >
                        <span className="resq-map-legend-dot team-dot" />
                        Teams <b>{teamPins.length}</b>
                    </button>
                    <button
                        type="button"
                        className="resq-map-locate"
                        onClick={requestLocation}
                        disabled={locating}
                    >
                        <span className="resq-map-target">◎</span>
                        {locating ? "Locating…" : "Locate me"}
                    </button>
                </div>
            </div>

            <div className="resq-map-canvas">
                <MapContainer
                    center={mapCenter}
                    zoom={userLocation || emergencyPins.length || teamPins.length ? 13 : 11}
                    scrollWheelZoom
                    zoomControl={false}
                    preferCanvas
                    className="resq-leaflet-map"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        maxZoom={19}
                    />
                    <ZoomControl position="bottomright" />
                    <FlyToLocation target={userLocation} />

                    {userLocation && (
                        <Marker position={userLocation} icon={currentLocationIcon}>
                            <Popup>
                                <strong>Your current location</strong>
                                <br />
                                {userLocation[0].toFixed(5)}, {userLocation[1].toFixed(5)}
                            </Popup>
                        </Marker>
                    )}

                    {showEmergencies && emergencyPins.map(({ item, index, position }) => (
                        <Marker
                            key={item._id || item.id || `emergency-${index}`}
                            position={position}
                            icon={pinIcon(getSeverity(item), "!")}
                        >
                            <Popup>
                                <div className="resq-map-popup">
                                    <strong>{getTitle(item, `Emergency ${index + 1}`)}</strong>
                                    <span>Status: {item.status || "Reported"}</span>
                                    <span>People affected: {item.peopleAffected ?? item.people ?? "Not specified"}</span>
                                    <span>Location: {position[0].toFixed(5)}, {position[1].toFixed(5)}</span>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {showTeams && teamPins.map(({ item, index, position }) => (
                        <Marker
                            key={item._id || item.id || `team-${index}`}
                            position={position}
                            icon={pinIcon("blue", "R")}
                        >
                            <Popup>
                                <div className="resq-map-popup">
                                    <strong>{getTitle(item, `Rescue Team ${index + 1}`)}</strong>
                                    <span>Status: {item.status || "Available"}</span>
                                    <span>Members: {item.members ?? "Not specified"}</span>
                                    <span>Location: {position[0].toFixed(5)}, {position[1].toFixed(5)}</span>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>

                <div className="resq-map-scale-note">
                    <span className="resq-map-legend-dot emergency-dot" /> Emergency
                    <span className="resq-map-legend-dot team-dot" /> Rescue team
                    <span className="resq-map-legend-dot current-dot" /> Your location
                </div>

                {visiblePinCount === 0 && !userLocation && (
                    <div className="resq-map-empty">
                        <div className="resq-map-empty-icon">⌖</div>
                        <strong>Map ready for live operations</strong>
                        <span>Allow location access or add coordinates to emergency/team records to display markers.</span>
                    </div>
                )}
            </div>

            <div className="resq-map-footer">
                <span>{visiblePinCount} mapped record{visiblePinCount === 1 ? "" : "s"}</span>
                <span className="resq-map-location-message" role="status">{locationMessage}</span>
                <a href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer">Open full map ↗</a>
            </div>
        </section>
    );
}