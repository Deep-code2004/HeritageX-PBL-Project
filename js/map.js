/* ---------------------------
   HeritageX — map.js
   --------------------------- */

const CATEGORY_COLORS = {
    "Historical Monuments": "#6E1E24",
    "Sultanate Heritage": "#C17A45",
    "Religious Heritage": "#A9822C",
    "Pols & Havelis": "#2f7a4d",
    "Museums": "#3a5a8c",
    "Markets": "#B5533C",
    "Living Heritage": "#8a3037"
};

let map, markerLayer, userMarker;
let currentUserLoc = null;

function categoryColor(cat) { return CATEGORY_COLORS[cat] || "#6E1E24"; }

function popupHTML(site, distText) {
    return `
    <div style="width:200px;">
      <img src="${site.image}" alt="${site.name}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:6px;">
      <strong>${site.name}</strong><br>
      <span style="font-size:0.8rem;color:#574F47;">${site.category}</span><br>
      <span style="font-size:0.8rem;">★ ${site.rating.toFixed(1)} ${distText ? "· " + distText : ""}</span><br>
      <a href="detail.html?slug=${site.slug}" style="font-size:0.82rem;font-weight:600;">View details →</a>
    </div>`;
}

function renderMarkers(filterCategory) {
    markerLayer.clearLayers();
    const sites = getAllSites().filter((s) => !filterCategory || s.category === filterCategory);
    sites.forEach((site) => {
        const marker = L.circleMarker([site.latitude, site.longitude], {
            radius: 9,
            color: "#fff",
            weight: 2,
            fillColor: categoryColor(site.category),
            fillOpacity: 0.95
        });
        const distText = currentUserLoc ? distanceKm(currentUserLoc.latitude, currentUserLoc.longitude, site.latitude, site.longitude).toFixed(1) + " km away" : "";
        marker.bindPopup(popupHTML(site, distText));
        marker.addTo(markerLayer);
    });
    renderNearbyList(sites);
}

function renderNearbyList(sites) {
    const origin = currentUserLoc || DEMO_USER_LOCATION;
    const withDist = sites.map((s) => ({ s, d: distanceKm(origin.latitude, origin.longitude, s.latitude, s.longitude) }));
    withDist.sort((a, b) => a.d - b.d);
    const list = document.getElementById("nearbyList");
    list.innerHTML = withDist.slice(0, 10).map(({ s, d }) => `
    <div class="d-flex align-items-center gap-2 py-2 border-bottom">
      <img src="${s.image}" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:8px;">
      <div class="flex-grow-1">
        <div class="small fw-semibold">${s.name}</div>
        <div class="small text-charcoal-soft">${s.category} · ${d.toFixed(1)} km</div>
      </div>
      <button class="btn btn-sm btn-outline-maroon" data-lat="${s.latitude}" data-lng="${s.longitude}" data-name="${s.name}" aria-label="Fly to ${s.name}"><i class="bi bi-geo"></i></button>
    </div>`).join("");
    list.querySelectorAll("button[data-lat]").forEach((btn) => {
        btn.addEventListener("click", () => {
            map.flyTo([Number(btn.dataset.lat), Number(btn.dataset.lng)], 16);
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {
    map = L.map("map").setView([23.028, 72.585], 13.3);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 19
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);

    const catSelect = document.getElementById("mapCategoryFilter");
    getCategories().forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c; opt.textContent = c;
        catSelect.appendChild(opt);
    });
    catSelect.addEventListener("change", () => renderMarkers(catSelect.value));

    document.getElementById("locateBtn").addEventListener("click", () => {
        // Demo location — Lal Darwaza, centre of the old city (no real geolocation permission requested)
        currentUserLoc = DEMO_USER_LOCATION;
        if (userMarker) map.removeLayer(userMarker);
        userMarker = L.marker([currentUserLoc.latitude, currentUserLoc.longitude], {
            icon: L.divIcon({ className: "", html: `<div style="width:16px;height:16px;border-radius:50%;background:#C17A45;border:3px solid #fff;box-shadow:0 0 0 3px rgba(193,122,69,0.35);"></div>` })
        }).addTo(map).bindPopup("You are here (demo location)").openPopup();
        map.flyTo([currentUserLoc.latitude, currentUserLoc.longitude], 14.5);
        renderMarkers(catSelect.value);
        showToast("Using demo location", "bi-crosshair", currentUserLoc.label);
    });

    renderMarkers("");
});