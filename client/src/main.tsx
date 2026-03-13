import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { StatusBar } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";

if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: false });
}

createRoot(document.getElementById("root")!).render(<App />);
