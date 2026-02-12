"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { ShieldCheck } from "lucide-react";

interface MfaStepUpModalProps {
  onVerify: (code: string) => Promise<boolean>;
  onCancel: () => void;
}

export default function MfaStepUpModal({ onVerify, onCancel }: MfaStepUpModalProps) {
  const { t } = useI18n();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    setLoading(true);

    const success = await onVerify(code.trim());
    if (!success) {
      setError(t("stepUp.invalidCode"));
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg border border-[#F3E8D8] p-6 max-w-sm w-full shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-amber-50 rounded-lg">
            <ShieldCheck size={24} className="text-amber-800" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-amber-900">
              {t("stepUp.title")}
            </h3>
          </div>
        </div>
        <p className="text-sm text-amber-700 mb-4">
          {t("stepUp.description")}
        </p>

        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-amber-600 mb-1">
              {t("stepUp.codeLabel")}
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t("stepUp.codePlaceholder")}
              className="w-full px-4 py-2 border border-[#F3E8D8] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 font-mono text-center text-lg tracking-widest"
              autoFocus
              disabled={loading}
              maxLength={20}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 bg-amber-50 text-amber-800 rounded-lg hover:bg-amber-100 transition-colors"
              disabled={loading}
            >
              {t("stepUp.cancel")}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-colors disabled:opacity-50"
              disabled={loading || !code.trim()}
            >
              {loading ? t("stepUp.verifying") : t("stepUp.verify")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
