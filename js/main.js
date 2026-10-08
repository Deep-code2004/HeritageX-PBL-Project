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
    return getBookmarks().includes(Number(siteId));
}

function toggleBookmark(siteId) {
    siteId = Number(siteId);

    let marks = getBookmarks();
    let added;

    if (marks.includes(siteId)) {
        marks = marks.filter((id) => id !== siteId);
        added = false;
    } else {
        marks.push(siteId);
        added = true;
    }

    lsSet(LS_KEYS.bookmarks, marks);

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
        .querySelectorAll(`.bookmark-btn[data-site-id="${siteId}"]`)
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
            const count = getBookmarks().length;

            el.textContent = count;
            el.style.display = count > 0 ? "inline-flex" : "none";
        });

    return added;
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
                    ${title}
                </div>

                ${subtitle
            ? `
                            <div style="font-size:0.78rem;opacity:0.75;">
                                ${subtitle}
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
                        src="${site.image}"
                        alt="${site.name}"
                        loading="lazy"
                    >
                </a>

                <span class="card-cat-badge">
                    ${site.category}
                </span>

                <button
                    class="bookmark-btn ${bookmarked ? "active" : ""}"
                    data-site-id="${site.id}"
                    aria-pressed="${bookmarked}"
                    aria-label="Save ${site.name} to your places"
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
                        ${site.name}
                    </a>
                </h3>

                <p class="text-charcoal-soft small mb-2">
                    ${site.shortDescription}
                </p>

                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                    ${ratingHTML}

                    ${site.duration
            ? `
                                <span class="rating-pill">
                                    <i class="bi bi-clock"></i>
                                    ${site.duration}
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
            const count = getBookmarks().length;

            el.textContent = count;
            el.style.display =
                count > 0 ? "inline-flex" : "none";
        });
});