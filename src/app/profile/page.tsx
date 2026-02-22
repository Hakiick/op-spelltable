import type { Metadata } from "next";
import { ProfileView } from "@/components/auth/ProfileView";

export const metadata: Metadata = {
  title: "Profile — OP SpellTable",
};

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-8 text-2xl font-bold text-white">My Profile</h1>
        <ProfileView />
      </div>
    </main>
  );
}
