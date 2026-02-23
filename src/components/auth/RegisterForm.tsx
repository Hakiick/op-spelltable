"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  function validate(): FormErrors {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = "Name is required.";
    }

    if (!email.trim()) {
      newErrors.email = "Email is required.";
    } else if (!validateEmail(email)) {
      newErrors.email = "Please enter a valid email address.";
    }

    if (!password) {
      newErrors.password = "Password is required.";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters.";
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password.";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match.";
    }

    return newErrors;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        if (response.status === 409) {
          setErrors({ email: "This email is already in use." });
        } else {
          setErrors({ general: data.error ?? "Registration failed." });
        }
        return;
      }

      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.ok) {
        window.location.href = "/";
      } else {
        setErrors({
          general:
            "Account created, but sign-in failed. Please log in manually.",
        });
      }
    } catch {
      setErrors({ general: "An unexpected error occurred. Please try again." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm bg-gray-900 border-gray-800 text-white">
      <CardHeader>
        <CardTitle className="text-xl text-white">Create account</CardTitle>
        <CardDescription className="text-gray-400">
          Register to start playing One Piece TCG remotely
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-gray-200">
              Name
            </label>
            <Input
              id="name"
              type="text"
              placeholder="Monkey D. Luffy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              aria-label="Display name"
              aria-describedby={errors.name ? "name-error" : undefined}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 min-h-11"
              disabled={isLoading}
            />
            {errors.name && (
              <p id="name-error" role="alert" className="text-xs text-red-400">
                {errors.name}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-200"
            >
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              aria-label="Email address"
              aria-describedby={errors.email ? "email-error" : undefined}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 min-h-11"
              disabled={isLoading}
            />
            {errors.email && (
              <p id="email-error" role="alert" className="text-xs text-red-400">
                {errors.email}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-gray-200"
            >
              Password
            </label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              aria-label="Password"
              aria-describedby={errors.password ? "password-error" : undefined}
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 min-h-11"
              disabled={isLoading}
            />
            {errors.password && (
              <p
                id="password-error"
                role="alert"
                className="text-xs text-red-400"
              >
                {errors.password}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="confirmPassword"
              className="text-sm font-medium text-gray-200"
            >
              Confirm password
            </label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              aria-label="Confirm password"
              aria-describedby={
                errors.confirmPassword ? "confirm-error" : undefined
              }
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 min-h-11"
              disabled={isLoading}
            />
            {errors.confirmPassword && (
              <p
                id="confirm-error"
                role="alert"
                className="text-xs text-red-400"
              >
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {errors.general && (
            <p role="alert" className="text-sm text-red-400">
              {errors.general}
            </p>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full min-h-11 bg-red-600 hover:bg-red-700 text-white"
          >
            {isLoading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-gray-400">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="text-red-400 hover:text-red-300 underline underline-offset-4"
          >
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
