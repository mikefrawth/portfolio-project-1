/**
 * Application bootstrap
 * ----------------------
 * This is the very first file that runs in the browser.
 * It mounts the React app onto the <div id="root"> in index.html.
 *
 * StrictMode is a React development tool — it intentionally double-renders
 * components to help surface bugs. It has no effect in production builds.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Could not find #root element");

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
