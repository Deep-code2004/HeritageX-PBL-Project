/* Google Maps discovery backed by the public heritage catalogue API. */
const CATEGORY_COLORS = {
    "Historical Monuments": "#6E1E24",
    "Sultanate Heritage": "#C17A45",
    "Religious Heritage": "#A9822C",
    "Pols & Havelis": "#2f7a4d",
    "Museums": "#3a5a8c",
    "Markets": "#B5533C",
    "Living Heritage": "#8a3037"
};
const AHMEDABAD_CENTRE = { lat: 23.028, lng: 72.585 };
let heritageMap;
let userLocation;
let heritageSites = [];
let activeMarkers = new Map();
let userLocationMarker;
let mapUnavailableReason = "";
let infoWindow;

function mapCategoryColor(category) {
    return CATEGORY_COLORS[category] || "#6E1E24";
}

function mapStatus(message, isError = false) {
    const status = document.getElementById("mapStatus");
    if (status) {
        status.textContent = window.hxGoogleMapsError || message;
        status.classList.toggle("text-danger", isError || Boolean(window.hxGoogleMapsError));
    }
}

function mapPopup(site, distanceText) {
    const container = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = site.name;
    const category = document.createElement("div");
    category.className = "small text-charcoal-soft";
    category.textContent = site.category;
    const rating = document.createElement("div");
    rating.className = "small";
    rating.textContent = `★ ${Number(site.rating || 0).toFixed(1)}${distanceText ? ` · ${distanceText}` : ""}`;
    const link = document.createElement("a");
    link.href = `detail.html?slug=${encodeURIComponent(site.slug)}`;
    link.className = "small fw-semibold";
    link.textContent = "View details";
    container.append(title, category, rating, link);
    return container;
}

function createMapMarker(site) {
    const marker = new google.maps.Marker({
        map: heritageMap,
        position: { lat: Number(site.latitude), lng: Number(site.longitude) },
        title: site.name,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: mapCategoryColor(site.category),
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2
        }
    });
    const origin = userLocation || AHMEDABAD_CENTRE;
    const distance = distanceKm(origin.lat, origin.lng, site.latitude, site.longitude);
    marker.addListener("click", () => {
        infoWindow.setContent(mapPopup(site, userLocation ? `${distance.toFixed(1)} km away` : ""));
        infoWindow.open({ map: heritageMap, anchor: marker });
    });
    activeMarkers.set(Number(site.id), marker);
    return marker;
}

function renderNearbyList(sites) {
    const list = document.getElementById("nearbyList");
    const origin = userLocation || AHMEDABAD_CENTRE;
    const ordered = sites.map((site) => ({
        site,
        distance: distanceKm(origin.lat, origin.lng, site.latitude, site.longitude)
    })).sort((a, b) => a.distance - b.distance).slice(0, 10);

    if (!ordered.length) {
        list.innerHTML = `<p class="small text-charcoal-soft mb-0">No verified sites match this category.</p>`;
        return;
    }

    list.replaceChildren();
    ordered.forEach(({ site, distance }) => {
        const row = document.createElement("div");
        row.className = "d-flex align-items-center gap-2 py-2 border-bottom";
        const image = document.createElement("img");
        image.src = site.image;
        image.alt = "";
        image.loading = "lazy";
        image.width = 52;
        image.height = 52;
        image.className = "rounded-2 object-fit-cover";
        image.addEventListener("error", () => image.remove(), { once: true });
        const text = document.createElement("div");
        text.className = "flex-grow-1";
        const name = document.createElement("div");
        name.className = "small fw-semibold";
        const detailLink = document.createElement("a");
        detailLink.href = `detail.html?slug=${encodeURIComponent(site.slug)}`;
        detailLink.textContent = site.name;
        name.appendChild(detailLink);
        const description = document.createElement("div");
        description.className = "small text-charcoal-soft";
        description.textContent = `${site.category} · ${distance.toFixed(1)} km`;
        text.append(name, description);
        const focusButton = document.createElement("button");
        focusButton.type = "button";
        focusButton.className = "btn btn-sm btn-outline-maroon";
        focusButton.setAttribute("aria-label", `Show ${site.name} on map`);
        focusButton.innerHTML = `<i class="bi bi-geo" aria-hidden="true"></i>`;
        focusButton.addEventListener("click", () => {
            const marker = activeMarkers.get(Number(site.id));
            if (!marker || !heritageMap) {
                mapStatus(mapUnavailableReason || "Map controls are unavailable.", true);
                return;
            }
            heritageMap.setCenter(marker.getPosition());
            heritageMap.setZoom(16);
            infoWindow.setContent(mapPopup(site, ""));
            infoWindow.open({ map: heritageMap, anchor: marker });
        });
        row.append(image, text, focusButton);
        list.appendChild(row);
    });
}

