import { Fragment, useMemo, useState } from "react";
import {
    Circle,
    CircleMarker,
    MapContainer,
    Popup,
    TileLayer,
    WMSTileLayer,
    ZoomControl,
    Polyline,
    GeoJSON,
    useMapEvents
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./PublicRiskMap.css";
import { findSafestRoadRoute } from "./dijkstra";

const FALLBACK_CENTER = [26.9124, 75.7873];

function coordinatesOf(item) {
    const candidates = [
        [item?.latitude, item?.longitude],
        [item?.lat, item?.lng],
        [item?.lat, item?.lon],
        [item?.coordinates?.latitude, item?.coordinates?.longitude],
        [item?.coordinates?.lat, item?.coordinates?.lng],
        [item?.location?.latitude, item?.location?.longitude],
        [item?.location?.lat, item?.location?.lng],
        [item?.location?.coordinates?.[1], item?.location?.coordinates?.[0]]
    ];
    for (const [rawLat, rawLng] of candidates) {
        if (rawLat == null || rawLng == null) continue;
        const lat = Number(rawLat);
        const lng = Number(rawLng);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && (lat !== 0 || lng !== 0)) return [lat, lng];
    }
    const text = typeof item?.location === "string" ? item.location : typeof item?.address === "string" ? item.address : "";
    const match = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (match) {
        const lat = Number(match[1]), lng = Number(match[2]);
        if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lat, lng];
    }
    return null;
}

function activeIncident(item) {
    return !["resolved", "complete", "completed", "closed"].includes(String(item?.status || "").toLowerCase());
}

function labelOf(item, index) {
    return item?.title || item?.name || item?.cause || item?.emergencyType || item?.type || `Reported emergency ${index + 1}`;
}

function locationOf(item, coords) {
    if (typeof item?.address === "string" && item.address.trim()) return item.address;
    if (typeof item?.location === "string" && item.location.trim() && !/^-?\d/.test(item.location.trim())) return item.location;
    if (coords) return `${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`;
    return "Location not provided";
}

function MapClickPicker({ onPick, enabled }) {
    useMapEvents({
        click(event) {
            if (enabled) onPick([event.latlng.lat, event.latlng.lng]);
        }
    });
    return null;
}

function formatDistance(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
}

