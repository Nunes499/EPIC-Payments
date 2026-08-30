"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  clearToken,
  getCurrentUser,
  getToken,
  login as loginRequest,
  logout as logoutRequest,
  setToken,
  type AuthUser,
} from "@/services/auth";


type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (
    username: string,
    password: string,
  ) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};


const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  );


type AuthProviderProps = {
  children: ReactNode;
};


export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<AuthUser | null>(null);

  const [loading, setLoading] =
    useState(true);


  async function loadCurrentUser() {
    const token = getToken();

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const currentUser =
        await getCurrentUser(token);

      setUser(currentUser);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }


  useEffect(() => {
    void loadCurrentUser();
  }, []);


  async function login(
    username: string,
    password: string,
  ) {
    const response =
      await loginRequest(
        username,
        password,
      );

    setToken(
      response.access_token,
    );

    const currentUser =
      await getCurrentUser(
        response.access_token,
      );

    setUser(currentUser);
  }


  function logout() {
    setUser(null);
    logoutRequest();
  }


  async function refreshUser() {
    const currentUser =
      await getCurrentUser();

    setUser(currentUser);
  }


  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated:
        Boolean(user),
      login,
      logout,
      refreshUser,
    }),
    [
      user,
      loading,
    ],
  );


  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}


export function useAuth(): AuthContextValue {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth deve ser usado dentro de AuthProvider.",
    );
  }

  return context;
}