/* ---------------------------
   HeritageX — map.js
   Google Maps JavaScript API (replaces Leaflet + OpenStreetMap)
   --------------------------- */

const CATEGORY_COLORS = {
    "Historical Monuments": "#6E1E24",
    "Sultanate Heritage":   "#C17A45",
    "Religious Heritage":   "#A9822C",
    "Pols & Havelis":       "#2f7a4d",
    "Museums":              "#3a5a8c",
    "Markets":              "#B5533C",
    "Living Heritage":      "#8a3037"
};

// Ahmedabad old city centre — initial map view and fallback
const AHMEDABAD_CENTRE = { lat: 23.028, lng: 72.585 };

let map, currentInfoWindow = null, userMarker = null;
let currentUserLoc = null;
let allMarkersData = []; // { marker, site }

function categoryColor(cat) { return CATEGORY_COLORS[cat] || "#6E1E24"; }

function popupHTML(site, distText) {
    return `
    <div style="width:210px;font-family:inherit;">
      <img src="${site.image}" alt="${site.name}"
        style="width:100%;height:105px;object-fit:cover;border-radius:8px;margin-bottom:8px;"
        onerror="this.style.display='none'">
      <strong style="font-size:0.95rem;">${site.name}</strong><br>
      <span style="font-size:0.8rem;color:#574F47;">${site.category || site.categoryName || ""}</span><br>
      <span style="font-size:0.8rem;">★ ${(site.rating || 0).toFixed(1)} ${distText ? "· " + distText : ""}</span><br>
      <a href="detail.html?slug=${site.slug}"
         style="font-size:0.82rem;font-weight:600;color:#6E1E24;text-decoration:none;">View details →</a>
    </div>`;
}

function renderMarkers(filterCategory) {
    // Remove existing markers from map
    allMarkersData.forEach(({ marker }) => marker.setMap(null));
    allMarkersData = [];

    const sites = getAllSites().filter(
        (s) => !filterCategory || s.category === filterCategory || s.categoryName === filterCategory
    );

    const infoWindow = new google.maps.InfoWindow();
    if (currentInfoWindow) currentInfoWindow.close();
    currentInfoWindow = infoWindow;

    sites.forEach((site) => {
        const cat = site.category || site.categoryName;
        const color = categoryColor(cat);

        const marker = new google.maps.Marker({
            position: { lat: site.latitude, lng: site.longitude },
            map,
            title: site.name,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 9,
                fillColor: color,
                fillOpacity: 0.95,
                strokeColor: "#ffffff",
                strokeWeight: 2
            }
        });

        const origin = currentUserLoc
            ? { latitude: currentUserLoc.lat, longitude: currentUserLoc.lng }
            : { latitude: AHMEDABAD_CENTRE.lat, longitude: AHMEDABAD_CENTRE.lng };
        const distKm = distanceKm(origin.latitude, origin.longitude, site.latitude, site.longitude);
        const distText = currentUserLoc ? distKm.toFixed(1) + " km away" : "";

        marker.addListener("click", () => {
            infoWindow.setContent(popupHTML(site, distText));
            infoWindow.open(map, marker);
        });

        allMarkersData.push({ marker, site });
    });

    renderNearbyList(sites);
}

function renderNearbyList(sites) {
    const origin = currentUserLoc
        ? { latitude: currentUserLoc.lat, longitude: currentUserLoc.lng }
        : { latitude: AHMEDABAD_CENTRE.lat, longitude: AHMEDABAD_CENTRE.lng };

    const withDist = sites.map((s) => ({
        s,
        d: distanceKm(origin.latitude, origin.longitude, s.latitude, s.longitude)
    }));
    withDist.sort((a, b) => a.d - b.d);

    const list = document.getElementById("nearbyList");
    if (!list) return;

    list.innerHTML = withDist.slice(0, 10).map(({ s, d }) => `
    <div class="d-flex align-items-center gap-2 py-2 border-bottom">
      <img src="${s.image}" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:8px;"
        onerror="this.style.display='none'">
      <div class="flex-grow-1">
        <div class="small fw-semibold">${s.name}</div>
        <div class="small text-charcoal-soft">${s.category || s.categoryName || ""} · ${d.toFixed(1)} km</div>
      </div>
      <button class="btn btn-sm btn-outline-maroon" data-lat="${s.latitude}" data-lng="${s.longitude}"
        data-name="${s.name}" aria-label="Go to ${s.name}">
        <i class="bi bi-geo"></i>
      </button>
    </div>`).join("");

    list.querySelectorAll("button[data-lat]").forEach((btn) => {
        btn.addEventListener("click", () => {
            map.panTo({ lat: Number(btn.dataset.lat), lng: Number(btn.dataset.lng) });
            map.setZoom(16);
        });
    });
}

function setUserLocation(lat, lng, label) {
    currentUserLoc = { lat, lng };

    if (userMarker) userMarker.setMap(null);
    userMarker = new google.maps.Marker({
        position: { lat, lng },
        map,
        title: label || "Your location",
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#2563EB",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3
        },
        zIndex: 999
    });

    const iw = new google.maps.InfoWindow({ content: `<strong>${label || "Your location"}</strong>` });
    iw.open(map, userMarker);
    map.panTo({ lat, lng });
    map.setZoom(14);

    const catSelect = document.getElementById("mapCategoryFilter");
    renderMarkers(catSelect ? catSelect.value : "");

    if (typeof showToast === "function") {
        showToast("Location found", "bi-crosshair", label || "Your current location");
    }
}

// Called by Google Maps script callback=initHeritageMap
function initHeritageMap() {
    map = new google.maps.Map(document.getElementById("map"), {
        center: AHMEDABAD_CENTRE,
        zoom: 14,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        styles: [
            { featureType: "poi", stylers: [{ visibility: "simplified" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] }
        ]
    });

    const catSelect = document.getElementById("mapCategoryFilter");
    if (catSelect) {
        getCategories().forEach((c) => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            catSelect.appendChild(opt);
        });
        catSelect.addEventListener("change", () => renderMarkers(catSelect.value));
    }

    // Locate button
    const locateBtn = document.getElementById("locateBtn");
    if (locateBtn) {
        locateBtn.addEventListener("click", () => {
            if (!navigator.geolocation) {
                if (typeof showToast === "function") {
                    showToast("Not supported", "bi-exclamation-triangle", "Your browser does not support geolocation.");
                }
                return;
            }
            locateBtn.disabled = true;
            locateBtn.innerHTML = `<i class="bi bi-arrow-repeat me-1"></i>Locating…`;

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    locateBtn.disabled = false;
                    locateBtn.innerHTML = `<i class="bi bi-crosshair me-1"></i>My location`;
                    setUserLocation(pos.coords.latitude, pos.coords.longitude, "Your current location");
                },
                (err) => {
                    locateBtn.disabled = false;
                    locateBtn.innerHTML = `<i class="bi bi-crosshair me-1"></i>My location`;
                    let msg = "Unable to get your location.";
                    if (err.code === 1) msg = "Location access denied. Please allow it in your browser.";
                    if (typeof showToast === "function") {
                        showToast("Location error", "bi-exclamation-triangle", msg);
                    }
                },
                { timeout: 10000, maximumAge: 60000 }
            );
        });
    }

    renderMarkers("");
}