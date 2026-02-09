"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
}

interface PremiumToastContextValue {
  showToast: (opts: {
    title: string;
    description?: string;
    variant?: ToastVariant;
    duration?: number;
  }) => void;
}

let _showToast: PremiumToastContextValue["showToast"] | null = null;

/** Call from anywhere: premiumToast.success({ title, description }) */
export const premiumToast = {
  success: (opts: { title: string; description?: string; duration?: number }) =>
    _showToast?.({ ...opts, variant: "success" }),
  error: (opts: { title: string; description?: string; duration?: number }) =>
    _showToast?.({ ...opts, variant: "error" }),
  warning: (opts: { title: string; description?: string; duration?: number }) =>
    _showToast?.({ ...opts, variant: "warning" }),
  info: (opts: { title: string; description?: string; duration?: number }) =>
    _showToast?.({ ...opts, variant: "info" }),
};

const VARIANT_CONFIG: Record<ToastVariant, {
  icon: typeof CheckCircle;
  gradient: string;
  iconColor: string;
  borderColor: string;
  bgColor: string;
}> = {
  success: {
    icon: CheckCircle,
    gradient: "from-emerald-500 via-emerald-400 to-teal-500",
    iconColor: "text-emerald-500",
    borderColor: "border-emerald-200/60",
    bgColor: "bg-white",
  },
  error: {
    icon: XCircle,
    gradient: "from-red-500 via-rose-400 to-pink-500",
    iconColor: "text-red-500",
    borderColor: "border-red-200/60",
    bgColor: "bg-white",
  },
  warning: {
    icon: AlertTriangle,
    gradient: "from-amber-500 via-orange-400 to-yellow-500",
    iconColor: "text-amber-500",
    borderColor: "border-amber-200/60",
    bgColor: "bg-white",
  },
  info: {
    icon: Info,
    gradient: "from-blue-500 via-indigo-400 to-violet-500",
    iconColor: "text-blue-500",
    borderColor: "border-blue-200/60",
    bgColor: "bg-white",
  },
};

/** Render this component once in your layout / providers */
export default function PremiumToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
  }, []);

  const showToast = useCallback(
    (opts: { title: string; description?: string; variant?: ToastVariant; duration?: number }) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const duration = opts.duration ?? 3000;
      const toast: ToastItem = {
        id,
        title: opts.title,
        description: opts.description,
        variant: opts.variant ?? "success",
        duration,
      };
      setToasts((prev) => [...prev.slice(-4), toast]); // max 5 visible
      const timer = setTimeout(() => removeToast(id), duration);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  // Register global function
  useEffect(() => {
    _showToast = showToast;
    return () => { _showToast = null; };
  }, [showToast]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[99999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast, i) => {
        const cfg = VARIANT_CONFIG[toast.variant];
        const Icon = cfg.icon;
        return (
          <div
            key={toast.id}
            className="pointer-events-auto animate-in slide-in-from-right-5 fade-in duration-300"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {/* Outer wrapper with gradient border */}
            <div className="relative rounded-2xl p-[1.5px] shadow-2xl shadow-black/10">
              {/* Gradient border */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${cfg.gradient} opacity-60`} />
              {/* Inner card */}
              <div className={`relative ${cfg.bgColor} rounded-[14px] px-4 py-3.5 min-w-[320px] max-w-[400px] flex items-start gap-3`}>
                {/* Animated icon */}
                <div className="flex-shrink-0 mt-0.5">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${cfg.gradient} bg-opacity-10 flex items-center justify-center`}>
                    <Icon size={16} className="text-white" />
                  </div>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-slate-900 leading-tight">{toast.title}</p>
                  {toast.description && (
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{toast.description}</p>
                  )}
                </div>
                {/* Close */}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 p-1 text-slate-300 hover:text-slate-500 rounded-lg transition-colors"
                >
                  <X size={14} />
                </button>
                {/* Progress bar - no styled-jsx (App Router safe) */}
                <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${cfg.gradient} rounded-full animate-[shrink_3s_linear_forwards]`}
                    style={{
                      animation: `shrink ${toast.duration}ms linear forwards`,
                      width: "100%",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <style dangerouslySetInnerHTML={{ __html: `@keyframes shrink{from{width:100%}to{width:0%}}` }} />
    </div>
  );
}
