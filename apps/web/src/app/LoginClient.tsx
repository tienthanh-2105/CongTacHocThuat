"use client";

import dynamic from "next/dynamic";

const LoginForm = dynamic(() => import("./LoginForm"), {
  ssr: false,
  loading: () => <main className="login-page" aria-busy="true" />,
});

export default function LoginClient() {
  return <LoginForm />;
}
