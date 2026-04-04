/**
 * Subtle looped background music per zone.
 */
(function () {
  var TRACKS = {
    default: "LeetmateBGMusic.mp3",
    community: "communityMusic.mp3",
  };

  var zone = document.body && document.body.dataset.musicZone;
  if (!zone || !TRACKS[zone]) zone = "default";

  var base = new URL("../../assets/audio/", window.location.href);
  var src = new URL(TRACKS[zone], base).href;
  var audio = new Audio(src);
  audio.loop = true;
  audio.volume = 0.14;
  audio.preload = "auto";

  function tryPlay() {
    var p = audio.play();
    if (p && typeof p.catch === "function") p.catch(function () {});
  }

  audio.addEventListener("error", function () {
    /* eslint-disable no-console */
    console.warn("Background music failed to load:", src);
  });

  audio.play().catch(function () {
    function unlockOnce() {
      document.removeEventListener("pointerdown", unlockOnce);
      document.removeEventListener("keydown", unlockOnce);
      tryPlay();
    }
    document.addEventListener("pointerdown", unlockOnce);
    document.addEventListener("keydown", unlockOnce);
  });
})();
