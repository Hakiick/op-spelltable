"use client";

import type { ReactNode } from "react";

interface VideoLayoutProps {
  localFeed: ReactNode;
  remoteFeed: ReactNode;
  statusBar?: ReactNode;
  controls?: ReactNode;
}

export default function VideoLayout({
  localFeed,
  remoteFeed,
  statusBar,
  controls,
}: VideoLayoutProps) {
  return (
    <div className="flex flex-1 flex-col gap-3">
      {/* Status bar — shown at top when provided */}
      {statusBar && (
        <div className="flex items-center justify-between px-1">
          {statusBar}
        </div>
      )}

      {/* Video feeds: stacked on mobile, side by side on desktop */}
      <div className="flex flex-1 flex-col gap-3 md:flex-row">
        {/* Local feed */}
        <div className="flex-1">
          <div className="aspect-video w-full overflow-hidden">{localFeed}</div>
        </div>

        {/* Remote feed */}
        <div className="flex-1">
          <div className="aspect-video w-full overflow-hidden">
            {remoteFeed}
          </div>
        </div>
      </div>

      {/* Controls — shown at bottom when provided */}
      {controls && (
        <div className="flex items-center justify-center gap-3">{controls}</div>
      )}
    </div>
  );
}
