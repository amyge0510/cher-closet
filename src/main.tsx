import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { isPhone, PHONE } from "./stage/layout";

// The phone layout is picked once at start-up, so turning a phone sideways
// (or back) reloads into the other one. Only a real turn counts: the
// keyboard opening must never reload (it would wipe what's being typed).
const turned = () => {
  if (isPhone() !== PHONE && !PAGE) location.reload();
};
screen.orientation?.addEventListener("change", turned);
window.addEventListener("orientationchange", turned);

// /#admin is the owner's analytics dashboard and /#recover puts deleted
// clothes back: plain pages instead of the closet
const PAGES = ["#admin", "#recover"];
const PAGE = PAGES.includes(location.hash) ? location.hash : null;
const Dashboard = lazy(() => import("./admin/Dashboard").then((m) => ({ default: m.Dashboard })));
const Recover = lazy(() => import("./admin/Recover").then((m) => ({ default: m.Recover })));
window.addEventListener("hashchange", () => {
  if ((PAGES.includes(location.hash) ? location.hash : null) !== PAGE) location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {PAGE ? (
      <Suspense fallback={null}>{PAGE === "#admin" ? <Dashboard /> : <Recover />}</Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
