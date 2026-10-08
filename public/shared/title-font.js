/* Title-font picker: lets the host choose the font of the game-title banner.
   Choice is saved in localStorage and shared by all five games. Any element
   with [data-title-font-picker] becomes a grid of font chips. */
(function () {
  var KEY = "platformTitleFont";
  var FONTS = [
    { id: "default", name: "Game default" },
    { id: "pacifico", name: "Pacifico", css: "Pacifico", fam: "Pacifico", w: 400 },
    { id: "bungee", name: "Bungee", css: "Bungee", fam: "Bungee", w: 400 },
    { id: "lilita", name: "Lilita One", css: "Lilita One", fam: "Lilita+One", w: 400 },
    { id: "cinzel", name: "Cinzel Decorative", css: "Cinzel Decorative", fam: "Cinzel+Decorative:wght@700", w: 700 },
    { id: "baloo", name: "Baloo 2", css: "Baloo 2", fam: "Baloo+2:wght@800", w: 800 },
    { id: "fredoka", name: "Fredoka", css: "Fredoka", fam: "Fredoka:wght@600", w: 600 },
    { id: "lobster", name: "Lobster", css: "Lobster", fam: "Lobster", w: 400 },
    { id: "righteous", name: "Righteous", css: "Righteous", fam: "Righteous", w: 400 },
    { id: "chewy", name: "Chewy", css: "Chewy", fam: "Chewy", w: 400 },
    { id: "bangers", name: "Bangers", css: "Bangers", fam: "Bangers", w: 400 },
    { id: "shrikhand", name: "Shrikhand", css: "Shrikhand", fam: "Shrikhand", w: 400 },
    { id: "luckiest", name: "Luckiest Guy", css: "Luckiest Guy", fam: "Luckiest+Guy", w: 400 },
    { id: "titan", name: "Titan One", css: "Titan One", fam: "Titan+One", w: 400 },
    { id: "marker", name: "Permanent Marker", css: "Permanent Marker", fam: "Permanent+Marker", w: 400 },
    { id: "pixel", name: "Press Start 2P", css: "Press Start 2P", fam: "Press+Start+2P", w: 400 }
  ];
  function byId(id) { for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i]; return FONTS[0]; }
  function saved() { try { return byId(localStorage.getItem(KEY)).id; } catch (e) { return "default"; } }

  // One small request: only the letters needed (the titles + font names).
  function loadFonts() {
    if (document.getElementById("titleFontsLink")) return;
    var fams = FONTS.filter(function (f) { return f.fam; }).map(function (f) { return "family=" + f.fam; }).join("&");
    var text = encodeURIComponent("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ");
    var l = document.createElement("link");
    l.id = "titleFontsLink"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?" + fams + "&text=" + text + "&display=swap";
    document.head.appendChild(l);
  }

  function fit() {
    var t = document.querySelector(".heroTitle"), band = document.getElementById("heroBand");
    if (!t || !band) return;
    t.style.fontSize = "";
    var max = band.clientWidth - (band.classList.contains("hasDiag") ? 120 : 28);
    var size = parseFloat(getComputedStyle(t).fontSize), guard = 40;
    while (t.scrollWidth > max && size > 12 && guard-- > 0) { size -= 1; t.style.fontSize = size + "px"; }
  }

  function apply(id) {
    var f = byId(id), t = document.querySelector(".heroTitle");
    if (t) {
      if (f.css) { t.style.fontFamily = '"' + f.css + '", "Fredoka", cursive'; t.style.fontWeight = f.w; }
      else { t.style.fontFamily = ""; t.style.fontWeight = ""; }
    }
    try { localStorage.setItem(KEY, f.id); } catch (e) {}
    var chips = document.querySelectorAll("[data-title-font-chip]");
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle("active", chips[i].getAttribute("data-title-font-chip") === f.id);
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  function build() {
    var title = (document.querySelector(".heroTitle") || {}).textContent || "TITLE";
    var hosts = document.querySelectorAll("[data-title-font-picker]");
    for (var h = 0; h < hosts.length; h++) {
      var grid = document.createElement("div"); grid.className = "titleFontGrid";
      FONTS.forEach(function (f) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "titleFontChip"; b.setAttribute("data-title-font-chip", f.id);
        b.setAttribute("aria-label", "Title font: " + f.name);
        var s = document.createElement("span"); s.className = "tfSample"; s.textContent = f.css ? title : "Aa";
        if (f.css) { s.style.fontFamily = '"' + f.css + '", cursive'; s.style.fontWeight = f.w; }
        var n = document.createElement("span"); n.className = "tfName"; n.textContent = f.name;
        b.appendChild(s); b.appendChild(n);
        b.addEventListener("click", function () { apply(f.id); });
        grid.appendChild(b);
      });
      hosts[h].appendChild(grid);
    }
    apply(saved());
  }

  loadFonts();
  function init() { build(); window.addEventListener("resize", fit); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.TitleFont = { apply: apply, fonts: FONTS };
})();
