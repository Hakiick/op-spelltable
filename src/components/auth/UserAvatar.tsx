import { cn } from "@/lib/utils";
import Image from "next/image";

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const AVATAR_COLORS = [
  "bg-red-600",
  "bg-orange-600",
  "bg-amber-600",
  "bg-green-600",
  "bg-teal-600",
  "bg-blue-600",
  "bg-indigo-600",
  "bg-violet-600",
  "bg-pink-600",
];

function getColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_COLORS.length;
  }
  return AVATAR_COLORS[hash] ?? "bg-red-600";
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
  }
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

const SIZE_CLASSES: Record<"sm" | "md" | "lg", string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-16 w-16 text-xl",
};

const SIZE_PX: Record<"sm" | "md" | "lg", number> = {
  sm: 32,
  md: 40,
  lg: 64,
};

export function UserAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: UserAvatarProps) {
  const sizeClass = SIZE_CLASSES[size];
  const sizePx = SIZE_PX[size];

  if (avatarUrl) {
    return (
      <div
        className={cn(
          "relative rounded-full overflow-hidden shrink-0",
          sizeClass,
          className
        )}
        aria-label={`Avatar of ${name}`}
      >
        <Image
          src={avatarUrl}
          alt={`Avatar of ${name}`}
          fill
          className="object-cover"
          sizes={`${sizePx}px`}
        />
      </div>
    );
  }

  const initials = getInitials(name);
  const colorClass = getColorForName(name);

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full shrink-0 font-semibold text-white select-none",
        colorClass,
        sizeClass,
        className
      )}
      aria-label={`Avatar of ${name}`}
      role="img"
    >
      {initials}
    </div>
  );
}
