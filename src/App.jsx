import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";

import "leaflet/dist/leaflet.css";
import "./App.css";

const API = "https://nwis-26121-backend.onrender.com";

function App() {

  // =========================================================
  // AUTHENTICATION
  // =========================================================

  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // =========================================================
  // LOGIN
  // =========================================================

  const handleLogin = async (e) => {
    e.preventDefault();

    setLoginError("");

    if (!username || !password) {
      setLoginError("Please enter username and password.");
      return;
    }

    try {
      setLoginLoading(true);

      const response = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setLoginError(
          data.detail ||
            data.message ||
            "Invalid username or password."
        );
        return;
      }

      setIsLoggedIn(true);
      setUsername("");
      setPassword("");
      setLoginError("");
    }  catch (error) { 
      console.error("Login error:", error);

      setLoginError(
        "Unable to connect to server. Make sure FastAPI is running."
      );
    } finally {
      setLoginLoading(false);
    }
  };

  // =========================================================
  // LOGOUT
  // =========================================================

  const handleLogout = () => {
    setIsLoggedIn(false);
    setActivePage("Dashboard");

    setWells([]);
    setIntelligence(null);
    setRiskData(null);

    setUsername("");
    setPassword("");
    setLoginError("");
  };

  // =========================================================
  // MAIN APP STATE
  // =========================================================

  const [activePage, setActivePage] = useState("Dashboard");

  const [wells, setWells] = useState([]);
  const [intelligence, setIntelligence] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [selectedWell, setSelectedWell] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reportSummary, setReportSummary] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState(null);
