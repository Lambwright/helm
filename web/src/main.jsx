import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme.css";
import App from "./App.jsx";
import ProcorePanel from "./panel/ProcorePanel.jsx";

// ?panel=erp-tools is the Procore side panel, set as the External URL on TALLY's
// Procore app. HELM has no router, so this is the one place the page is chosen.
const isProcorePanel = new URLSearchParams(window.location.search).get("panel") === "erp-tools";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {isProcorePanel ? <ProcorePanel /> : <App />}
  </StrictMode>
);
