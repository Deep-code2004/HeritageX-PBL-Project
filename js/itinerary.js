/* ---------------------------
   HeritageX — itinerary.js
   --------------------------- */

const TRAVEL_BUFFER_MIN = 15; // assumed walk/transfer time between consecutive stops
let itinerarySiteCache = new Map();
let activeItineraryId = null;

function getItinerary() { return lsGet(LS_KEYS.itinerary, []); }
function setItinerary(items) { lsSet(LS_KEYS.itinerary, items); }
function getItinerarySite(siteId) {
    return itinerarySiteCache.get(Number(siteId)) || getSiteById(siteId);
}

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
        const site = getItinerarySite(item.siteId);
        if (!site) return;
        const arrival = formatClock(clock);
        rows.push({ item, site, idx, arrival });
        clock += durationMidpoint(site.duration) + TRAVEL_BUFFER_MIN;
    });

    list.innerHTML = rows.map(({ site, idx, arrival }) => `
    <div class="itinerary-item" draggable="true" data-index="${idx}">
      <span class="drag-handle"><i class="bi bi-grip-vertical"></i></span>
      <span class="itinerary-time">${arrival}</span>
      <img src="${escapeHTML(site.image)}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:10px;">
      <div class="flex-grow-1">
        <div class="fw-semibold">${escapeHTML(site.name)}</div>
        <div class="small text-charcoal-soft">${escapeHTML(site.category)} · ${escapeHTML(site.duration)}</div>
      </div>
      <a href="detail.html?slug=${encodeURIComponent(site.slug)}" class="btn btn-sm btn-outline-maroon no-print" aria-label="View ${escapeHTML(site.name)}"><i class="bi bi-eye"></i></a>
      <button class="btn btn-sm btn-outline-maroon no-print remove-stop-btn" data-index="${idx}" aria-label="Remove ${escapeHTML(site.name)} from trip"><i class="bi bi-x-lg"></i></button>
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

let itMap, itPolyline = null, itMarkers = [];
function renderItineraryMap(sites) {
    const container = document.getElementById("itineraryMap");
    if (!container) return;

    if (!window.L) {
        document.getElementById("itineraryMapStatus").textContent =
            "Map preview unavailable. Your ordered stops and distance summary are still shown above.";
        return;
    }
    if (!itMap) {
        itMap = L.map(container, {
            scrollWheelZoom: false,
            keyboard: true
        }).setView([23.028, 72.585], 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(itMap).once("tileerror", () => {
            document.getElementById("itineraryMapStatus").textContent =
                "Map tiles could not be loaded. Your ordered stops and distance summary remain available above.";
            container.setAttribute("aria-label", "Itinerary route; map tiles could not be loaded");
        });
    }
    itMarkers.forEach((marker) => marker.remove());
    itMarkers = [];
    if (itPolyline) { itPolyline.remove(); itPolyline = null; }

    if (!sites.length) {
        container.setAttribute("aria-label", "No itinerary stops to display on map");
        document.getElementById("itineraryMapStatus").textContent = "Add a stop to preview your route.";
        return;
    }

    const latlngs = sites.map((site) => [site.latitude, site.longitude]);
    sites.forEach((site, index) => {
        const icon = L.divIcon({
            className: "hx-map-stop",
            html: `<span aria-hidden="true">${index + 1}</span>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        const marker = L.marker(latlngs[index], {
            icon,
            title: `${index + 1}. ${site.name}`,
            alt: `${index + 1}. ${site.name}`,
            keyboard: true
        }).addTo(itMap);
        const label = document.createElement("strong");
        label.textContent = `${index + 1}. ${site.name}`;
        marker.bindPopup(label);
        itMarkers.push(marker);
    });

    itPolyline = L.polyline(latlngs, { color: "#C17A45", weight: 3, dashArray: "6 6" }).addTo(itMap);
    if (latlngs.length === 1) itMap.setView(latlngs[0], 15);
    else itMap.fitBounds(itPolyline.getBounds(), { padding: [30, 30] });
    container.setAttribute("aria-label", `Map showing ${sites.length} itinerary stops in order`);
    document.getElementById("itineraryMapStatus").textContent = `Map showing ${sites.length} itinerary stops in order.`;
}

