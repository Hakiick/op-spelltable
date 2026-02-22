import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Login — OP SpellTable",
};

export default function LoginPage() {
  return (
    <div className="flex w-full items-center justify-center">
      <LoginForm />
    </div>
  );
}
