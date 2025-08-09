"use client";
import { useEffect } from "react";
import { sdk } from "@farcaster/miniapp-sdk";

export default function DashboardPage() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard — coming soon</h1>
    </div>
  );
}
