"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CameraDevice, CameraSettings } from "@/hooks/useCamera";
import WebcamFeed from "@/components/video/WebcamFeed";

interface CameraSetupProps {
  devices: CameraDevice[];
  settings: CameraSettings;
  stream: MediaStream | null;
  onUpdateSettings: (partial: Partial<CameraSettings>) => void;
  onApply: () => Promise<void>;
}

const RESOLUTIONS: Array<{ value: CameraSettings["resolution"]; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "720p", label: "720p HD" },
  { value: "480p", label: "480p SD" },
  { value: "360p", label: "360p Low" },
];

export default function CameraSetup({
  devices,
  settings,
  stream,
  onUpdateSettings,
  onApply,
}: CameraSetupProps) {
  const [open, setOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply();
    } finally {
      setApplying(false);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px] min-w-[44px] border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
          aria-label="Open camera settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mr-1.5 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.069A1 1 0 0121 8.882v6.236a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
            />
          </svg>
          Camera Settings
        </Button>
      </DialogTrigger>

      <DialogContent className="border-gray-700 bg-gray-900 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Camera Settings</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* Preview */}
          <div className="overflow-hidden rounded-lg">
            <WebcamFeed
              stream={stream}
              mirror={settings.mirror}
              className="aspect-video w-full"
            />
          </div>

          {/* Device selection */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="camera-device-select"
              className="text-sm font-medium text-gray-300"
            >
              Camera
            </label>
            {devices.length > 0 ? (
              <select
                id="camera-device-select"
                value={settings.deviceId ?? ""}
                onChange={(e) =>
                  onUpdateSettings({ deviceId: e.target.value || null })
                }
                className="min-h-[44px] w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="">Default camera</option>
                {devices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-gray-500">
                No cameras detected. Start the camera to enumerate devices.
              </p>
            )}
          </div>

          {/* Resolution */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-300">Resolution</span>
            <div className="grid grid-cols-2 gap-2">
              {RESOLUTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onUpdateSettings({ resolution: value })}
                  className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                    settings.resolution === value
                      ? "border-blue-500 bg-blue-600 text-white"
                      : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`}
                  aria-pressed={settings.resolution === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mirror toggle */}
          <div className="flex items-center justify-between">
            <span id="mirror-label" className="text-sm font-medium text-gray-300">Mirror video</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.mirror}
              aria-labelledby="mirror-label"
              onClick={() => onUpdateSettings({ mirror: !settings.mirror })}
              className={`relative inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                settings.mirror
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              {settings.mirror ? "On" : "Off"}
            </button>
          </div>

          {/* Apply button */}
          <Button
            onClick={() => void handleApply()}
            disabled={applying}
            className="min-h-[44px] w-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {applying ? "Applying..." : "Apply Settings"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
