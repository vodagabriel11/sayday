import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { StatusBar } from "@capacitor/status-bar";
import { Capacitor } from "@capacitor/core";
import { requestNotificationPermission } from "@/lib/notification-service";

if (Capacitor.isNativePlatform()) {
  StatusBar.setOverlaysWebView({ overlay: true });
  StatusBar.setBackgroundColor({ color: '#00000000' });
  requestNotificationPermission();
}

createRoot(document.getElementById("root")!).render(<App />);
