import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import "./styles.css";

const LEGACY_MOCK_KEYS = [
  "agensync_local_products_v1",
  "agensync_local_product_sales_v1",
  "agensync_local_expenses_v1",
  "agensync_local_subscriptions_v1"
];
const CARE_STORAGE_KEY = "agensync_client_care_v1";
const LEGACY_CLEANUP_FLAG_KEY = "agensync_cleanup_legacy_mock_data_v1";

function cleanupLegacyMockStorage() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(LEGACY_CLEANUP_FLAG_KEY) === "true") return;

  LEGACY_MOCK_KEYS.forEach((key) => window.localStorage.removeItem(key));

  const rawCareStorage = window.localStorage.getItem(CARE_STORAGE_KEY);
  if (rawCareStorage) {
    try {
      const parsed = JSON.parse(rawCareStorage);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "__formTemplates" in parsed) {
        delete parsed.__formTemplates;
        window.localStorage.setItem(CARE_STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch {
      window.localStorage.removeItem(CARE_STORAGE_KEY);
    }
  }

  window.localStorage.setItem(LEGACY_CLEANUP_FLAG_KEY, "true");
}

cleanupLegacyMockStorage();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
