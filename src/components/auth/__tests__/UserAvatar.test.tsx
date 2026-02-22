import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserAvatar } from "@/components/auth/UserAvatar";

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    ...props
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    className?: string;
    sizes?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

describe("UserAvatar", () => {
  it("shows initials when no avatarUrl provided", () => {
    render(<UserAvatar name="Monkey D. Luffy" />);
    expect(screen.getByText("ML")).toBeInTheDocument();
  });

  it("shows single-word initials for single name", () => {
    render(<UserAvatar name="Luffy" />);
    expect(screen.getByText("LU")).toBeInTheDocument();
  });

  it("shows image when avatarUrl is provided", () => {
    render(
      <UserAvatar name="Luffy" avatarUrl="https://example.com/avatar.jpg" />
    );
    const img = screen.getByRole("img", { name: "Avatar of Luffy" });
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe("IMG");
  });

  it("applies sm size classes", () => {
    render(<UserAvatar name="Luffy" size="sm" />);
    const avatar = screen.getByRole("img", { name: "Avatar of Luffy" });
    expect(avatar.className).toContain("h-8");
    expect(avatar.className).toContain("w-8");
  });

  it("applies md size classes by default", () => {
    render(<UserAvatar name="Luffy" />);
    const avatar = screen.getByRole("img", { name: "Avatar of Luffy" });
    expect(avatar.className).toContain("h-10");
    expect(avatar.className).toContain("w-10");
  });

  it("applies lg size classes", () => {
    render(<UserAvatar name="Luffy" size="lg" />);
    const avatar = screen.getByRole("img", { name: "Avatar of Luffy" });
    expect(avatar.className).toContain("h-16");
    expect(avatar.className).toContain("w-16");
  });

  it("applies custom className", () => {
    render(<UserAvatar name="Luffy" className="border-2" />);
    const avatar = screen.getByRole("img", { name: "Avatar of Luffy" });
    expect(avatar.className).toContain("border-2");
  });
});
