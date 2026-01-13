"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import useAuthStore from "../hooks/store/use-auth-store";
import { IUser } from "../types/user";
import { PageLoading, PageSlowLoading } from "@/components";
import dynamic from "next/dynamic";
import { PUBLIC_ROUTES, isPublicRoute } from "@/constants/route";
import { ENV } from "@/config/env";

export const AuthContext = createContext({});
export const useAuthContext = () => useContext(AuthContext);

const AuthContextProvider = ({ children }: { children: any }) => {
    const [isInitializing, setIsInitializing] = useState<boolean>(true);
    const [isShowSlowLoading, setIsShowSlowLoading] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);

    const pathName = usePathname();
    const router = useRouter();

    const logout = async () => {
        const response = await fetch(`${ENV.API_BASE_URL}/auth/logout`, {
            method: "POST",
            credentials: "include",
        });

        if (response.status === 200) {
            useAuthStore.setState({
                currentUser: null,
                isAuthenticated: false,
            });

            router.push("/login");
        }
    };

    const refreshToken = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${ENV.API_BASE_URL}/auth/refresh`, {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
            });
            const result = await response.json();

            if (response.status === 200) {
                const user = result.data as IUser;
                useAuthStore.setState({ currentUser: user, isAuthenticated: true });
            }
        } catch (error: any) {
            console.error(error);
            useAuthStore.setState({ currentUser: null, isAuthenticated: false });

            await logout();
        } finally {
            setLoading(false);
        }
    };

    const handleAuthenticatedUser = (user: IUser) => {
        useAuthStore.setState({ currentUser: user, isAuthenticated: true });

        const isPublic = isPublicRoute(pathName);

        if (user.isAdmin && isPublic) {
            return router.push("/admin");
        }

        if (isPublic) {
            return router.push("/");
        }
    };

    const handleUnauthenticatedUser = () => {
        const isPublic = isPublicRoute(pathName);

        if (!isPublic) {
            return router.push("/login");
        }
    };

    useEffect(() => {
        const initializeAuth = async () => {
            let timeoutId: NodeJS.Timeout | null = null;

            try {
                timeoutId = setTimeout(() => {
                    setIsShowSlowLoading(true);
                }, 4000);

                const response = await fetch(`${ENV.API_BASE_URL}/auth/me`, {
                    credentials: "include",
                });
                const result = await response.json();
                const user = result.data as IUser;

                if (response.status === 200) {
                    return handleAuthenticatedUser(user);
                }

                // If user is not authenticated, redirect to login page
                if (response.status === 403) {
                    return handleUnauthenticatedUser();
                }

                // If user authenticated and token is expired, refresh token
                if (response.status === 401) {
                    await refreshToken();
                }
            } catch (error: any) {
                console.error(error);
            } finally {
                if (timeoutId) clearTimeout(timeoutId);

                setLoading(false);
                setIsInitializing(false);
                setIsShowSlowLoading(false);
            }
        };

        if (typeof window !== "undefined") {
            initializeAuth();
        }
    }, [pathName, router]);

    if (isInitializing) {
        if (isShowSlowLoading) {
            return <PageSlowLoading />;
        }

        return <PageLoading />;
    }

    if (loading) {
        return <PageLoading />;
    }

    return <AuthContext.Provider value={{}}>{children}</AuthContext.Provider>;
};

export default dynamic(() => Promise.resolve(AuthContextProvider), { ssr: false });
