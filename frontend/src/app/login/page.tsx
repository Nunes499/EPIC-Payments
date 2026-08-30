"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/AuthProvider";


export default function LoginPage() {
  const {
    login,
    isAuthenticated,
  } = useAuth();

  const router = useRouter();

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);


  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [
    isAuthenticated,
    router,
  ]);


  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      await login(
        username.trim(),
        password,
      );

      router.replace("/");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar sessão.";

      setError(message);
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #111 0%, #222 100%)",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#fff",
          borderRadius: "18px",
          padding: "32px",
          boxShadow:
            "0 20px 50px rgba(0,0,0,0.35)",
        }}
      >
        <div
          style={{
            marginBottom: "28px",
            textAlign: "center",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "30px",
              fontWeight: 800,
            }}
          >
            EPIC Payments
          </h1>

          <p
            style={{
              marginTop: "8px",
              marginBottom: 0,
              color: "#666",
              fontSize: "14px",
            }}
          >
            Iniciar sessão
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div>
            <label
              htmlFor="username"
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
                fontSize: "14px",
              }}
            >
              Username
            </label>

            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) =>
                setUsername(
                  event.target.value,
                )
              }
              autoComplete="username"
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                border:
                  "1px solid #d7d7d7",
                borderRadius: "10px",
                fontSize: "15px",
                outline: "none",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "7px",
                fontWeight: 600,
                fontSize: "14px",
              }}
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              autoComplete="current-password"
              required
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "12px 14px",
                border:
                  "1px solid #d7d7d7",
                borderRadius: "10px",
                fontSize: "15px",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: "11px 12px",
                borderRadius: "10px",
                background: "#fdecec",
                color: "#a40000",
                fontSize: "14px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              border: 0,
              borderRadius: "10px",
              padding: "13px 16px",
              background: "#d71920",
              color: "#fff",
              fontSize: "15px",
              fontWeight: 700,
              cursor:
                submitting
                  ? "default"
                  : "pointer",
              opacity:
                submitting
                  ? 0.7
                  : 1,
            }}
          >
            {submitting
              ? "A entrar..."
              : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}