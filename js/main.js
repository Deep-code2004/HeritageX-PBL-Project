/* ---------------------------
   HeritageX — main.js
   Shared across every page:
   Bookmarks
   Toast notifications
   Reusable heritage cards
   Responsive detail page URLs
   Global search
   Footer year
   --------------------------- */

const LS_KEYS = {
    bookmarks: "heritagex_bookmarks",
    itinerary: "heritagex_itinerary",
    reviews: "heritagex_reviews",
    prefs: "heritagex_prefs",
    admin: "heritagex_admin_sites"
};

/* ---------------------------
   localStorage helpers
   --------------------------- */

function lsGet(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
}

function lsSet(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.warn("Unable to save localStorage data:", e);
    }
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
}

/* ---------------------------
   Detail page URL helper
   --------------------------- */

function getDetailUrl(slug) {
    const encodedSlug = encodeURIComponent(slug);
    const currentPath = window.location.pathname.toLowerCase();

    if (currentPath.includes("/pages/")) {
        return `detail.html?slug=${encodedSlug}`;
    }

    return `Pages/detail.html?slug=${encodedSlug}`;
}

/* ---------------------------
   Bookmarks
   --------------------------- */

function getBookmarks() {
    return lsGet(LS_KEYS.bookmarks, []);
}

function isBookmarked(siteId) {
    const marks = window.HX_AUTH_USER && Array.isArray(window.HX_SAVED_IDS)
        ? window.HX_SAVED_IDS
        : getBookmarks();
    return marks.includes(Number(siteId));
}

function refreshSavedUI() {
    document.querySelectorAll("[data-site-id]").forEach((button) => {
        const saved = isBookmarked(button.dataset.siteId);
        button.classList.toggle("active", saved);
        button.setAttribute("aria-pressed", String(saved));
        const icon = button.querySelector("i");
        if (icon) icon.className = `bi ${saved ? "bi-bookmark-fill" : "bi-bookmark"}`;
    });
    const count = window.HX_AUTH_USER && Array.isArray(window.HX_SAVED_IDS)
        ? window.HX_SAVED_IDS.length
        : getBookmarks().length;
    document.querySelectorAll(".saved-count-badge").forEach((badge) => {
        badge.textContent = count;
        badge.style.display = count ? "inline-flex" : "none";
    });
}

async function toggleBookmark(siteId) {
    siteId = Number(siteId);

    let marks = window.HX_AUTH_USER && Array.isArray(window.HX_SAVED_IDS)
        ? [...window.HX_SAVED_IDS]
        : getBookmarks();
    const added = !marks.includes(siteId);

    if (window.HX_AUTH_USER && window.api) {
        try {
            if (added) await api.post(`/saved/${siteId}`, {});
            else await api.delete(`/saved/${siteId}`);
        } catch (error) {
            showToast(error.message || "Could not update saved places.", "bi-exclamation-circle");
            return !added;
        }
    }

    if (!added) {
        marks = marks.filter((id) => id !== siteId);
    } else {
        marks.push(siteId);
    }

    if (window.HX_AUTH_USER) window.HX_SAVED_IDS = marks;
    else lsSet(LS_KEYS.bookmarks, marks);

    const site =
        typeof getSiteById === "function"
            ? getSiteById(siteId)
            : null;

    showToast(
        added ? "Saved to your places" : "Removed from saved places",
        added ? "bi-bookmark-check-fill" : "bi-bookmark-x",
        site ? site.name : ""
    );

    document
        .querySelectorAll(`[data-site-id="${siteId}"]`)
        .forEach((btn) => {
            btn.classList.toggle("active", added);
            btn.setAttribute("aria-pressed", added ? "true" : "false");

            btn.innerHTML = `
                <i
                    class="bi ${added ? "bi-bookmark-fill" : "bi-bookmark"}"
                    aria-hidden="true"
                ></i>
            `;
        });

    document
        .querySelectorAll(".saved-count-badge")
        .forEach((el) => {
            const count = window.HX_AUTH_USER && Array.isArray(window.HX_SAVED_IDS)
                ? window.HX_SAVED_IDS.length
                : getBookmarks().length;

            el.textContent = count;
            el.style.display = count > 0 ? "inline-flex" : "none";
        });

    return added;
}