function renderMarkers(category = "") {
    activeMarkers.forEach((marker) => marker.setMap(null));
    activeMarkers.clear();
    const matchingSites = heritageSites.filter((site) =>
        !category || site.category === category
    );
    if (heritageMap) matchingSites.forEach(createMapMarker);
    renderNearbyList(matchingSites);
    const summary = matchingSites.length
        ? `Showing ${matchingSites.length} verified heritage site${matchingSites.length === 1 ? "" : "s"}.`
        : "No verified sites match this category.";
    mapStatus(mapUnavailableReason ? `${summary} ${mapUnavailableReason}` : summary, Boolean(mapUnavailableReason));
}

function showUserLocation(latitude, longitude) {
    userLocation = { lat: latitude, lng: longitude };
    if (!heritageMap) {
        mapStatus(mapUnavailableReason || "Map controls are unavailable.", true);
        return;
    }
    if (userLocationMarker) userLocationMarker.setMap(null);
    userLocationMarker = new google.maps.Marker({
        map: heritageMap,
        position: { lat: latitude, lng: longitude },
        title: "Your current location",
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#2769b0",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3
        },
        zIndex: 1000
    });
    heritageMap.setCenter({ lat: latitude, lng: longitude });
    heritageMap.setZoom(14);
    const category = document.getElementById("mapCategoryFilter").value;
    renderMarkers(category);
    mapStatus("Your location is shown. Nearby distances are approximate.");
}

async function loadHeritageSites() {
    const container = document.getElementById("map");
    const retry = document.getElementById("retryMapSites");
    if (retry) retry.remove();
    container.setAttribute("aria-busy", "true");
    mapStatus("Loading verified heritage sites…");

    try {
        const [catalogue, categories] = await Promise.all([
            api.getSites({ page: 1, limit: 50 }),
            api.getCategories()
        ]);
        heritageSites = catalogue.data.filter((site) =>
            Number.isFinite(Number(site.latitude)) && Number.isFinite(Number(site.longitude))
        );
        const categorySelect = document.getElementById("mapCategoryFilter");
        categorySelect.replaceChildren(new Option("All categories", ""));
        categories.forEach((category) => {
            const option = document.createElement("option");
            option.value = category.name;
            option.textContent = `${category.name} (${category.siteCount})`;
            categorySelect.appendChild(option);
        });
        renderMarkers(categorySelect.value);
    } catch (error) {
        mapStatus(`${error.message} The map is unavailable; please retry.`, true);
        const retryButton = document.createElement("button");
        retryButton.id = "retryMapSites";
        retryButton.type = "button";
        retryButton.className = "btn btn-outline-maroon btn-sm mt-2";
        retryButton.textContent = "Retry loading sites";
        retryButton.addEventListener("click", loadHeritageSites);
        document.getElementById("nearbyList").replaceChildren(retryButton);
    } finally {
        container.setAttribute("aria-busy", "false");
    }
}

async function initializeHeritageMap() {
    const container = document.getElementById("map");
    const locateButton = document.getElementById("locateBtn");
    const categorySelect = document.getElementById("mapCategoryFilter");
    categorySelect.addEventListener("change", () => renderMarkers(categorySelect.value));
    locateButton.addEventListener("click", () => {
        if (!navigator.geolocation) {
            mapStatus("Location is not supported by this browser. You can still browse heritage sites.", true);
            return;
        }
        locateButton.disabled = true;
        locateButton.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Locating…`;
        locateButton.setAttribute("aria-busy", "true");
        mapStatus("Requesting your location…");
        navigator.geolocation.getCurrentPosition((position) => {
            locateButton.disabled = false;
            locateButton.innerHTML = `<i class="bi bi-crosshair me-1" aria-hidden="true"></i>My location`;
            locateButton.removeAttribute("aria-busy");
            showUserLocation(position.coords.latitude, position.coords.longitude);
        }, (error) => {
            locateButton.disabled = false;
            locateButton.innerHTML = `<i class="bi bi-crosshair me-1" aria-hidden="true"></i>My location`;
            locateButton.removeAttribute("aria-busy");
            const message = error.code === error.PERMISSION_DENIED
                ? "Location access was denied. Allow location in your browser settings and try again."
                : error.code === error.POSITION_UNAVAILABLE
                    ? "Your location is currently unavailable. You can still browse the map."
                    : "Location lookup timed out. Please try again.";
            mapStatus(message, true);
        }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
    });

    try {
        await window.hxGoogleMapsReady;
        heritageMap = new google.maps.Map(container, {
            center: AHMEDABAD_CENTRE,
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        });
        infoWindow = new google.maps.InfoWindow();
        container.setAttribute("aria-busy", "false");
    } catch (error) {
        mapUnavailableReason = error.message;
        container.setAttribute("aria-busy", "false");
    }

    await loadHeritageSites();
}

document.addEventListener("DOMContentLoaded", initializeHeritageMap);
