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

  const [trackingAssetId, setTrackingAssetId] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(null);

  const mapRef = useRef(null);
  const markerRefs = useRef({});
  const watchIdRef = useRef(null);

  useEffect(() => {
    loadAssets();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
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
        (asset.room || "").toLowerCase().includes(q)
    );
  }, [assets, query]);

  const stats = useMemo(() => {
    return {
      total: assets.length,
      available: assets.filter((a) => a.status === "available").length,
      inUse: assets.filter((a) => a.status === "in_use").length,
      maintenance: assets.filter((a) => a.status === "maintenance").length,
      lost: assets.filter((a) => a.status === "lost").length,
    };
  }, [assets]);

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
      "Are you sure you want to delete this asset?"
    );
    if (!confirmDelete) return;

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/assets/${assetId}/`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        throw new Error("Failed to delete asset.");
      }

      setAssets((prevAssets) =>
        prevAssets.filter((asset) => asset.id !== assetId)
      );
      alert("Asset deleted successfully");

      if (selectedId === assetId) {
        setSelectedId(null);
      }

      if (String(trackingAssetId) === String(assetId)) {
        stopLiveTracking();
        setTrackingAssetId("");
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

      const res = await fetch(
        `http://127.0.0.1:8000/api/assets/${assetId}/`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...assetToUpdate,
            status: newStatus,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to update asset.");
      }

      const updatedAsset = await res.json();
      alert("Asset updated successfully");

      setAssets((prevAssets) =>
        prevAssets.map((asset) =>
          asset.id === assetId ? updatedAsset : asset
        )
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update asset.");
    }
  }

  async function updateTrackedAssetLocation(assetId, lat, lng) {
    const assetToUpdate = assets.find(
      (asset) => String(asset.id) === String(assetId)
    );
    if (!assetToUpdate) return;

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/assets/${assetId}/`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...assetToUpdate,
            latitude: lat,
            longitude: lng,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to update tracked asset location.");
      }

      const updatedAsset = await res.json();

      setAssets((prevAssets) =>
        prevAssets.map((asset) =>
          asset.id === updatedAsset.id ? updatedAsset : asset
        )
      );

      if (mapRef.current) {
        mapRef.current.setView([lat, lng], 17);
      }
    } catch (err) {
      console.error(err);
    }
  }

  function startLiveTracking() {
    if (!trackingAssetId) {
      alert("Please choose an asset to track first.");
      return;
    }

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));

        setCurrentPosition({ lat, lng });

        setNewAsset((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));

        updateTrackedAssetLocation(trackingAssetId, lat, lng);
        setIsTracking(true);
      },
      (error) => {
        console.error("Live tracking error:", error);

        if (error.code === 1) {
          alert("Location permission was denied.");
        } else if (error.code === 2) {
          alert("Location unavailable.");
        } else if (error.code === 3) {
          alert("Location request timed out.");
        } else {
          alert("Unable to retrieve live location.");
        }

        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  function stopLiveTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
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
          <h3 style={{ marginTop: 0 }}>Dashboard</h3>

          <div style={statsGridStyle}>
            <div style={statCardStyle}>
              <div style={statNumberStyle}>{stats.total}</div>
              <div style={statLabelStyle}>Total</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ ...statNumberStyle, color: "#2ecc71" }}>
                {stats.available}
              </div>
              <div style={statLabelStyle}>Available</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ ...statNumberStyle, color: "#3498db" }}>
                {stats.inUse}
              </div>
              <div style={statLabelStyle}>In Use</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ ...statNumberStyle, color: "#f39c12" }}>
                {stats.maintenance}
              </div>
              <div style={statLabelStyle}>Maintenance</div>
            </div>
            <div style={statCardStyle}>
              <div style={{ ...statNumberStyle, color: "#e74c3c" }}>
                {stats.lost}
              </div>
              <div style={statLabelStyle}>Lost</div>
            </div>
          </div>

          <h3 style={{ marginTop: "20px" }}>Live Tracking</h3>

          <select
            value={trackingAssetId}
            onChange={(e) => setTrackingAssetId(e.target.value)}
            style={inputStyle}
          >
            <option value="">Select asset to track</option>
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={startLiveTracking}
            style={{ ...buttonStyle, marginBottom: "10px", background: "#2d8cff" }}
          >
            {isTracking ? "Tracking..." : "Start Live Tracking"}
          </button>

          <button
            type="button"
            onClick={stopLiveTracking}
            style={{ ...buttonStyle, marginBottom: "20px", background: "#555" }}
          >
            Stop Tracking
          </button>

          <h3>Add New Asset</h3>

          <p style={{ fontSize: "13px", opacity: 0.7 }}>
            Click on the map to auto-fill location
          </p>

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
                {asset.asset_type} •{" "}
                <span
                  style={{
                    color:
                      asset.status === "available"
                        ? "#2ecc71"
                        : asset.status === "in_use"
                        ? "#3498db"
                        : asset.status === "maintenance"
                        ? "#f39c12"
                        : "#e74c3c",
                  }}
                >
                  {asset.status}
                </span>
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
            whenCreated={(map) => {
              mapRef.current = map;
            }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickHandler setNewAsset={setNewAsset} />

            {currentPosition && (
              <Marker position={[currentPosition.lat, currentPosition.lng]}>
                <Popup>
                  <div>
                    <strong>Your current location</strong>
                    <br />
                    {currentPosition.lat}, {currentPosition.lng}
                  </div>
                </Popup>
              </Marker>
            )}

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

const statsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(2, 1fr)",
  gap: "10px",
  marginBottom: "20px",
};

const statCardStyle = {
  background: "#1a1a1a",
  border: "1px solid #444",
  borderRadius: "10px",
  padding: "12px",
  textAlign: "center",
};

const statNumberStyle = {
  fontSize: "22px",
  fontWeight: "bold",
};

const statLabelStyle = {
  fontSize: "13px",
  opacity: 0.8,
};