import { useEffect, useRef } from "react";
import { initApp } from "./app/main.js";

// This project intentionally contains ALL real application logic in plain
// JavaScript/HTML/CSS files under ./app — this file only exists because the
// build tooling requires a React entry point. It does nothing but mount a
// single div and hand control over to the vanilla JS app (initApp).
export default function App() {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const teardown = initApp(host);
    return () => {
      if (typeof teardown === "function") teardown();
    };
  }, []);

  return <div id="pas-host" ref={hostRef} />;
}
