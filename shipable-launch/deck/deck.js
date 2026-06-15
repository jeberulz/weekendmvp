(function () {
  const params = new URLSearchParams(window.location.search);
  const present = params.get("present") === "1";
  const deck = document.getElementById("deck");
  const hud = document.getElementById("hud");
  const slides = Array.from(document.querySelectorAll(".slide"));

  if (!present) return;

  deck.classList.remove("deck-export");
  deck.classList.add("deck-present");
  hud.hidden = false;

  let index = 0;

  function show(i) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, n) => s.classList.toggle("is-active", n === index));
    hud.textContent = `Slide ${index + 1} / ${slides.length} · ← → · F fullscreen`;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
      e.preventDefault();
      show(index + 1);
    } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      show(index - 1);
    } else if (e.key === "Home") {
      show(0);
    } else if (e.key === "End") {
      show(slides.length - 1);
    } else if (e.key === "f" || e.key === "F") {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }
  });

  show(0);
})();
