import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import PwaUpdatePrompt from "./components/PwaUpdatePrompt.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { OnboardingProvider } from "./contexts/OnboardingContext.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { WorkspaceViewProvider } from "./contexts/WorkspaceViewContext.jsx";
import { ToastProvider } from "./components/Toast.jsx";
import "./styles.css";

const LEGACY_LOCAL_DATA_KEYS = [
  "agensync_local_products_v1",
  "agensync_local_product_sales_v1",
  "agensync_local_expenses_v1",
  "agensync_local_subscriptions_v1",
  "agensync_token",
  "@agensync-token",
  "agensync_cleanup_legacy_local_data_v1"
];
const CARE_STORAGE_KEY = "agensync_client_care_v1";
const FORM_TEMPLATES_KEY = "agensync_form_templates_v1";
const LEGACY_STORAGE_PREFIX = "agensync_local_";
const LEGACY_SUPABASE_AUTH_TOKEN_SUFFIX = "-auth-token";

function cleanupLegacyLocalStorage() {
  if (typeof window === "undefined") return;

  const keysToRemove = [...LEGACY_LOCAL_DATA_KEYS];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = String(window.localStorage.key(index) || "");
    if (key.startsWith(LEGACY_STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
    if (key.startsWith("sb-") && key.endsWith(LEGACY_SUPABASE_AUTH_TOKEN_SUFFIX)) {
      keysToRemove.push(key);
    }
  }

  [...new Set(keysToRemove)].forEach((key) => window.localStorage.removeItem(key));

  const rawCareStorage = window.localStorage.getItem(CARE_STORAGE_KEY);
  if (rawCareStorage) {
    try {
      const parsed = JSON.parse(rawCareStorage);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "__formTemplates" in parsed) {
        const templates = Array.isArray(parsed.__formTemplates) ? parsed.__formTemplates : [];
        if (templates.length && !window.localStorage.getItem(FORM_TEMPLATES_KEY)) {
          window.localStorage.setItem(FORM_TEMPLATES_KEY, JSON.stringify(templates));
        }
        delete parsed.__formTemplates;
        window.localStorage.setItem(CARE_STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch {
      window.localStorage.removeItem(CARE_STORAGE_KEY);
    }
  }
}

cleanupLegacyLocalStorage();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <WorkspaceViewProvider>
              <OnboardingProvider>
                <App />
                <PwaUpdatePrompt />
              </OnboardingProvider>
            </WorkspaceViewProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
