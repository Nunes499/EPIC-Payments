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
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
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

  refreshUser:
    () => Promise<void>;
};


const AuthContext =
  createContext<
    AuthContextValue | null
  >(null);


type AuthProviderProps = {
  children: ReactNode;
};


export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [
    user,
    setUser,
  ] =
    useState<
      AuthUser | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);


  async function loadCurrentUser() {
    try {
      /*
       * getCurrentUser() usa agora o
       * cookie HttpOnly. Se este browser
       * ainda tiver a sessão antiga em
       * localStorage, o próprio serviço
       * trata primeiro da migração.
       */
      const currentUser =
        await getCurrentUser();

      setUser(
        currentUser,
      );
    } catch {
      setUser(
        null,
      );
    } finally {
      setLoading(
        false,
      );
    }
  }


  useEffect(() => {
    void loadCurrentUser();
  }, []);


  async function login(
    username: string,
    password: string,
  ) {
    /*
     * O endpoint de login cria o cookie
     * HttpOnly. O JWT nunca é entregue
     * ao JavaScript.
     */
    await loginRequest(
      username,
      password,
    );

    try {
      const currentUser =
        await getCurrentUser();

      setUser(
        currentUser,
      );
    } catch (error) {
      setUser(
        null,
      );

      /*
       * Se o backend rejeitar a sessão
       * acabada de criar, eliminamos
       * também o cookie no Worker.
       */
      logoutRequest();

      throw error;
    }
  }


  function logout() {
    setUser(
      null,
    );

    logoutRequest();
  }


  async function refreshUser() {
    try {
      const currentUser =
        await getCurrentUser();

      setUser(
        currentUser,
      );
    } catch (error) {
      setUser(
        null,
      );

      throw error;
    }
  }


  const value =
    useMemo(
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


export function useAuth():
AuthContextValue {
  const context =
    useContext(
      AuthContext,
    );

  if (!context) {
    throw new Error(
      "useAuth deve ser usado dentro de AuthProvider.",
    );
  }

  return context;
}
