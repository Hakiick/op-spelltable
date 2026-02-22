"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/auth/UserAvatar";
import type { UserProfile } from "@/types/player";

interface EditState {
  name: string;
  avatarUrl: string;
}

export function ProfileView() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<EditState>({ name: "", avatarUrl: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await fetch("/api/users/me");
        if (!response.ok) {
          if (response.status === 401) {
            setError("You must be logged in to view your profile.");
          } else {
            setError("Failed to load profile.");
          }
          return;
        }
        const data = (await response.json()) as UserProfile;
        setProfile(data);
      } catch {
        setError("An unexpected error occurred.");
      } finally {
        setIsLoading(false);
      }
    }

    void fetchProfile();
  }, []);

  function handleEditStart() {
    if (!profile) return;
    setEditState({
      name: profile.name,
      avatarUrl: profile.avatarUrl ?? "",
    });
    setSaveError(null);
    setIsEditing(true);
  }

  function handleEditCancel() {
    setIsEditing(false);
    setSaveError(null);
  }

  async function handleSave() {
    if (!profile) return;
    setSaveError(null);

    if (!editState.name.trim()) {
      setSaveError("Name cannot be empty.");
      return;
    }

    setIsSaving(true);

    try {
      const body: { name?: string; avatarUrl?: string } = {};

      if (editState.name.trim() !== profile.name) {
        body.name = editState.name.trim();
      }

      const newAvatarUrl = editState.avatarUrl.trim() || null;
      if (newAvatarUrl !== profile.avatarUrl) {
        body.avatarUrl = editState.avatarUrl.trim();
      }

      if (Object.keys(body).length === 0) {
        setIsEditing(false);
        return;
      }

      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setSaveError(data.error ?? "Failed to save changes.");
        return;
      }

      const updated = (await response.json()) as UserProfile;
      setProfile(updated);
      setIsEditing(false);
    } catch {
      setSaveError("An unexpected error occurred.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-16"
        aria-label="Loading profile"
        role="status"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-600 border-t-red-500" />
        <span className="sr-only">Loading profile…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-red-400" role="alert">
          {error}
        </p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const winRate =
    profile.gamesPlayed > 0
      ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100)
      : 0;

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl text-white">Profile</CardTitle>
            {!isEditing && (
              <Button
                onClick={handleEditStart}
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-200 hover:bg-gray-800 min-h-9"
              >
                Edit
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <UserAvatar
              name={profile.name}
              avatarUrl={profile.avatarUrl}
              size="lg"
            />
            <div>
              <p className="text-lg font-semibold text-white">{profile.name}</p>
              <p className="text-sm text-gray-400">{profile.email}</p>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="profile-name"
                  className="text-sm font-medium text-gray-200"
                >
                  Display name
                </label>
                <Input
                  id="profile-name"
                  type="text"
                  value={editState.name}
                  onChange={(e) =>
                    setEditState((prev) => ({ ...prev, name: e.target.value }))
                  }
                  disabled={isSaving}
                  aria-label="Display name"
                  className="bg-gray-800 border-gray-700 text-white min-h-11"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="profile-avatar"
                  className="text-sm font-medium text-gray-200"
                >
                  Avatar URL
                </label>
                <Input
                  id="profile-avatar"
                  type="url"
                  placeholder="https://example.com/avatar.jpg"
                  value={editState.avatarUrl}
                  onChange={(e) =>
                    setEditState((prev) => ({ ...prev, avatarUrl: e.target.value }))
                  }
                  disabled={isSaving}
                  aria-label="Avatar URL"
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 min-h-11"
                />
              </div>

              {saveError && (
                <p role="alert" className="text-sm text-red-400">
                  {saveError}
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="bg-red-600 hover:bg-red-700 text-white min-h-11"
                >
                  {isSaving ? "Saving…" : "Save changes"}
                </Button>
                <Button
                  onClick={handleEditCancel}
                  disabled={isSaving}
                  variant="outline"
                  className="border-gray-700 text-gray-200 hover:bg-gray-800 min-h-11"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="bg-gray-900 border-gray-800 text-white">
        <CardHeader>
          <CardTitle className="text-base text-white">Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-3 gap-4 text-center">
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">
                Played
              </dt>
              <dd className="mt-1 text-2xl font-bold text-white">
                {profile.gamesPlayed}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">
                Won
              </dt>
              <dd className="mt-1 text-2xl font-bold text-white">
                {profile.gamesWon}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-400 uppercase tracking-wide">
                Win rate
              </dt>
              <dd className="mt-1 text-2xl font-bold text-white">
                {winRate}%
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
