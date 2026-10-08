/* ==========================================================================
   PLATFORM SESSION — remembers the host's TikTok username across every
   game on this platform (localStorage, same-device only), so connecting
   once on any game pre-fills and auto-connects the rest. This is not an
   account/auth system — there's no server-side login — it's a shared
   "who am I streaming as" convenience so the host never has to re-type
   their username when switching games mid-broadcast.

   API:
     window.PlatformSession.getUsername()      -> string | null
     window.PlatformSession.setUsername(name)  -> void (also broadcasts
                                                   to other open tabs via
                                                   the "storage" event)
     window.PlatformSession.clear()            -> void
     window.PlatformSession.onChange(fn)       -> fn(username) called
                                                   immediately with the
                                                   current value, and again
                                                   whenever it changes
                                                   (including from another
                                                   tab/game)
   ========================================================================== */
(function () {
  var STORAGE_KEY = "platformTikTokUsername";
  var listeners = [];

  function readSaved() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      return v && v.trim() ? v.trim() : null;
    } catch (e) {
      return null;
    }
  }

  function normalize(name) {
    return String(name || "").trim().replace(/^@/, "");
  }

  function getUsername() {
    return readSaved();
  }

  function setUsername(name) {
    var clean = normalize(name);
    if (!clean) return;
    try {
      localStorage.setItem(STORAGE_KEY, clean);
    } catch (e) {}
    notify(clean);
  }

  function clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    notify(null);
  }

  function notify(value) {
    for (var i = 0; i < listeners.length; i++) {
      try {
        listeners[i](value);
      } catch (e) {}
    }
  }

  function onChange(fn) {
    if (typeof fn !== "function") return;
    listeners.push(fn);
    fn(readSaved());
  }

  // Pick up a username saved from ANOTHER open tab/game without a reload.
  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY) notify(e.newValue && e.newValue.trim() ? e.newValue.trim() : null);
  });

  window.PlatformSession = {
    getUsername: getUsername,
    setUsername: setUsername,
    clear: clear,
    onChange: onChange,
  };
})();