function populateAddPlaceSelect() {
    const sel = document.getElementById("addPlaceSelect");
    const inTrip = getItinerary().map((i) => i.siteId);
    sel.innerHTML = [...itinerarySiteCache.values()]
        .filter((s) => !inTrip.includes(s.id))
        .map((s) => `<option value="${s.id}">${escapeHTML(s.name)} — ${escapeHTML(s.category)}</option>`).join("");
}

async function saveItinerary() {
    const items = getItinerary();
    const notes = JSON.stringify({
        date: document.getElementById("tripDate").value,
        start: document.getElementById("tripStart").value,
        hours: document.getElementById("tripHours").value
    });
    const payload = {
        title: "My Ahmedabad Heritage Day",
        notes,
        stops: items.map((item) => ({
            siteId: Number(item.siteId),
            ...(item.time ? { visitTime: String(item.time) } : {})
        }))
    };
    if (!window.HX_AUTH_USER) {
        lsSet("heritagex_saved_itinerary_meta", {
            date: document.getElementById("tripDate").value,
            start: document.getElementById("tripStart").value,
            hours: document.getElementById("tripHours").value,
            savedAt: new Date().toISOString()
        });
        showToast("Itinerary saved to this device", "bi-check-circle-fill");
        return;
    }

    const button = document.getElementById("saveTripBtn");
    button.disabled = true;
    try {
        const result = activeItineraryId
            ? await api.put(`/itineraries/${encodeURIComponent(activeItineraryId)}`, payload)
            : await api.post("/itineraries", payload);
        activeItineraryId = result.id;
        showToast("Itinerary saved to your account", "bi-check-circle-fill");
    } catch (error) {
        showToast(error.message || "Could not save your itinerary. Your draft remains on this device.", "bi-exclamation-circle");
    } finally {
        button.disabled = false;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("tripDate").valueAsDate = new Date();
    getAllSites().forEach((site) => itinerarySiteCache.set(Number(site.id), site));
    try {
        const catalogue = await api.getSites({ page: 1, limit: 50 });
        catalogue.data.forEach((site) => itinerarySiteCache.set(Number(site.id), site));
    } catch (error) {
        console.warn("Unable to load current heritage sites for the itinerary selector:", error.message);
    }

    const user = await (window.hxAuthReady || Promise.resolve(window.HX_AUTH_USER));
    if (user) {
        document.getElementById("itineraryStorageLabel").textContent = "Synced to your account";
        try {
            const itineraries = await api.get("/itineraries");
            const saved = itineraries[0];
            if (saved) {
                activeItineraryId = saved.id;
                saved.stops.forEach((stop) => {
                    if (stop.site) itinerarySiteCache.set(Number(stop.site.id), api.normalizeSite(stop.site));
                });
                setItinerary(saved.stops.map((stop) => ({
                    siteId: Number(stop.siteId),
                    time: stop.visitTime || ""
                })));
                try {
                    const meta = JSON.parse(saved.notes || "{}");
                    if (meta.date) document.getElementById("tripDate").value = meta.date;
                    if (meta.start) document.getElementById("tripStart").value = meta.start;
                    if (meta.hours) document.getElementById("tripHours").value = meta.hours;
                } catch {
                    // Older free-form notes do not contain schedule metadata.
                }
            } else {
                setItinerary([]);
            }
        } catch (error) {
            showToast(error.message || "Could not load your saved itinerary.", "bi-exclamation-circle");
        }
    }

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

    document.getElementById("saveTripBtn").addEventListener("click", saveItinerary);

    document.getElementById("printTripBtn").addEventListener("click", () => window.print());
});