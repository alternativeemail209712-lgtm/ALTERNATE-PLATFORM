/* ==========================================================================
   PLATFORM THEME SYSTEM — apply / persist / wire up <select data-theme-select>
   Shared by the hub, Flagle, and TRAVLE so a theme picked on any one page
   carries over to the others (stored in localStorage).
   ========================================================================== */
(function () {
  var THEMES = ["cream", "blue", "green", "pink", "violet", "honey"];
  var STORAGE_KEY = "platformTheme";

  function readSaved() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return THEMES.indexOf(v) !== -1 ? v : "cream";
    } catch (e) {
      return "cream";
    }
  }

  function apply(theme) {
    if (THEMES.indexOf(theme) === -1) theme = "cream";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {}
    var selects = document.querySelectorAll("[data-theme-select]");
    for (var i = 0; i < selects.length; i++) {
      if (selects[i].value !== theme) selects[i].value = theme;
    }
  }

  // Apply immediately (before DOMContentLoaded) so there's no flash of the
  // wrong theme on load.
  apply(readSaved());

  function wireSelects() {
    var selects = document.querySelectorAll("[data-theme-select]");
    for (var i = 0; i < selects.length; i++) {
      selects[i].value = readSaved();
      selects[i].addEventListener("change", function (e) {
        apply(e.target.value);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wireSelects);
  } else {
    wireSelects();
  }

  window.PlatformTheme = { apply: apply, themes: THEMES };
})();
