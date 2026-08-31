import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/context";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./app/App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
);
