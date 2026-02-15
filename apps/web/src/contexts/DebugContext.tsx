"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { io, Socket } from "socket.io-client";

export interface NetworkRequest {
  id: string;
  method: string;
  path: string;
  status: number | null;
  timestamp: Date;
}

interface DebugContextType {
  apiUrl: string;
  socketStatus: "connected" | "disconnected" | "connecting";
  requests: NetworkRequest[];
  logRequest: (method: string, path: string, status: number | null) => void;
  isMounted: boolean;
  socket: Socket | null;
}

const DebugContext = createContext<DebugContextType | null>(null);

export function DebugProvider({ children }: { children: React.ReactNode }) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const orgKey = "demo"; // Default for socket connection (can be updated if needed)
  const [socketStatus, setSocketStatus] = useState<"connected" | "disconnected" | "connecting">("disconnected");
  const [requests, setRequests] = useState<NetworkRequest[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Mark as mounted (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Socket.IO connection monitoring (only in browser) with orgKey auth
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "development") return;

    setSocketStatus("connecting");
    const token = window.sessionStorage.getItem("helvino_portal_refresh_token") || undefined;
    const socketInstance = io(apiUrl, {
      transports: ["websocket", "polling"],
      auth: {
        orgKey,
        token,
      },
    });

    socketInstance.on("connect", () => {
      setSocketStatus("connected");
    });

    socketInstance.on("disconnect", () => {
      setSocketStatus("disconnected");
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [apiUrl, orgKey, isMounted]);

  const logRequest = useCallback((method: string, path: string, status: number | null) => {
    const request: NetworkRequest = {
      id: `${Date.now()}-${Math.random()}`,
      method,
      path,
      status,
      timestamp: new Date(),
    };

    setRequests((prev) => [request, ...prev].slice(0, 5));
  }, []);

  return (
    <DebugContext.Provider value={{ apiUrl, socketStatus, requests, logRequest, isMounted, socket }}>
      {children}
    </DebugContext.Provider>
  );
}

export function useDebug() {
  const context = useContext(DebugContext);
  if (!context) {
    throw new Error("useDebug must be used within DebugProvider");
  }
  return context;
}
