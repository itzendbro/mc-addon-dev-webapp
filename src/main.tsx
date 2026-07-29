import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const container = document.getElementById("root") || document.body;
createRoot(container).render(<App />);
