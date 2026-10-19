import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { isPhone, PHONE } from "./stage/layout";

// The phone layout is picked once at start-up, so turning a phone sideways
// (or back) reloads into the other one. Only a real turn counts: the
// keyboard opening must never reload (it would wipe what's being typed).
const turned = () => {
  if (isPhone() !== PHONE && location.hash !== "#admin") location.reload();
};
screen.orientation?.addEventListener("change", turned);
window.addEventListener("orientationchange", turned);

// /#admin is the owner's analytics dashboard, a plain page instead of the closet
const ADMIN = location.hash === "#admin";
const Dashboard = lazy(() => import("./admin/Dashboard").then((m) => ({ default: m.Dashboard })));
window.addEventListener("hashchange", () => {
  if ((location.hash === "#admin") !== ADMIN) location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {ADMIN ? (
      <Suspense fallback={null}>
        <Dashboard />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
