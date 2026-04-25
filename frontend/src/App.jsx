import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

import { QRCodeCanvas } from "qrcode.react";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import locateitLogo from "./assets/locateit-logo.png";
import uswLogo from "./assets/usw-logo.png";

import {
  LayoutDashboard,
  Package,
  Map,
  PlusSquare,
  Bell,
  ClipboardList,
  Box,
  CheckCircle,
  User,
  Wrench,
  AlertTriangle,
  Plus,
  FolderOpen,
  FileText,
  Download,
  FileSpreadsheet,
} from "lucide-react";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function getImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://"))
    return imagePath;
  if (imagePath.startsWith("/")) return `http://127.0.0.1:8000${imagePath}`;
  return `http://127.0.0.1:8000/${imagePath}`;
}

function MapClickHandler({ setNewAsset }) {
  useMapEvents({
    click(e) {
      setNewAsset((prev) => ({
        ...prev,
        latitude: Number(e.latlng.lat.toFixed(6)),
        longitude: Number(e.latlng.lng.toFixed(6)),
      }));
    },
  });

  return null;
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState("dashboard");
  const [activityLog, setActivityLog] = useState([]);

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [buildingFilter, setBuildingFilter] = useState("all");

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const [newAsset, setNewAsset] = useState({
    name: "",
    asset_tag: "",
    asset_type: "",
    status: "available",
    condition: "good",
    assigned_to: "",
    building: "",
    room: "",
    notes: "",
    image: null,
    last_checked: "",
    next_maintenance_date: "",
    latitude: "",
    longitude: "",
  });

  const [editingAsset, setEditingAsset] = useState(null);

  const mapRef = useRef(null);
  const markerRefs = useRef({});
  const mainContentRef = useRef(null);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);

      if (!mobile) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!assets.length) return;

    const params = new URLSearchParams(window.location.search);
    const assetId = params.get("asset");

    if (assetId) {
      const foundAsset = assets.find((asset) => String(asset.id) === assetId);

      if (foundAsset) {
        setActiveSection("assets");
        setSelectedId(foundAsset.id);
        addActivity(`Asset opened from QR code: ${foundAsset.name}`, "view");
        scrollToTop();
      }
    }
  }, [assets]);

  function goToSection(section) {
    setActiveSection(section);
    if (isMobile) {
      setSidebarOpen(false);
    }
  }

  function addActivity(message, type = "info") {
    const newActivity = {
      id: Date.now(),
      message,
      type,
      user: username || "system",
      time: new Date().toLocaleString(),
    };

    setActivityLog((prev) => [newActivity, ...prev]);
  }

  function showToast(message, type = "success") {
    setToast({ message, type });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  }

  function getAssetQrUrl(assetId) {
    return `${window.location.origin}?asset=${assetId}`;
  }

  async function checkSession() {
    try {
      const res = await fetch("http://127.0.0.1:8000/api/session/", {
        credentials: "include",
      });

      const data = await res.json();

      if (data.authenticated) {
        setIsAuthenticated(true);
        setUsername(data.username);
        await loadAssets();
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error(err);
      setIsAuthenticated(false);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();

    try {
      const res = await fetch("http://127.0.0.1:8000/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(loginForm),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.message || "Login failed");
        return;
      }

      setIsAuthenticated(true);
      setUsername(data.username);
      setLoginForm({ username: "", password: "" });
      addActivity(`Staff login: ${data.username}`, "login");
      await loadAssets();
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  }

  async function handleLogout() {
    addActivity(`Staff logout: ${username}`, "logout");

    try {
      await fetch("http://127.0.0.1:8000/api/logout/", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error(err);
    }

    setIsAuthenticated(false);
    setUsername("");
    setAssets([]);
    setActiveSection("dashboard");
  }

  async function loadAssets() {
    try {
      setLoading(true);
      setErrorMsg("");

      const res = await fetch("http://127.0.0.1:8000/api/assets/", {
        credentials: "include",
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      setAssets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to load assets.");
    } finally {
      setLoading(false);
    }
  }

  const assetTypes = useMemo(() => {
    return [
      ...new Set(assets.map((asset) => asset.asset_type).filter(Boolean)),
    ].sort();
  }, [assets]);

  const buildings = useMemo(() => {
    return [
      ...new Set(assets.map((asset) => asset.building).filter(Boolean)),
    ].sort();
  }, [assets]);

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();

    return assets.filter((asset) => {
      const matchesSearch =
        !q ||
        (asset.name || "").toLowerCase().includes(q) ||
        (asset.asset_tag || "").toLowerCase().includes(q) ||
        (asset.asset_type || "").toLowerCase().includes(q) ||
        (asset.status || "").toLowerCase().includes(q) ||
        (asset.condition || "").toLowerCase().includes(q) ||
        (asset.assigned_to || "").toLowerCase().includes(q) ||
        (asset.building || "").toLowerCase().includes(q) ||
        (asset.room || "").toLowerCase().includes(q) ||
        (asset.notes || "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || asset.status === statusFilter;
      const matchesType =
        typeFilter === "all" || asset.asset_type === typeFilter;
      const matchesBuilding =
        buildingFilter === "all" || asset.building === buildingFilter;

      return matchesSearch && matchesStatus && matchesType && matchesBuilding;
    });
  }, [assets, query, statusFilter, typeFilter, buildingFilter]);

  const stats = useMemo(() => {
    return {
      total: assets.length,
      available: assets.filter((a) => a.status === "available").length,
      inUse: assets.filter((a) => a.status === "in_use").length,
      maintenance: assets.filter((a) => a.status === "maintenance").length,
      lost: assets.filter((a) => a.status === "lost").length,
    };
  }, [assets]);

  const maintenanceAlerts = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const overdue = [];
    const dueSoon = [];

    assets.forEach((asset) => {
      if (!asset.next_maintenance_date) return;

      const dueDate = new Date(asset.next_maintenance_date);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate < today) {
        overdue.push(asset);
      } else if (dueDate <= sevenDaysFromNow) {
        dueSoon.push(asset);
      }
    });

    return {
      overdue,
      dueSoon,
      total: overdue.length + dueSoon.length,
    };
  }, [assets]);

  const selectedAsset = useMemo(() => {
    return assets.find((asset) => asset.id === selectedId) || null;
  }, [assets, selectedId]);

  const recentActivity = activityLog.slice(0, 5);

  const focusAsset = (asset) => {
    setSelectedId(asset.id);
    setActiveSection("map");
    if (isMobile) setSidebarOpen(false);

    addActivity(`Viewed asset on map: ${asset.name}`, "view");

    const lat = Number(asset.latitude);
    const lng = Number(asset.longitude);

    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 17);
    }

    setTimeout(() => {
      const marker = markerRefs.current[asset.id];
      if (marker) marker.openPopup();
    }, 250);
  };

  function selectAsset(asset) {
    setSelectedId(asset.id);
    addActivity(`Viewed asset details: ${asset.name}`, "view");
    scrollToTop();
  }

  function scrollToTop() {
    setTimeout(() => {
      if (mainContentRef.current) {
        mainContentRef.current.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 150);
  }

  function startEditAsset(asset) {
    setEditingAsset({
      ...asset,
      image: null,
    });
    setSelectedId(asset.id);
    scrollToTop();
  }

  function cancelEditAsset() {
    setEditingAsset(null);
  }

  async function saveEditedAsset(e) {
    e.preventDefault();

    const lat = parseFloat(editingAsset.latitude);
    const lng = parseFloat(editingAsset.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      alert("Please enter valid latitude and longitude.");
      return;
    }

    try {
      const formData = new FormData();

      formData.append("name", editingAsset.name || "");
      formData.append("asset_tag", editingAsset.asset_tag || "");
      formData.append("asset_type", editingAsset.asset_type || "");
      formData.append("status", editingAsset.status || "available");
      formData.append("condition", editingAsset.condition || "good");
      formData.append("assigned_to", editingAsset.assigned_to || "");
      formData.append("building", editingAsset.building || "");
      formData.append("room", editingAsset.room || "");
      formData.append("notes", editingAsset.notes || "");
      formData.append("latitude", lat);
      formData.append("longitude", lng);

      if (editingAsset.image) {
        formData.append("image", editingAsset.image);
      }

      const res = await fetch(
        `http://127.0.0.1:8000/api/assets/${editingAsset.id}/`,
        {
          method: "PATCH",
          credentials: "include",
          body: formData,
        },
      );

      if (!res.ok) {
        throw new Error("Failed to update asset.");
      }

      const updatedAsset = await res.json();

      setAssets((prevAssets) =>
        prevAssets.map((asset) =>
          asset.id === updatedAsset.id ? updatedAsset : asset,
        ),
      );

      setEditingAsset(null);
      setSelectedId(updatedAsset.id);
      showToast("Asset details updated successfully", "success");
      addActivity(`Asset edited: ${updatedAsset.name}`, "update");
    } catch (err) {
      console.error(err);
      showToast("Failed to update asset details.", "error");
    }
  }
  async function addAsset(e) {
    e.preventDefault();

    const lat = parseFloat(newAsset.latitude);
    const lng = parseFloat(newAsset.longitude);

    if (isNaN(lat) || isNaN(lng)) {
      alert("Please enter valid latitude and longitude.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", newAsset.name);
      formData.append("asset_tag", newAsset.asset_tag || "");
      formData.append("asset_type", newAsset.asset_type);
      formData.append("status", newAsset.status);
      formData.append("condition", newAsset.condition);
      formData.append("assigned_to", newAsset.assigned_to || "");
      formData.append("building", newAsset.building || "");
      formData.append("room", newAsset.room || "");
      formData.append("notes", newAsset.notes || "");
      formData.append("last_checked", newAsset.last_checked || "");
      formData.append(
        "next_maintenance_date",
        newAsset.next_maintenance_date || "",
      );
      formData.append("latitude", lat);
      formData.append("longitude", lng);

      if (newAsset.image) {
        formData.append("image", newAsset.image);
      }

      const res = await fetch("http://127.0.0.1:8000/api/assets/", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to add asset.");

      const createdAsset = await res.json();

      setAssets((prevAssets) => [...prevAssets, createdAsset]);

      setNewAsset({
        name: "",
        asset_tag: "",
        asset_type: "",
        status: "available",
        condition: "good",
        assigned_to: "",
        building: "",
        room: "",
        notes: "",
        image: null,
        latitude: "",
        longitude: "",
      });

      showToast("Asset added successfully", "success");
      addActivity(`Asset added: ${createdAsset.name}`, "create");
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

    const deletedAsset = assets.find((asset) => asset.id === assetId);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/assets/${assetId}/`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to delete asset.");

      setAssets((prevAssets) =>
        prevAssets.filter((asset) => asset.id !== assetId),
      );

      showToast("Asset deleted successfully", "success");

      if (deletedAsset) {
        addActivity(`Asset deleted: ${deletedAsset.name}`, "delete");
      }

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
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...assetToUpdate,
          status: newStatus,
        }),
      });

      if (!res.ok) throw new Error("Failed to update asset.");

      const updatedAsset = await res.json();

      setAssets((prevAssets) =>
        prevAssets.map((asset) =>
          asset.id === assetId ? updatedAsset : asset,
        ),
      );

      alert("Asset updated successfully");
      addActivity(
        `Status updated: ${updatedAsset.name} changed to ${updatedAsset.status}`,
        "update",
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update asset.");
    }
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setTypeFilter("all");
    setBuildingFilter("all");
  }

  function clearLogs() {
    const confirmClear = window.confirm(
      "Are you sure you want to clear all logs?",
    );
    if (!confirmClear) return;
    setActivityLog([]);
  }

  function downloadCSV(filename, rows) {
    if (!rows || rows.length === 0) {
      alert("No data available to export.");
      return;
    }

    const headers = Object.keys(rows[0]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = row[header] ?? "";
            return `"${String(value).replaceAll('"', '""')}"`;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
  }

  function exportAssetsCSV() {
    const rows = assets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      asset_tag: asset.asset_tag || "",
      asset_type: asset.asset_type,
      status: asset.status,
      condition: asset.condition,
      assigned_to: asset.assigned_to || "",
      building: asset.building || "",
      room: asset.room || "",
      last_checked: asset.last_checked || "",
      next_maintenance_date: asset.next_maintenance_date || "",
      latitude: asset.latitude,
      longitude: asset.longitude,
      notes: asset.notes || "",
      created_at: asset.created_at || "",
    }));

    downloadCSV("locateit_assets_report.csv", rows);
    addActivity("Exported assets CSV report", "export");
  }

  function exportLogsCSV() {
    const rows = activityLog.map((log) => ({
      id: log.id,
      type: log.type,
      message: log.message,
      user: log.user,
      time: log.time,
    }));

    downloadCSV("locateit_activity_logs.csv", rows);
    addActivity("Exported activity logs CSV report", "export");
  }

  const appShellStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "240px 1fr",
    minHeight: "100vh",
    background: "#050505",
    color: "white",
  };

  const sidebarStyle = {
    background: "#0b0b0b",
    borderRight: "1px solid #1f1f1f",
    padding: "20px 14px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    position: isMobile ? "fixed" : "sticky",
    top: 0,
    left: isMobile ? (sidebarOpen ? "0" : "-270px") : "0",
    width: "240px",
    minHeight: "100vh",
    height: "100vh",
    alignSelf: "start",
    zIndex: 999,
    transition: "0.3s ease",
    boxSizing: "border-box",
  };

  const brandStyle = {
    fontSize: isMobile ? "26px" : "32px",
    fontWeight: "bold",
    marginBottom: "20px",
    color: "#ffffff",
    fontFamily: "Calibri, sans-serif",
    whiteSpace: "nowrap",
  };

  const navButtonStyle = (active) => ({
    padding: "14px 16px",
    borderRadius: "10px",
    border: active ? "1px solid #b71c1c" : "1px solid transparent",
    background: active ? "#1a1a1a" : "transparent",
    color: active ? "#ffffff" : "#d0d0d0",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "15px",
    transition: "0.2s ease",
    boxShadow: active ? "0 0 10px rgba(183,28,28,0.4)" : "none",
    whiteSpace: "nowrap",
  });

  const mainAreaStyle = {
    display: "grid",
    gridTemplateRows: isMobile ? "auto 1fr" : "70px 1fr",
    minWidth: 0,
    background: "#050505",
  };

  const topbarStyle = {
    borderBottom: "1px solid #1f1f1f",
    background: "#0d0d0d",
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    alignItems: isMobile ? "flex-start" : "center",
    justifyContent: "space-between",
    gap: isMobile ? "10px" : 0,
    padding: isMobile ? "14px" : "0 24px",
    color: "#ffffff",
  };

  const contentStyle = {
    padding: isMobile ? "14px" : "24px",
    overflowY: "auto",
    background: "#050505",
  };

  const statsRowStyle = {
    display: "grid",
    gridTemplateColumns: isMobile
      ? "1fr 1fr"
      : "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    marginBottom: "24px",
  };

  const dashboardPanelsStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr",
    gap: "20px",
  };

  const filtersGridStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "repeat(4, minmax(160px, 1fr))",
    gap: "12px",
  };

  const formMapLayoutStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "380px 1fr",
    gap: "20px",
  };

  const detailsContentStyle = {
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "220px 1fr",
    gap: "18px",
    alignItems: "start",
  };

  const renderDashboard = () => (
    <div>
      <h2 style={sectionTitleStyle}>Dashboard</h2>

      <p style={subtitleStyle}>
        Real-time overview of assets, maintenance status and monitoring
        activity.
      </p>
      <div style={statsRowStyle}>
        <div style={statCardStyle}>
          <div style={statIconBoxStyle("#e74c3c")}>
            <Box size={24} />
          </div>
          <div style={statNumberStyle}>{stats.total}</div>
          <div style={statLabelStyle}>Total Assets</div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconBoxStyle("#e74c3c")}>
            <CheckCircle size={24} />
          </div>
          <div style={{ ...statNumberStyle, color: "#2ecc71" }}>
            {stats.available}
          </div>
          <div style={statLabelStyle}>Available</div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconBoxStyle("#e74c3c")}>
            <User size={24} />
          </div>
          <div style={{ ...statNumberStyle, color: "#3498db" }}>
            {stats.inUse}
          </div>
          <div style={statLabelStyle}>In Use</div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconBoxStyle("#e74c3c")}>
            <Wrench size={24} />
          </div>
          <div style={{ ...statNumberStyle, color: "#f39c12" }}>
            {stats.maintenance}
          </div>
          <div style={statLabelStyle}>Maintenance</div>
        </div>
        <div style={statCardStyle}>
          <div style={statIconBoxStyle("#e74c3c")}>
            <AlertTriangle size={24} />
          </div>
          <div style={{ ...statNumberStyle, color: "#e74c3c" }}>
            {stats.lost}
          </div>
          <div style={statLabelStyle}>Lost</div>
        </div>
      </div>

      <div style={{ ...panelStyle, marginBottom: "20px" }}>
        <h3 style={panelTitleStyle}>Maintenance Alerts</h3>

        {maintenanceAlerts.total === 0 ? (
          <p style={{ opacity: 0.75 }}>No maintenance alerts at the moment.</p>
        ) : (
          <>
            <p style={{ color: "#e74c3c", fontWeight: "bold" }}>
              Overdue: {maintenanceAlerts.overdue.length}
            </p>
            <p style={{ color: "#f39c12", fontWeight: "bold" }}>
              Due soon: {maintenanceAlerts.dueSoon.length}
            </p>

            <button
              style={actionButtonStyle}
              onClick={() => goToSection("alerts")}
            >
              View Maintenance Alerts
            </button>
          </>
        )}
      </div>

      <div style={dashboardPanelsStyle}>
        <div style={panelStyle}>
          <h3 style={panelTitleStyle}>Recent Assets</h3>
          {filteredAssets.slice(0, 5).map((asset) => (
            <div
              key={asset.id}
              style={miniAssetRowStyle}
              onClick={() => focusAsset(asset)}
            >
              <div>
                <div style={{ fontWeight: "bold" }}>{asset.name}</div>
                <div style={{ fontSize: "13px", opacity: 0.8 }}>
                  {asset.asset_tag ? `${asset.asset_tag} • ` : ""}
                  {asset.asset_type} • {asset.building}
                </div>
              </div>
              <div style={statusTextStyle(asset.status)}>{asset.status}</div>
            </div>
          ))}
        </div>

        <div style={panelStyle}>
          <h3 style={panelTitleStyle}>Quick Actions</h3>
          <button style={actionButtonStyle} onClick={() => goToSection("add")}>
            <span style={buttonIconTextStyle}>
              <Plus size={18} />
              Add New Asset
            </span>
          </button>
          <button
            style={actionButtonStyle}
            onClick={() => goToSection("assets")}
          >
            <span style={buttonIconTextStyle}>
              <FolderOpen size={18} />
              Manage Assets
            </span>
          </button>
          <button style={actionButtonStyle} onClick={() => goToSection("map")}>
            <span style={buttonIconTextStyle}>
              <Map size={18} />
              Open Map View
            </span>
          </button>
          <button style={actionButtonStyle} onClick={() => goToSection("logs")}>
            <span style={buttonIconTextStyle}>
              <FileText size={18} />
              View Logs
            </span>
          </button>
          <button style={actionButtonStyle} onClick={exportAssetsCSV}>
            <span style={buttonIconTextStyle}>
              <FileSpreadsheet size={18} />
              Export Assets CSV
            </span>
          </button>

          <button style={actionButtonStyle} onClick={exportLogsCSV}>
            <span style={buttonIconTextStyle}>
              <Download size={18} />
              Export Logs CSV
            </span>
          </button>
        </div>
      </div>

      <div style={{ ...panelStyle, marginTop: "20px" }}>
        <h3 style={panelTitleStyle}>Recent Activity</h3>

        {recentActivity.length === 0 ? (
          <p style={{ opacity: 0.75 }}>No recent activity yet.</p>
        ) : (
          recentActivity.map((activity) => (
            <div key={activity.id} style={activityRowStyle}>
              <div>{activity.message}</div>
              <div style={{ fontSize: "12px", opacity: 0.65 }}>
                {activity.time}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderAlerts = () => (
    <div>
      <h2 style={sectionTitleStyle}>Maintenance Alerts</h2>

      <div style={panelStyle}>
        <h3 style={panelTitleStyle}>Overdue Maintenance</h3>

        {maintenanceAlerts.overdue.length === 0 ? (
          <p style={{ opacity: 0.75 }}>No overdue maintenance.</p>
        ) : (
          maintenanceAlerts.overdue.map((asset) => (
            <div
              key={asset.id}
              style={alertRowStyle("overdue")}
              onClick={() => selectAsset(asset)}
            >
              <strong>{asset.name}</strong>
              <span>Due: {asset.next_maintenance_date}</span>
            </div>
          ))
        )}
      </div>

      <div style={{ ...panelStyle, marginTop: "18px" }}>
        <h3 style={panelTitleStyle}>Due Soon</h3>

        {maintenanceAlerts.dueSoon.length === 0 ? (
          <p style={{ opacity: 0.75 }}>No assets due within 7 days.</p>
        ) : (
          maintenanceAlerts.dueSoon.map((asset) => (
            <div
              key={asset.id}
              style={alertRowStyle("soon")}
              onClick={() => selectAsset(asset)}
            >
              <strong>{asset.name}</strong>
              <span>Due: {asset.next_maintenance_date}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderLogs = () => (
    <div>
      <h2 style={sectionTitleStyle}>Monitoring Logs</h2>

      <div style={panelStyle}>
        <div style={logsHeaderStyle}>
          <div>
            <h3 style={panelTitleStyle}>System Activity History</h3>
            <p style={{ marginTop: "-8px", opacity: 0.7 }}>
              Full monitoring record of asset and staff actions during this
              session.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button style={secondaryButtonStyle} onClick={exportLogsCSV}>
              Export Logs CSV
            </button>

            <button style={secondaryButtonStyle} onClick={clearLogs}>
              Clear Logs
            </button>
          </div>
        </div>

        {activityLog.length === 0 ? (
          <p style={{ opacity: 0.75 }}>No logs recorded yet.</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {activityLog.map((activity) => (
              <div key={activity.id} style={logCardStyle}>
                <div>
                  <span style={logBadgeStyle(activity.type)}>
                    {activity.type.toUpperCase()}
                  </span>
                  <strong style={{ marginLeft: "10px" }}>
                    {activity.message}
                  </strong>
                </div>
                <div
                  style={{ fontSize: "13px", opacity: 0.75, marginTop: "6px" }}
                >
                  User: {activity.user} • Time: {activity.time}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderAssets = () => (
    <div>
      <h2 style={sectionTitleStyle}>Assets</h2>

      {selectedAsset && (
        <div style={detailsPanelStyle}>
          <h3 style={panelTitleStyle}>Selected Asset Details</h3>

          <div style={detailsContentStyle}>
            {selectedAsset.image && (
              <div style={detailsImageBoxStyle}>
                <img
                  src={getImageUrl(selectedAsset.image)}
                  alt={selectedAsset.name}
                  style={detailsImageStyle}
                />
              </div>
            )}

            <div>
              <h3 style={{ marginTop: 0 }}>{selectedAsset.name}</h3>
              <p>
                <strong>Tag:</strong> {selectedAsset.asset_tag || "Not set"}
              </p>
              <p>
                <strong>Type:</strong> {selectedAsset.asset_type}
              </p>
              <p>
                <strong>Status:</strong> {selectedAsset.status}
              </p>
              <p>
                <strong>Condition:</strong> {selectedAsset.condition || "N/A"}
              </p>
              <p>
                <strong>Last checked:</strong>{" "}
                {selectedAsset.last_checked || "Not set"}
              </p>

              <p>
                <strong>Next maintenance:</strong>{" "}
                {selectedAsset.next_maintenance_date || "Not set"}
              </p>
              <p>
                <strong>Assigned to:</strong>{" "}
                {selectedAsset.assigned_to || "Unassigned"}
              </p>
              <p>
                <strong>Location:</strong> {selectedAsset.building}{" "}
                {selectedAsset.room ? `• ${selectedAsset.room}` : ""}
              </p>
              <p>
                <strong>Coordinates:</strong> {selectedAsset.latitude},{" "}
                {selectedAsset.longitude}
              </p>
              <p>
                <strong>Notes:</strong>{" "}
                {selectedAsset.notes || "No notes added"}
              </p>

              <div style={qrBoxStyle}>
                <p style={{ marginTop: 0, fontWeight: "bold" }}>
                  Asset QR Code
                </p>

                <QRCodeCanvas
                  value={getAssetQrUrl(selectedAsset.id)}
                  size={140}
                  bgColor="#ffffff"
                  fgColor="#000000"
                />

                <p style={{ fontSize: "12px", opacity: 0.75 }}>
                  Scan to open this asset record.
                </p>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button
                  style={buttonStyle}
                  onClick={() => focusAsset(selectedAsset)}
                >
                  View on Map
                </button>

                <button
                  style={secondaryButtonStyle}
                  onClick={() => setSelectedId(null)}
                >
                  Clear Selection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingAsset && (
        <div style={detailsPanelStyle}>
          <h3 style={panelTitleStyle}>Edit Asset Details</h3>

          <form onSubmit={saveEditedAsset}>
            <input
              type="text"
              placeholder="Asset name"
              value={editingAsset.name || ""}
              onChange={(e) =>
                setEditingAsset({ ...editingAsset, name: e.target.value })
              }
              style={inputStyle}
              required
            />

            <input
              type="text"
              placeholder="Asset tag"
              value={editingAsset.asset_tag || ""}
              onChange={(e) =>
                setEditingAsset({ ...editingAsset, asset_tag: e.target.value })
              }
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Asset type"
              value={editingAsset.asset_type || ""}
              onChange={(e) =>
                setEditingAsset({ ...editingAsset, asset_type: e.target.value })
              }
              style={inputStyle}
              required
            />

            <select
              value={editingAsset.status || "available"}
              onChange={(e) =>
                setEditingAsset({ ...editingAsset, status: e.target.value })
              }
              style={inputStyle}
            >
              <option value="available">Available</option>
              <option value="in_use">In Use</option>
              <option value="maintenance">Maintenance</option>
              <option value="lost">Lost</option>
            </select>

            <select
              value={editingAsset.condition || "good"}
              onChange={(e) =>
                setEditingAsset({ ...editingAsset, condition: e.target.value })
              }
              style={inputStyle}
            >
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </select>

            <input
              type="text"
              placeholder="Assigned to"
              value={editingAsset.assigned_to || ""}
              onChange={(e) =>
                setEditingAsset({
                  ...editingAsset,
                  assigned_to: e.target.value,
                })
              }
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Building"
              value={editingAsset.building || ""}
              onChange={(e) =>
                setEditingAsset({ ...editingAsset, building: e.target.value })
              }
              style={inputStyle}
            />

            <input
              type="text"
              placeholder="Room"
              value={editingAsset.room || ""}
              onChange={(e) =>
                setEditingAsset({ ...editingAsset, room: e.target.value })
              }
              style={inputStyle}
            />

            <textarea
              placeholder="Notes"
              value={editingAsset.notes || ""}
              onChange={(e) =>
                setEditingAsset({ ...editingAsset, notes: e.target.value })
              }
              style={textareaStyle}
              rows={4}
            />

            <input
              type="file"
              accept="image/*"
              onChange={(e) =>
                setEditingAsset({
                  ...editingAsset,
                  image: e.target.files[0] || null,
                })
              }
              style={inputStyle}
            />

            <input
              type="number"
              step="any"
              placeholder="Latitude"
              value={editingAsset.latitude || ""}
              onChange={(e) =>
                setEditingAsset({ ...editingAsset, latitude: e.target.value })
              }
              style={inputStyle}
              required
            />

            <input
              type="number"
              step="any"
              placeholder="Longitude"
              value={editingAsset.longitude || ""}
              onChange={(e) =>
                setEditingAsset({ ...editingAsset, longitude: e.target.value })
              }
              style={inputStyle}
              required
            />

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="submit"
                style={{ ...buttonStyle, flex: "1 1 180px" }}
              >
                Save Changes
              </button>

              <button
                type="button"
                onClick={cancelEditAsset}
                style={{ ...secondaryButtonStyle, flex: "1 1 180px" }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={filtersPanelStyle}>
        <input
          type="text"
          placeholder="Search by name, tag, type, status, assignee..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ ...inputStyle, marginBottom: 0 }}
        />

        <div style={filtersGridStyle}>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ ...inputStyle, marginBottom: 0 }}
          >
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="in_use">In Use</option>
            <option value="maintenance">Maintenance</option>
            <option value="lost">Lost</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ ...inputStyle, marginBottom: 0 }}
          >
            <option value="all">All Types</option>
            {assetTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
            style={{ ...inputStyle, marginBottom: 0 }}
          >
            <option value="all">All Buildings</option>
            {buildings.map((building) => (
              <option key={building} value={building}>
                {building}
              </option>
            ))}
          </select>

          <button onClick={clearFilters} style={secondaryButtonStyle}>
            Clear Filters
          </button>
        </div>

        <div style={{ fontSize: "13px", opacity: 0.75 }}>
          Showing {filteredAssets.length} of {assets.length} assets
        </div>
      </div>

      {loading && <p>Loading assets...</p>}
      {errorMsg && <p style={{ color: "red" }}>{errorMsg}</p>}

      <div style={{ display: "grid", gap: "12px" }}>
        {filteredAssets.map((asset) => (
          <div key={asset.id} style={assetManagementCardStyle}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile
                  ? "1fr"
                  : asset.image
                    ? "180px 1fr"
                    : "1fr",
                gap: "16px",
                alignItems: "start",
              }}
            >
              {asset.image && (
                <div
                  style={{
                    width: isMobile ? "100%" : "180px",
                    height: "180px",
                    overflow: "hidden",
                    borderRadius: "10px",
                    border: "1px solid #242424",
                    background: "#111",
                  }}
                >
                  <img
                    src={getImageUrl(asset.image)}
                    alt={asset.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              )}

              <div
                onClick={() => selectAsset(asset)}
                style={{ cursor: "pointer" }}
              >
                <div style={{ fontWeight: "bold", fontSize: "18px" }}>
                  {asset.name}
                </div>
                <div
                  style={{ marginTop: "6px", fontSize: "13px", opacity: 0.9 }}
                >
                  {asset.asset_tag ? `Tag: ${asset.asset_tag}` : "Tag: Not set"}
                </div>
                <div style={{ marginTop: "4px", opacity: 0.9 }}>
                  {asset.asset_type} •{" "}
                  <span style={statusTextStyle(asset.status)}>
                    {asset.status}
                  </span>
                </div>
                <div
                  style={{ marginTop: "4px", fontSize: "13px", opacity: 0.8 }}
                >
                  Condition: {asset.condition || "N/A"}
                </div>
                <div
                  style={{ marginTop: "4px", fontSize: "13px", opacity: 0.8 }}
                >
                  Last checked: {asset.last_checked || "Not set"}
                </div>

                <div
                  style={{ marginTop: "4px", fontSize: "13px", opacity: 0.8 }}
                >
                  Next maintenance: {asset.next_maintenance_date || "Not set"}
                </div>
                <div
                  style={{ marginTop: "4px", fontSize: "13px", opacity: 0.8 }}
                >
                  Assigned to: {asset.assigned_to || "Unassigned"}
                </div>
                <div
                  style={{ marginTop: "4px", fontSize: "13px", opacity: 0.8 }}
                >
                  {asset.building} {asset.room ? `• ${asset.room}` : ""}
                </div>
                {asset.notes && (
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "13px",
                      opacity: 0.75,
                    }}
                  >
                    Notes: {asset.notes}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginTop: "14px",
                flexWrap: "wrap",
              }}
            >
              <select
                value={asset.status}
                onChange={(e) => updateAssetStatus(asset.id, e.target.value)}
                style={{ ...inputStyle, marginBottom: 0, flex: "1 1 180px" }}
              >
                <option value="available">Available</option>
                <option value="in_use">In Use</option>
                <option value="maintenance">Maintenance</option>
                <option value="lost">Lost</option>
              </select>

              <button
                onClick={() => startEditAsset(asset)}
                style={{ ...secondaryButtonStyle, flex: "1 1 140px" }}
              >
                Edit
              </button>

              <button
                onClick={() => deleteAsset(asset.id)}
                style={{ ...dangerButtonStyle, flex: "1 1 140px" }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAddAsset = () => (
    <div>
      <h2 style={sectionTitleStyle}>Add New Asset</h2>
      <p style={{ fontSize: "14px", opacity: 0.75, marginBottom: "16px" }}>
        Click on the map to auto-fill the asset location.
      </p>

      <div style={formMapLayoutStyle}>
        <form onSubmit={addAsset} style={panelStyle}>
          <input
            type="text"
            placeholder="Asset name"
            value={newAsset.name}
            onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
            style={inputStyle}
            required
          />
          <input
            type="text"
            placeholder="Asset tag (e.g. LAP-001)"
            value={newAsset.asset_tag}
            onChange={(e) =>
              setNewAsset({ ...newAsset, asset_tag: e.target.value })
            }
            style={inputStyle}
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

          <select
            value={newAsset.condition}
            onChange={(e) =>
              setNewAsset({ ...newAsset, condition: e.target.value })
            }
            style={inputStyle}
          >
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>

          <input
            type="text"
            placeholder="Assigned to"
            value={newAsset.assigned_to}
            onChange={(e) =>
              setNewAsset({ ...newAsset, assigned_to: e.target.value })
            }
            style={inputStyle}
          />
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
            onChange={(e) => setNewAsset({ ...newAsset, room: e.target.value })}
            style={inputStyle}
          />

          <textarea
            placeholder="Notes"
            value={newAsset.notes}
            onChange={(e) =>
              setNewAsset({ ...newAsset, notes: e.target.value })
            }
            style={textareaStyle}
            rows={4}
          />

          <input
            type="file"
            accept="image/*"
            onChange={(e) =>
              setNewAsset({ ...newAsset, image: e.target.files[0] || null })
            }
            style={inputStyle}
          />

          <label style={fieldLabelStyle}>Last checked date</label>
          <input
            type="date"
            value={newAsset.last_checked}
            onChange={(e) =>
              setNewAsset({ ...newAsset, last_checked: e.target.value })
            }
            style={inputStyle}
          />

          <label style={fieldLabelStyle}>Next maintenance date</label>
          <input
            type="date"
            value={newAsset.next_maintenance_date}
            onChange={(e) =>
              setNewAsset({
                ...newAsset,
                next_maintenance_date: e.target.value,
              })
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

        <div
          style={{
            ...panelStyle,
            height: isMobile ? "420px" : "500px",
            padding: 0,
            overflow: "hidden",
          }}
        >
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
                    {asset.image && (
                      <div
                        style={{
                          width: "220px",
                          height: "120px",
                          overflow: "hidden",
                          borderRadius: "8px",
                          marginBottom: "8px",
                          background: "#111",
                        }}
                      >
                        <img
                          src={getImageUrl(asset.image)}
                          alt={asset.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      </div>
                    )}
                    <strong>{asset.name}</strong>
                    <br />
                    {asset.asset_tag ? `Tag: ${asset.asset_tag}` : "No tag"}
                    <br />
                    Type: {asset.asset_type}
                    <br />
                    Status: {asset.status}
                    <br />
                    Condition: {asset.condition || "N/A"}
                    <br />
                    Last checked: {asset.last_checked || "Not set"}
                    <br />
                    Next maintenance: {asset.next_maintenance_date || "Not set"}
                    <br />
                    Assigned to: {asset.assigned_to || "Unassigned"}
                    <br />
                    {asset.building} {asset.room ? `• ${asset.room}` : ""}
                    {asset.notes ? (
                      <>
                        <br />
                        Notes: {asset.notes}
                      </>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>
    </div>
  );

  const renderMap = () => (
    <div>
      <h2 style={sectionTitleStyle}>Map View</h2>

      <div
        style={{
          ...panelStyle,
          height: isMobile ? "500px" : "620px",
          padding: 0,
          overflow: "hidden",
        }}
      >
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
                  {asset.image && (
                    <div
                      style={{
                        width: "220px",
                        height: "120px",
                        overflow: "hidden",
                        borderRadius: "8px",
                        marginBottom: "8px",
                        background: "#111",
                      }}
                    >
                      <img
                        src={getImageUrl(asset.image)}
                        alt={asset.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </div>
                  )}
                  <strong>{asset.name}</strong>
                  <br />
                  {asset.asset_tag ? `Tag: ${asset.asset_tag}` : "No tag"}
                  <br />
                  Type: {asset.asset_type}
                  <br />
                  Status: {asset.status}
                  <br />
                  Condition: {asset.condition || "N/A"}
                  <br />
                  Last checked: {asset.last_checked || "Not set"}
                  <br />
                  Next maintenance: {asset.next_maintenance_date || "Not set"}
                  <br />
                  Assigned to: {asset.assigned_to || "Unassigned"}
                  <br />
                  {asset.building} {asset.room ? `• ${asset.room}` : ""}
                  {asset.notes ? (
                    <>
                      <br />
                      Notes: {asset.notes}
                    </>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );

  if (authLoading) {
    return (
      <div style={loginPageStyle}>
        <div style={loginCardStyle}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={loginPageStyle}>
        <form onSubmit={handleLogin} style={loginCardStyle}>
          <div style={loginLogoWrapStyle}>
            <img
              src={locateitLogo}
              alt="LocateIT Logo"
              style={loginLogoStyle}
            />
          </div>
          {/* <p style={loginSubtitleStyle}>
          Secure access to the Asset Monitoring System
        </p> */}

          <input
            type="text"
            placeholder="Username"
            value={loginForm.username}
            onChange={(e) =>
              setLoginForm({ ...loginForm, username: e.target.value })
            }
            style={inputStyle}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={loginForm.password}
            onChange={(e) =>
              setLoginForm({ ...loginForm, password: e.target.value })
            }
            style={inputStyle}
            required
          />

          <button type="submit" style={buttonStyle}>
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      {toast && <div style={toastStyle(toast.type)}>{toast.message}</div>}
      <div style={appShellStyle}>
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              background: "rgba(0,0,0,0.55)",
              zIndex: 998,
            }}
          />
        )}

        <aside style={sidebarStyle}>
          <div style={brandStyle}>
            <img
              src={locateitLogo}
              alt="LocateIT logo"
              style={brandLogoStyle}
            />
          </div>

          <button
            style={navButtonStyle(activeSection === "dashboard")}
            onClick={() => goToSection("dashboard")}
          >
            <span style={navIconTextStyle}>
              <LayoutDashboard size={18} />
              Dashboard
            </span>
          </button>

          <button
            style={navButtonStyle(activeSection === "assets")}
            onClick={() => goToSection("assets")}
          >
            <span style={navIconTextStyle}>
              <Package size={18} />
              Assets
            </span>
          </button>

          <button
            style={navButtonStyle(activeSection === "map")}
            onClick={() => goToSection("map")}
          >
            <span style={navIconTextStyle}>
              <Map size={18} />
              Map View
            </span>
          </button>

          <button
            style={navButtonStyle(activeSection === "add")}
            onClick={() => goToSection("add")}
          >
            <span style={navIconTextStyle}>
              <PlusSquare size={18} />
              Add Asset
            </span>
          </button>

          <button
            style={navButtonStyle(activeSection === "alerts")}
            onClick={() => goToSection("alerts")}
          >
            <span style={navIconTextStyle}>
              <Bell size={18} />
              Alerts{" "}
              {maintenanceAlerts.total > 0
                ? `(${maintenanceAlerts.total})`
                : ""}
            </span>
          </button>

          <button
            style={navButtonStyle(activeSection === "logs")}
            onClick={() => goToSection("logs")}
          >
            <span style={navIconTextStyle}>
              <ClipboardList size={18} />
              Logs
            </span>
          </button>
        </aside>

        <div style={mainAreaStyle}>
          <header style={topbarStyle}>
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                style={{
                  background: "#181818",
                  color: "white",
                  border: "1px solid #333",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontSize: "18px",
                }}
              >
                ☰
              </button>
            )}

            <div style={{ fontWeight: "bold", letterSpacing: "0.5px" }}>
              Asset Monitoring and Management Dashboard
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <span style={{ opacity: 0.85 }}>Logged in as {username}</span>
              <button
                onClick={handleLogout}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #7f1d1d",
                  background: "#181818",
                  color: "white",
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </div>
          </header>

          <main ref={mainContentRef} style={contentStyle}>
            {activeSection === "dashboard" && renderDashboard()}
            {activeSection === "assets" && renderAssets()}
            {activeSection === "map" && renderMap()}
            {activeSection === "add" && renderAddAsset()}
            {activeSection === "alerts" && renderAlerts()}
            {activeSection === "logs" && renderLogs()}
          </main>
        </div>
      </div>

      <footer style={footerStyle}>
        <div style={footerLeftStyle}>
          <img
            src={uswLogo}
            alt="University of South Wales logo"
            style={uswLogoStyle}
          />
          <div>
            <strong>University of South Wales</strong>
            <div style={{ opacity: 0.75 }}>Prifysgol De Cymru</div>
          </div>
        </div>

        <div style={footerCenterStyle}>
          <strong>LocateIT Asset Monitoring and Management System</strong>
          <div style={{ opacity: 0.75 }}>© 2026 All rights reserved.</div>
        </div>

        <div style={footerRightStyle}>
          <strong>Developed by Sanuth Nathavitharana</strong>
          <div style={{ opacity: 0.75 }}>Final Year Project</div>
        </div>
      </footer>
    </>
  );
}

const statusTextStyle = (status) => ({
  fontSize: "13px",
  color:
    status === "available"
      ? "#2ecc71"
      : status === "in_use"
        ? "#3498db"
        : status === "maintenance"
          ? "#f39c12"
          : "#e74c3c",
});

const logBadgeStyle = (type) => ({
  fontSize: "11px",
  padding: "4px 8px",
  borderRadius: "999px",
  border: "1px solid #333",
  color:
    type === "create"
      ? "#2ecc71"
      : type === "update"
        ? "#3498db"
        : type === "delete"
          ? "#e74c3c"
          : type === "login"
            ? "#f39c12"
            : "#d0d0d0",
});

const sectionTitleStyle = {
  fontSize: "36px",
  marginTop: 0,
  marginBottom: "20px",
  fontWeight: "bold",
  fontFamily: "Calibri, sans-serif",
};

const statCardStyle = {
  background: "linear-gradient(180deg, #121212 0%, #0c0c0c 100%)",
  border: "1px solid #242424",
  borderRadius: "14px",
  padding: "18px",
  textAlign: "center",
  boxShadow: "0 0 14px rgba(183,28,28,0.08)",
};

const statNumberStyle = {
  fontSize: "28px",
  fontWeight: "bold",
  color: "#ffffff",
  fontFamily: "Calibri, sans-serif",
};

const statLabelStyle = {
  fontSize: "14px",
  opacity: 0.82,
  marginTop: "4px",
  color: "#d0d0d0",
};

const panelStyle = {
  background: "#101010",
  border: "1px solid #1f1f1f",
  borderRadius: "14px",
  padding: "20px",
  boxShadow: "0 0 18px rgba(0,0,0,0.25)",
};

const panelTitleStyle = {
  marginTop: 0,
  marginBottom: "16px",
  fontSize: "22px",
  fontWeight: "bold",
  fontFamily: "Calibri, sans-serif",
};

const logsHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "16px",
  flexWrap: "wrap",
};

const logCardStyle = {
  background: "#080808",
  border: "1px solid #242424",
  borderRadius: "10px",
  padding: "14px",
};

const filtersPanelStyle = {
  background: "#101010",
  border: "1px solid #1f1f1f",
  borderRadius: "12px",
  padding: "16px",
  marginBottom: "18px",
  display: "grid",
  gap: "12px",
};

const miniAssetRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 0",
  borderBottom: "1px solid #1f1f1f",
  cursor: "pointer",
};

const activityRowStyle = {
  padding: "12px 0",
  borderBottom: "1px solid #1f1f1f",
  fontSize: "14px",
};

const assetManagementCardStyle = {
  background: "#101010",
  border: "1px solid #1f1f1f",
  borderRadius: "12px",
  padding: "16px",
  overflow: "hidden",
};

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "12px",
  borderRadius: "8px",
  border: "1px solid #242424",
  background: "#080808",
  color: "white",
  boxSizing: "border-box",
  fontFamily: "Calibri, sans-serif",
};

const textareaStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "12px",
  borderRadius: "8px",
  border: "1px solid #242424",
  background: "#080808",
  color: "white",
  boxSizing: "border-box",
  fontFamily: "Calibri, sans-serif",
  resize: "vertical",
};

const buttonStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #7f1d1d",
  background: "linear-gradient(180deg, #b71c1c 0%, #7f1d1d 100%)",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily: "Calibri, sans-serif",
};

const secondaryButtonStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #2a2a2a",
  background: "#181818",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  fontFamily: "Calibri, sans-serif",
};

const actionButtonStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #333",
  background: "linear-gradient(180deg, #1b1b1b 0%, #121212 100%)",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
  marginBottom: "10px",
  transition: "0.2s ease",
};

const dangerButtonStyle = {
  width: "100%",
  padding: "12px",
  borderRadius: "8px",
  border: "1px solid #5c0f0f",
  background: "linear-gradient(180deg, #c62828 0%, #7f1d1d 100%)",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer",
};

const loginPageStyle = {
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#050505",
  padding: "16px",
  boxSizing: "border-box",
};

const loginCardStyle = {
  width: "100%",
  maxWidth: "420px",
  background: "#101010",
  border: "1px solid #1f1f1f",
  borderRadius: "14px",
  padding: "28px",
};

const detailsPanelStyle = {
  background: "#101010",
  border: "1px solid #1f1f1f",
  borderRadius: "12px",
  padding: "18px",
  marginBottom: "18px",
};

const detailsImageBoxStyle = {
  width: "220px",
  height: "220px",
  overflow: "hidden",
  borderRadius: "12px",
  border: "1px solid #242424",
  background: "#111",
};

const detailsImageStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const fieldLabelStyle = {
  display: "block",
  marginBottom: "6px",
  fontSize: "13px",
  color: "#d0d0d0",
  fontWeight: "bold",
};

const alertRowStyle = (type) => ({
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  padding: "12px",
  marginBottom: "10px",
  borderRadius: "10px",
  border: type === "overdue" ? "1px solid #7f1d1d" : "1px solid #7a4f00",
  background: type === "overdue" ? "#1a0808" : "#1a1205",
  color: "white",
  cursor: "pointer",
});

const qrBoxStyle = {
  marginTop: "16px",
  padding: "14px",
  borderRadius: "12px",
  background: "#080808",
  border: "1px solid #242424",
  display: "inline-block",
};

const brandLogoStyle = {
  width: "190px",
  height: "auto",
  objectFit: "contain",
  display: "block",
  margin: "0 auto 8px auto",
};
const footerStyle = {
  width: "100%",
  borderTop: "1px solid #7f1d1d",
  background: "linear-gradient(180deg, #080808 0%, #050505 100%)",
  padding: "12px 24px",
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: "12px",
  alignItems: "center",
  color: "#ffffff",
  boxSizing: "border-box",
  minHeight: "70px",
};

const footerLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontSize: "14px",
};

const uswLogoStyle = {
  width: "42px",
  height: "42px",
  objectFit: "contain",
  borderRadius: "4px",
};

const footerCenterStyle = {
  textAlign: "center",
  borderLeft: "1px solid #333",
  borderRight: "1px solid #333",
  padding: "0 14px",
  fontSize: "14px",
};

const footerRightStyle = {
  textAlign: "right",
  fontSize: "14px",
};

const subtitleStyle = {
  marginTop: "-12px",
  marginBottom: "22px",
  color: "#bdbdbd",
  fontSize: "15px",
};

const navIconTextStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};

const statIconBoxStyle = (color) => ({
  width: "46px",
  height: "46px",
  borderRadius: "12px",
  background: `${color}22`,
  color: color,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  margin: "0 auto 10px auto",
});

const buttonIconTextStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
};

const toastStyle = (type) => ({
  position: "fixed",
  top: "20px",
  right: "20px",
  zIndex: 2000,
  padding: "14px 18px",
  borderRadius: "10px",
  background: type === "error" ? "#2a0808" : "#082a14",
  border: type === "error" ? "1px solid #e74c3c" : "1px solid #2ecc71",
  color: "white",
  fontWeight: "bold",
  boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
});

const loginLogoWrapStyle = {
  textAlign: "center",
  marginBottom: "14px",
};

const loginLogoStyle = {
  width: "220px",
  height: "auto",
  objectFit: "contain",
};

const loginTitleStyle = {
  marginTop: 0,
  marginBottom: "8px",
  textAlign: "center",
  fontSize: "42px",
  fontWeight: "bold",
};

const loginSubtitleStyle = {
  textAlign: "center",
  opacity: 0.7,
  fontSize: "14px",
  marginBottom: "22px",
};
