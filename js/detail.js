document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementById("detailRoot");
    const slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug) {
        renderFailure("No heritage site was specified.");
        return;
    }

    let site;
    try {
        await (window.hxAuthReady || Promise.resolve());
        site = await api.getSite(slug);
    } catch (error) {
        renderFailure(error.status === 404
            ? "This heritage record may have been moved or renamed."
            : error.message);
        return;
    }
    if (!site) {
        renderFailure("This heritage record may have been moved or renamed.");
        return;
    }

    site.tags = Array.isArray(site.tags) ? site.tags : [];
    site.gallery = Array.isArray(site.gallery) && site.gallery.length ? site.gallery : [site.image];
    site.responsibleGuidelines = Array.isArray(site.responsibleGuidelines) ? site.responsibleGuidelines : [];
    const nearby = Array.isArray(site.nearby) ? site.nearby.map(api.normalizeSite) : [];
    const reviews = site.reviews || [];
    document.title = `${site.name} | HeritageX`;

    const safe = escapeHTML;
    const bookmarked = isBookmarked(site.id);
    root.innerHTML = `
      <nav aria-label="breadcrumb" class="mb-3">
        <ol class="breadcrumb small">
          <li class="breadcrumb-item"><a href="../index.html">Home</a></li>
          <li class="breadcrumb-item"><a href="explore.html">Explore</a></li>
          <li class="breadcrumb-item active" aria-current="page">${safe(site.name)}</li>
        </ol>
      </nav>
      <div class="row g-2 mb-4">
        <div class="col-md-8">
          <div class="rounded-4 overflow-hidden" style="aspect-ratio:16/10;">
            <img src="${safe(site.gallery[0] || site.image)}" alt="${safe(site.name)}" class="w-100 h-100" style="object-fit:cover;">
          </div>
        </div>
        <div class="col-lg-4">
          <div class="filter-panel mb-3" style="position:sticky;top:90px;">
            <h2 class="h6 mb-2">Plan your visit</h2>
            <p class="small mb-1"><i class="bi bi-clock text-maroon me-2"></i><strong>Timings:</strong> ${safe(site.timings || "Check locally before visiting")}</p>
            <p class="small mb-1"><i class="bi bi-ticket-perforated text-maroon me-2"></i><strong>Entry:</strong> ${safe(site.entryFee || "Check locally before visiting")}</p>
            <p class="small mb-3"><i class="bi bi-hourglass text-maroon me-2"></i><strong>Suggested duration:</strong> ${safe(site.duration)}</p>
            <div class="d-grid gap-2">
              <button class="btn btn-maroon" id="addToTripBtn"><i class="bi bi-plus-circle me-1"></i> Add to Trip</button>
              <button class="btn btn-outline-maroon" id="directionsBtn"><i class="bi bi-signpost-2 me-1"></i> Get Directions</button>
              <button class="btn btn-outline-maroon" id="bookmarkDetailBtn"><i class="bi ${bookmarked ? "bi-bookmark-fill" : "bi-bookmark"} me-1"></i> ${bookmarked ? "Saved" : "Save Place"}</button>
              <button class="btn btn-outline-maroon" id="shareBtn"><i class="bi bi-share me-1"></i> Share</button>
            </div>
            ${site.source ? `<hr><p class="small text-charcoal-soft mt-2 mb-0">Source: ${safe(site.source)}</p>` : ""}
          </div>
        </div>
      </div>
      <div class="row g-5">
        <div class="col-lg-8">
          <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
            <span class="card-cat-badge" style="position:static;">${safe(site.category)}</span>
            ${site.tags.includes("UNESCO Core") ? `<span class="badge-unesco"><i class="bi bi-award"></i> UNESCO City Heritage</span>` : ""}
            ${site.verified ? `<span class="verified-badge"><i class="bi bi-patch-check-fill"></i> Verified</span>` : ""}
          </div>
          <h1 class="display-font mb-2">${safe(site.name)}</h1>
          <div class="d-flex flex-wrap gap-3 mb-3 text-charcoal-soft small">
            <span><i class="bi bi-star-fill text-warning"></i> ${site.rating.toFixed(1)} (${site.reviewCount} reviews)</span>
            <span><i class="bi bi-clock"></i> ${safe(site.duration)}</span>
          </div>
          <p class="lead" style="font-size:1.1rem;">${safe(site.shortDescription)}</p>
          ${site.history ? `<h2 class="h4 mt-4">The story</h2><p class="text-charcoal-soft">${safe(site.history)}</p>` : ""}
          ${site.culturalSignificance ? `<h2 class="h4 mt-4">Cultural significance</h2><p class="text-charcoal-soft">${safe(site.culturalSignificance)}</p>` : ""}
          ${site.architecture ? `<h2 class="h4 mt-4">Architectural features</h2><p class="text-charcoal-soft">${safe(site.architecture)}</p>` : ""}
          ${site.responsibleGuidelines.length ? `<h2 class="h4 mt-4">Respectful-visitor guidelines</h2><ul class="text-charcoal-soft">${site.responsibleGuidelines.map((item) => `<li>${safe(item)}</li>`).join("")}</ul>` : ""}
          <h2 class="h4 mt-4">Location &amp; nearby</h2>
          <div id="detailMap" style="height:320px;" class="mb-3 hx-map" role="region"
            aria-label="Map showing ${safe(site.name)} and nearby heritage sites" aria-busy="true"></div>
          <p id="detailMapStatus" class="map-status" role="status" data-google-maps-status>Loading location map…</p>
          ${nearby.length ? `<h2 class="h4 mt-4">Explore nearby</h2><div class="row g-3">${nearby.map((item) => `<div class="col-md-4">${siteCardHTML(item)}</div>`).join("")}</div>` : ""}
          <h2 class="h4 mt-5">Reviews</h2>
          <div class="d-flex align-items-center gap-3 mb-3">
            <span class="display-font" style="font-size:2rem;color:var(--maroon);">${site.rating.toFixed(1)}</span>
            <div><div class="text-warning">${"★".repeat(Math.round(site.rating))}${"☆".repeat(5 - Math.round(site.rating))}</div><div class="small text-charcoal-soft">${site.reviewCount} verified visitor reviews</div></div>
            <select id="reviewSort" class="form-select form-select-sm ms-auto" style="width:auto;" aria-label="Sort reviews">
              <option value="helpful">Most helpful</option><option value="recent">Most recent</option>
            </select>
          </div>
          <div id="reviewList"></div>
          <div class="filter-panel mt-4">
            <h2 class="h6">Write a review</h2>
            <p class="small text-charcoal-soft">Reviews are submitted to the HeritageX team for moderation before they appear publicly.</p>
            <form id="reviewForm">
              <div class="mb-2"><label class="form-label small">Your rating</label><br>
                <div id="starPicker" role="radiogroup" aria-label="Star rating">
                  ${[1, 2, 3, 4, 5].map((number) => `<button type="button" class="btn btn-link p-0 me-1 star-btn" data-star="${number}" aria-label="${number} star" aria-pressed="false" style="font-size:1.4rem;color:var(--sandstone);"><i class="bi bi-star-fill"></i></button>`).join("")}
                </div>
                <input type="hidden" id="starValue" value="0">
              </div>
              <div class="mb-2"><label for="reviewText" class="form-label small">Your review</label>
                <textarea id="reviewText" class="form-control" rows="3" required minlength="3" maxlength="1000" placeholder="What stood out about your visit?"></textarea>
              </div>
              <div id="reviewMessage" class="small mb-2" role="status" aria-live="polite"></div>
              <button class="btn btn-maroon" type="submit">Submit review</button>
            </form>
          </div>
        </div>
      </div>`;

    document.getElementById("bookmarkDetailBtn").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        const nowSaved = await toggleBookmark(site.id);
        button.innerHTML = `<i class="bi ${nowSaved ? "bi-bookmark-fill" : "bi-bookmark"} me-1"></i> ${nowSaved ? "Saved" : "Save Place"}`;
        button.disabled = false;
    });

    document.getElementById("addToTripBtn").addEventListener("click", () => {
        hxAddSiteToTrip(site.id);
    });
    document.getElementById("directionsBtn").addEventListener("click", () =>
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${site.latitude},${site.longitude}`, "_blank", "noopener")
    );
    document.getElementById("shareBtn").addEventListener("click", async () => {
        try {
            if (navigator.share) await navigator.share({ title: site.name, url: window.location.href });
            else {
                await navigator.clipboard.writeText(window.location.href);
                showToast("Link copied to clipboard", "bi-link-45deg", site.name);
            }
        } catch (error) {
            if (error.name !== "AbortError") showToast("Could not share this link.", "bi-exclamation-circle");
        }
    });

    let selectedStar = 0;
    document.querySelectorAll(".star-btn").forEach((button) => {
        button.addEventListener("click", () => {
            selectedStar = Number(button.dataset.star);
            document.getElementById("starValue").value = selectedStar;
            document.querySelectorAll(".star-btn").forEach((star) => {
                const active = Number(star.dataset.star) <= selectedStar;
                star.style.color = active ? "var(--gold)" : "var(--sandstone)";
                star.setAttribute("aria-pressed", String(active && Number(star.dataset.star) === selectedStar));
            });
        });
    });

    function renderReviews(sortMode) {
        const sorted = [...reviews].sort((a, b) => sortMode === "recent"
            ? new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)
            : Number(b.helpful || 0) - Number(a.helpful || 0));
        const list = document.getElementById("reviewList");
        if (!sorted.length) {
            list.innerHTML = `<p class="text-charcoal-soft small">No approved reviews yet — be the first to share your visit.</p>`;
            return;
        }
        list.innerHTML = sorted.map((review) => `
          <article class="border-bottom py-3">
            <div class="d-flex justify-content-between">
              <strong>${safe(review.author || "Visitor")}</strong>
              <span class="text-warning small" aria-label="${Number(review.rating)} out of 5 stars">${"★".repeat(Number(review.rating))}${"☆".repeat(5 - Number(review.rating))}</span>
            </div>
            <p class="mb-1 text-charcoal-soft small">${safe(review.text)}</p>
            <div class="small text-charcoal-soft">${review.createdAt ? new Date(review.createdAt).toLocaleDateString() : safe(review.date || "")} · Helpful (${Number(review.helpful || 0)})</div>
          </article>`).join("");
    }
    renderReviews("helpful");
    document.getElementById("reviewSort").addEventListener("change", (event) => renderReviews(event.target.value));

    document.getElementById("reviewForm").addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const message = document.getElementById("reviewMessage");
        const text = document.getElementById("reviewText").value.trim();
        if (selectedStar < 1 || text.length < 3) {
            message.textContent = "Choose a star rating and write at least 3 characters.";
            message.className = "small mb-2 text-danger";
            return;
        }
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        message.textContent = "Submitting your review…";
        message.className = "small mb-2 text-charcoal-soft";
        try {
            const user = await (window.hxAuthReady || Promise.resolve(window.HX_AUTH_USER));
            if (!user) {
                const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
                window.location.href = `account.html?returnTo=${returnTo}`;
                return;
            }
            await api.post(`/heritage/${site.id}/reviews`, { rating: selectedStar, comment: text });
            form.reset();
            selectedStar = 0;
            document.querySelectorAll(".star-btn").forEach((star) => {
                star.style.color = "var(--sandstone)";
                star.setAttribute("aria-pressed", "false");
            });
            message.textContent = "Your review was submitted and is awaiting moderation.";
            message.className = "small mb-2 text-success";
        } catch (error) {
            if (error.status === 401) {
                const returnTo = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
                window.location.href = `account.html?returnTo=${returnTo}`;
                return;
            }
            message.textContent = error.message || "We could not submit your review. Please try again.";
            message.className = "small mb-2 text-danger";
        } finally {
            submit.disabled = false;
        }
    });

    function initializeMap() {
        const container = document.getElementById("detailMap");
        const status = document.getElementById("detailMapStatus");
        window.hxGoogleMapsReady.then(() => {
            const position = { lat: Number(site.latitude), lng: Number(site.longitude) };
            if (!Number.isFinite(position.lat) || !Number.isFinite(position.lng)) {
                throw new Error("This site's location coordinates are unavailable.");
            }
            const map = new google.maps.Map(container, {
                center: position,
                zoom: 15,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true
            });
            const infoWindow = new google.maps.InfoWindow();
            [site, ...nearby].forEach((place, index) => {
                const placePosition = { lat: Number(place.latitude), lng: Number(place.longitude) };
                if (!Number.isFinite(placePosition.lat) || !Number.isFinite(placePosition.lng)) return;
                const marker = new google.maps.Marker({
                    map,
                    position: placePosition,
                    title: place.name,
                    label: index ? undefined : { text: "★", color: "#ffffff" }
                });
                marker.addListener("click", () => {
                    const content = document.createElement("div");
                    const title = document.createElement(index === 0 ? "strong" : "a");
                    title.textContent = place.name;
                    if (index > 0) title.href = `detail.html?slug=${encodeURIComponent(place.slug)}`;
                    content.appendChild(title);
                    infoWindow.setContent(content);
                    infoWindow.open({ map, anchor: marker });
                });
                if (index === 0) {
                    const content = document.createElement("strong");
                    content.textContent = place.name;
                    infoWindow.setContent(content);
                    infoWindow.open({ map, anchor: marker });
                }
            });
            container.setAttribute("aria-busy", "false");
            status.textContent = "Interactive Google Map. Use the map controls to explore this site and nearby places.";
        }).catch((error) => {
            status.textContent = `${error.message} Use the directions button to open this location in Maps.`;
            status.classList.add("text-danger");
            container.setAttribute("aria-busy", "false");
        });
    }
    initializeMap();

    function renderFailure(message) {
        root.innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-circle"></i><h1 class="h4 mt-3">Site unavailable</h1><p>${escapeHTML(message)}</p><a href="explore.html" class="btn btn-maroon">Back to Explore</a></div>`;
    }
});
