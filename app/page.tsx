"use client";

import dynamic from "next/dynamic";

const MaidBridgeApp = dynamic(() => import("@/components/MaidBridgeApp"), {
  ssr: false,
});

export default function Page() {
  return <MaidBridgeApp />;
}
