import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import VideoLayout from "@/components/video/VideoLayout";

describe("VideoLayout", () => {
  it("renders local and remote feed slots", () => {
    render(
      <VideoLayout
        localFeed={<div data-testid="local-feed">Local Feed</div>}
        remoteFeed={<div data-testid="remote-feed">Remote Feed</div>}
      />
    );

    expect(screen.getByTestId("local-feed")).toBeInTheDocument();
    expect(screen.getByTestId("remote-feed")).toBeInTheDocument();
  });

  it("renders status bar when provided", () => {
    render(
      <VideoLayout
        localFeed={<div>Local</div>}
        remoteFeed={<div>Remote</div>}
        statusBar={<div data-testid="status-bar">Connected</div>}
      />
    );

    expect(screen.getByTestId("status-bar")).toBeInTheDocument();
  });

  it("does not render status bar area when not provided", () => {
    render(
      <VideoLayout
        localFeed={<div>Local</div>}
        remoteFeed={<div>Remote</div>}
      />
    );

    expect(screen.queryByTestId("status-bar")).not.toBeInTheDocument();
  });

  it("renders controls when provided", () => {
    render(
      <VideoLayout
        localFeed={<div>Local</div>}
        remoteFeed={<div>Remote</div>}
        controls={<button data-testid="control-btn">Settings</button>}
      />
    );

    expect(screen.getByTestId("control-btn")).toBeInTheDocument();
  });

  it("does not render controls area when not provided", () => {
    render(
      <VideoLayout
        localFeed={<div>Local</div>}
        remoteFeed={<div>Remote</div>}
      />
    );

    expect(screen.queryByTestId("control-btn")).not.toBeInTheDocument();
  });

  it("renders all four slots when all props are provided", () => {
    render(
      <VideoLayout
        localFeed={<div data-testid="local">Local</div>}
        remoteFeed={<div data-testid="remote">Remote</div>}
        statusBar={<div data-testid="status">Status</div>}
        controls={<div data-testid="controls">Controls</div>}
      />
    );

    expect(screen.getByTestId("local")).toBeInTheDocument();
    expect(screen.getByTestId("remote")).toBeInTheDocument();
    expect(screen.getByTestId("status")).toBeInTheDocument();
    expect(screen.getByTestId("controls")).toBeInTheDocument();
  });

  it("applies responsive flex classes for mobile/desktop layout", () => {
    const { container } = render(
      <VideoLayout
        localFeed={<div>Local</div>}
        remoteFeed={<div>Remote</div>}
      />
    );

    // The video container should have flex-col on mobile and md:flex-row on desktop
    const videoContainer = container.querySelector(".flex-col.md\\:flex-row");
    expect(videoContainer).not.toBeNull();
  });

  it("wraps each feed in an aspect-video container", () => {
    const { container } = render(
      <VideoLayout
        localFeed={<div data-testid="local">Local</div>}
        remoteFeed={<div data-testid="remote">Remote</div>}
      />
    );

    const aspectContainers = container.querySelectorAll(".aspect-video");
    expect(aspectContainers).toHaveLength(2);
  });
});
