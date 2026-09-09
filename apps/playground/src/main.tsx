import React from "react";
import { createRoot } from "react-dom/client";
import "@smeditor/theme-default";
import "./styles.css";
import { App } from "./App.js";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing from index.html");

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
