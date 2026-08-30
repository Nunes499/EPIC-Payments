"use client";

import {
  useEffect,
  type ReactNode,
} from "react";

import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "./AuthProvider";


type ProtectedLayoutProps = {
  children: ReactNode;
};


export default function ProtectedLayout({
  children,
}: ProtectedLayoutProps) {
  const {
    loading,
    isAuthenticated,
  } = useAuth();

  const router = useRouter();
  const pathname = usePathname();


  useEffect(() => {
    if (
      !loading &&
      !isAuthenticated &&
      pathname !== "/login"
    ) {
      router.replace("/login");
    }
  }, [
    loading,
    isAuthenticated,
    pathname,
    router,
  ]);


  if (pathname === "/login") {
    return <>{children}</>;
  }


  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        A carregar...
      </div>
    );
  }


  if (!isAuthenticated) {
    return null;
  }


  return <>{children}</>;
}