async function hxAddSiteToTrip(siteId) {
    siteId = Number(siteId);
    const items = lsGet(LS_KEYS.itinerary, []);
    if (window.HX_AUTH_USER && window.api) {
        try {
            await api.post("/itineraries/merge", {
                title: "My Ahmedabad Heritage Day",
                stops: [{ siteId }]
            });
            showToast("Saved to your account itinerary", "bi-map");
            return true;
        } catch (error) {
            showToast(error.message || "Could not save this stop to your account.", "bi-exclamation-circle");
            return false;
        }
    }
    if (!items.some((item) => Number(item.siteId) === siteId)) {
        items.push({ siteId, time: "" });
        lsSet(LS_KEYS.itinerary, items);
    }
    showToast("Added to your trip", "bi-map");
    return true;
}

async function hxMigrateGuestData() {
    if (!window.HX_AUTH_USER || !window.api) return;
    const bookmarks = getBookmarks();
    if (bookmarks.length) {
        await api.post("/saved/merge", { siteIds: bookmarks });
        lsSet(LS_KEYS.bookmarks, []);
    }
    const localTrip = lsGet(LS_KEYS.itinerary, []);
    if (localTrip.length) {
        const meta = lsGet("heritagex_saved_itinerary_meta", {});
        const notes = JSON.stringify({
            date: meta.date || "",
            start: meta.start || "",
            hours: meta.hours || ""
        });
        await api.post("/itineraries/merge", {
            title: "My Ahmedabad Heritage Day",
            notes,
            stops: localTrip.map((item) => ({
                siteId: Number(item.siteId),
                ...(item.time ? { visitTime: String(item.time) } : {})
            }))
        });
        lsSet(LS_KEYS.itinerary, []);
    }
}

/* ---------------------------
   Toast notifications
   --------------------------- */

function showToast(
    title,
    icon = "bi-check-circle-fill",
    subtitle = ""
) {
    let container = document.querySelector(".hx-toast-container");

    if (!container) {
        container = document.createElement("div");
        container.className = "hx-toast-container";
        document.body.appendChild(container);
    }

    const toastEl = document.createElement("div");

    toastEl.className =
        "toast align-items-center border-0 mb-2 show";

    toastEl.style.background = "#2A2420";
    toastEl.style.color = "#F8F3E8";
    toastEl.style.borderRadius = "12px";

    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");

    toastEl.innerHTML = `
        <div class="d-flex align-items-center px-3 py-2">
            <i
                class="bi ${icon} me-2"
                style="color:#CBA75A;font-size:1.1rem;"
            ></i>

            <div class="me-3">
                <div style="font-weight:600;font-size:0.92rem;">
                    ${escapeHTML(title)}
                </div>

                ${subtitle
            ? `
                            <div style="font-size:0.78rem;opacity:0.75;">
                                ${escapeHTML(subtitle)}
                            </div>
                        `
            : ""
        }
            </div>

            <button
                type="button"
                class="btn-close btn-close-white ms-auto"
                aria-label="Close"
            ></button>
        </div>
    `;

    container.appendChild(toastEl);

    const closeButton = toastEl.querySelector(".btn-close");

    if (closeButton) {
        closeButton.addEventListener(
            "click",
            () => toastEl.remove()
        );
    }

    setTimeout(() => toastEl.remove(), 3800);
}

/* ---------------------------
   Reusable heritage site card
   --------------------------- */

