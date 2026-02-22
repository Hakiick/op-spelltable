import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const metadata: Metadata = {
  title: "Register — OP SpellTable",
};

export default function RegisterPage() {
  return (
    <div className="flex w-full items-center justify-center">
      <RegisterForm />
    </div>
  );
}
