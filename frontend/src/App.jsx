import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function App() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");

  const mapRef = useRef(null);
  const markerRefs = useRef({});

  useEffect(() => {
    async function loadAssets() {
      try {
        setLoading(true);
        setErrorMsg("");

        const res = await fetch("http://127.0.0.1:8000/api/assets/");

        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }

        const data = await res.json();
        setAssets(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        setErrorMsg("Failed to load assets.");
      } finally {
        setLoading(false);
      }
    }

    loadAssets();
  }, []);

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;

    return assets.filter((asset) =>
      asset.name.toLowerCase().includes(q) ||
      asset.asset_type.toLowerCase().includes(q) ||
      asset.status.toLowerCase().includes(q) ||
      asset.building.toLowerCase().includes(q) ||
      asset.room.toLowerCase().includes(q)
    );
  }, [assets, query]);

  const focusAsset = (asset) => {
    setSelectedId(asset.id);

    const lat = Number(asset.latitude);
    const lng = Number(asset.longitude);

    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 17);
    }

    setTimeout(() => {
      const marker = markerRefs.current[asset.id];
      if (marker) {
        marker.openPopup();
      }
    }, 200);
  };

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <div
        style={{
          padding: "12px 16px",
          fontWeight: "bold",
          borderBottom: "1px solid #333",
          background: "#1f1f1f",
          color: "white",
        }}
      >
        LocateIT — Asset Tracker
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          height: "calc(100% - 49px)",
        }}
      >
        <div
          style={{
            borderRight: "1px solid #333",
            padding: "12px",
            overflowY: "auto",
            background: "#242424",
            color: "white",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Assets</h3>

          <input
            type="text"
            placeholder="Search assets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              marginBottom: "12px",
              borderRadius: "8px",
              border: "1px solid #555",
              background: "#1a1a1a",
              color: "white",
              boxSizing: "border-box",
            }}
          />

          {loading && <p>Loading assets...</p>}
          {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}

          {!loading && !errorMsg && filteredAssets.length === 0 && (
            <p>No assets found.</p>
          )}

          {filteredAssets.map((asset) => (
            <div
              key={asset.id}
              onClick={() => focusAsset(asset)}
              style={{
                padding: "12px",
                marginBottom: "10px",
                borderRadius: "10px",
                background: selectedId === asset.id ? "#353f6b" : "#2c2c2c",
                border: selectedId === asset.id ? "1px solid #6c7bff" : "1px solid #444",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: "bold" }}>{asset.name}</div>
              <div style={{ fontSize: "14px", opacity: 0.9 }}>
                {asset.asset_type} • {asset.status}
              </div>
              <div style={{ fontSize: "13px", opacity: 0.8 }}>
                {asset.building} {asset.room ? `• ${asset.room}` : ""}
              </div>
            </div>
          ))}
        </div>

        <div style={{ height: "100%" }}>
          <MapContainer
            center={[51.4816, -3.1791]}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
            ref={mapRef}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {assets.map((asset) => (
              <Marker
                key={asset.id}
                position={[Number(asset.latitude), Number(asset.longitude)]}
                ref={(ref) => {
                  if (ref) markerRefs.current[asset.id] = ref;
                }}
              >
                <Popup>
                  <div>
                    <strong>{asset.name}</strong>
                    <br />
                    Type: {asset.asset_type}
                    <br />
                    Status: {asset.status}
                    <br />
                    {asset.building} {asset.room ? `• ${asset.room}` : ""}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}