export default function PublicRiskMap({ emergencies = [] }) {
    const [routeMode, setRouteMode] = useState(false);
    const [routeStart, setRouteStart] = useState(null);
    const [routeEnd, setRouteEnd] = useState(null);
    const [routeResult, setRouteResult] = useState(null);
    const [routeLoading, setRouteLoading] = useState(false);
    const [routeMessage, setRouteMessage] = useState("");
    const [routeRequestId, setRouteRequestId] = useState(0);
    const [officialHazardData, setOfficialHazardData] = useState(null);
    const [hazardFileName, setHazardFileName] = useState("");
    const [hazardFileError, setHazardFileError] = useState("");
    const [showOfficialHazards, setShowOfficialHazards] = useState(true);
    const [showGlobalFloodHazard, setShowGlobalFloodHazard] = useState(false);

    const reports = useMemo(() => emergencies
        .filter(activeIncident)
        .map((item, index) => ({ item, index, coords: coordinatesOf(item) }))
        .filter((entry) => entry.coords), [emergencies]);

    const center = reports[0]?.coords || FALLBACK_CENTER;
    const noCoordinates = emergencies.filter(activeIncident).length - reports.length;
    const hazardCoordinates = reports.map((report) => report.coords);

    const handleHazardFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setHazardFileError("");
        try {
            const parsed = JSON.parse(await file.text());
            const validTypes = ["FeatureCollection", "Feature", "Polygon", "MultiPolygon", "GeometryCollection"];
            if (!parsed || !validTypes.includes(parsed.type)) {
                throw new Error("Choose a valid GeoJSON FeatureCollection, Feature, Polygon, or MultiPolygon file.");
            }
            if (parsed.type === "FeatureCollection" && !Array.isArray(parsed.features)) {
                throw new Error("This GeoJSON FeatureCollection has no features array.");
            }
            setOfficialHazardData(parsed);
            setHazardFileName(file.name);
        } catch (error) {
            setOfficialHazardData(null);
            setHazardFileName("");
            setHazardFileError(error.message || "Could not read this GeoJSON file.");
        } finally {
            event.target.value = "";
        }
    };

    const pickRoutePoint = (coords) => {
        if (!routeStart || (routeStart && routeEnd)) {
            setRouteStart(coords);
            setRouteEnd(null);
            setRouteResult(null);
            setRouteMessage("Start point selected. Click the map to choose a destination.");
        } else {
            setRouteEnd(coords);
            setRouteMessage("Destination selected. Calculate a route to avoid reported caution zones.");
        }
    };

    const calculateRoute = async () => {
        if (!routeStart || !routeEnd) {
            setRouteMessage("Choose a start point and destination by clicking two places on the map.");
            return;
        }

        setRouteLoading(true);
        setRouteResult(null);
        setRouteMessage("Loading OpenStreetMap roads and calculating a Dijkstra route…");
        const requestId = routeRequestId + 1;
        setRouteRequestId(requestId);

        try {
            const south = Math.min(routeStart[0], routeEnd[0]) - 0.035;
            const north = Math.max(routeStart[0], routeEnd[0]) + 0.035;
            const west = Math.min(routeStart[1], routeEnd[1]) - 0.035;
            const east = Math.max(routeStart[1], routeEnd[1]) + 0.035;
            const query = `[out:json][timeout:25];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|service|road)$"](${south},${west},${north},${east}););out body;>;out skel qt;`;
            const response = await fetch("https://overpass-api.de/api/interpreter", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
                body: `data=${encodeURIComponent(query)}`
            });
            if (!response.ok) throw new Error("The OpenStreetMap road service is busy. Please try again shortly.");
            const data = await response.json();

            const result = findSafestRoadRoute(
                data.elements || [],
                routeStart,
                routeEnd,
                hazardCoordinates,
                1200
            );

            if (!result.reachable || result.coordinates?.length < 2) {
                setRouteResult(null);
                setRouteMessage(result.reason || "No route found in the available road data. Try points closer together.");
            } else {
                setRouteResult(result);
                setRouteMessage(`Route found: ${formatDistance(result.distanceMeters)}. Reported caution circles were excluded from the road graph.`);
            }
        } catch (error) {
            setRouteMessage(error.message || "Could not calculate a route. Check your internet connection and retry.");
        } finally {
            setRouteLoading(false);
        }
    };

    const clearRoute = () => {
        setRouteStart(null);
        setRouteEnd(null);
        setRouteResult(null);
        setRouteMessage("");
        setRouteMode(false);
    };

    return (
        <section className="public-risk-panel" aria-label="Public emergency and hazard map">
            <div className="public-risk-header">
                <div>
                    <div className="public-risk-eyebrow"><span /> PUBLIC SAFETY ADVISORY</div>
                    <h3>Know where to avoid</h3>
                    <p>Active reported emergencies and nearby caution zones</p>
                </div>
                <div className="public-risk-header-actions">
                    <div className="public-risk-count">
                        <strong>{reports.length}</strong>
                        <span>mapped alerts</span>
                    </div>
                    <button
                        type="button"
                        className={`public-risk-route-toggle ${routeMode ? "is-on" : ""}`}
                        onClick={() => {
                            setRouteMode((value) => !value);
                            setRouteMessage("Click the map once for a start point, then again for your destination.");
                        }}
                    >
                        {routeMode ? "Picking route points…" : "Plan safer route"}
                    </button>
                </div>
            </div>

            <div className="public-risk-content">
                <div className="public-risk-map-wrap">
                    <MapContainer
                        center={center}
                        zoom={reports.length ? 12 : 11}
                        scrollWheelZoom
                        zoomControl={false}
                        className="public-risk-map"
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            maxZoom={19}
                        />
                        {showGlobalFloodHazard && (
                            <WMSTileLayer
                                key="global-flood-hazard-wms"
                                url="https://ows.globalfloods.eu/glofas-ows/ows.py"
                                params={{
                                    service: "WMS",
                                    version: "1.3.0",
                                    request: "GetMap",
                                    layers: "FloodHazard100y",
                                    styles: "",
                                    format: "image/png",
                                    transparent: true
                                }}
                                opacity={0.42}
                                attribution="Flood hazard layer: GloFAS / Copernicus Emergency Management Service"
                            />
                        )}
                        <ZoomControl position="bottomright" />
                        {showOfficialHazards && officialHazardData && (
                            <GeoJSON
                                key={hazardFileName}
                                data={officialHazardData}
                                style={() => ({
                                    color: "#b91c1c",
                                    weight: 2,
                                    opacity: 0.95,
                                    fillColor: "#ef4444",
                                    fillOpacity: 0.28
                                })}
                                onEachFeature={(feature, layer) => {
                                    const properties = feature?.properties || {};
                                    const title = properties.name || properties.NAME || properties.hazard || properties.type || "Imported hazard area";
                                    layer.bindPopup(`<strong>${String(title).replace(/[&<>"]/g, "")}</strong><br/>Imported hazard boundary. Check the source and date before relying on it.`);
                                }}
                            />
                        )}
                        <MapClickPicker onPick={pickRoutePoint} enabled={routeMode} />
                        {reports.map(({ item, index, coords }) => (
                            <Fragment key={`zone-${item._id || item.id || index}`}>
                                <Circle
                                    center={coords}
                                    radius={1200}
                                    pathOptions={{
                                        color: "#ff4657",
                                        weight: 2,
                                        opacity: 0.95,
                                        fillColor: "#f43f5e",
                                        fillOpacity: 0.22
                                    }}
                                />
                                <CircleMarker
                                    center={coords}
                                    radius={7}
                                    pathOptions={{ color: "#fff", weight: 2, fillColor: "#e11d48", fillOpacity: 1 }}
                                >
                                    <Popup>
                                        <strong>{labelOf(item, index)}</strong>
                                        <br />
                                        <b>CAUTION — Avoid this area if possible.</b>
                                        <br />
                                        {locationOf(item, coords)}
                                        <br />
                                        Status: {item.status || "Reported"}
                                    </Popup>
                                </CircleMarker>
                            </Fragment>
                        ))}
                        {routeStart && (
                            <CircleMarker center={routeStart} radius={8} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#16a34a", fillOpacity: 1 }}>
                                <Popup><strong>Route start</strong></Popup>
                            </CircleMarker>
                        )}
                        {routeEnd && (
                            <CircleMarker center={routeEnd} radius={8} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }}>
                                <Popup><strong>Route destination</strong></Popup>
                            </CircleMarker>
                        )}
                        {routeResult?.coordinates?.length > 1 && (
                            <Polyline
                                positions={routeResult.coordinates}
                                pathOptions={{ color: "#087f8c", weight: 6, opacity: 0.92, lineCap: "round", lineJoin: "round" }}
                            />
                        )}
                    </MapContainer>
                    <div className="public-risk-map-legend"><span /> Reported caution zone <i className="route-legend-line" /> Dijkstra route</div>
                    {reports.length === 0 && (
                        <div className="public-risk-map-empty">
                            <strong>No mapped active incidents</strong>
                            <span>When active emergency reports include coordinates, their locations will appear here.</span>
                        </div>
                    )}
                </div>

                <aside className="public-risk-list">
                    <div className="public-risk-list-title">
                        <span className="public-risk-alert-symbol">!</span>
                        <div><strong>Areas to avoid</strong><small>Based on active RESQ reports</small></div>
                    </div>
                    {reports.length === 0 ? (
                        <div className="public-risk-clear">
                            <span className="public-risk-clear-dot" />
                            <strong>No geolocated alerts right now</strong>
                            <p>This does not guarantee an area is safe. Follow local authorities and official alerts.</p>
                        </div>
                    ) : (
                        <div className="public-risk-items">
                            {reports.slice(0, 5).map(({ item, index, coords }) => (
                                <article className="public-risk-item" key={item._id || item.id || index}>
                                    <span className="public-risk-item-marker">!</span>
                                    <div>
                                        <strong>{labelOf(item, index)}</strong>
                                        <p>{locationOf(item, coords)}</p>
                                        <small>{String(item.status || "Reported")} · Avoid this area if possible</small>
                                    </div>
                                </article>
                            ))}
                            {reports.length > 5 && <p className="public-risk-more">+ {reports.length - 5} more mapped alerts on the map</p>}
                        </div>
                    )}
                    {noCoordinates > 0 && (
                        <p className="public-risk-missing">{noCoordinates} active report{noCoordinates === 1 ? "" : "s"} missing coordinates, so they cannot be mapped yet.</p>
                    )}
                    <div className="public-risk-routing">
                        <strong>Safer route planner</strong>
                        <p>{routeMode ? "Click the map to set your start and destination." : "Choose two points on the map to calculate a road route around reported incident zones."}</p>
                        {routeStart && <small>Start: {routeStart[0].toFixed(4)}, {routeStart[1].toFixed(4)}</small>}
                        {routeEnd && <small>Destination: {routeEnd[0].toFixed(4)}, {routeEnd[1].toFixed(4)}</small>}
                        {routeResult && <div className="public-risk-route-distance">Estimated road distance: <b>{formatDistance(routeResult.distanceMeters)}</b></div>}
                        {routeMessage && <div className="public-risk-route-message" role="status">{routeMessage}</div>}
                        <div className="public-risk-route-buttons">
                            <button type="button" onClick={calculateRoute} disabled={routeLoading || !routeStart || !routeEnd}>
                                {routeLoading ? "Calculating…" : "Calculate Dijkstra route"}
                            </button>
                            <button type="button" className="public-risk-route-clear" onClick={clearRoute}>Clear</button>
                        </div>
                        <small className="public-risk-route-note">Experimental route: uses available OpenStreetMap roads and avoids 1.2 km circles around active mapped RESQ reports. It is not an official evacuation route.</small>
                    </div>
                    <div className="public-risk-data-panel">
                        <div className="public-risk-data-heading">
                            <div>
                                <strong>Official hazard layer</strong>
                                <p>Load a GeoJSON hazard boundary from a verified authority or dataset.</p>
                            </div>
                            <button
                                type="button"
                                className="public-risk-layer-toggle"
                                onClick={() => setShowOfficialHazards((value) => !value)}
                                disabled={!officialHazardData}
                            >
                                {showOfficialHazards ? "Hide layer" : "Show layer"}
                            </button>
                        </div>
                        <button
                            type="button"
                            className="public-risk-layer-toggle"
                            onClick={() => setShowGlobalFloodHazard((value) => !value)}
                        >
                            {showGlobalFloodHazard ? "Hide global flood layer" : "Show global flood layer"}
                        </button>
                        <label className="public-risk-file-label">
                            <span>{hazardFileName ? "Replace GeoJSON layer" : "Import GeoJSON (.geojson / .json)"}</span>
                            <input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={handleHazardFile} />
                        </label>
                        {hazardFileName && <div className="public-risk-file-success">Loaded: {hazardFileName}</div>}
                        {hazardFileError && <div className="public-risk-file-error" role="alert">{hazardFileError}</div>}
                        <small className="public-risk-data-note">No hazard dataset is bundled by default. Import verified flood, fire, landslide, or evacuation polygons. This layer is visual only for now; Dijkstra currently avoids active RESQ incident circles, not these imported polygons.</small>
                    </div>
                    <div className="public-risk-disclaimer">
                        <strong>Safety note</strong>
                        <p>These are reported incident areas, not an official all-hazards map. Check local authority instructions before travelling.</p>
                    </div>
                </aside>
            </div>
        </section>
    );
}
