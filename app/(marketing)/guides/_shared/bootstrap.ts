/**
 * Runs before any visible guide markup and sets the lock state on the guide wrapper.
 * The flag belongs to the wrapper so client navigation cannot affect other routes.
 */
export const GUIDE_BOOTSTRAP = `(function () {
  var mode = "locked";
  try {
    if (localStorage.getItem("weekendmvp_subscribed") === "true") mode = "returning";
  } catch {}
  document.currentScript.parentElement.setAttribute("data-guide", mode);
})();`;
