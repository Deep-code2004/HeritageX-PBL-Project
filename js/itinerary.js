/* ---------------------------
   HeritageX — itinerary.js
   --------------------------- */

const TRAVEL_BUFFER_MIN = 15; // assumed walk/transfer time between consecutive stops

function getItinerary() { return lsGet(LS_KEYS.itinerary, []); }
function setItinerary(items) { lsSet(LS_KEYS.itinerary, items); }

function durationMidpoint(str) {
    const nums = (str.match(/\d+/g) || []).map(Number);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 30;
}

function formatClock(mins) {
    const h = Math.floor(mins / 60) % 24;
    const m = Math.round(mins % 60);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function renderItinerary() {
    const items = getItinerary();
    const list = document.getElementById("itineraryList");
    const empty = document.getElementById("itineraryEmpty");

    if (!items.length) {
        list.innerHTML = "";
        empty.classList.remove("d-none");
        updateSummary([]);
        renderItineraryMap([]);
        return;
    }
    empty.classList.add("d-none");

    const startTimeStr = document.getElementById("tripStart").value || "09:00";
    const [sh, sm] = startTimeStr.split(":").map(Number);
    let clock = sh * 60 + sm;

    const rows = [];
    items.forEach((item, idx) => {
        const site = getSiteById(item.siteId);
        if (!site) return;
        const arrival = formatClock(clock);
        rows.push({ item, site, idx, arrival });
        clock += durationMidpoint(site.duration) + TRAVEL_BUFFER_MIN;
    });

    list.innerHTML = rows.map(({ site, idx, arrival }) => `
    <div class="itinerary-item" draggable="true" data-index="${idx}">
      <span class="drag-handle"><i class="bi bi-grip-vertical"></i></span>
      <span class="itinerary-time">${arrival}</span>
      <img src="${site.image}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px;">
      <div class="flex-grow-1">
        <div class="fw-semibold">${site.name}</div>
        <div class="small text-charcoal-soft">${site.category} · ${site.duration}</div>
      </div>
      <a href="detail.html?slug=${site.slug}" class="btn btn-sm btn-outline-maroon no-print" aria-label="View ${site.name}"><i class="bi bi-eye"></i></a>
      <button class="btn btn-sm btn-outline-maroon no-print remove-stop-btn" data-index="${idx}" aria-label="Remove ${site.name} from trip"><i class="bi bi-x-lg"></i></button>
    </div>`).join("");

    wireDragAndDrop();
    list.querySelectorAll(".remove-stop-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            const items2 = getItinerary();
            items2.splice(Number(btn.dataset.index), 1);
            setItinerary(items2);
            renderItinerary();
            showToast("Removed from trip", "bi-x-circle");
        });
    });

    updateSummary(rows.map((r) => r.site));
    renderItineraryMap(rows.map((r) => r.site));
}

function wireDragAndDrop() {
    const list = document.getElementById("itineraryList");
    let dragIndex = null;
    list.querySelectorAll(".itinerary-item").forEach((el) => {
        el.addEventListener("dragstart", () => { dragIndex = Number(el.dataset.index); el.classList.add("dragging"); });
        el.addEventListener("dragend", () => el.classList.remove("dragging"));
        el.addEventListener("dragover", (e) => e.preventDefault());
        el.addEventListener("drop", () => {
            const dropIndex = Number(el.dataset.index);
            if (dragIndex === null || dragIndex === dropIndex) return;
            const items = getItinerary();
            const [moved] = items.splice(dragIndex, 1);
            items.splice(dropIndex, 0, moved);
            setItinerary(items);
            renderItinerary();
        });
    });
}

function updateSummary(sites) {
    document.getElementById("sumStops").textContent = sites.length;
    const totalVisitMin = sites.reduce((sum, s) => sum + durationMidpoint(s.duration), 0);
    const travelMin = sites.length > 1 ? (sites.length - 1) * TRAVEL_BUFFER_MIN : 0;
    let distanceTotal = 0;
    for (let i = 0; i < sites.length - 1; i++) {
        distanceTotal += distanceKm(sites[i].latitude, sites[i].longitude, sites[i + 1].latitude, sites[i + 1].longitude);
    }
    const fmt = (mins) => `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
    document.getElementById("sumDuration").textContent = fmt(totalVisitMin);
    document.getElementById("sumDistance").textContent = `${distanceTotal.toFixed(1)} km`;
    document.getElementById("sumTotal").textContent = fmt(totalVisitMin + travelMin);
}

let itMap, itLayer;
function renderItineraryMap(sites) {
    if (!itMap) {
        itMap = L.map("itineraryMap", { scrollWheelZoom: false }).setView([23.028, 72.585], 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap contributors" }).addTo(itMap);
        itLayer = L.layerGroup().addTo(itMap);
    }
    itLayer.clearLayers();
    if (!sites.length) return;
    const latlngs = sites.map((s) => [s.latitude, s.longitude]);
    sites.forEach((s, i) => {
        L.marker([s.latitude, s.longitude], {
            icon: L.divIcon({ className: "", html: `<div style="background:#6E1E24;color:#F8F3E8;border-radius:50%;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;border:2px solid #fff;">${i + 1}</div>` })
        }).addTo(itLayer).bindPopup(s.name);
    });
    L.polyline(latlngs, { color: "#C17A45", weight: 3, dashArray: "6 6" }).addTo(itLayer);
    itMap.fitBounds(latlngs, { padding: [30, 30] });
}

function populateAddPlaceSelect() {
    const sel = document.getElementById("addPlaceSelect");
    const inTrip = getItinerary().map((i) => i.siteId);
    sel.innerHTML = getAllSites()
        .filter((s) => !inTrip.includes(s.id))
        .map((s) => `<option value="${s.id}">${s.name} — ${s.category}</option>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("tripDate").valueAsDate = new Date();
    renderItinerary();
    populateAddPlaceSelect();

    document.getElementById("tripStart").addEventListener("change", renderItinerary);

    document.getElementById("addPlaceBtn").addEventListener("click", () => {
        const sel = document.getElementById("addPlaceSelect");
        if (!sel.value) return;
        const items = getItinerary();
        items.push({ siteId: Number(sel.value), time: "" });
        setItinerary(items);
        renderItinerary();
        populateAddPlaceSelect();
        showToast("Added to your trip", "bi-map");
    });

    document.getElementById("clearTripBtn").addEventListener("click", () => {
        if (!confirm("Clear all stops from your trip?")) return;
        setItinerary([]);
        renderItinerary();
        populateAddPlaceSelect();
    });

    document.getElementById("saveTripBtn").addEventListener("click", () => {
        lsSet("heritagex_saved_itinerary_meta", {
            date: document.getElementById("tripDate").value,
            start: document.getElementById("tripStart").value,
            hours: document.getElementById("tripHours").value,
            savedAt: new Date().toISOString()
        });
        showToast("Itinerary saved to this device", "bi-check-circle-fill");
    });

    document.getElementById("printTripBtn").addEventListener("click", () => window.print());
});