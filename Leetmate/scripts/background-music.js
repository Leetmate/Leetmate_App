/**
 * Subtle looped background music per zone.
 * Volume and mute persist via chrome.storage (leetmate_music_volume, leetmate_music_muted).
 */
(function () {
  "use strict";

  var TRACKS = {
    default: "LeetmateBGMusic.mp3",
    community: "communityMusic.mp3",
  };

  var STORAGE_VOLUME = "leetmate_music_volume";
  var STORAGE_MUTED = "leetmate_music_muted";
  var DEFAULT_VOLUME = 0.14;

  var zone = document.body && document.body.dataset.musicZone;
  if (!zone || !TRACKS[zone]) zone = "default";

  var base = new URL("../../assets/audio/", window.location.href);
  var src = new URL(TRACKS[zone], base).href;
  var audio = new Audio(src);
  audio.loop = true;
  audio.preload = "auto";

  function clamp01(x) {
    if (typeof x !== "number" || isNaN(x)) return DEFAULT_VOLUME;
    return Math.max(0, Math.min(1, x));
  }

  function applyToAudio(volume01, muted) {
    var v = clamp01(volume01);
    audio.volume = muted ? 0 : v;
  }

  function loadPrefsAndApply(cb) {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) {
      applyToAudio(DEFAULT_VOLUME, false);
      if (cb) cb();
      return;
    }
    chrome.storage.local.get([STORAGE_VOLUME, STORAGE_MUTED], function (items) {
      var vol =
        typeof items[STORAGE_VOLUME] === "number"
          ? items[STORAGE_VOLUME]
          : DEFAULT_VOLUME;
      var muted = !!items[STORAGE_MUTED];
      applyToAudio(vol, muted);
      if (cb) cb();
    });
  }

  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local") return;
      if (!changes[STORAGE_VOLUME] && !changes[STORAGE_MUTED]) return;
      loadPrefsAndApply();
    });
  }

  function tryPlay() {
    var p = audio.play();
    if (p && typeof p.catch === "function") p.catch(function () {});
  }

  audio.addEventListener("error", function () {
    /* eslint-disable no-console */
    console.warn("Background music failed to load:", src);
  });

  loadPrefsAndApply(function () {
    audio.play().catch(function () {
      function unlockOnce() {
        document.removeEventListener("pointerdown", unlockOnce);
        document.removeEventListener("keydown", unlockOnce);
        tryPlay();
      }
      document.addEventListener("pointerdown", unlockOnce);
      document.addEventListener("keydown", unlockOnce);
    });
  });
})();
