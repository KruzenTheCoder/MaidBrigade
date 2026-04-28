"use client";

import { useEffect, useRef } from "react";

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-mb="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = false;
    s.dataset.mb = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export default function MaidBridgeApp() {
  const containerRef = useRef<HTMLDivElement>(null);
  const bootedRef = useRef(false);

  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    (async () => {
      // 1) Inject the original body markup (keeps the exact DOM the script expects).
      const html = await fetch("/body.html").then((r) => r.text());
      if (containerRef.current) containerRef.current.innerHTML = html;

      // 2) Load 3rd-party libs in order (CDN, matching the original file).
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
      await loadScript("https://unpkg.com/dexie@3.2.4/dist/dexie.js");
      await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");

      // 3) Load Supabase JS (UMD build) so the sync layer can use it without a bundler import.
      await loadScript("https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js");

      // 4) Inject Supabase config from env (compiled into the page) for the sync layer.
      (window as any).__MB_SUPABASE__ = {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
      };

      // 5) Load the original app logic FIRST (it defines saveAll/loadAll placeholders).
      await loadScript("/maidbridge.js");

      // 6) Load the Supabase sync wrapper AFTER, so it overrides saveAll/loadAll with Supabase versions.
      await loadScript("/supabase-sync.js");

      // 7) Load enhanced features (marketing intel, mobile nav, enhanced routing).
      await loadScript("/mb-enhanced.js");

      // 8) Load lead intelligence (conversations, heatmap, CRM pipeline).
      await loadScript("/mb-leads.js");

      const init = (window as any).__mbInit;
      if (typeof init === "function") {
        try {
          await init();
        } catch (e) {
          console.error("MaidBridge init failed", e);
        }
      }
    })();
  }, []);

  return <div ref={containerRef} />;
}
