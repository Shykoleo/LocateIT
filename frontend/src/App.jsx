import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
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

/* ✅ NEW: Proper map click handler */
function MapClickHandler({ setNewAsset }) {
  useMapEvents({
    click(e) {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));

      setNewAsset((prev) => ({
        ...prev,
        latitude: lat,
        longitude: lng,
      }));
    },
  });

  return null;
}

export default function App() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");

  const [newAsset, setNewAsset] = useState({
    name: "",
    asset_type: "",
    status: "available",
    building: "",
    room: "",
    latitude: "",
    longitude: "",
  });

  const mapRef = useRef(null);
  const markerRefs = useRef({});

  useEffect(() => {
    loadAssets();
  }, []);

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

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;

    return assets.filter(
      (asset) =>
        (asset.name || "").toLowerCase().includes(q) ||
        (asset.asset_type || "").toLowerCase().includes(q) ||
        (asset.status || "").toLowerCase().includes(q) ||
        (asset.building || "").toLowerCase().includes(q) ||
        (asset.room || "").toLowerCase().includes(q),
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

  async function addAsset(e) {
    e.preventDefault();

    const lat = parseFloat(newAsset.latitude);
    const lng = parseFloat(newAsset.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      alert("Please enter valid latitude and longitude.");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/api/assets/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...newAsset,
          latitude: lat,
          longitude: lng,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to add asset.");
      }

      const createdAsset = await res.json();

      setAssets((prevAssets) => [...prevAssets, createdAsset]);

      setNewAsset({
        name: "",
        asset_type: "",
        status: "available",
        building: "",
        room: "",
        latitude: "",
        longitude: "",
      });
    } catch (err) {
      console.error(err);
      alert("Failed to add asset. Please check the form.");
    }
  }

  async function deleteAsset(assetId) {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this asset?",
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/assets/${assetId}/`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete asset.");
      }

      setAssets((prevAssets) =>
        prevAssets.filter((asset) => asset.id !== assetId),
      );

      if (selectedId === assetId) {
        setSelectedId(null);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete asset.");
    }
  }

  async function updateAssetStatus(assetId, newStatus) {
    try {
      const assetToUpdate = assets.find((asset) => asset.id === assetId);
      if (!assetToUpdate) return;

      const res = await fetch(`http://127.0.0.1:8000/api/assets/${assetId}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...assetToUpdate,
          status: newStatus,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update asset.");
      }

      const updatedAsset = await res.json();

      setAssets((prevAssets) =>
        prevAssets.map((asset) =>
          asset.id === assetId ? updatedAsset : asset,
        ),
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update asset.");
    }
  }

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
          gridTemplateColumns: "360px 1fr",
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
          <h3 style={{ marginTop: 0 }}>Add New Asset</h3>

          <form onSubmit={addAsset} style={{ marginBottom: "20px" }}>
            <input
              type="text"
              placeholder="Asset name"
              value={newAsset.name}
              onChange={(e) =>
                setNewAsset({ ...newAsset, name: e.target.value })
              }
              style={inputStyle}
              required
            />
            <input
              type="text"
              placeholder="Asset type"
              value={newAsset.asset_type}
              onChange={(e) =>
                setNewAsset({ ...newAsset, asset_type: e.target.value })
              }
              style={inputStyle}
              required
            />

            <select
              value={newAsset.status}
              onChange={(e) =>
                setNewAsset({ ...newAsset, status: e.target.value })
              }
              style={inputStyle}
            >
              <option value="available">Available</option>
              <option value="in_use">In Use</option>
              <option value="maintenance">Maintenance</option>
              <option value="lost">Lost</option>
            </select>

            <input
              type="text"
              placeholder="Building"
              value={newAsset.building}
              onChange={(e) =>
                setNewAsset({ ...newAsset, building: e.target.value })
              }
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="Room"
              value={newAsset.room}
              onChange={(e) =>
                setNewAsset({ ...newAsset, room: e.target.value })
              }
              style={inputStyle}
            />

            <input
              type="number"
              step="any"
              placeholder="Latitude"
              value={newAsset.latitude || ""}
              onChange={(e) =>
                setNewAsset({ ...newAsset, latitude: e.target.value })
              }
              style={inputStyle}
              required
            />
            <input
              type="number"
              step="any"
              placeholder="Longitude"
              value={newAsset.longitude || ""}
              onChange={(e) =>
                setNewAsset({ ...newAsset, longitude: e.target.value })
              }
              style={inputStyle}
              required
            />

            <button type="submit" style={buttonStyle}>
              Add Asset
            </button>
          </form>

          <h3>Assets</h3>

          <input
            type="text"
            placeholder="Search assets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={inputStyle}
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
                border:
                  selectedId === asset.id
                    ? "1px solid #6c7bff"
                    : "1px solid #444",
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: "bold" }}>{asset.name}</div>
              <div style={{ fontSize: "14px", opacity: 0.9 }}>
                {asset.asset_type} • {asset.status}
              </div>
              <div
                style={{ fontSize: "13px", opacity: 0.8, marginBottom: "10px" }}
              >
                {asset.building} {asset.room ? `• ${asset.room}` : ""}
              </div>
              <select
                value={asset.status}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateAssetStatus(asset.id, e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  marginBottom: "8px",
                  borderRadius: "6px",
                  border: "1px solid #555",
                  background: "#1a1a1a",
                  color: "white",
                }}
              >
                <option value="available">Available</option>
                <option value="in_use">In Use</option>
                <option value="maintenance">Maintenance</option>
                <option value="lost">Lost</option>
              </select>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteAsset(asset.id);
                }}
                style={{
                  width: "100%",
                  padding: "8px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#c0392b",
                  color: "white",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        <div style={{ height: "100%" }}>
          <MapContainer
            center={[51.4816, -3.1791]}
            zoom={15}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {/* ✅ THIS FIXES AUTO FILL */}
            <MapClickHandler setNewAsset={setNewAsset} />

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

const inputStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "8px",
  border: "1px solid #555",
  background: "#1a1a1a",
  color: "white",
  boxSizing: "border-box",
};

const buttonStyle = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "none",
  background: "#646cff",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};