const [aiLoading, setAiLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [riskLoading, setRiskLoading] = useState(true);

  // =========================================================
  // LOAD DATA FROM FASTAPI
  // =========================================================

  const loadAIInsight = async () => {
  setAiLoading(true);

  try {
    const response = await fetch(`${API}/api/ai/insight`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        well_id: "W-A042",
      }),
    });

    const data = await response.json();

    console.log("AI INSIGHT:", data);

    if (data.success) {
      setAiInsight(data);
    }

  } catch (error) {
    console.error("AI Insight Error:", error);
  } finally {
    setAiLoading(false);
  }
};

  useEffect(() => {
    if (!isLoggedIn) {
      return;
    }

    async function loadData() {
      try {
        // -----------------------------------------------------
        // WELLS
        // -----------------------------------------------------

        const wellsResponse = await fetch(
          `${API}/api/wells`
        );

        const wellsData =
          await wellsResponse.json();

        setWells(wellsData.wells || []);

        // -----------------------------------------------------
        // WELL INTELLIGENCE
        // -----------------------------------------------------

        const intelligenceResponse =
          await fetch(
            `${API}/api/wells/W-A042/intelligence`
          );

        const intelligenceData =
          await intelligenceResponse.json();

        console.log(
          "INTELLIGENCE:",
          intelligenceData
        );

        setIntelligence(intelligenceData);

        // -----------------------------------------------------
        // ML RISK SCORE
        // -----------------------------------------------------

        const riskResponse =
          await fetch(
            `${API}/api/wells/W-A042/risk`
          );

        const riskResult =
          await riskResponse.json();

        console.log(
          "ML RISK:",
          riskResult
        );

        setRiskData(riskResult);
        loadAIInsight();

      } catch (error) {
        console.error(
          "Backend connection error:",
          error
        );
      } finally {
        setLoading(false);
        setRiskLoading(false);
      }
    }

    loadData();

  }, [isLoggedIn]);

  // =========================================================
  // SEARCH + REPORT / RAG HELPERS
  // =========================================================

  const searchText = searchQuery.trim().toLowerCase();

  const filteredWells = searchText
    ? wells.filter((well) =>
        [well.id, well.name, well.formation, well.status]
          .some((value) => String(value ?? "").toLowerCase().includes(searchText))
      )
    : [];

  const filteredEvents = searchText
    ? (intelligence?.nearby_events || []).filter((event) =>
        [event.event, event.well_id, event.depth, event.severity]
          .some((value) => String(value ?? "").toLowerCase().includes(searchText))
      )
    : [];

  const generateReportSummary = async () => {
    setReportLoading(true);

    try {
      const events = intelligence?.nearby_events || [];
      const eventText = events.length
        ? events.map((event) =>
            `${event.event} in ${event.well_id} at ${event.depth} m (${event.severity})`
          ).join("; ")
        : "No historical events found in the upcoming interval.";

      const groundedInsight = aiInsight?.insight
        ? aiInsight.insight.replace(/\s+/g, " ").trim()
        : "AI insight not available.";

      setReportSummary(
        `NWIS DRILLING RISK REPORT\n\n` +
        `Well: ${intelligence?.well_name || "W-A042"}\n` +
        `Formation: ${intelligence?.formation || "N/A"}\n` +
        `Current Depth: ${intelligence?.current_depth ?? "N/A"} m\n` +
        `Upcoming Interval: ${riskData?.upcoming_interval || intelligence?.upcoming_interval || "N/A"}\n` +
        `ML Risk Score: ${riskData?.risk_score ?? "N/A"}\n` +
        `Risk Level: ${riskData?.risk_level || "N/A"}\n\n` +
        `RETRIEVED HISTORICAL EVIDENCE (RAG):\n${eventText}\n\n` +
        `AI / GROUNDED INSIGHT:\n${groundedInsight}`
      );
    } finally {
      setReportLoading(false);
    }
  };

  const copyReport = async () => {
    if (!reportSummary) return;
    try {
      await navigator.clipboard.writeText(reportSummary);
      alert("Report summary copied.");
    } catch (error) {
      console.error("Copy report error:", error);
    }
  };

  // =========================================================
  // MENU
  // =========================================================

  const menuItems = [
    "Dashboard",
    "Nearby Wells",
    "Well Intelligence",
    "Risk Alerts",
    "Analytics",
  ];

  // =========================================================
  // DASHBOARD
  // =========================================================

  const renderDashboard = () => {
    return (
      <section className="content">

        {/* Welcome */}

        <div className="welcome">

          <div>
            <p className="eyebrow">
              CURRENT OPERATION
            </p>

            <h2>
              Well-A042
            </h2>

            <p>
              Offset-well intelligence and historical
              drilling analysis
            </p>
          </div>

          <div className="well-status">
            <span></span>
            Active Drilling
          </div>

        </div>


        {/* Statistics */}

        <div className="stats-grid">

          {/* Current Depth */}

          <div className="stat-card">

            <div className="stat-top">
              <span>
                Current Depth
              </span>

              <div className="stat-icon blue">
                ↓
              </div>
            </div>

            <h3>
              {intelligence?.current_depth || 2820}
              <small> m</small>
            </h3>

            <p>
              +42 m today
            </p>

          </div>


          {/* Nearby Wells */}

          <div className="stat-card">

            <div className="stat-top">
              <span>
                Nearby Wells
              </span>

              <div className="stat-icon purple">
                ◉
              </div>
            </div>

            <h3>
              {wells.length}
            </h3>

            <p>
              Within 10 km radius
            </p>

          </div>


          {/* Historical Events */}

          <div className="stat-card">

            <div className="stat-top">
              <span>
                Historical Events
              </span>

              <div className="stat-icon orange">
                ◈
              </div>
            </div>

            <h3>
              {intelligence?.nearby_events?.length || 0}
            </h3>

            <p>
              Matched historical events
            </p>

          </div>


          {/* ML Risk Score */}

          <div className="stat-card risk-stat">

            <div className="stat-top">
              <span>
                ML Risk Score
              </span>

              <div className="stat-icon red">
                ⚠
              </div>
            </div>

            <h3>
              {riskLoading
                ? "..."
                : riskData?.risk_score ?? "--"}
            </h3>

            <p>
              {riskLoading
                ? "Analyzing..."
                : riskData?.risk_level
                ? `Risk Level: ${riskData.risk_level}`
                : "No risk data"}
            </p>

          </div>

        </div>


        {/* MAP + ALERTS */}

        <div className="dashboard-grid">

          {/* Map */}

          <div className="panel">

            <div className="panel-header">

              <div>
                <h3>
                  Nearby Wells
                </h3>

                <p>
                  Offset wells around current drilling
                  location
                </p>
              </div>

              <button
                className="outline-btn"
                onClick={() =>
                  setActivePage("Nearby Wells")
                }
              >
                View All
              </button>

            </div>


            <div className="real-map">

              <MapContainer
                center={[23.2605, 77.4145]}
                zoom={12}
                style={{
                  height: "100%",
                  width: "100%",
                }}
              >

                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {wells.map((well) => (

                  <Marker
                    key={well.id}
                    position={[
                      well.latitude,
                      well.longitude,
                    ]}
                  >

                    <Popup>

                      <div className="well-popup">

                        <h3>
                          {well.name}
                        </h3>

                        <div className="popup-row">
                          <span>
                            Depth
                          </span>

                          <strong>
                            {well.depth} m
                          </strong>
                        </div>

                        <div className="popup-row">
                          <span>
                            Formation
                          </span>

                          <strong>
                            {well.formation}
                          </strong>
                        </div>

                        <div className="popup-row">
                          <span>
                            Status
                          </span>

                          <strong>
                            {well.status}
                          </strong>
                        </div>

                      </div>

                    </Popup>

                  </Marker>

                ))}

              </MapContainer>


              <div className="map-legend">

                <div>
                  <span className="legend-dot current"></span>
                  Current Well
                </div>

                <div>
                  <span className="legend-dot offset"></span>
                  Offset Wells
                </div>

              </div>

            </div>

          </div>


          {/* Risk Alerts */}

          <div className="panel">

            <div className="panel-header">

              <div>

                <h3>
                  Risk Alerts
                </h3>

                <p>
                  Historical risks requiring attention
                </p>

              </div>

              <span className="alert-count">
                {intelligence?.nearby_events?.length || 0}
              </span>

            </div>


            {intelligence?.nearby_events?.length ? (

              intelligence.nearby_events.map(
                (event, index) => (

                  <div
                    className={`alert-item ${
                      event.severity === "HIGH"
                        ? "high"
                        : event.severity === "MEDIUM"
                        ? "medium"
                        : "low"
                    }`}
                    key={`${event.well_id}-${index}`}
                  >

                    <div className="alert-symbol">
                      ⚠
                    </div>

                    <div>

                      <strong>
                        {event.event}
                      </strong>

                      <p>
                        Well {event.well_id} ·{" "}
                        {event.depth} m
                      </p>

                      <small>
                        Severity: {event.severity}
                      </small>

                    </div>

                  </div>

                )

              )

            ) : (

              <p className="empty-message">
                No active risk alerts.
              </p>

            )}


            <button
              className="view-alerts"
              onClick={() =>
                setActivePage("Risk Alerts")
              }
            >
              View All Alerts →
            </button>

          </div>

        </div>

        {/* =====================================================
    AI DRILLING INSIGHT
===================================================== */}

{/* =====================================================
    RISK ALERT
===================================================== */}

{riskData && (
  <div className="risk-alert-card">

    <div className="risk-alert-left">

      <div className="risk-alert-icon">
        ⚠
      </div>

      <div>

        <p className="risk-alert-label">
          ML RISK ALERT
        </p>

        <h3>
          {riskData.risk_level === "HIGH"
            ? "High Risk Detected"
            : riskData.risk_level === "MEDIUM"
            ? "Moderate Risk Detected"
            : "Low Risk"}
        </h3>

        <p className="risk-alert-text">
  {riskLoading
    ? "Analyzing drilling risk..."
    : riskData?.upcoming_interval
      ? `Upcoming drilling interval: ${riskData.upcoming_interval}`
      : "Risk assessment unavailable"}
</p>

      </div>

    </div>


    <div className="risk-alert-score">

      <span>
        Risk Score
      </span>

      <strong>
        {riskLoading
          ? "..."
          : riskData.risk_score ?? "--"}
      </strong>

      <small>
        ML assessment
      </small>

    </div>

  </div>
)}

<div className="panel ai-insight-panel">

  <div className="panel-header">

    <div>

      <p className="eyebrow">
        AI-POWERED INSIGHT
      </p>

      <h3>
        Drilling Risk Insight
      </h3>

      <p>
        AI-generated analysis based on ML risk
        assessment and historical well events
      </p>

    </div>

    <span
      className={`ai-risk-badge ${
        aiInsight?.risk_level === "HIGH"
          ? "high"
          : aiInsight?.risk_level === "MEDIUM"
          ? "medium"
          : "low"
      }`}
    >
      {aiLoading
        ? "ANALYZING..."
        : aiInsight?.risk_level || "ANALYZING"}
    </span>

  </div>


  {aiLoading ? (

    <div className="ai-loading">
      Generating drilling insight...
    </div>

  ) : aiInsight ? (

    <div className="ai-insight-content">

      {/* Risk Summary */}

      <div className="ai-section">

        <span className="ai-section-title">
          RISK SUMMARY
        </span>

        <p>
          ML risk assessment indicates a{" "}
          <strong>
            {aiInsight.risk_level}
          </strong>{" "}
          risk level with a risk score of{" "}
          <strong>
            {aiInsight.risk_score}
          </strong>.
        </p>

      </div>


      {/* Historical Evidence */}

      <div className="ai-section">

        <span className="ai-section-title">
          HISTORICAL EVIDENCE
        </span>

        {aiInsight.historical_events?.length > 0 ? (

          aiInsight.historical_events.map(
            (event, index) => (

              <p key={index}>
                <strong>
                  {event.event}
                </strong>{" "}
                was recorded in offset well{" "}
                <strong>
                  {event.well_id}
                </strong>{" "}
                at{" "}
                <strong>
                  {event.depth} m
                </strong>{" "}
                ({event.severity} severity).
              </p>

            )
          )

        ) : (

          <p>
            No historical events were found in
            the upcoming drilling interval.
          </p>

        )}

      </div>


      {/* AI Insight */}

      <div className="ai-main-insight">

  <span className="ai-section-title">
    RECOMMENDED MONITORING
  </span>

  <p>
    {aiInsight.insight
      ?.split("RECOMMENDED MONITORING")[1]
      ?.split("OPERATIONAL INSIGHT")[0]
      ?.trim()
      || "Increase monitoring of relevant drilling parameters and review historical risk events before entering the upcoming interval."}
  </p>

</div>


<div className="ai-section ai-operational">

  <span className="ai-section-title">
    OPERATIONAL INSIGHT
  </span>

  <p>
    {aiInsight.insight
      ?.split("OPERATIONAL INSIGHT")[1]
      ?.trim()
      || "Monitor the upcoming drilling interval based on historical evidence."}
  </p>

</div>
    </div>

  ) : (

    <div className="ai-loading">
      AI insight unavailable.
    </div>

  )}

</div>


        {/* QUICK REPORT */}

        <div className="panel report-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">RAG + REPORT SUMMARY</p>
              <h3>Generate Grounded Drilling Report</h3>
              <p>Uses retrieved historical events, ML risk assessment and AI insight.</p>
            </div>
            <button
              className="primary-btn"
              onClick={generateReportSummary}
              disabled={reportLoading}
            >
              {reportLoading ? "Generating..." : "Generate Report"}
            </button>
          </div>
          {reportSummary && (
            <div className="report-summary-box">
              <pre>{reportSummary}</pre>
              <button className="outline-btn" onClick={copyReport}>Copy Report</button>
            </div>
          )}
        </div>

        {/* BOTTOM PANELS */}

        <div className="bottom-grid">

          {/* Historical Events */}

          <div className="panel">

            <div className="panel-header">

              <div>

                <h3>
                  Recent Historical Events
                </h3>

                <p>
                  Events from nearby offset wells
                </p>

              </div>

              <button
                className="text-btn"
                onClick={() =>
                  setActivePage("Well Intelligence")
                }
              >
                View Intelligence →
              </button>

            </div>


            {intelligence?.nearby_events?.map(
              (event, index) => (

                <div
                  className="event-row"
                  key={`${event.well_id}-${index}`}
                >

                  <div className="event-depth">
                    {event.depth} m
                  </div>

                  <div className="event-info">

                    <strong>
                      {event.event}
                    </strong>

                    <span>
                      Offset Well {event.well_id}
                    </span>

                  </div>

                  <span
                    className={`severity ${
                      event.severity === "HIGH"
                        ? "high-severity"
                        : event.severity === "MEDIUM"
                        ? "medium-severity"
                        : "low-severity"
                    }`}
                  >
                    {event.severity}
                  </span>

                </div>

              )
            )}

          </div>


          {/* Well Intelligence */}

          <div className="panel">

            <div className="panel-header">

              <div>

                <h3>
                  Well Intelligence
                </h3>

                <p>
                  Current formation analysis
                </p>

              </div>

            </div>


            <div className="formation">

              <div>

                <span>
                  Current Formation
                </span>

                <strong>
                  {intelligence?.formation ||
                    "ABC Formation"}
                </strong>

              </div>

              <div className="formation-depth">

                <span>
                  Depth
                </span>

                <strong>
                  {intelligence?.current_depth ||
                    2820} m
                </strong>

              </div>

            </div>


            <div className="intelligence-message">

              <span>
                {intelligence?.historical_match
                  ? "⚠"
                  : "✓"}
              </span>

              <div>

                <strong>
                  {intelligence?.historical_match
                    ? "Historical Match Found"
                    : "No Historical Match"}
                </strong>

                <p>
                  {intelligence?.recommendation ||
                    "Analyzing historical well data..."}
                </p>

              </div>

            </div>


            <button
              className="primary-btn"
              onClick={() =>
                setActivePage("Well Intelligence")
              }
            >
              Open Well Intelligence →
            </button>

          </div>

        </div>

      </section>
    );
  };


  // =========================================================
  // NEARBY WELLS
  // =========================================================

  const renderNearbyWells = () => {

    return (
      <section className="nearby-page">

        <div className="nearby-intro">

          <div>

            <p className="eyebrow">
              OFFSET WELL DATA
            </p>

            <h2>
              Nearby Wells
            </h2>

            <p>
              Wells available around the current
              drilling operation
            </p>

          </div>

          <div className="nearby-count">

            <strong>
              {wells.length}
            </strong>

            <span>
              Wells Found
            </span>

          </div>

        </div>


        <div className="nearby-grid">

          {wells.map((well) => (

            <div
              className="well-card"
              key={well.id}
            >

              <div className="well-card-top">

                <div>

                  <span className="well-label">
                    {well.id}
                  </span>

                  <h3>
                    {well.name}
                  </h3>

                </div>

                <span className="well-status-badge">
                  {well.status}
                </span>

              </div>


              <div className="well-details">

                <div>

                  <span>
                    Depth
                  </span>

                  <strong>
                    {well.depth} m
                  </strong>

                </div>

                <div>

                  <span>
                    Formation
                  </span>

                  <strong>
                    {well.formation}
                  </strong>

                </div>
                <button
  className="well-map-btn"
  onClick={() =>
    window.open(
      `https://www.google.com/maps?q=${well.latitude},${well.longitude}`,
      "_blank"
    )
  }
>
  View Location →
</button>
<button
  className="well-details-btn"
  onClick={() => setSelectedWell(well)}
>
  View Details →
</button>

              </div>


              <div className="well-location">
                📍 {well.latitude},{" "}
                {well.longitude}
              </div>

            </div>

          ))}

        </div>

        {/* =====================================================
    SELECTED WELL DETAILS
===================================================== */}

{selectedWell && (

  <div className="well-details-panel">

    <div className="well-details-header">

      <div>

        <p className="eyebrow">
          WELL INFORMATION
        </p>

        <h3>
          {selectedWell.name}
        </h3>

        <span>
          {selectedWell.id}
        </span>

      </div>

      <button
        className="close-details-btn"
        onClick={() => setSelectedWell(null)}
      >
        ✕
      </button>

    </div>


    <div className="well-details-grid">

      <div className="detail-box">

        <span>
          Well ID
        </span>

        <strong>
          {selectedWell.id}
        </strong>

      </div>


      <div className="detail-box">

        <span>
          Depth
        </span>

        <strong>
          {selectedWell.depth} m
        </strong>

      </div>


      <div className="detail-box">

        <span>
          Formation
        </span>

        <strong>
          {selectedWell.formation}
        </strong>

      </div>


      <div className="detail-box">

        <span>
          Status
        </span>

        <strong>
          {selectedWell.status}
        </strong>

      </div>


      <div className="detail-box">

        <span>
          Latitude
        </span>

        <strong>
          {selectedWell.latitude}
        </strong>

      </div>


      <div className="detail-box">

        <span>
          Longitude
        </span>

        <strong>
          {selectedWell.longitude}
        </strong>

      </div>

    </div>


    <div className="well-detail-action">

      <button
        className="well-map-btn"
        onClick={() =>
          window.open(
            `https://www.google.com/maps?q=${selectedWell.latitude},${selectedWell.longitude}`,
            "_blank"
          )
        }
      >
        Open Well Location →
      </button>

    </div>

  </div>

)}


        <div className="nearby-map-panel">

          <div className="nearby-map-header">

            <div>

              <h3>
                Well Locations
              </h3>

              <p>
                Geographic distribution of nearby
                wells
              </p>

            </div>

            <span className="map-radius">
              10 km radius
            </span>

          </div>


          <div className="real-map">

            <MapContainer
              center={[23.2605, 77.4145]}
              zoom={12}
              style={{
                height: "100%",
                width: "100%",
              }}
            >

              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {wells.map((well) => (

                <Marker
                  key={well.id}
                  position={[
                    well.latitude,
                    well.longitude,
                  ]}
                >

                  <Popup>

                    <strong>
                      {well.name}
                    </strong>

                    <br />

                    Depth: {well.depth} m

                    <br />

                    Formation: {well.formation}

                  </Popup>

                </Marker>

              ))}

            </MapContainer>

          </div>

        </div>

      </section>
    );
  };


  // =========================================================
  // WELL INTELLIGENCE
  // =========================================================

  const renderIntelligence = () => {

    if (loading) {

      return (
        <section className="intelligence-page">

          <p className="eyebrow">
            AI-POWERED ANALYSIS
          </p>

          <h2>
            Loading Well Intelligence...
          </h2>

        </section>
      );
    }


    if (!intelligence) {

      return (
        <section className="intelligence-page">

          <p className="eyebrow">
            AI-POWERED ANALYSIS
          </p>

          <h2>
            Well Intelligence
          </h2>

          <p>
            Unable to load intelligence data.
            Make sure FastAPI is running.
          </p>

        </section>
      );
    }


    return (
      <section className="intelligence-page">

        <div className="page-intro">

          <div>

            <p className="eyebrow">
              AI-POWERED ANALYSIS
            </p>

            <h2>
              Well Intelligence
            </h2>

            <p>
              Historical offset-well analysis for
              current drilling operations
            </p>

          </div>

          <div className="well-status">
            <span></span>
            Well A042 Active
          </div>

        </div>


        {/* SUMMARY */}

        <div className="intelligence-summary">

          <div className="info-card">

            <span>
              Current Well
            </span>

            <strong>
              {intelligence.well_name}
            </strong>

          </div>


          <div className="info-card">

            <span>
              Formation
            </span>

            <strong>
              {intelligence.formation}
            </strong>

          </div>


          <div className="info-card">

            <span>
              Current Depth
            </span>

            <strong>
              {intelligence.current_depth} m
            </strong>

          </div>


          <div className="info-card">

            <span>
              Upcoming Interval
            </span>

            <strong>
              {intelligence.upcoming_interval}
            </strong>

          </div>

        </div>


        {/* ML RISK */}

        <div className="panel">

          <div className="panel-header">

            <div>

              <p className="eyebrow">
                MACHINE LEARNING
              </p>

              <h3>
                Drilling Risk Assessment
              </h3>

              <p>
                Risk score generated from historical
                drilling events
              </p>

            </div>

          </div>


          <div className="stats-grid">

            <div className="stat-card">

              <span>
                ML Risk Score
              </span>

              <strong>
                {riskLoading
                  ? "..."
                  : riskData?.risk_score ?? "--"}
              </strong>

              <small>
                Score generated by risk engine
              </small>

            </div>


            <div className="stat-card">

              <span>
                Risk Level
              </span>

              <strong>
                {riskLoading
                  ? "Analyzing..."
                  : riskData?.risk_level || "--"}
              </strong>

              <small>
                Current drilling assessment
              </small>

            </div>


            <div className="stat-card">

              <span>
                Matched Events
              </span>

              <strong>
                {riskData?.matched_events?.length || 0}
              </strong>

              <small>
                Historical events matched
              </small>

            </div>

          </div>

        </div>


        {/* HISTORICAL MATCH */}

        <div className="panel intelligence-result">

          <div className="result-header">

            <div>

              <p className="eyebrow">
                HISTORICAL ANALYSIS
              </p>

              <h3>
                Historical Pattern Analysis
              </h3>

            </div>

            <span
              className={`match-badge ${
                intelligence.historical_match
                  ? "warning"
                  : "safe"
              }`}
            >
              {intelligence.historical_match
                ? "MATCH FOUND"
                : "NO MATCH"}
            </span>

          </div>


          <div className="match-content">

            <div className="match-icon">
              {intelligence.historical_match
                ? "⚠"
                : "✓"}
            </div>

            <div>

              <h3>
                {intelligence.historical_match
                  ? "Historical Match Found"
                  : "No Historical Match"}
              </h3>

              <p>
                {intelligence.recommendation}
              </p>

            </div>

          </div>

        </div>


        {/* EVENTS */}

        <div className="panel">

          <div className="panel-header">

            <div>

              <h3>
                Relevant Historical Events
              </h3>

              <p>
                Events detected in nearby
                offset wells
              </p>

            </div>

            <span className="alert-count">
              {intelligence.nearby_events?.length || 0}
            </span>

          </div>


          {intelligence.nearby_events?.map(
            (event, index) => (

              <div
                className="intelligence-event"
                key={`${event.well_id}-${index}`}
              >

                <div>

                  <strong>
                    {event.event}
                  </strong>

                  <span>
                    Offset Well {event.well_id}
                    {" · "}
                    Depth {event.depth} m
                  </span>

                </div>

                <span className="event-risk">
                  {event.severity}
                </span>

              </div>

            )
          )}

        </div>


        {/* ML MATCHED EVENTS */}

        {riskData?.matched_events?.length > 0 && (

          <div className="panel">

            <div className="panel-header">

              <div>

                <p className="eyebrow">
                  ML DETECTION
                </p>

                <h3>
                  ML Matched Risk Events
                </h3>

                <p>
                  Events contributing to the current
                  risk assessment
                </p>

              </div>

            </div>


            {riskData.matched_events.map(
              (event, index) => (

                <div
                  className="intelligence-event"
                  key={`ml-${event.well_id}-${index}`}
                >

                  <div>

                    <strong>
                      {event.event}
                    </strong>

                    <span>
                      Offset Well {event.well_id}
                      {" · "}
                      Depth {event.depth} m
                    </span>

                  </div>

                  <span className="event-risk">
                    {event.severity}
                  </span>

                </div>

              )
            )}

          </div>

        )}


        {/* RAG + REPORT SUMMARY */}

        <div className="panel report-panel">

          <div className="panel-header">
            <div>
              <p className="eyebrow">
                RAG + REPORT
              </p>
              <h3>
                Grounded Drilling Report Summary
              </h3>
              <p>
                Retrieved historical evidence + ML risk + AI insight.
              </p>
            </div>

            <button
              className="primary-btn"
              onClick={generateReportSummary}
              disabled={reportLoading}
            >
              {reportLoading ? "Generating..." : "Generate Report"}
            </button>
          </div>

          {reportSummary && (
            <div className="report-summary-box">
              <pre>{reportSummary}</pre>
              <button className="outline-btn" onClick={copyReport}>
                Copy Report
              </button>
            </div>
          )}

        </div>

        {/* RECOMMENDATION */}

        <div className="recommendation-panel">

          <div className="recommendation-icon">
            AI
          </div>

          <div>

            <p className="eyebrow">
              RISK GUIDANCE
            </p>

            <h3>
              Drilling Risk Guidance
            </h3>

            <p>
              {intelligence.recommendation}
            </p>

          </div>

        </div>

      </section>
    );
  };


  // =========================================================
  // RISK ALERTS
  // =========================================================

  const renderRiskAlerts = () => {

    const events =
      intelligence?.nearby_events || [];

    const highRisk =
      events.filter(
        (event) =>
          event.severity === "HIGH"
      ).length;

    const mediumRisk =
      events.filter(
        (event) =>
          event.severity === "MEDIUM"
      ).length;

    const lowRisk =
      events.filter(
        (event) =>
          event.severity === "LOW"
      ).length;


    return (
      <section className="content">

        <div className="page-heading">

          <div>

            <p className="eyebrow">
              RISK MONITORING
            </p>

            <h1>
              Risk Alerts
            </h1>

            <p>
              Historical drilling risks requiring
              attention
            </p>

          </div>

        </div>


        {/* RISK SUMMARY */}

        <div className="stats-grid">

          <div className="stat-card">

            <span>
              ML Risk Score
            </span>

            <strong>
              {riskLoading
                ? "..."
                : riskData?.risk_score ?? "--"}
            </strong>

            <small>
              Current ML assessment
            </small>



          </div>


          <div className="stat-card">

            <span>
              Risk Level
            </span>

            <strong>
              {riskLoading
                ? "..."
                : riskData?.risk_level || "--"}
            </strong>

            <small>
              Current drilling risk
            </small>

          </div>


          <div className="stat-card">

            <span>
              High Risk Events
            </span>

            <strong>
              {highRisk}
            </strong>

            <small>
              Historical high severity events
            </small>

          </div>


          <div className="stat-card">

            <span>
              Matched Events
            </span>

            <strong>
              {events.length}
            </strong>

            <small>
              Current interval
            </small>

          </div>

        </div>


        {/* ALERTS */}

        <div className="panel">

          <div className="panel-header">

            <div>

              <p className="eyebrow">
                ACTIVE ALERTS
              </p>

              <h3>
                Historical Risk Events
              </h3>

              <p>
                Events detected in the upcoming
                drilling interval
              </p>

            </div>

            <span className="alert-count">
              {events.length} Active
            </span>

          </div>


          {events.length === 0 ? (

            <div className="intelligence-event">

              <div>

                <strong>
                  No Active Risk Alerts
                </strong>

                <span>
                  No historical events detected
                  in the upcoming drilling interval.
                </span>

              </div>

            </div>

          ) : (

            events.map((event, index) => (

              <div
                className="intelligence-event"
                key={`${event.well_id}-${index}`}
              >

                <div>

                  <strong>
                    ⚠ HISTORICAL RISK EVENT
                  </strong>

                  <strong>
                    {event.event}
                  </strong>

                  <span>
                    Offset Well {event.well_id}
                    {" · "}
                    Depth {event.depth} m
                  </span>

                </div>

                <span className="event-risk">
                  {event.severity}
                </span>

              </div>

            ))

          )}

        </div>


        {/* ML ASSESSMENT */}

        <div className="panel">

          <div className="panel-header">

            <div>

              <p className="eyebrow">
                MACHINE LEARNING ASSESSMENT
              </p>

              <h3>
                Current Risk Assessment
              </h3>

              <p>
                ML risk score generated from matched
                historical drilling events.
              </p>

            </div>

          </div>


          <div className="stats-grid">

            <div className="stat-card">

              <span>
                Risk Score
              </span>

              <strong>
                {riskData?.risk_score ?? "--"}
              </strong>

            </div>


            <div className="stat-card">

              <span>
                Risk Level
              </span>

              <strong>
                {riskData?.risk_level || "--"}
              </strong>

            </div>


            <div className="stat-card">

              <span>
                Current Depth
              </span>

              <strong>
                {riskData?.current_depth ??
                  intelligence?.current_depth ??
                  2820} m
              </strong>

            </div>


            <div className="stat-card">

              <span>
                Upcoming Interval
              </span>

              <strong>
                {riskData?.upcoming_interval ||
                  intelligence?.upcoming_interval ||
                  "2820 - 2920 m"}
              </strong>

            </div>

          </div>

        </div>

        {/* =====================================================
    RISK BREAKDOWN
===================================================== */}

<div className="panel">

  <div className="panel-header">

    <div>

      <p className="eyebrow">
        RISK EXPLANATION
      </p>

      <h3>
        Why This Risk Level?
      </h3>

      <p>
        Factors contributing to the current drilling
        risk assessment
      </p>

    </div>

  </div>

  <div className="risk-breakdown">

    <div className="risk-factor">

      <div>
        <strong>
          Historical Evidence
        </strong>

        <span>
          {events.length > 0
            ? `${events.length} historical event(s) found`
            : "No historical events found"}
        </span>
      </div>

      <strong className="risk-factor-value">
        {events.length > 0 ? "+30" : "+0"}
      </strong>

    </div>

    <div className="risk-factor">

      <div>
        <strong>
          ML Risk Assessment
        </strong>

        <span>
          Score generated from historical drilling
          patterns
        </span>
      </div>

      <strong className="risk-factor-value">
        {riskData?.risk_score ?? "--"}
      </strong>

    </div>

    <div className="risk-factor">

      <div>
        <strong>
          Upcoming Drilling Interval
        </strong>

        <span>
          {riskData?.upcoming_interval ||
            intelligence?.upcoming_interval ||
            "Not available"}
        </span>
      </div>

      <strong className="risk-factor-value">
        {events.length > 0 ? "+40" : "+0"}
      </strong>

    </div>

    <div className="risk-total">

      <span>
        CURRENT RISK SCORE
      </span>

      <strong>
        {riskData?.risk_score ?? "--"}
      </strong>

      <small>
        {riskData?.risk_level || "Analyzing"}
      </small>

    </div>

  </div>

</div>


        {/* DRILLING CONTEXT */}

        <div className="panel">

          <div className="panel-header">

            <div>

              <p className="eyebrow">
                DRILLING CONTEXT
              </p>

              <h3>
                Why this alert was triggered
              </h3>

              <p>
                Historical events from nearby
                offset wells were compared with
                the current drilling interval of
                Well A042.
              </p>

            </div>

          </div>


          <div className="stats-grid">

            <div className="stat-card">

              <span>
                Current Depth
              </span>

              <strong>
                {intelligence?.current_depth ||
                  2820} m
              </strong>

            </div>


            <div className="stat-card">

              <span>
                Upcoming Interval
              </span>

              <strong>
                {intelligence?.upcoming_interval ||
                  "2820 - 2920 m"}
              </strong>

            </div>


            <div className="stat-card">

              <span>
                Matched Events
              </span>

              <strong>
                {events.length}
              </strong>

            </div>

          </div>

        </div>

      </section>
    );
  };


  // =========================================================
  // ANALYTICS
  // =========================================================

  const renderAnalytics = () => {

    const events =
      intelligence?.nearby_events || [];

    const highRisk =
      events.filter(
        (event) =>
          event.severity === "HIGH"
      ).length;

    const mediumRisk =
      events.filter(
        (event) =>
          event.severity === "MEDIUM"
      ).length;


    return (

      <section className="content">

        <div className="page-heading">

          <div>

            <p className="eyebrow">
              OPERATIONS OVERVIEW
            </p>

            <h1>
              Analytics
            </h1>

            <p>
              Current drilling and historical data
              overview
            </p>

          </div>

        </div>


        {/* OVERVIEW */}

        <div className="stats-grid">

          <div className="stat-card">

            <span>
              Nearby Wells
            </span>

            <strong>
              {wells.length}
            </strong>

            <small>
              Wells in current area
            </small>

          </div>


          <div className="stat-card">

            <span>
              Current Depth
            </span>

            <strong>
              {intelligence?.current_depth ||
                2820} m
            </strong>

            <small>
              Current drilling depth
            </small>

          </div>


          <div className="stat-card">

            <span>
              ML Risk Score
            </span>

            <strong>
              {riskData?.risk_score ?? "--"}
            </strong>

            <small>
              Current ML assessment
            </small>

          </div>


          <div className="stat-card">

            <span>
              Active Risk Alerts
            </span>

            <strong>
              {events.length}
            </strong>

            <small>
              Detected in current interval
            </small>

          </div>

        </div>


        {/* WELL OVERVIEW */}

        <div className="panel">

          <div className="panel-header">

            <div>

              <h3>
                Well Overview
              </h3>

              <p>
                Current and nearby drilling
                operations
              </p>

            </div>

          </div>


          {wells.map((well) => (

            <div
              className="event-row"
              key={well.id}
            >

              <div className="event-depth">
                {well.depth} m
              </div>

              <div className="event-info">

                <strong>
                  {well.name}
                </strong>

                <span>
                  {well.id} · {well.formation}
                </span>

              </div>

              <span className="severity low-severity">
                {well.status}
              </span>

            </div>

          ))}

        </div>


        {/* RISK SUMMARY */}

        <div className="panel">

          <div className="panel-header">

            <div>

              <h3>
                Risk Summary
              </h3>

              <p>
                Historical events detected in
                the current drilling analysis
              </p>

            </div>

          </div>


          <div className="stats-grid">

            <div className="stat-card">

              <span>
                ML Risk Score
              </span>

              <strong>
                {riskData?.risk_score ?? "--"}
              </strong>

              <small>
                Current ML assessment
              </small>

            </div>


            <div className="stat-card">

              <span>
                Risk Level
              </span>

              <strong>
                {riskData?.risk_level || "--"}
              </strong>

              <small>
                Current drilling risk
              </small>

            </div>


            <div className="stat-card">

              <span>
                High Risk
              </span>

              <strong>
                {highRisk}
              </strong>

              <small>
                Historical high severity events
              </small>

            </div>


            <div className="stat-card">

              <span>
                Medium Risk
              </span>

              <strong>
                {mediumRisk}
              </strong>

              <small>
                Historical medium severity events
              </small>

            </div>

          </div>

        </div>


        {/* CURRENT DRILLING CONTEXT */}

        <div className="panel">

          <div className="panel-header">

            <div>

              <p className="eyebrow">
                DRILLING CONTEXT
              </p>

              <h3>
                Current Operation
              </h3>

              <p>
                Current drilling position and
                historical comparison context
              </p>

            </div>

          </div>


          <div className="stats-grid">

            <div className="stat-card">

              <span>
                Current Well
              </span>

              <strong>
                A042
              </strong>

              <small>
                Active drilling operation
              </small>

            </div>


            <div className="stat-card">

              <span>
                Formation
              </span>

              <strong>
                {intelligence?.formation ||
                  "ABC Formation"}
              </strong>

              <small>
                Current formation
              </small>

            </div>


            <div className="stat-card">

              <span>
                Upcoming Interval
              </span>

              <strong>
                {intelligence?.upcoming_interval ||
                  "2820 - 2920 m"}
              </strong>

              <small>
                Analysis interval
              </small>

            </div>


            <div className="stat-card">

              <span>
                Matched Events
              </span>

              <strong>
                {events.length}
              </strong>

              <small>
                Historical matches
              </small>

            </div>

          </div>

        </div>

      </section>

    );
  };


  // =========================================================
  // PAGE SELECTION
  // =========================================================

  const renderPage = () => {

    if (activePage === "Dashboard") {
      return renderDashboard();
    }

    if (activePage === "Nearby Wells") {
      return renderNearbyWells();
    }

    if (activePage === "Well Intelligence") {
      return renderIntelligence();
    }

    if (activePage === "Risk Alerts") {
      return renderRiskAlerts();
    }

    if (activePage === "Analytics") {
      return renderAnalytics();
    }

    return renderDashboard();
  };


  // =========================================================
  // LOGIN SCREEN
  // =========================================================

  if (!isLoggedIn) {

    return (

      <div className="login-page">

        <div className="login-background-glow glow-one"></div>
        <div className="login-background-glow glow-two"></div>

        <div className="login-container">

          <div className="login-brand">

            <div className="login-logo">
              N
            </div>

            <div>
              <h1>
                NWIS
              </h1>

              <p>
                Nearby Wells Intelligence System
              </p>
            </div>

          </div>


          <div className="login-card">

            <div className="login-header">

              <span className="login-eyebrow">
                SECURE ACCESS
              </span>

              <h2>
                Welcome back
              </h2>

              <p>
                Sign in to access drilling intelligence
                and risk analytics.
              </p>

            </div>


            <form
              onSubmit={handleLogin}
              className="login-form"
            >

              <div className="input-group">

                <label>
                  Username
                </label>

                <input
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setUsername(e.target.value)
                  }
                  placeholder="Enter username"
                  autoComplete="username"
                />

              </div>


              <div className="input-group">

                <label>
                  Password
                </label>

                <input
                  type="password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="Enter password"
                  autoComplete="current-password"
                />

              </div>


              {loginError && (

                <div className="login-error">
                  ⚠ {loginError}
                </div>

              )}


              <button
                type="submit"
                className="login-button"
                disabled={loginLoading}
              >

                {loginLoading
                  ? "Signing in..."
                  : "Sign In →"}

              </button>

            </form>


            <div className="login-footer">

              <span className="online-dot"></span>

              NWIS Intelligence Platform · System Online

            </div>

          </div>

        </div>

      </div>

    );
  }


  // =========================================================
  // MAIN APPLICATION
  // =========================================================

  return (

    <div className="app">

      {/* SIDEBAR */}

      <aside className="sidebar">

        <div className="logo">

          <div className="logo-mark">
            N
          </div>

          <div>

            <h2>
              NWIS
            </h2>

            <span>
              Well Intelligence
            </span>

          </div>

        </div>


        <p className="menu-title">
          MAIN MENU
        </p>


        <nav className="menu">

          {menuItems.map((item) => (

            <button
              key={item}
              className={
                activePage === item
                  ? "menu-item active"
                  : "menu-item"
              }
              onClick={() =>
                setActivePage(item)
              }
            >

              <span className="menu-icon">

                {item === "Dashboard" && "⌂"}
                {item === "Nearby Wells" && "◉"}
                {item === "Well Intelligence" && "◇"}
                {item === "Risk Alerts" && "⚠"}
                {item === "Analytics" && "▥"}

              </span>

              {item}

            </button>

          ))}

        </nav>


        <div className="sidebar-bottom">

          <div className="system-status">

            <span className="status-dot"></span>

            <div>

              <strong>
                System Online
              </strong>

              <small>
                All services operational
              </small>

            </div>

          </div>


          <div className="user-card">

            <div className="avatar">
              S
            </div>

            <div className="user-info">

              <strong>
                Drilling Engineer
              </strong>

              <small>
                Operations
              </small>

            </div>

          </div>


          {/* LOGOUT */}

          <button
            className="logout-button"
            onClick={handleLogout}
          >

            <span>
              ⇥
            </span>

            Logout

          </button>

        </div>

      </aside>


      {/* MAIN */}

      <main className="main">

        <header className="topbar">

          <div>

            <div className="breadcrumb">
              NWIS / {activePage}
            </div>

            <h1>
              {activePage}
            </h1>

          </div>


          <div className="header-actions">

            <div className="search">

              <span>
                ⌕
              </span>

              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search wells, events..."
              />

              {searchQuery.trim() && (
                <div className="search-results">
                  {filteredWells.map((well) => (
                    <button
                      key={`well-${well.id}`}
                      className="search-result-item"
                      onClick={() => {
                        setSelectedWell(well);
                        setActivePage("Nearby Wells");
                        setSearchQuery("");
                      }}
                    >
                      <strong>{well.name}</strong>
                      <span>{well.id} · {well.formation}</span>
                    </button>
                  ))}

                  {filteredEvents.map((event, index) => (
                    <button
                      key={`event-${event.well_id}-${index}`}
                      className="search-result-item"
                      onClick={() => {
                        setActivePage("Well Intelligence");
                        setSearchQuery("");
                      }}
                    >
                      <strong>{event.event}</strong>
                      <span>Well {event.well_id} · {event.depth} m</span>
                    </button>
                  ))}

                  {!filteredWells.length && !filteredEvents.length && (
                    <div className="search-no-result">No matching wells or events.</div>
                  )}
                </div>
              )}

            </div>


            <button className="notification">

              🔔

              <span className="notification-dot"></span>

            </button>

          </div>

        </header>


        {renderPage()}

      </main>

    </div>

  );
}

export default App;