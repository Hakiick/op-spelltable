import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import CameraSetup from "@/components/video/CameraSetup";
import type { CameraDevice, CameraSettings } from "@/hooks/useCamera";

// Mock WebcamFeed so tests don't need a real camera
vi.mock("@/components/video/WebcamFeed", () => ({
  default: ({ className }: { className?: string }) => (
    <div data-testid="webcam-feed-mock" className={className}>
      Camera Preview
    </div>
  ),
}));

// Mock radix-ui Dialog portal to render inline for testing
vi.mock("radix-ui", async () => {
  const actual = await vi.importActual<typeof import("radix-ui")>("radix-ui");
  return {
    ...actual,
    Dialog: {
      ...actual.Dialog,
      Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    },
  };
});

const defaultSettings: CameraSettings = {
  deviceId: null,
  resolution: "auto",
  mirror: true,
};

const defaultDevices: CameraDevice[] = [
  { deviceId: "cam1", label: "Front Camera" },
  { deviceId: "cam2", label: "Back Camera" },
];

function renderCameraSetup(overrides?: {
  devices?: CameraDevice[];
  settings?: CameraSettings;
  stream?: MediaStream | null;
  onUpdateSettings?: (partial: Partial<CameraSettings>) => void;
  onApply?: () => Promise<void>;
}) {
  const onUpdateSettings = overrides?.onUpdateSettings ?? vi.fn();
  const onApply = overrides?.onApply ?? vi.fn().mockResolvedValue(undefined);

  render(
    <CameraSetup
      devices={overrides?.devices ?? defaultDevices}
      settings={overrides?.settings ?? defaultSettings}
      stream={overrides?.stream ?? null}
      onUpdateSettings={onUpdateSettings}
      onApply={onApply}
    />
  );

  return { onUpdateSettings, onApply };
}

describe("CameraSetup", () => {
  it("renders the Camera Settings trigger button", () => {
    renderCameraSetup();

    expect(
      screen.getByRole("button", { name: /camera settings/i })
    ).toBeInTheDocument();
  });

  it("opens the dialog when trigger button is clicked", async () => {
    renderCameraSetup();

    const triggerBtn = screen.getByRole("button", { name: /open camera settings/i });
    fireEvent.click(triggerBtn);

    await waitFor(() => {
      // Dialog should be open — the dialog title heading should be visible
      expect(screen.getByRole("heading", { name: /camera settings/i })).toBeInTheDocument();
    });
  });

  it("shows camera device options in the select", async () => {
    renderCameraSetup();

    fireEvent.click(screen.getByRole("button", { name: /camera settings/i }));

    await waitFor(() => {
      expect(screen.getByText("Front Camera")).toBeInTheDocument();
      expect(screen.getByText("Back Camera")).toBeInTheDocument();
    });
  });

  it("shows all resolution options", async () => {
    renderCameraSetup();

    fireEvent.click(screen.getByRole("button", { name: /camera settings/i }));

    await waitFor(() => {
      expect(screen.getByText("Auto")).toBeInTheDocument();
      expect(screen.getByText("720p HD")).toBeInTheDocument();
      expect(screen.getByText("480p SD")).toBeInTheDocument();
      expect(screen.getByText("360p Low")).toBeInTheDocument();
    });
  });

  it("shows mirror toggle with correct initial state", async () => {
    renderCameraSetup({ settings: { ...defaultSettings, mirror: true } });

    fireEvent.click(screen.getByRole("button", { name: /camera settings/i }));

    await waitFor(() => {
      const mirrorSwitch = screen.getByRole("switch", { name: /mirror video/i });
      expect(mirrorSwitch).toHaveAttribute("aria-checked", "true");
    });
  });

  it("calls onUpdateSettings with mirror=false when mirror toggle is clicked", async () => {
    const { onUpdateSettings } = renderCameraSetup({
      settings: { ...defaultSettings, mirror: true },
    });

    fireEvent.click(screen.getByRole("button", { name: /camera settings/i }));

    await waitFor(() => {
      expect(screen.getByRole("switch", { name: /mirror video/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("switch", { name: /mirror video/i }));
    expect(onUpdateSettings).toHaveBeenCalledWith({ mirror: false });
  });

  it("calls onUpdateSettings with selected resolution when a resolution button is clicked", async () => {
    const { onUpdateSettings } = renderCameraSetup();

    fireEvent.click(screen.getByRole("button", { name: /camera settings/i }));

    await waitFor(() => {
      expect(screen.getByText("720p HD")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("720p HD"));
    expect(onUpdateSettings).toHaveBeenCalledWith({ resolution: "720p" });
  });

  it("calls onApply when Apply Settings button is clicked", async () => {
    const { onApply } = renderCameraSetup();

    fireEvent.click(screen.getByRole("button", { name: /camera settings/i }));

    await waitFor(() => {
      expect(screen.getByText("Apply Settings")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Apply Settings"));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledOnce();
    });
  });

  it("shows no cameras message when devices array is empty", async () => {
    renderCameraSetup({ devices: [] });

    fireEvent.click(screen.getByRole("button", { name: /camera settings/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/no cameras detected/i)
      ).toBeInTheDocument();
    });
  });

  it("renders the webcam preview", async () => {
    renderCameraSetup();

    fireEvent.click(screen.getByRole("button", { name: /camera settings/i }));

    await waitFor(() => {
      expect(screen.getByTestId("webcam-feed-mock")).toBeInTheDocument();
    });
  });

  it("trigger button meets touch target size (min-h-[44px])", () => {
    renderCameraSetup();

    const btn = screen.getByRole("button", { name: /camera settings/i });
    expect(btn.className).toContain("min-h-[44px]");
  });
});
