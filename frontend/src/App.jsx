import "./rescuer_ui_upgrade.css";
import { useCallback, useEffect, useState } from "react";

import RescueMap from "./components/RescueMap";
import PublicRiskMap from "./components/PublicRiskMap";
import "./role.css";
import "./login.css";

// Set this to the HTTPS ngrok URL for your BACKEND (port 5000).
// Example: https://your-backend-name.ngrok-free.dev
const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
import {
    AlertTriangle,
    Ambulance,
    Users,
    Package,
    Map,
    Clock,
    Activity,
    Menu,
    Plus,
    Send,
    X,
    Trash2,
    Siren,
    MapPin,
    CheckCircle
} from "lucide-react";

function App() {
    const [role, setRole] = useState(null);
    const [page, setPage] = useState("Dashboard");
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navigateToPage = (nextPage) => {
        setPage(nextPage);
        setMobileMenuOpen(false);
    };
    const [authToken, setAuthToken] = useState("");
    const [loginForm, setLoginForm] = useState({ username: "", password: "" });
    const [loginError, setLoginError] = useState("");
    const [loggingIn, setLoggingIn] = useState(false);

    const [emergencies, setEmergencies] = useState([]);
    const [teams, setTeams] = useState([]);
    const [victims, setVictims] = useState([]);

    // Inventory and action history are loaded from the MongoDB-backed API.
    const [supplyHash, setSupplyHash] = useState({});
    const [supplyForm, setSupplyForm] = useState({
        name: "", category: "Food", quantity: "", unit: "units", lowStockAt: "5"
    });
    const [showSupplyForm, setShowSupplyForm] = useState(false);
    const [supplySearch, setSupplySearch] = useState("");
    const [supplyNotice, setSupplyNotice] = useState("");
    const [historyStack, setHistoryStack] = useState([]);

    const [showTeamForm, setShowTeamForm] = useState(false);
    const [showVictimForm, setShowVictimForm] = useState(false);
    const [, setDispatching] = useState(false);

    const [showSOS, setShowSOS] = useState(false);
    const [sosSent, setSosSent] = useState(false);
    const [sendingSOS, setSendingSOS] = useState(false);
    const [locationStatus, setLocationStatus] = useState("");

    const [sosForm, setSosForm] = useState({
        cause: "Flood",
        people: 1
    });

    const [teamForm, setTeamForm] = useState({
        teamId: "",
        name: "",
        members: "",
        emergencyId: "",
        status: "Available"
    });

    const [victimForm, setVictimForm] = useState({
        victimId: "",
        name: "",
        age: "",
        location: "",
        condition: "Injured"
    });

    const handleLogin = async (event) => {
        event.preventDefault();
        setLoginError("");
        setLoggingIn(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(loginForm)
            });
            const data = await response.json();

            if (!response.ok || !data.token) {
                throw new Error(data.message || "Login failed. Check your credentials.");
            }

            setAuthToken(data.token);
            setLoginForm({ username: "", password: "" });
            setLoginError("");
        } catch (error) {
            setLoginError(error.message || "Unable to connect to the RESQ server.");
        } finally {
            setLoggingIn(false);
        }
    };

    const logoutRescuer = () => {
        setAuthToken("");
        setRole(null);
        setPage("Dashboard");
    };

    const normalizeList = useCallback((payload, fallbackKey) => {
        if (Array.isArray(payload)) return payload;

        if (payload && typeof payload === "object") {
            const list = payload[fallbackKey] ?? payload.data ?? payload.results;
            if (Array.isArray(list)) return list;
        }

        return [];
    }, []);

    const authorizedFetch = useCallback((url, options = {}) => {
        const headers = {
            ...(options.headers || {}),
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        };
        return fetch(url, { ...options, headers });
    }, [authToken]);

    const fetchEmergencies = useCallback(() => {
        authorizedFetch(`${API_BASE_URL}/api/emergencies`)
            .then((response) => response.json())
            .then((data) => setEmergencies(normalizeList(data, "emergencies")))
            .catch((error) =>
                console.log("Error fetching emergencies:", error)
            );
    }, [normalizeList, authorizedFetch]);

    const fetchTeams = useCallback(() => {
        authorizedFetch(`${API_BASE_URL}/api/teams`)
            .then((response) => response.json())
            .then((data) => setTeams(normalizeList(data, "queue")))
            .catch((error) =>
                console.log("Error fetching teams:", error)
            );
    }, [normalizeList, authorizedFetch]);

    const fetchVictims = useCallback(() => {
        authorizedFetch(`${API_BASE_URL}/api/victims`)
            .then((response) => response.json())
            .then((data) => setVictims(normalizeList(data, "victims")))
            .catch((error) =>
                console.log("Error fetching victims:", error)
            );
    }, [normalizeList, authorizedFetch]);

    const fetchSupplies = useCallback(async () => {
        try {
            const response = await authorizedFetch(`${API_BASE_URL}/api/supplies`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Unable to load supplies");
            const items = normalizeList(data, "supplies");
            setSupplyHash(Object.fromEntries(items.map((item) => [item.id || item._id, {
                ...item,
                id: item.id || item._id,
                quantity: Number(item.quantity || 0),
                lowStockAt: Number(item.lowStockAt ?? 5)
            }])));
        } catch (error) {
            console.error("Error fetching supplies:", error);
            setSupplyNotice(error.message || "Unable to load supplies from the server.");
        }
    }, [authorizedFetch, normalizeList]);

    const fetchHistory = useCallback(async () => {
        try {
            const response = await authorizedFetch(`${API_BASE_URL}/api/history`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Unable to load history");
            setHistoryStack(normalizeList(data, "history"));
        } catch (error) {
            console.error("Error fetching history:", error);
        }
    }, [authorizedFetch, normalizeList]);

    useEffect(() => {
        let cancelled = false;

        Promise.resolve().then(() => {
            if (cancelled) return;

            fetchEmergencies();
            fetchTeams();
            fetchVictims();
            if (authToken) {
                fetchSupplies();
                fetchHistory();
            } else {
                setSupplyHash({});
                setHistoryStack([]);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [role, authToken, fetchEmergencies, fetchTeams, fetchVictims, fetchSupplies, fetchHistory]);

    /* ================= SOS ================= */

    const openSOS = () => {
        setSosSent(false);
        setLocationStatus("");
        setShowSOS(true);
    };

    const closeSOS = () => {
        if (sendingSOS) return;

        setShowSOS(false);
        setSosSent(false);
        setLocationStatus("");
    };

    const sendSOS = () => {
        if (sosForm.people < 1) {
            alert("Number of people must be at least 1");
            return;
        }

        if (!navigator.geolocation) {
            alert(
                "Location services are not supported by this browser."
            );
            return;
        }

        setSendingSOS(true);
        setLocationStatus("Getting your location...");

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                setLocationStatus("Location found. Sending SOS...");

                try {
                    const response = await fetch(
                        `${API_BASE_URL}/api/sos`,
                        {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                latitude,
                                longitude,
                                location: `${latitude.toFixed(
                                    5
                                )}, ${longitude.toFixed(5)}`,
                                cause: sosForm.cause,
                                people: Number(sosForm.people)
                            })
                        }
                    );

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(
                            data.message || "Failed to send SOS"
                        );
                    }

                    await fetchEmergencies();

                    setSosSent(true);
                    setLocationStatus(
                        "SOS received and added to emergencies. Rescue teams have been notified."
                    );
                } catch (error) {
                    console.log("SOS error:", error);

                    alert(
                        "Could not send SOS. Make sure the backend is running."
                    );
                } finally {
                    setSendingSOS(false);
                }
            },
            (error) => {
                console.log("Location error:", error);

                setSendingSOS(false);

                if (error.code === 1) {
                    setLocationStatus(
                        "Location permission was denied."
                    );
                } else {
                    setLocationStatus(
                        "Unable to get your location."
                    );
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    /* ================= TEAMS ================= */

    const addTeam = async (event) => {
        event.preventDefault();

        try {
            const response = await authorizedFetch(
                `${API_BASE_URL}/api/teams/add`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        teamId: teamForm.teamId,
                        name: teamForm.name,
                        members: Number(teamForm.members),
                        targetEmergencyId: teamForm.emergencyId,
                        status: teamForm.status
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Failed to add team");
                return;
            }

            setTeams(normalizeList(data, "queue"));

            setTeamForm({
                teamId: "",
                name: "",
                members: "",
                emergencyId: "",
                status: "Available"
            });

            setShowTeamForm(false);
        } catch (error) {
            console.log("Error adding team:", error);
            alert("Could not connect to backend");
        }
    };

    const dispatchTeam = async () => {
        if (teams.length === 0) {
            alert("No rescue teams available.");
            return;
        }

        setDispatching(true);

        try {
            const response = await authorizedFetch(
                `${API_BASE_URL}/api/teams/dispatch`,
                {
                    method: "POST"
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Failed to dispatch team");
                return;
            }

            setTeams(
                normalizeList(
                    data.remainingTeams ?? data.queue ?? data,
                    "remainingTeams"
                )
            );

            await fetchEmergencies();

            alert(
                `${data.team.name || data.team.teamId} dispatched to ${
                    data.emergency.location
                } successfully`
            );
        } catch (error) {
            console.log("Error dispatching team:", error);
            alert("Could not connect to backend");
        } finally {
            setDispatching(false);
        }
    };

    /* ================= VICTIMS ================= */

    const addVictim = async (event) => {
        event.preventDefault();

        try {
            const response = await authorizedFetch(
                `${API_BASE_URL}/api/victims/add`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        ...victimForm,
                        age:
                            victimForm.age === ""
                                ? ""
                                : Number(victimForm.age)
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || "Failed to add victim");
                return;
            }

            setVictims(normalizeList(data, "victims"));

            setVictimForm({
                victimId: "",
                name: "",
                age: "",
                location: "",
                condition: "Injured"
            });

            setShowVictimForm(false);
        } catch (error) {
            console.log("Error adding victim:", error);
            alert("Could not connect to backend");
        }
    };

    const removeVictim = async (victimId) => {
    try {
        const response = await authorizedFetch(
            `${API_BASE_URL}/api/victims/${victimId}`,
            {
                method: "DELETE"
            }
        );

        const data = await response.json();

        if (!response.ok) {
            alert(data.message);
            return;
        }

        setVictims(
            normalizeList(
                data.remainingVictims ?? data.victims ?? data,
                "remainingVictims"
            )
        );

        alert(
            `${data.victim.name || data.victim.victimId} rescued successfully`
        );
    } catch (error) {
        console.log("Error removing victim:", error);
    }
};

    const criticalCount = emergencies.filter(
        (emergency) => emergency.priority >= 85
    ).length;

    const peopleAffected = emergencies.reduce(
        (total, emergency) =>
            total + Number(emergency.peopleTrapped || 0),
        0
    );

    if (!role) {
        return (
            <div className="role-screen">
                <div className="role-glow role-glow-one"></div>
                <div className="role-glow role-glow-two"></div>

                <div className="role-container">
                    <div className="role-brand">
                        <div className="role-logo">
                            <Activity size={30} />
                        </div>
                        <div>
                            <h1>RESQ</h1>
                            <p>Emergency Response System</p>
                        </div>
                    </div>

                    <div className="role-heading">
                        <span>WELCOME</span>
                        <h2>How are you using RESQ?</h2>
                        <p>
                            Choose your role to enter the appropriate emergency
                            response interface.
                        </p>
                    </div>

                    <PublicRiskMap emergencies={emergencies} />

                    <div className="role-cards">
                        <button
                            className="role-card victim-role"
                            onClick={() => setRole("victim")}
                        >
                            <div className="role-card-icon">
                                <Siren size={32} />
                            </div>
                            <div className="role-card-content">
                                <h3>I need help</h3>
                                <p>I'm a victim or someone reporting an emergency.</p>
                                <span>Send SOS →</span>
                            </div>
                        </button>

                        <button
                            className="role-card rescuer-role"
                            onClick={() => setRole("rescuer")}
                        >
                            <div className="role-card-icon">
                                <Ambulance size={32} />
                            </div>
                            <div className="role-card-content">
                                <h3>I'm a rescuer</h3>
                                <p>I'm coordinating teams and emergency response.</p>
                                <span>Open command center →</span>
                            </div>
                        </button>
                    </div>

                    <p className="role-footer">
                        You can switch roles later from the menu.
                    </p>
                </div>
            </div>
        );
    }

    if (role === "rescuer" && !authToken) {
        return (
            <main className="resq-login-screen">
                <div className="resq-login-orb resq-login-orb-a" />
                <div className="resq-login-orb resq-login-orb-b" />
                <div className="resq-login-grid" />

                <header className="resq-login-topbar">
                    <div className="resq-login-brand">
                        <div className="resq-login-brand-mark"><Activity size={24} strokeWidth={2.5} /></div>
                        <div className="resq-login-brand-copy">
                            <span className="resq-login-wordmark">RESQ<span>.</span></span>
                            <span className="resq-login-brand-subtitle">EMERGENCY RESPONSE PLATFORM</span>
                        </div>
                    </div>
                    <div className="resq-login-secure-pill"><span className="resq-login-secure-dot" /> SECURE RESPONDER ACCESS</div>
                </header>

                <section className="resq-login-layout">
                    <div className="resq-login-story">
                        <div className="resq-login-eyebrow"><span className="resq-login-eyebrow-line" /> RESQ OPERATIONS NETWORK</div>
                        <h1>When every<br />second <span>matters.</span></h1>
                        <p className="resq-login-story-copy">One command center. Clear decisions. Faster response. Sign in to coordinate rescue operations and help teams reach the people who need them.</p>

                        <div className="resq-login-live-card">
                            <div className="resq-login-live-icon"><Siren size={21} /></div>
                            <div className="resq-login-live-copy">
                                <strong>Response starts here</strong>
                                <span>Situational awareness · Team coordination · Emergency support</span>
                            </div>
                            <span className="resq-login-live-indicator"><span /> READY</span>
                        </div>

                        <div className="resq-login-feature-row">
                            <div className="resq-login-feature"><div className="resq-login-feature-icon"><MapPin size={17} /></div><div><strong>Live coordination</strong><span>Keep response teams aligned</span></div></div>
                            <div className="resq-login-feature"><div className="resq-login-feature-icon"><CheckCircle size={17} /></div><div><strong>Controlled access</strong><span>For registered responders</span></div></div>
                        </div>
                        <div className="resq-login-quote-mark">“</div>
                        <p className="resq-login-motto">Prepared teams. Coordinated action. Stronger outcomes.</p>
                    </div>

                    <div className="resq-login-panel-wrap">
                        <div className="resq-login-panel-topline"><span>RESPONDER PORTAL</span><span className="resq-login-panel-version">RESQ / 01</span></div>
                        <div className="resq-login-panel">
                            <div className="resq-login-panel-icon"><Activity size={24} strokeWidth={2.4} /></div>
                            <div className="resq-login-panel-heading">
                                <span className="resq-login-panel-kicker">WELCOME BACK</span>
                                <h2>Sign in to RESQ</h2>
                                <p>Enter your responder credentials to continue.</p>
                            </div>

                            <form className="resq-login-form" onSubmit={handleLogin}>
                                <label className="resq-login-field">
                                    <span>Username</span>
                                    <div className="resq-login-input-wrap"><span className="resq-login-input-icon"><Users size={18} /></span><input type="text" autoComplete="username" value={loginForm.username} onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })} placeholder="Your registered username" required /></div>
                                </label>
                                <label className="resq-login-field">
                                    <span>Password</span>
                                    <div className="resq-login-input-wrap"><span className="resq-login-input-icon"><CheckCircle size={18} /></span><input type="password" autoComplete="current-password" value={loginForm.password} onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })} placeholder="Enter your password" required /></div>
                                </label>

                                {loginError && <p className="resq-login-error" role="alert"><AlertTriangle size={17} /> <span>{loginError}</span></p>}

                                <button className="resq-login-submit" type="submit" disabled={loggingIn}>
                                    <span>{loggingIn ? "Verifying credentials…" : "Access command center"}</span>
                                    {!loggingIn && <span className="resq-login-submit-arrow">↗</span>}
                                </button>
                            </form>

                            <div className="resq-login-panel-security"><span className="resq-login-lock"><CheckCircle size={15} /></span><span>Your session is protected by secure authentication.</span></div>
                            <button className="resq-login-back" type="button" onClick={() => { setRole(null); setLoginError(""); setLoginForm({ username: "", password: "" }); }}><span>←</span> Back to role selection</button>
                        </div>
                        <div className="resq-login-panel-foot"><span>AUTHORIZED PERSONNEL ONLY</span><span>ACCESS IS MONITORED</span></div>
                    </div>
                </section>
                <footer className="resq-login-footer"><span>© RESQ Emergency Response System</span><span><span className="resq-login-footer-dot" /> Built for moments that matter</span></footer>
            </main>
        );
    }

    if (role === "victim") {
        const activeEmergencies = emergencies.filter(
            (emergency) => emergency.status !== "Resolved"
        );

        return (
            <div className="victim-app">
                <header className="victim-topbar">
                    <div className="victim-brand">
                        <div className="victim-logo">
                            <Activity size={25} />
                        </div>
                        <div>
                            <strong>RESQ</strong>
                            <span>Emergency Assistance</span>
                        </div>
                    </div>

                    <button
                        className="switch-role-button"
                        onClick={() => setRole(null)}
                    >
                        Switch Role
                    </button>
                </header>

                <main className="victim-content">
                    <section className="victim-hero">
                        <div>
                            <span className="victim-eyebrow">NEED HELP?</span>
                            <h1>Get emergency assistance</h1>
                            <p>
                                If you are trapped, injured, or need immediate
                                rescue, send an SOS. Your location and emergency
                                details will be sent to the response team.
                            </p>
                        </div>

                        <button className="victim-sos-button" onClick={openSOS}>
                            <Siren size={28} />
                            <div>
                                <strong>SEND SOS</strong>
                                <span>Request immediate rescue</span>
                            </div>
                        </button>
                    </section>

                    <section className="victim-grid">
                        <div className="victim-info-card">
                            <div className="victim-info-icon">
                                <MapPin size={22} />
                            </div>
                            <div>
                                <h3>Your location</h3>
                                <p>
                                    Your current location is automatically shared
                                    when you send an SOS.
                                </p>
                            </div>
                        </div>

                        <div className="victim-info-card">
                            <div className="victim-info-icon">
                                <Ambulance size={22} />
                            </div>
                            <div>
                                <h3>Rescue response</h3>
                                <p>
                                    Your SOS becomes an emergency in the RESQ
                                    command center for dispatch.
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className="victim-status-panel">
                        <div className="victim-status-header">
                            <div>
                                <h2>Emergency Status</h2>
                                <p>Current active rescue situations</p>
                            </div>
                            <span>{activeEmergencies.length} Active</span>
                        </div>

                        {activeEmergencies.length === 0 ? (
                            <div className="victim-empty">
                                <CheckCircle size={35} />
                                <p>No active emergencies currently reported.</p>
                            </div>
                        ) : (
                            <div className="victim-emergency-list">
                                {activeEmergencies.slice(0, 5).map((emergency) => (
                                    <div
                                        className={
                                            emergency.status === "Dispatched"
                                                ? "victim-emergency-row rescue-underway"
                                                : "victim-emergency-row rescue-pending"
                                        }
                                        key={emergency._id || emergency.emergencyId}
                                    >
                                        <div>
                                            <strong>{emergency.emergencyId}</strong>
                                            <p>{emergency.location}</p>
                                        </div>
                                        <span>
                                            {emergency.status === "Dispatched"
                                                ? "Rescue underway"
                                                : "Awaiting rescue"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </main>

                {showSOS && (
                    <div className="sos-overlay">
                        <div className="sos-modal">
                            {!sosSent ? (
                                <>
                                    <div className="sos-header">
                                        <div className="sos-icon">
                                            <Siren size={30} />
                                        </div>
                                        <button
                                            className="sos-close"
                                            onClick={closeSOS}
                                            disabled={sendingSOS}
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <h2>Send Emergency SOS</h2>
                                    <p className="sos-description">
                                        Your location will be shared automatically
                                        with the rescue team.
                                    </p>

                                    <div className="sos-form">
                                        <label>
                                            Cause of Emergency
                                            <select
                                                value={sosForm.cause}
                                                onChange={(event) =>
                                                    setSosForm({
                                                        ...sosForm,
                                                        cause: event.target.value
                                                    })
                                                }
                                            >
                                                <option>Flood</option>
                                                <option>Earthquake</option>
                                                <option>Landslide</option>
                                                <option>Cyclone</option>
                                                <option>Fire</option>
                                                <option>Medical Emergency</option>
                                                <option>Trapped / Rescue Needed</option>
                                                <option>Other</option>
                                            </select>
                                        </label>

                                        <label>
                                            Number of People
                                            <input
                                                type="number"
                                                min="1"
                                                value={sosForm.people}
                                                onChange={(event) =>
                                                    setSosForm({
                                                        ...sosForm,
                                                        people: Number(event.target.value)
                                                    })
                                                }
                                            />
                                        </label>

                                        <div className="location-box">
                                            <MapPin size={20} />
                                            <div>
                                                <strong>Automatic Location</strong>
                                                <p>
                                                    {locationStatus ||
                                                        "Your current location will be shared automatically."}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            className="send-sos-button"
                                            onClick={sendSOS}
                                            disabled={sendingSOS}
                                        >
                                            <Siren size={21} />
                                            {sendingSOS ? "SENDING SOS..." : "SEND SOS"}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="sos-success">
                                    <div className="success-icon">
                                        <CheckCircle size={55} />
                                    </div>
                                    <h2>SOS Sent Successfully</h2>
                                    <p>
                                        Your emergency has been added to the RESQ
                                        system. Rescue teams have been notified.
                                    </p>
                                    <button className="close-success" onClick={closeSOS}>
                                        Close
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="app">

            {/* ================= SIDEBAR ================= */}

            {mobileMenuOpen && (
                <button
                    type="button"
                    className="mobile-menu-backdrop"
                    aria-label="Close navigation menu"
                    onClick={() => setMobileMenuOpen(false)}
                />
            )}

            <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>

                <div className="logo">

                    <div className="logo-icon">
                        <Activity size={24} />
                    </div>

                    <div>
                        <h2>RESQ</h2>
                        <span>Emergency Response</span>
                    </div>

                </div>

                <div className="menu-title">
                    MAIN MENU
                </div>

                <nav>

                    <button
                        className={
                            page === "Dashboard"
                                ? "nav-button active"
                                : "nav-button"
                        }
                        onClick={() => navigateToPage("Dashboard")}
                    >
                        <Activity size={19} />
                        Dashboard
                    </button>

                    <button
                        className={
                            page === "Emergencies"
                                ? "nav-button active"
                                : "nav-button"
                        }
                        onClick={() => navigateToPage("Emergencies")}
                    >
                        <AlertTriangle size={19} />
                        Emergencies
                    </button>

                    <button
                        className={
                            page === "Rescue Teams"
                                ? "nav-button active"
                                : "nav-button"
                        }
                        onClick={() => navigateToPage("Rescue Teams")}
                    >
                        <Ambulance size={19} />
                        Rescue Teams
                    </button>

                    <button
                        className={
                            page === "Victims"
                                ? "nav-button active"
                                : "nav-button"
                        }
                        onClick={() => navigateToPage("Victims")}
                    >
                        <Users size={19} />
                        Victims
                    </button>

                    <button
                        className={
                            page === "Supplies"
                                ? "nav-button active"
                                : "nav-button"
                        }
                        onClick={() => navigateToPage("Supplies")}
                    >
                        <Package size={19} />
                        Supplies
                    </button>

                    <button
                        className={
                            page === "History"
                                ? "nav-button active"
                                : "nav-button"
                        }
                        onClick={() => navigateToPage("History")}
                    >
                        <Clock size={19} />
                        History
                    </button>

                </nav>

                <div className="sidebar-bottom">

                    <button
                        className="switch-role-sidebar"
                        onClick={logoutRescuer}
                    >
                        <Users size={17} />
                        Log Out
                    </button>

                    <div className="system-status">

                        <span className="status-dot"></span>

                        <div>
                            <strong>System Online</strong>

                            <small>
                                All services operational
                            </small>
                        </div>

                    </div>

                </div>

            </aside>

            {/* ================= MAIN ================= */}

            <main className="main">

                {/* ================= TOPBAR ================= */}

                <header className="topbar">

                    <div>

                        <h1>
                            {page === "Dashboard"
                                ? "Emergency Dashboard"
                                : page}
                        </h1>

                        <p>
                            {page === "Dashboard"
                                ? "Real-time disaster response monitoring"
                                : `Manage ${page.toLowerCase()}`}
                        </p>

                    </div>

                    <div className="top-actions">

                        {/* SOS BUTTON */}

                        <button
                            className="sos-button"
                            onClick={openSOS}
                        >
                            <Siren size={19} />
                            <span>SOS</span>
                        </button>

                        <div className="live-status">
                            <span></span>
                            LIVE
                        </div>

                        <button
                            type="button"
                            className="menu-button"
                            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                            aria-expanded={mobileMenuOpen}
                            onClick={() => setMobileMenuOpen(open => !open)}
                        >
                            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                        </button>

                    </div>

                </header>

                {/* ================= DASHBOARD ================= */}

                {page === "Dashboard" && (

                    <>

                        <section className="stats">

                            <div className="stat-card">

                                <div className="stat-icon red">
                                    <AlertTriangle size={23} />
                                </div>

                                <div>
                                    <p>Active Emergencies</p>

                                    <h2>
                                        {emergencies.length}
                                    </h2>

                                    <small className="danger">
                                        Currently active
                                    </small>
                                </div>

                            </div>

                            <div className="stat-card">

                                <div className="stat-icon orange">
                                    <Activity size={23} />
                                </div>

                                <div>
                                    <p>Critical Situations</p>

                                    <h2>
                                        {criticalCount}
                                    </h2>

                                    <small className="danger">
                                        Requires attention
                                    </small>
                                </div>

                            </div>

                            <div className="stat-card">

                                <div className="stat-icon blue">
                                    <Ambulance size={23} />
                                </div>

                                <div>
                                    <p>Rescue Teams</p>

                                    <h2>
                                        {teams.length}
                                    </h2>

                                    <small className="success">
                                        {teams.length} in queue
                                    </small>
                                </div>

                            </div>

                            <div className="stat-card">

                                <div className="stat-icon purple">
                                    <Users size={23} />
                                </div>

                                <div>
                                    <p>People Affected</p>

                                    <h2>
                                        {peopleAffected}
                                    </h2>

                                    <small>
                                        People trapped
                                    </small>
                                </div>

                            </div>

                        </section>

                        <section className="quick-actions-top">

                            <div className="panel quick-panel">

                                <h3>
                                    Quick Actions
                                </h3>

                                <div className="quick-actions-buttons">

                                    <button
                                        onClick={() =>
                                            navigateToPage("Emergencies")
                                        }
                                    >
                                        <AlertTriangle size={18} />
                                        Report Emergency
                                    </button>

                                    <button
                                        onClick={() =>
                                            navigateToPage("Rescue Teams")
                                        }
                                    >
                                        <Ambulance size={18} />
                                        Dispatch Team
                                    </button>

                                    <button
                                        onClick={openSOS}
                                        className="quick-sos"
                                    >
                                        <Siren size={18} />
                                        Send SOS
                                    </button>

                                </div>

                            </div>

                        </section>

                        <section className="dashboard-grid">

                            <div className="panel map-panel">

                                <div className="panel-header">

                                    <div>

                                        <h3>
                                            <Map size={19} />
                                            Emergency Map
                                        </h3>

                                        <p>
                                            Live disaster locations
                                        </p>

                                    </div>

                                    <button className="view-map">
                                        View Full Map
                                    </button>

                                </div>

                                <div
                                    className="map-placeholder"
                                    style={{
                                        padding: 0,
                                        overflow: "hidden",
                                        minHeight: "450px"
                                    }}
                                >
                                    <RescueMap emergencies={emergencies} teams={teams} />
                                </div>

                            </div>

                            <div className="panel">

                                <div className="panel-header">

                                    <div>

                                        <h3>
                                            <AlertTriangle size={19} />
                                            Priority Alerts
                                        </h3>

                                        <p>
                                            Highest priority emergencies
                                        </p>

                                    </div>

                                    <span className="count">
                                        {emergencies.length}
                                    </span>

                                </div>

                                <div className="alerts">

                                    {emergencies.length === 0 ? (

                                        <p className="empty-text">
                                            No emergencies found.
                                        </p>

                                    ) : (

                                        [...emergencies]
                                            .sort(
                                                (a, b) =>
                                                    b.priority -
                                                    a.priority
                                            )
                                            .map((emergency) => {

                                                let priorityClass = "medium";

                                                if (
                                                    emergency.priority >= 85
                                                ) {
                                                    priorityClass =
                                                        "critical";
                                                } else if (
                                                    emergency.priority >= 70
                                                ) {
                                                    priorityClass =
                                                        "high";
                                                }

                                                return (
                                                    <div
                                                        className={`alert ${priorityClass}`}
                                                        key={emergency._id}
                                                    >

                                                        <div>

                                                            <strong>
                                                                {
                                                                    emergency.emergencyId
                                                                }
                                                            </strong>

                                                            <p>
                                                                {
                                                                    emergency.location
                                                                }
                                                            </p>

                                                        </div>

                                                        <span>
                                                            {
                                                                emergency.priority
                                                            }
                                                        </span>

                                                    </div>
                                                );

                                            })

                                    )}

                                </div>

                            </div>

                        </section>

                        <section className="bottom-grid">

                            <div className="panel">

                                <div className="panel-header">

                                    <div>

                                        <h3>
                                            Recent Activity
                                        </h3>

                                        <p>
                                            Latest rescue operations
                                        </p>

                                    </div>

                                </div>

                                <div className="activity">

                                    <div>

                                        <span className="activity-dot"></span>

                                        <div>
                                            <strong>
                                                Rescue system active
                                            </strong>

                                            <p>
                                                RESQ monitoring
                                            </p>
                                        </div>

                                        <small>
                                            Live
                                        </small>

                                    </div>

                                    <div>

                                        <span className="activity-dot"></span>

                                        <div>
                                            <strong>
                                                Emergency database connected
                                            </strong>

                                            <p>
                                                MongoDB
                                            </p>
                                        </div>

                                        <small>
                                            Online
                                        </small>

                                    </div>

                                </div>

                            </div>

                        </section>

                    </>

                )}

                {/* ================= EMERGENCIES ================= */}

                {page === "Emergencies" && (

                    <div>

                        <div className="page-heading">

                            <div>

                                <h2>
                                    Emergency Management
                                </h2>

                                <p>
                                    Track emergencies waiting for rescue and teams currently responding
                                </p>

                            </div>

                            <button
                                className="primary-button"
                                onClick={fetchEmergencies}
                            >
                                Refresh
                            </button>

                        </div>

                        {/* ================= UNDERGOING RESCUE ================= */}

                        <div className="panel" style={{ marginBottom: "24px" }}>

                            <div className="panel-header">

                                <div>

                                    <h3 style={{ color: "#22c55e" }}>
                                        <Ambulance size={19} />
                                        Undergoing Rescue
                                    </h3>

                                    <p>
                                        Rescue teams have already been dispatched to these emergencies
                                    </p>

                                </div>

                                <span
                                    className="count"
                                    style={{
                                        background: "rgba(34, 197, 94, 0.14)",
                                        color: "#22c55e"
                                    }}
                                >
                                    {
                                        emergencies.filter(
                                            (emergency) =>
                                                emergency.status === "Dispatched"
                                        ).length
                                    }
                                </span>

                            </div>

                            {emergencies.filter(
                                (emergency) => emergency.status === "Dispatched"
                            ).length === 0 ? (

                                <div className="empty-state">
                                    <CheckCircle size={45} />
                                    <h3>No rescues currently underway</h3>
                                    <p>
                                        Dispatched emergencies will appear here.
                                    </p>
                                </div>

                            ) : (

                                <div className="emergency-list">

                                    {[...emergencies]
                                        .filter(
                                            (emergency) =>
                                                emergency.status === "Dispatched"
                                        )
                                        .sort(
                                            (a, b) =>
                                                Number(b.priority || 0) -
                                                Number(a.priority || 0)
                                        )
                                        .map((emergency) => (

                                            <div
                                                className="emergency-card"
                                                key={
                                                    emergency._id ||
                                                    emergency.emergencyId
                                                }
                                                style={{
                                                    borderLeft: "4px solid #22c55e",
                                                    background:
                                                        "rgba(34, 197, 94, 0.06)"
                                                }}
                                            >

                                                <div
                                                    className="emergency-id"
                                                    style={{
                                                        color: "#22c55e"
                                                    }}
                                                >
                                                    {emergency.emergencyId}
                                                </div>

                                                <div className="emergency-info">

                                                    <strong>
                                                        {emergency.location}
                                                    </strong>

                                                    <div className="emergency-details">

                                                        <span>
                                                            Disaster: {emergency.disasterType}
                                                        </span>

                                                        <span>
                                                            Trapped: {emergency.peopleTrapped}
                                                        </span>

                                                        <span>
                                                            Injured: {emergency.injured}
                                                        </span>

                                                        <span>
                                                            Severity: {emergency.severity}
                                                        </span>

                                                        <span
                                                            style={{
                                                                color: "#22c55e",
                                                                fontWeight: 700
                                                            }}
                                                        >
                                                            Team: {emergency.assignedTeam || "Assigned"}
                                                        </span>

                                                    </div>

                                                </div>

                                                <div className="priority-score">

                                                    <small>
                                                        PRIORITY
                                                    </small>

                                                    <strong>
                                                        {emergency.priority}
                                                    </strong>

                                                </div>

                                            </div>

                                        ))}

                                </div>

                            )}

                        </div>

                        {/* ================= STILL TO BE RESCUED ================= */}

                        <div className="panel">

                            <div className="panel-header">

                                <div>

                                    <h3 style={{ color: "#ef4444" }}>
                                        <AlertTriangle size={19} />
                                        Still to be Rescued
                                    </h3>

                                    <p>
                                        Emergencies waiting for a rescue team
                                    </p>

                                </div>

                                <span
                                    className="count"
                                    style={{
                                        background: "rgba(239, 68, 68, 0.14)",
                                        color: "#ef4444"
                                    }}
                                >
                                    {
                                        emergencies.filter(
                                            (emergency) =>
                                                emergency.status !== "Dispatched" &&
                                                emergency.status !== "Resolved"
                                        ).length
                                    }
                                </span>

                            </div>

                            {emergencies.filter(
                                (emergency) =>
                                    emergency.status !== "Dispatched" &&
                                    emergency.status !== "Resolved"
                            ).length === 0 ? (

                                <div className="empty-state">
                                    <CheckCircle size={45} />
                                    <h3>No emergencies waiting for rescue</h3>
                                    <p>
                                        New emergency reports will appear here.
                                    </p>
                                </div>

                            ) : (

                                <div className="emergency-list">

                                    {[...emergencies]
                                        .filter(
                                            (emergency) =>
                                                emergency.status !== "Dispatched" &&
                                                emergency.status !== "Resolved"
                                        )
                                        .sort(
                                            (a, b) =>
                                                Number(b.priority || 0) -
                                                Number(a.priority || 0)
                                        )
                                        .map((emergency) => (

                                            <div
                                                className="emergency-card"
                                                key={
                                                    emergency._id ||
                                                    emergency.emergencyId
                                                }
                                                style={{
                                                    borderLeft: "4px solid #ef4444",
                                                    background:
                                                        "rgba(239, 68, 68, 0.06)"
                                                }}
                                            >

                                                <div
                                                    className="emergency-id"
                                                    style={{
                                                        color: "#ef4444"
                                                    }}
                                                >
                                                    {emergency.emergencyId}
                                                </div>

                                                <div className="emergency-info">

                                                    <strong>
                                                        {emergency.location}
                                                    </strong>

                                                    <div className="emergency-details">

                                                        <span>
                                                            Disaster: {emergency.disasterType}
                                                        </span>

                                                        <span>
                                                            Trapped: {emergency.peopleTrapped}
                                                        </span>

                                                        <span>
                                                            Injured: {emergency.injured}
                                                        </span>

                                                        <span>
                                                            Severity: {emergency.severity}
                                                        </span>

                                                    </div>

                                                </div>

                                                <div className="priority-score">

                                                    <small>
                                                        PRIORITY
                                                    </small>

                                                    <strong>
                                                        {emergency.priority}
                                                    </strong>

                                                </div>

                                            </div>

                                        ))}

                                </div>

                            )}

                        </div>

                    </div>

                )}

                {/* ================= RESCUE TEAMS ================= */}

                {page === "Rescue Teams" && (

                    <div>

                        <div className="page-heading">

                            <div>

                                <h2>
                                    Rescue Teams
                                </h2>

                                <p>
                                    Teams waiting in the rescue queue
                                </p>

                            </div>

                            <div className="team-actions">

                                <button
                                    className="secondary-button"
                                    onClick={fetchTeams}
                                >
                                    Refresh
                                </button>

                                <button
                                    className="primary-button"
                                    onClick={() =>
                                        setShowTeamForm(true)
                                    }
                                >
                                    <Plus size={18} />
                                    Add Rescue Team
                                </button>

                                <button
                                    className="dispatch-button"
                                    onClick={dispatchTeam}
                                    disabled={teams.length === 0}
                                >
                                    <Send size={18} />
                                    Dispatch Team
                                </button>

                            </div>

                        </div>

                        <div className="team-summary">

                            <div className="team-summary-card">

                                <Ambulance size={24} />

                                <div>
                                    <span>
                                        Teams in Queue
                                    </span>

                                    <strong>
                                        {teams.length}
                                    </strong>
                                </div>

                            </div>

                            <div className="team-summary-card">

                                <Users size={24} />

                                <div>
                                    <span>
                                        Total Personnel
                                    </span>

                                    <strong>
                                        {teams.reduce(
                                            (total, team) =>
                                                total +
                                                Number(
                                                    team.members || 0
                                                ),
                                            0
                                        )}
                                    </strong>
                                </div>

                            </div>

                            <div className="team-summary-card">

                                <Activity size={24} />

                                <div>
                                    <span>
                                        Queue Status
                                    </span>

                                    <strong>
                                        {teams.length > 0
                                            ? "Ready"
                                            : "Empty"}
                                    </strong>
                                </div>

                            </div>

                        </div>

                        <div className="panel team-panel">

                            <div className="panel-header">

                                <div>

                                    <h3>
                                        Rescue Queue
                                    </h3>

                                    <p>
                                        First team added is dispatched first
                                        (FIFO)
                                    </p>

                                </div>

                                <span className="count">
                                    {teams.length}
                                </span>

                            </div>

                            {teams.length === 0 ? (

                                <div className="empty-state">

                                    <Ambulance size={45} />

                                    <h3>
                                        No rescue teams in queue
                                    </h3>

                                    <p>
                                        Add a rescue team to start
                                        the dispatch queue.
                                    </p>

                                </div>

                            ) : (

                                <div className="team-list">

                                    {teams.map((team, index) => (

                                        <div
                                            className="team-card"
                                            key={index}
                                        >

                                            <div className="team-number">
                                                #{index + 1}
                                            </div>

                                            <div className="team-info">

                                                <div className="team-title">

                                                    <strong>
                                                        {team.name ||
                                                            team.teamId}
                                                    </strong>

                                                    <span className="available-badge">
                                                        {team.status ||
                                                            "Available"}
                                                    </span>

                                                </div>

                                                <div className="team-details">

                                                    <span>
                                                        ID:{" "}
                                                        {team.teamId ||
                                                            "N/A"}
                                                    </span>

                                                    <span>
                                                        <Users size={14} />
                                                        {team.members ||
                                                            0}{" "}
                                                        members
                                                    </span>

                                                    <span>
                                                        Location:{" "}
                                                        {team.location ||
                                                            "Unknown"}
                                                    </span>

                                                </div>

                                            </div>

                                            {index === 0 && (

                                                <div className="next-team">
                                                    NEXT TO DISPATCH
                                                </div>

                                            )}

                                        </div>

                                    ))}

                                </div>

                            )}

                        </div>

                        {showTeamForm && (

                            <div className="modal-overlay">

                                <div className="team-modal">

                                    <div className="modal-header">

                                        <div>

                                            <h2>
                                                Add Rescue Team
                                            </h2>

                                            <p>
                                                Add team to the FIFO queue
                                            </p>

                                        </div>

                                        <button
                                            className="close-button"
                                            onClick={() =>
                                                setShowTeamForm(false)
                                            }
                                        >
                                            <X size={20} />
                                        </button>

                                    </div>

                                    <form onSubmit={addTeam}>

                                        <label>
                                            Team ID

                                            <input
                                                type="text"
                                                placeholder="T001"
                                                value={
                                                    teamForm.teamId
                                                }
                                                onChange={(event) =>
                                                    setTeamForm({
                                                        ...teamForm,
                                                        teamId:
                                                            event.target.value
                                                    })
                                                }
                                                required
                                            />
                                        </label>

                                        <label>
                                            Team Name

                                            <input
                                                type="text"
                                                placeholder="Alpha Rescue Team"
                                                value={
                                                    teamForm.name
                                                }
                                                onChange={(event) =>
                                                    setTeamForm({
                                                        ...teamForm,
                                                        name:
                                                            event.target.value
                                                    })
                                                }
                                                required
                                            />
                                        </label>

                                        <label>
                                            Number of Members

                                            <input
                                                type="number"
                                                min="1"
                                                placeholder="6"
                                                value={
                                                    teamForm.members
                                                }
                                                onChange={(event) =>
                                                    setTeamForm({
                                                        ...teamForm,
                                                        members:
                                                            event.target.value
                                                    })
                                                }
                                                required
                                            />
                                        </label>

                                        <label>
                                            Dispatch Destination

                                            <select
                                                value={teamForm.emergencyId}
                                                onChange={(event) =>
                                                    setTeamForm({
                                                        ...teamForm,
                                                        emergencyId:
                                                            event.target.value
                                                    })
                                                }
                                                required
                                            >
                                                <option value="" disabled>
                                                    Select an emergency
                                                </option>

                                                {emergencies
                                                    .filter(
                                                        (emergency) =>
                                                            emergency.status !== "Dispatched" &&
                                                            emergency.status !== "Resolved"
                                                    )
                                                    .sort(
                                                        (a, b) =>
                                                            Number(
                                                                b.priority || 0
                                                            ) -
                                                            Number(
                                                                a.priority || 0
                                                            )
                                                    )
                                                    .map((emergency) => (
                                                        <option
                                                            key={
                                                                emergency._id ||
                                                                emergency.emergencyId
                                                            }
                                                            value={
                                                                emergency.emergencyId
                                                            }
                                                        >
                                                            {emergency.emergencyId} — {emergency.location} — Priority {emergency.priority || 0}
                                                        </option>
                                                    ))}
                                            </select>

                                            {emergencies.filter(
                                                (emergency) =>
                                                    emergency.status !==
                                                        "Dispatched" &&
                                                    emergency.status !==
                                                        "Resolved"
                                            ).length === 0 && (
                                                <small>
                                                    No active emergencies available.
                                                </small>
                                            )}
                                        </label>

                                        <label>
                                            Status

                                            <select
                                                value={
                                                    teamForm.status
                                                }
                                                onChange={(event) =>
                                                    setTeamForm({
                                                        ...teamForm,
                                                        status:
                                                            event.target.value
                                                    })
                                                }
                                            >
                                                <option>
                                                    Available
                                                </option>

                                                <option>
                                                    Medical
                                                </option>

                                                <option>
                                                    Search & Rescue
                                                </option>

                                            </select>

                                        </label>

                                        <button
                                            className="primary-button submit-team"
                                            type="submit"
                                        >
                                            <Plus size={18} />
                                            Add Team to Queue
                                        </button>

                                    </form>

                                </div>

                            </div>

                        )}

                    </div>

                )}

                {/* ================= VICTIMS ================= */}

                {page === "Victims" && (

                    <div>

                        <div className="page-heading">

                            <div>

                                <h2>
                                    Victim Management
                                </h2>

                                <p>
                                    Victims waiting for rescue
                                </p>

                            </div>

                            <div className="team-actions">

                                <button
                                    className="secondary-button"
                                    onClick={fetchVictims}
                                >
                                    Refresh
                                </button>

                                <button
                                    className="primary-button"
                                    onClick={() =>
                                        setShowVictimForm(true)
                                    }
                                >
                                    <Plus size={18} />
                                    Add Victim
                                </button>

                            </div>

                        </div>

                        <div className="team-summary">

                            <div className="team-summary-card">

                                <Users size={24} />

                                <div>
                                    <span>
                                        Victims Waiting
                                    </span>

                                    <strong>
                                        {victims.length}
                                    </strong>
                                </div>

                            </div>

                            <div className="team-summary-card">

                                <AlertTriangle size={24} />

                                <div>
                                    <span>
                                        Critical Cases
                                    </span>

                                    <strong>
                                        {
                                            victims.filter(
                                                (victim) =>
                                                    victim.condition ===
                                                    "Critical"
                                            ).length
                                        }
                                    </strong>
                                </div>

                            </div>

                            <div className="team-summary-card">

                                <Activity size={24} />

                                <div>
                                    <span>
                                        Data Structure
                                    </span>

                                    <strong>
                                        Linked List
                                    </strong>
                                </div>

                            </div>

                        </div>

                        <div className="panel team-panel">

                            <div className="panel-header">

                                <div>

                                    <h3>
                                        Victim List
                                    </h3>

                                    <p>
                                        Each victim is stored as a node
                                        in the Linked List
                                    </p>

                                </div>

                                <span className="count">
                                    {victims.length}
                                </span>

                            </div>

                            {victims.length === 0 ? (

                                <div className="empty-state">

                                    <Users size={45} />

                                    <h3>
                                        No victims registered
                                    </h3>

                                    <p>
                                        Add a victim to the rescue list.
                                    </p>

                                </div>

                            ) : (

                                <div className="team-list">

                                    {victims.map((victim, index) => (

                                        <div
                                            className="team-card"
                                            key={
                                                victim.victimId ||
                                                index
                                            }
                                        >

                                            <div className="team-number">
                                                #{index + 1}
                                            </div>

                                            <div className="team-info">

                                                <div className="team-title">

                                                    <strong>
                                                        {victim.name ||
                                                            victim.victimId}
                                                    </strong>

                                                    <span
                                                        className={
                                                            victim.condition ===
                                                            "Critical"
                                                                ? "critical-badge"
                                                                : "available-badge"
                                                        }
                                                    >
                                                        {victim.condition ||
                                                            "Unknown"}
                                                    </span>

                                                </div>

                                                <div className="team-details">

                                                    <span>
                                                        ID:{" "}
                                                        {victim.victimId}
                                                    </span>

                                                    <span>
                                                        Age:{" "}
                                                        {victim.age ||
                                                            "N/A"}
                                                    </span>

                                                    <span>
                                                        Location:{" "}
                                                        {victim.location ||
                                                            "Unknown"}
                                                    </span>

                                                </div>

                                            </div>

                                            <button
                                                className="rescue-button"
                                                onClick={() =>
                                                    removeVictim(
                                                        victim.victimId
                                                    )
                                                }
                                            >
                                                <Trash2 size={17} />
                                                Rescued
                                            </button>

                                        </div>

                                    ))}

                                </div>

                            )}

                        </div>

                        {showVictimForm && (

                            <div className="modal-overlay">

                                <div className="team-modal">

                                    <div className="modal-header">

                                        <div>

                                            <h2>
                                                Register Victim
                                            </h2>

                                            <p>
                                                Add victim to the Linked List
                                            </p>

                                        </div>

                                        <button
                                            className="close-button"
                                            onClick={() =>
                                                setShowVictimForm(false)
                                            }
                                        >
                                            <X size={20} />
                                        </button>

                                    </div>

                                    <form onSubmit={addVictim}>

                                        <label>
                                            Victim ID

                                            <input
                                                type="text"
                                                placeholder="V001"
                                                value={
                                                    victimForm.victimId
                                                }
                                                onChange={(event) =>
                                                    setVictimForm({
                                                        ...victimForm,
                                                        victimId:
                                                            event.target.value
                                                    })
                                                }
                                                required
                                            />
                                        </label>

                                        <label>
                                            Name

                                            <input
                                                type="text"
                                                placeholder="Rahul Sharma"
                                                value={
                                                    victimForm.name
                                                }
                                                onChange={(event) =>
                                                    setVictimForm({
                                                        ...victimForm,
                                                        name:
                                                            event.target.value
                                                    })
                                                }
                                                required
                                            />
                                        </label>

                                        <label>
                                            Age

                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="25"
                                                value={
                                                    victimForm.age
                                                }
                                                onChange={(event) =>
                                                    setVictimForm({
                                                        ...victimForm,
                                                        age:
                                                            event.target.value
                                                    })
                                                }
                                            />
                                        </label>

                                        <label>
                                            Location

                                            <input
                                                type="text"
                                                placeholder="Area B"
                                                value={
                                                    victimForm.location
                                                }
                                                onChange={(event) =>
                                                    setVictimForm({
                                                        ...victimForm,
                                                        location:
                                                            event.target.value
                                                    })
                                                }
                                                required
                                            />
                                        </label>

                                        <label>
                                            Condition

                                            <select
                                                value={
                                                    victimForm.condition
                                                }
                                                onChange={(event) =>
                                                    setVictimForm({
                                                        ...victimForm,
                                                        condition:
                                                            event.target.value
                                                    })
                                                }
                                            >
                                                <option>
                                                    Injured
                                                </option>

                                                <option>
                                                    Critical
                                                </option>

                                                <option>
                                                    Safe
                                                </option>

                                                <option>
                                                    Missing
                                                </option>

                                            </select>

                                        </label>

                                        <button
                                            className="primary-button submit-team"
                                            type="submit"
                                        >
                                            <Plus size={18} />
                                            Add Victim
                                        </button>

                                    </form>

                                </div>

                            </div>

                        )}

                    </div>

                )}

                {/* ================= SUPPLIES ================= */}

                {page === "Supplies" && (() => {
                    const supplies = Object.values(supplyHash);
                    const filteredSupplies = supplies.filter((item) =>
                        `${item.name} ${item.category}`.toLowerCase().includes(supplySearch.toLowerCase())
                    );
                    const totalUnits = supplies.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
                    const lowStockItems = supplies.filter((item) => Number(item.quantity) <= Number(item.lowStockAt));

                    const saveSupply = async (event) => {
                        event.preventDefault();
                        const name = supplyForm.name.trim();
                        const quantity = Number(supplyForm.quantity);
                        const threshold = Number(supplyForm.lowStockAt);
                        if (!name || !Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(threshold) || threshold < 0) {
                            setSupplyNotice("Enter a valid supply name, whole-number quantity, and low-stock threshold.");
                            return;
                        }
                        try {
                            const response = await authorizedFetch(`${API_BASE_URL}/api/supplies/add`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    name,
                                    category: supplyForm.category,
                                    quantity,
                                    unit: supplyForm.unit.trim() || "units",
                                    lowStockAt: threshold
                                })
                            });
                            const data = await response.json();
                            if (!response.ok) throw new Error(data.message || "Unable to save supply");
                            await Promise.all([fetchSupplies(), fetchHistory()]);
                            setSupplyNotice(data.message || `${name} stock updated successfully.`);
                            setSupplyForm({ name: "", category: "Food", quantity: "", unit: "units", lowStockAt: "5" });
                            setShowSupplyForm(false);
                        } catch (error) {
                            setSupplyNotice(error.message || "Unable to save supply.");
                        }
                    };

                    const distributeSupply = async (item) => {
                        const raw = window.prompt(`How many ${item.unit} of ${item.name} should be distributed?`);
                        if (raw === null) return;
                        const amount = Number(raw);
                        if (!Number.isInteger(amount) || amount <= 0) {
                            setSupplyNotice("Enter a whole number greater than zero.");
                            return;
                        }
                        try {
                            const response = await authorizedFetch(`${API_BASE_URL}/api/supplies/${item.id}/distribute`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ quantity: amount })
                            });
                            const data = await response.json();
                            if (!response.ok) throw new Error(data.message || "Unable to distribute supplies");
                            await Promise.all([fetchSupplies(), fetchHistory()]);
                            setSupplyNotice(data.message || `${amount} ${item.unit} of ${item.name} distributed.`);
                        } catch (error) {
                            setSupplyNotice(error.message || "Unable to distribute supplies.");
                        }
                    };

                    const removeSupply = async (item) => {
                        if (!window.confirm(`Remove ${item.name} from the inventory?`)) return;
                        try {
                            const response = await authorizedFetch(`${API_BASE_URL}/api/supplies/${item.id}`, { method: "DELETE" });
                            const data = await response.json();
                            if (!response.ok) throw new Error(data.message || "Unable to remove supply");
                            await Promise.all([fetchSupplies(), fetchHistory()]);
                            setSupplyNotice(data.message || `${item.name} removed from inventory.`);
                        } catch (error) {
                            setSupplyNotice(error.message || "Unable to remove supply.");
                        }
                    };

                    return (
                        <div className="resq-module">
                            <div className="page-heading">
                                <div>
                                    <h2>Relief Supplies</h2>
                                    <p>Manage relief inventory, restock items, and record distributions.</p>
                                </div>
                                <div className="team-actions">
                                    <button className="secondary-button" onClick={() => { setSupplyNotice(""); setSupplySearch(""); }}>Clear filters</button>
                                    <button className="primary-button" onClick={() => { setSupplyNotice(""); setShowSupplyForm(true); }}>
                                        <Plus size={18} /> Add / Restock
                                    </button>
                                </div>
                            </div>

                            {supplyNotice && (
                                <div role="status" style={{ marginBottom: 16, padding: "11px 14px", borderRadius: 10, background: "rgba(20,184,166,.10)", border: "1px solid rgba(45,212,191,.25)", color: "#99f6e4", fontSize: 13 }}>
                                    {supplyNotice}
                                </div>
                            )}

                            <div className="team-summary">
                                <div className="team-summary-card"><Package size={24} /><div><span>Inventory Items</span><strong>{supplies.length}</strong></div></div>
                                <div className="team-summary-card"><Activity size={24} /><div><span>Total Stock Units</span><strong>{totalUnits.toLocaleString()}</strong></div></div>
                                <div className="team-summary-card"><AlertTriangle size={24} /><div><span>Low Stock Alerts</span><strong style={{ color: lowStockItems.length ? "#f97316" : "#22c55e" }}>{lowStockItems.length}</strong></div></div>
                            </div>

                            <div className="panel team-panel">
                                <div className="panel-header">
                                    <div><h3><Package size={19} /> Inventory</h3><p>Item lookup uses a hash-table-style key based on the supply name.</p></div>
                                    <span className="count">{filteredSupplies.length} items</span>
                                </div>
                                <div style={{ padding: "0 20px 18px" }}>
                                    <input
                                        aria-label="Search supplies"
                                        value={supplySearch}
                                        onChange={(event) => setSupplySearch(event.target.value)}
                                        placeholder="Search by supply name or category..."
                                        style={{ width: "100%", maxWidth: 440, padding: "11px 13px", borderRadius: 9, border: "1px solid rgba(148,163,184,.28)", background: "rgba(15,23,42,.65)", color: "inherit" }}
                                    />
                                </div>
                                {filteredSupplies.length === 0 ? (
                                    <div className="empty-state"><Package size={42} /><h3>No supplies found</h3><p>Add an item or try a different search.</p></div>
                                ) : (
                                    <div className="team-list" style={{ padding: "0 20px 20px" }}>
                                        {filteredSupplies.map((item) => {
                                            const low = Number(item.quantity) <= Number(item.lowStockAt);
                                            return (
                                                <div className="team-card" key={item.id}>
                                                    <div className="team-number"><Package size={18} /></div>
                                                    <div className="team-info">
                                                        <div className="team-title">
                                                            <strong>{item.name}</strong>
                                                            <span className={low ? "critical-badge" : "available-badge"}>{low ? "Low stock" : "In stock"}</span>
                                                        </div>
                                                        <div className="team-details">
                                                            <span>Category: {item.category}</span>
                                                            <span>Quantity: <strong>{item.quantity} {item.unit}</strong></span>
                                                            <span>Alert threshold: {item.lowStockAt} {item.unit}</span>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                                        <button className="primary-button" onClick={() => distributeSupply(item)} disabled={Number(item.quantity) <= 0}>Distribute</button>
                                                        <button className="secondary-button" onClick={() => removeSupply(item)} aria-label={`Remove ${item.name}`}><Trash2 size={16} /></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {lowStockItems.length > 0 && (
                                <div className="panel" style={{ marginTop: 18, padding: 18, border: "1px solid rgba(249,115,22,.3)" }}>
                                    <h3 style={{ display: "flex", alignItems: "center", gap: 8, color: "#fb923c" }}><AlertTriangle size={19} /> Restock required</h3>
                                    <p style={{ color: "#aeb8c7", marginBottom: 0 }}>{lowStockItems.map((item) => `${item.name} (${item.quantity} ${item.unit})`).join(" · ")}</p>
                                </div>
                            )}

                            {showSupplyForm && (
                                <div className="modal-overlay">
                                    <div className="team-modal">
                                        <div className="modal-header">
                                            <div><h2>Add / Restock Supply</h2><p>Existing item names add to the current stock.</p></div>
                                            <button className="close-button" type="button" onClick={() => setShowSupplyForm(false)}><X size={20} /></button>
                                        </div>
                                        <form onSubmit={saveSupply}>
                                            <label>Supply name<input value={supplyForm.name} onChange={(event) => setSupplyForm({ ...supplyForm, name: event.target.value })} placeholder="e.g. Drinking Water" required /></label>
                                            <label>Category<select value={supplyForm.category} onChange={(event) => setSupplyForm({ ...supplyForm, category: event.target.value })}><option>Food</option><option>Water</option><option>Medical</option><option>Shelter</option><option>Rescue Equipment</option><option>Other</option></select></label>
                                            <label>Quantity to add<input type="number" min="0" step="1" value={supplyForm.quantity} onChange={(event) => setSupplyForm({ ...supplyForm, quantity: event.target.value })} required /></label>
                                            <label>Unit<input value={supplyForm.unit} onChange={(event) => setSupplyForm({ ...supplyForm, unit: event.target.value })} placeholder="bottles, packs, kits..." required /></label>
                                            <label>Low-stock threshold<input type="number" min="0" step="1" value={supplyForm.lowStockAt} onChange={(event) => setSupplyForm({ ...supplyForm, lowStockAt: event.target.value })} required /></label>
                                            <button className="primary-button submit-team" type="submit"><Plus size={18} /> Save supply</button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* ================= HISTORY ================= */}

                {page === "History" && (
                    <div className="resq-module">
                        <div className="page-heading">
                            <div><h2>Rescue History</h2><p>Review emergency records and persisted supply actions.</p></div>
                            <div className="team-actions">
                                <button className="secondary-button" onClick={fetchEmergencies}>Refresh emergencies</button>
                                <button className="secondary-button" onClick={async () => {
                                    if (!window.confirm("Permanently clear the saved supply action history?")) return;
                                    try {
                                        const response = await authorizedFetch(`${API_BASE_URL}/api/history/supply-actions`, { method: "DELETE" });
                                        const data = await response.json();
                                        if (!response.ok) throw new Error(data.message || "Unable to clear history");
                                        setHistoryStack([]);
                                    } catch (error) {
                                        window.alert(error.message || "Unable to clear history.");
                                    }
                                }} disabled={historyStack.length === 0}>Clear action log</button>
                            </div>
                        </div>

                        <div className="team-summary">
                            <div className="team-summary-card"><Clock size={24} /><div><span>Logged Actions</span><strong>{historyStack.length}</strong></div></div>
                            <div className="team-summary-card"><AlertTriangle size={24} /><div><span>Active Emergencies</span><strong>{emergencies.filter((item) => item.status !== "Resolved").length}</strong></div></div>
                            <div className="team-summary-card"><CheckCircle size={24} /><div><span>Resolved Emergencies</span><strong>{emergencies.filter((item) => item.status === "Resolved").length}</strong></div></div>
                        </div>

                        <div className="panel team-panel">
                            <div className="panel-header">
                                <div><h3><Clock size={19} /> Emergency Records</h3><p>Current emergency records returned by the backend.</p></div>
                                <span className="count">{emergencies.length}</span>
                            </div>
                            {emergencies.length === 0 ? (
                                <div className="empty-state"><Clock size={42} /><h3>No emergency records yet</h3><p>Emergency reports will appear here when they are available.</p></div>
                            ) : (
                                <div className="team-list" style={{ padding: "0 20px 20px" }}>
                                    {[...emergencies].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)).map((item, index) => (
                                        <div className="team-card" key={item._id || item.emergencyId || index}>
                                            <div className="team-number">#{index + 1}</div>
                                            <div className="team-info">
                                                <div className="team-title"><strong>{item.emergencyId || item._id || `Emergency ${index + 1}`}</strong><span className={item.status === "Resolved" ? "available-badge" : item.status === "Dispatched" ? "available-badge" : "critical-badge"}>{item.status || "Reported"}</span></div>
                                                <div className="team-details">
                                                    <span>Type: {item.disasterType || item.cause || item.emergencyType || "Not specified"}</span>
                                                    <span>Location: {item.location || "Not specified"}</span>
                                                    <span>People affected: {item.peopleTrapped ?? item.people ?? item.peopleAffected ?? "Not specified"}</span>
                                                    <span>Priority: {item.priority ?? item.severity ?? "Not specified"}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="panel team-panel" style={{ marginTop: 20 }}>
                            <div className="panel-header">
                                <div><h3><Activity size={19} /> Recent Action Stack</h3><p>Newest actions are shown first (stack-style history log).</p></div>
                                <span className="count">{historyStack.length}</span>
                            </div>
                            {historyStack.length === 0 ? (
                                <div className="empty-state"><Activity size={40} /><h3>No actions logged yet</h3><p>Adding, restocking, distributing, or removing supplies will create entries here.</p></div>
                            ) : (
                                <div className="team-list" style={{ padding: "0 20px 20px" }}>
                                    {historyStack.map((entry, index) => (
                                        <div className="team-card" key={entry.id}>
                                            <div className="team-number">#{index + 1}</div>
                                            <div className="team-info">
                                                <div className="team-title"><strong>{entry.action}</strong><span className="available-badge">{entry.type}</span></div>
                                                <div className="team-details"><span>{entry.details}</span><span>{new Date(entry.timestamp).toLocaleString()}</span></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </main>

            {/* ================= SOS MODAL ================= */}

            {showSOS && (

                <div className="sos-overlay">

                    <div className="sos-modal">

                        {!sosSent ? (

                            <>

                                <div className="sos-header">

                                    <div className="sos-icon">
                                        <Siren size={30} />
                                    </div>

                                    <button
                                        className="sos-close"
                                        onClick={closeSOS}
                                        disabled={sendingSOS}
                                    >
                                        <X size={20} />
                                    </button>

                                </div>

                                <h2>
                                    Send Emergency SOS
                                </h2>

                                <p className="sos-description">
                                    Send your location and emergency
                                    information to the rescue team.
                                </p>

                                <div className="sos-form">

                                    <label>
                                        Cause of Emergency

                                        <select
                                            value={sosForm.cause}
                                            onChange={(event) =>
                                                setSosForm({
                                                    ...sosForm,
                                                    cause:
                                                        event.target.value
                                                })
                                            }
                                        >
                                            <option>
                                                Flood
                                            </option>

                                            <option>
                                                Earthquake
                                            </option>

                                            <option>
                                                Landslide
                                            </option>

                                            <option>
                                                Cyclone
                                            </option>

                                            <option>
                                                Fire
                                            </option>

                                            <option>
                                                Medical Emergency
                                            </option>

                                            <option>
                                                Trapped / Rescue Needed
                                            </option>

                                            <option>
                                                Other
                                            </option>

                                        </select>

                                    </label>

                                    <label>
                                        Number of People

                                        <input
                                            type="number"
                                            min="1"
                                            value={sosForm.people}
                                            onChange={(event) =>
                                                setSosForm({
                                                    ...sosForm,
                                                    people:
                                                        Number(
                                                            event.target.value
                                                        )
                                                })
                                            }
                                        />

                                    </label>

                                    <div className="location-box">

                                        <MapPin size={20} />

                                        <div>

                                            <strong>
                                                Location
                                            </strong>

                                            <p>
                                                {locationStatus ||
                                                    "Your current location will be shared automatically."}
                                            </p>

                                        </div>

                                    </div>

                                    <button
                                        className="send-sos-button"
                                        onClick={sendSOS}
                                        disabled={sendingSOS}
                                    >

                                        <Siren size={21} />

                                        {sendingSOS
                                            ? "SENDING SOS..."
                                            : "SEND SOS"}

                                    </button>

                                    <p className="sos-warning">
                                        Only press SOS when emergency
                                        assistance is required.
                                    </p>

                                </div>

                            </>

                        ) : (

                            <div className="sos-success">

                                <div className="success-icon">
                                    <CheckCircle size={55} />
                                </div>

                                <h2>
                                    SOS Sent Successfully
                                </h2>

                                <p>
                                    Rescue teams have received your
                                    emergency signal.
                                </p>

                                <div className="success-details">

                                    <div>
                                        <span>Cause</span>
                                        <strong>
                                            {sosForm.cause}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>People</span>
                                        <strong>
                                            {sosForm.people}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>Status</span>
                                        <strong>
                                            Rescue notified
                                        </strong>
                                    </div>

                                </div>

                                <button
                                    className="close-success"
                                    onClick={closeSOS}
                                >
                                    Close
                                </button>

                            </div>

                        )}

                    </div>

                </div>

            )}

        </div>
    );
}

export default App;
