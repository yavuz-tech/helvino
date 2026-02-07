"use client";

/**
 * StepUpContext — Step 11.23
 *
 * Provides a React-context-based step-up flow:
 *  1) Any page calls `withStepUp(asyncAction)` to wrap a sensitive action.
 *  2) The action runs. If the API returns STEP_UP_REQUIRED (403),
 *     the context opens a verification modal.
 *  3) User enters code → context calls the correct challenge endpoint.
 *  4) On success, the original action is auto-retried exactly once.
 *  5) On cancel / second failure → action is aborted and an error shown.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import MfaStepUpModal from "@/components/MfaStepUpModal";
import { adminStepUpChallenge, portalStepUpChallenge } from "@/utils/step-up";

type StepUpArea = "admin" | "portal";

interface StepUpContextValue {
  /**
   * Wraps an async action so that STEP_UP_REQUIRED responses are handled
   * automatically with a modal + single retry.
   *
   * Returns `{ ok, data?, error?, cancelled? }`.
   */
  withStepUp: <T>(
    action: () => Promise<Response>,
    area?: StepUpArea
  ) => Promise<StepUpResult<T>>;
}

export interface StepUpResult<T = unknown> {
  ok: boolean;
  data?: T;
  response?: Response;
  error?: string;
  cancelled?: boolean;
}

const StepUpContext = createContext<StepUpContextValue | null>(null);

export function useStepUp() {
  const ctx = useContext(StepUpContext);
  if (!ctx) {
    throw new Error("useStepUp must be used inside <StepUpProvider>");
  }
  return ctx;
}

/**
 * Detect area from current pathname (client-side only).
 */
function detectArea(): StepUpArea {
  if (typeof window === "undefined") return "portal";
  const path = window.location.pathname;
  if (path.startsWith("/dashboard") || path.startsWith("/login")) return "admin";
  return "portal";
}

/**
 * Check whether a parsed response body signals STEP_UP_REQUIRED.
 */
function isStepUpCode(body: Record<string, unknown> | null): boolean {
  return body?.code === "STEP_UP_REQUIRED";
}

export function StepUpProvider({ children }: { children: React.ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentArea, setCurrentArea] = useState<StepUpArea>("portal");

  // We store the pending retry info in refs so the modal callback can access them
  // without stale closures.
  const pendingResolve = useRef<((ok: boolean) => void) | null>(null);

  const handleVerify = useCallback(
    async (code: string): Promise<boolean> => {
      const challengeFn =
        currentArea === "admin" ? adminStepUpChallenge : portalStepUpChallenge;
      const ok = await challengeFn(code);
      if (ok) {
        setModalOpen(false);
        pendingResolve.current?.(true);
        pendingResolve.current = null;
      }
      return ok;
    },
    [currentArea]
  );

  const handleCancel = useCallback(() => {
    setModalOpen(false);
    pendingResolve.current?.(false);
    pendingResolve.current = null;
  }, []);

  /**
   * Opens the step-up modal and returns a promise that resolves when
   * the user either verifies successfully (true) or cancels (false).
   */
  const requestStepUp = useCallback(
    (area: StepUpArea): Promise<boolean> => {
      setCurrentArea(area);
      setModalOpen(true);
      return new Promise<boolean>((resolve) => {
        pendingResolve.current = resolve;
      });
    },
    []
  );

  const withStepUp = useCallback(
    async <T,>(
      action: () => Promise<Response>,
      area?: StepUpArea
    ): Promise<StepUpResult<T>> => {
      const resolvedArea = area ?? detectArea();

      // First attempt
      let res: Response;
      try {
        res = await action();
      } catch {
        return { ok: false, error: "Network error" };
      }

      // If not a step-up error, return directly
      if (res.status !== 403) {
        // Parse body for caller
        try {
          const data = await res.json();
          return { ok: res.ok, data, response: res };
        } catch {
          return { ok: res.ok, response: res };
        }
      }

      // 403 — might be step-up or permission error
      let body: Record<string, unknown> | null = null;
      try {
        body = await res.json();
      } catch {
        return { ok: false, error: "Forbidden" };
      }

      if (!isStepUpCode(body)) {
        // Regular 403 (permission), not step-up
        return {
          ok: false,
          error: (body as Record<string, string>)?.error || "Forbidden",
          data: body as T,
          response: res,
        };
      }

      // Step-up required — show modal
      const verified = await requestStepUp(resolvedArea);
      if (!verified) {
        return { ok: false, cancelled: true };
      }

      // Retry exactly once
      let retryRes: Response;
      try {
        retryRes = await action();
      } catch {
        return { ok: false, error: "Network error on retry" };
      }

      try {
        const data = await retryRes.json();
        return { ok: retryRes.ok, data, response: retryRes };
      } catch {
        return { ok: retryRes.ok, response: retryRes };
      }
    },
    [requestStepUp]
  );

  return (
    <StepUpContext.Provider value={{ withStepUp }}>
      {children}
      {modalOpen && (
        <MfaStepUpModal onVerify={handleVerify} onCancel={handleCancel} />
      )}
    </StepUpContext.Provider>
  );
}