function siteCardHTML(site, opts = {}) {
    const bookmarked = isBookmarked(site.id);

    /*
       getDetailUrl() decides the correct detail page path.
    */

    const detailUrl = getDetailUrl(site.slug);
    const name = escapeHTML(site.name);
    const category = escapeHTML(site.category);
    const image = escapeHTML(site.image);
    const description = escapeHTML(site.shortDescription);

    const distance =
        opts.distanceKm != null
            ? `
                <span class="rating-pill">
                    <i class="bi bi-signpost-2"></i>
                    ${opts.distanceKm.toFixed(1)} km
                </span>
            `
            : "";

    let ratingHTML = "";

    if (site.rating != null) {
        ratingHTML = `
            <span class="rating-pill">
                <i class="bi bi-star-fill"></i>
                ${Number(site.rating).toFixed(1)}
                ${site.reviewCount != null
                ? `
                            <span class="text-charcoal-soft fw-normal">
                                (${site.reviewCount})
                            </span>
                        `
                : ""
            }
            </span>
        `;
    }

    return `
        <div class="hx-card">
            <div class="card-img-wrap">
                <a href="${detailUrl}">
                    <img
                        src="${image}"
                        alt="${name}"
                        loading="lazy"
                    >
                </a>

                <span class="card-cat-badge">
                    ${category}
                </span>

                <button
                    class="bookmark-btn ${bookmarked ? "active" : ""}"
                    data-site-id="${site.id}"
                    aria-pressed="${bookmarked}"
                    aria-label="Save ${name} to your places"
                    onclick="toggleBookmark(${site.id})"
                >
                    <i
                        class="bi ${bookmarked ? "bi-bookmark-fill" : "bi-bookmark"}"
                        aria-hidden="true"
                    ></i>
                </button>
            </div>

            <div class="card-body-custom">
                <h3 class="h5">
                    <a href="${detailUrl}" class="text-maroon">
                        ${name}
                    </a>
                </h3>

                <p class="text-charcoal-soft small mb-2">
                    ${description}
                </p>

                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    ${ratingHTML}

                    ${site.duration
            ? `
                                <span class="rating-pill">
                                    <i class="bi bi-clock"></i>
                                    ${escapeHTML(site.duration)}
                                </span>
                            `
            : ""
        }
                </div>

                ${distance
            ? `
                            <div class="mt-2">
                                ${distance}
                            </div>
                        `
            : ""
        }

                <a
                    href="${detailUrl}"
                    class="btn btn-outline-maroon btn-sm w-100 mt-3"
                >
                    View details
                </a>
            </div>
        </div>
    `;
}

/* ---------------------------
   Mobile navigation
   Bootstrap handles collapse automatically
   --------------------------- */

/* ---------------------------
   Global search
   --------------------------- */

function wireGlobalSearch(inputId, formId) {
    const form = document.getElementById(formId);

    if (!form) {
        return;
    }

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const input = document.getElementById(inputId);

        if (!input) {
            return;
        }

        const q = input.value.trim();

        window.location.href =
            `explore.html${q ? "?q=" + encodeURIComponent(q) : ""}`;
    });
}

/* ---------------------------
   Footer year
   --------------------------- */

document.addEventListener("DOMContentLoaded", () => {
    document
        .querySelectorAll(".current-year")
        .forEach((el) => {
            el.textContent = new Date().getFullYear();
        });

    document
        .querySelectorAll(".saved-count-badge")
        .forEach((el) => {
            const count = window.HX_AUTH_USER && Array.isArray(window.HX_SAVED_IDS)
                ? window.HX_SAVED_IDS.length
                : getBookmarks().length;

            el.textContent = count;
            el.style.display =
                count > 0 ? "inline-flex" : "none";
        });

    document.querySelectorAll(".dropdown-menu").forEach((menu) => {
        if (menu.querySelector("[data-hx-account-link]")) return;
        const account = document.createElement("li");
        const accountHref = window.location.pathname.toLowerCase().includes("/pages/")
            ? "account.html"
            : "Pages/account.html";
        account.innerHTML = `<a class="dropdown-item" data-hx-account-link href="${accountHref}"><i class="bi bi-person me-2"></i>Sign in / Create account</a>`;
        menu.appendChild(account);
    });

    if (window.api) {
        window.hxAuthReady = api.get("/auth/me").then(async (result) => {
            const user = result?.user || null;
            api.setCurrentUser(user);
            if (user) {
                try {
                    await hxMigrateGuestData();
                } catch (error) {
                    showToast(error.message || "Guest data could not be synced yet; it remains on this device.", "bi-exclamation-circle");
                }
                try {
                    const savedSites = await api.get("/saved");
                    window.HX_SAVED_IDS = savedSites.map((site) => Number(site.id));
                    refreshSavedUI();
                } catch (error) {
                    console.error("Unable to load account saved places:", error);
                }
            }
            document.querySelectorAll("[data-hx-account-link]").forEach((link) => {
                link.innerHTML = user
                    ? `<i class="bi bi-person-check me-2"></i>${escapeHTML(user.name || user.email)}`
                    : `<i class="bi bi-person me-2"></i>Sign in / Create account`;
            });
            return user;
        }).catch((error) => {
            api.setCurrentUser(null);
            if (error.status !== 401 && error.code !== "NETWORK_ERROR") {
                console.error("Unable to restore the visitor session:", error);
            }
            return null;
        });
    }
});