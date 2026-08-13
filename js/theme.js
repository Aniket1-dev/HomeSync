// Dark / light theme toggle — persisted in localStorage as "homesync-theme"
// Applied to <body class="light"> ; dark is the default (matches ZeroSmoke).
const THEME_KEY = "homesync-theme";

function getStoredTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (e) {
    return null;
  }
}

function setStoredTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    /* localStorage unavailable — theme just won't persist */
  }
}

function applyTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  document.querySelectorAll(".theme-toggle").forEach((btn) => {
    btn.setAttribute(
      "aria-label",
      theme === "light" ? "Switch to dark mode" : "Switch to light mode"
    );
  });
}

function toggleTheme() {
  const next = document.body.classList.contains("light") ? "dark" : "light";
  applyTheme(next);
  setStoredTheme(next);
}

function initTheme() {
  // The inline snippet in <body> already set the class before paint;
  // this just re-syncs ARIA labels and wires up every toggle button on the page.
  const stored = getStoredTheme() || "dark";
  applyTheme(stored);
  document.querySelectorAll(".theme-toggle").forEach((btn) => {
    btn.addEventListener("click", toggleTheme);
  });
}

function initMobileNav() {
  const toggle = document.getElementById("nav-toggle");
  const links = document.getElementById("nav-links");
  if (!toggle || !links) return;

  const closeMenu = () => {
    links.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
  };

  toggle.addEventListener("click", () => {
    const isOpen = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  // Close after tapping a nav link, and on outside click / Escape.
  links.querySelectorAll("a, button:not(#nav-toggle)").forEach((el) => {
    el.addEventListener("click", closeMenu);
  });
  document.addEventListener("click", (e) => {
    if (!links.classList.contains("open")) return;
    if (!links.contains(e.target) && !toggle.contains(e.target)) closeMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeMenu();
  });
}

document.addEventListener("DOMContentLoaded", initTheme);
document.addEventListener("DOMContentLoaded", initMobileNav);
