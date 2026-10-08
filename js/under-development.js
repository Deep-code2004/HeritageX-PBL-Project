/**
 * HeritageX — Under Development Page
 * Handles page-specific content and lightweight animations.
 */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const defaultConfig = {
        pageTitle: "Page Under Development | HeritageX",
        heading: "Something Amazing Is Coming",
        description:
            "We're currently working on this page to bring you a better way to explore heritage, culture, places, stories, and local experiences. Please check back soon.",
        status: "Currently under development",
        backUrl: "./index.html",
        exploreUrl: "./Pages/explore.html"
    };

    const config = {
        ...defaultConfig,
        ...(window.HERITAGEX_PAGE || {})
    };

    document.title = config.pageTitle;

    const heading = document.querySelector("[data-page-heading]");
    if (heading) heading.textContent = config.heading;

    const description = document.querySelector("[data-page-description]");
    if (description) description.textContent = config.description;

    const status = document.querySelector("[data-page-status]");
    if (status) status.textContent = config.status;

    const backLink = document.querySelector("[data-back-link]");
    if (backLink) backLink.href = config.backUrl;

    const exploreLink = document.querySelector("[data-explore-link]");
    if (exploreLink) exploreLink.href = config.exploreUrl;

    const animatedElements = document.querySelectorAll(".ud-animate");
    const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
        animatedElements.forEach((element) => {
            element.classList.add("is-visible");
        });
    } else {
        requestAnimationFrame(() => {
            animatedElements.forEach((element, index) => {
                setTimeout(() => {
                    element.classList.add("is-visible");
                }, 100 + index * 90);
            });
        });
    }

    const loadingDots = document.querySelector(".ud-loading-dots");

    if (loadingDots && !prefersReducedMotion) {
        let dotCount = 0;

        setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            loadingDots.textContent = ".".repeat(dotCount);
        }, 500);
    }

    const compass = document.querySelector(".ud-compass");

    if (compass && !prefersReducedMotion) {
        let angle = -3;
        let direction = 1;

        setInterval(() => {
            angle += 0.08 * direction;

            if (angle >= 3) {
                angle = 3;
                direction = -1;
            }

            if (angle <= -3) {
                angle = -3;
                direction = 1;
            }

            compass.style.transform = `rotate(${angle}deg)`;
        }, 100);
    }

    document.querySelectorAll("[data-current-year]").forEach((element) => {
        element.textContent = new Date().getFullYear();
    });

    window.addEventListener("pageshow", (event) => {
        if (event.persisted) {
            animatedElements.forEach((element) => {
                element.classList.add("is-visible");
            });
        }
    });

    console.info("HeritageX — Under Development page loaded.");
});