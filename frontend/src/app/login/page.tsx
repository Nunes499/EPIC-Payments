"use client";

import Image from "next/image";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  UserRound,
} from "lucide-react";

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

  const [showPassword, setShowPassword] =
    useState(false);

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
        position: "relative",
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        padding: "28px",
        background:
          `
            radial-gradient(
              ellipse at 10% 10%,
              rgba(255,255,255,0.98) 0%,
              rgba(255,255,255,0.70) 28%,
              transparent 55%
            ),
            radial-gradient(
              ellipse at 82% 14%,
              rgba(153,203,242,0.54) 0%,
              rgba(184,220,246,0.27) 36%,
              transparent 61%
            ),
            radial-gradient(
              ellipse at 58% 88%,
              rgba(213,235,250,0.82) 0%,
              transparent 52%
            ),
            linear-gradient(
              140deg,
              #f2f8fd 0%,
              #d9edf9 38%,
              #edf6fc 67%,
              #d2e8f7 100%
            )
          `,
        fontFamily:
          `
            "Segoe UI Variable",
            "Segoe UI",
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            sans-serif
          `,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-30vh",
          left: "31vw",
          width: "82vw",
          height: "72vh",
          border:
            "2px solid rgba(255,255,255,0.76)",
          borderRadius: "50%",
          background:
            `
              linear-gradient(
                145deg,
                rgba(255,255,255,0.28),
                rgba(103,171,224,0.07)
              )
            `,
          transform: "rotate(-12deg)",
          pointerEvents: "none",
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-28vw",
          bottom: "12vh",
          width: "72vw",
          height: "52vh",
          borderRadius: "50%",
          background:
            `
              linear-gradient(
                140deg,
                rgba(255,255,255,0.56),
                rgba(181,218,244,0.16)
              )
            `,
          transform: "rotate(20deg)",
          pointerEvents: "none",
        }}
      />

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: "-18vw",
          bottom: "-30vh",
          width: "76vw",
          height: "66vh",
          borderRadius: "50%",
          background:
            `
              linear-gradient(
                135deg,
                rgba(255,255,255,0.52),
                rgba(103,170,223,0.10)
              )
            `,
          pointerEvents: "none",
        }}
      />

      <section
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          maxWidth: "640px",
          border:
            "1px solid rgba(255,255,255,0.92)",
          borderRadius: "22px",
          background:
            `
              linear-gradient(
                145deg,
                rgba(255,255,255,0.91),
                rgba(246,251,255,0.78)
              )
            `,
          padding: "26px 34px 28px",
          boxShadow:
            `
              0 26px 65px
              rgba(54,92,127,0.14),

              inset 0 1px 0
              rgba(255,255,255,0.96)
            `,
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: "14px",
          }}
        >
          <Image
            src="/branding/logo-epic-payments-white.png"
            alt="EPIC Payments"
            width={260}
            height={110}
            priority
            style={{
              width: "220px",
              maxWidth: "70%",
              height: "auto",
              objectFit: "contain",
              filter:
                `
                  brightness(0)
                  saturate(100%)
                  invert(17%)
                  sepia(30%)
                  saturate(1660%)
                  hue-rotate(169deg)
                  brightness(88%)
                  contrast(96%)
                `,
            }}
          />
        </div>

        <div
          style={{
            marginBottom: "18px",
            textAlign: "center",
          }}
        >
          <span
            style={{
              display: "block",
              color: "#4d87ba",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.20em",
              textTransform: "uppercase",
            }}
          >
            Sistema interno
          </span>

          <h1
            style={{
              margin: "6px 0 0",
              color: "#10233d",
              fontSize: "26px",
              fontWeight: 650,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
            }}
          >
            Iniciar sessão
          </h1>

          <p
            style={{
              margin: "7px 0 0",
              color: "#66809a",
              fontSize: "13px",
              lineHeight: 1.4,
            }}
          >
            Aceda à sua conta EPIC Payments
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div>
            <label
              htmlFor="username"
              style={{
                display: "block",
                marginBottom: "6px",
                color: "#16324f",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              Username
            </label>

            <div
              style={{
                display: "flex",
                minHeight: "50px",
                alignItems: "center",
                gap: "10px",
                border:
                  "1px solid rgba(104,143,180,0.34)",
                borderRadius: "11px",
                background:
                  "rgba(255,255,255,0.83)",
                padding: "0 14px",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.90)",
              }}
            >
              <UserRound
                size={20}
                strokeWidth={1.7}
                color="#7b8b9b"
              />

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
                placeholder="Introduza o seu username"
                style={{
                  width: "100%",
                  minWidth: 0,
                  border: 0,
                  background: "transparent",
                  padding: "12px 0",
                  color: "#10213a",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: "6px",
                color: "#16324f",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              Password
            </label>

            <div
              style={{
                display: "flex",
                minHeight: "50px",
                alignItems: "center",
                gap: "10px",
                border:
                  "1px solid rgba(104,143,180,0.34)",
                borderRadius: "11px",
                background:
                  "rgba(255,255,255,0.83)",
                padding: "0 10px 0 14px",
                boxShadow:
                  "inset 0 1px 0 rgba(255,255,255,0.90)",
              }}
            >
              <LockKeyhole
                size={19}
                strokeWidth={1.7}
                color="#7b8b9b"
              />

              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
                autoComplete="current-password"
                required
                placeholder="Introduza a sua password"
                style={{
                  width: "100%",
                  minWidth: 0,
                  border: 0,
                  background: "transparent",
                  padding: "12px 0",
                  color: "#10213a",
                  fontSize: "13px",
                  outline: "none",
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) => !current,
                  )
                }
                aria-label={
                  showPassword
                    ? "Ocultar password"
                    : "Mostrar password"
                }
                style={{
                  display: "flex",
                  width: "34px",
                  height: "34px",
                  flex: "0 0 34px",
                  alignItems: "center",
                  justifyContent: "center",
                  border: 0,
                  borderRadius: "8px",
                  background: "transparent",
                  color: "#748699",
                  cursor: "pointer",
                }}
              >
                {showPassword ? (
                  <EyeOff
                    size={19}
                    strokeWidth={1.7}
                  />
                ) : (
                  <Eye
                    size={19}
                    strokeWidth={1.7}
                  />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              style={{
                border:
                  "1px solid rgba(190,70,80,0.18)",
                borderRadius: "10px",
                background:
                  "rgba(255,238,239,0.86)",
                padding: "9px 11px",
                color: "#a53038",
                fontSize: "12px",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              display: "flex",
              minHeight: "52px",
              alignItems: "center",
              justifyContent: "center",
              gap: "11px",
              marginTop: "2px",
              border:
                "1px solid rgba(65,116,164,0.20)",
              borderRadius: "11px",
              background:
                `
                  linear-gradient(
                    110deg,
                    #2c8bca 0%,
                    #246fa9 42%,
                    #114772 100%
                  )
                `,
              padding: "12px 16px",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 600,
              cursor:
                submitting
                  ? "default"
                  : "pointer",
              opacity:
                submitting
                  ? 0.72
                  : 1,
              boxShadow:
                `
                  0 10px 24px
                  rgba(41,103,157,0.20)
                `,
            }}
          >
            <span>
              {submitting
                ? "A entrar..."
                : "Entrar"}
            </span>

            {!submitting && (
              <ArrowRight
                size={18}
                strokeWidth={1.9}
              />
            )}
          </button>
        </form>
      </section>

      <div
        style={{
          position: "absolute",
          left: "28px",
          bottom: "24px",
          display: "flex",
          width: "42px",
          height: "42px",
          alignItems: "center",
          justifyContent: "center",
          border:
            "1px solid rgba(34,74,110,0.22)",
          borderRadius: "50%",
          background:
            "rgba(255,255,255,0.64)",
          color: "#173a5c",
          fontSize: "15px",
          fontWeight: 600,
          boxShadow:
            "0 6px 20px rgba(64,103,138,0.10)",
          backdropFilter: "blur(10px)",
        }}
      >
        N
      </div>
    </main>
  );
}