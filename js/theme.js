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

document.addEventListener("DOMContentLoaded", initTheme);
