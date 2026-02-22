"use client";

import type { ConnectionStatus } from "@/types/webrtc";

interface ConnectionStatusProps {
  status: ConnectionStatus;
  error?: string | null;
  className?: string;
}

const statusConfig: Record<
  ConnectionStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  idle: {
    label: "Not connected",
    dotClass: "bg-gray-400",
    badgeClass: "bg-gray-100 text-gray-600 border-gray-200",
  },
  connecting: {
    label: "Connecting...",
    dotClass: "bg-yellow-400 animate-pulse",
    badgeClass: "bg-yellow-50 text-yellow-700 border-yellow-200",
  },
  connected: {
    label: "Connected",
    dotClass: "bg-green-400",
    badgeClass: "bg-green-50 text-green-700 border-green-200",
  },
  disconnected: {
    label: "Reconnecting...",
    dotClass: "bg-orange-400 animate-pulse",
    badgeClass: "bg-orange-50 text-orange-700 border-orange-200",
  },
  failed: {
    label: "Connection failed",
    dotClass: "bg-red-500",
    badgeClass: "bg-red-50 text-red-700 border-red-200",
  },
};

export default function ConnectionStatus({
  status,
  error,
  className = "",
}: ConnectionStatusProps) {
  const config = statusConfig[status];

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${config.badgeClass}`}
        role="status"
        aria-live="polite"
        aria-label={`Connection status: ${config.label}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${config.dotClass}`}
          aria-hidden="true"
        />
        {config.label}
      </span>

      {status === "failed" && error && (
        <p className="max-w-xs text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
