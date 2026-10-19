import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { isPhone, PHONE } from "./stage/layout";

// The phone layout is picked once at start-up, so turning a phone sideways
// (or back) reloads into the other one. Only a real turn counts: the
// keyboard opening must never reload (it would wipe what's being typed).
const turned = () => {
  if (isPhone() !== PHONE) location.reload();
};
screen.orientation?.addEventListener("change", turned);
window.addEventListener("orientationchange", turned);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
