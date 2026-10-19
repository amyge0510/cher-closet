import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { PHONE, PHONE_QUERY } from "./stage/layout";

// The phone layout is picked once at start-up, so turning a phone sideways
// (or back) reloads into the other one.
window.matchMedia(PHONE_QUERY).addEventListener("change", (e) => {
  if (e.matches !== PHONE) location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
