import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { toast } from "./hooks/useToast";

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  toast(event.reason?.message || "An unexpected error occurred", "error");
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
