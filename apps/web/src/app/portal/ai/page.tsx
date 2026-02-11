"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Zap, Send, Check, AlertTriangle, Cpu } from "lucide-react";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import AIUsageStats from "@/components/AIUsageStats";
import UpgradeModal from "@/components/UpgradeModal";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";
import { premiumToast } from "@/components/PremiumToast";

interface AiConfig {
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  autoReplyEnabled: boolean;
  greeting: string;
  fallbackMessage: string;
  tone: "professional" | "friendly" | "casual";
  language: string;
}

interface AiModel {
  id: string;
  name: string;
  description: string;
  recommended: boolean;
}

export default function PortalAiPage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = usePortalAuth();

  const [config, setConfig] = useState<AiConfig | null>(null);
  const [, setDefaults] = useState<AiConfig | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [models, setModels] = useState<AiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Test
  const [testInput, setTestInput] = useState("");
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testMeta, setTestMeta] = useState<{ model: string; tokens: number } | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const canEdit = user?.role === "owner" || user?.role === "admin";

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const [configRes, statusRes] = await Promise.all([
        portalApiFetch("/portal/ai/config"),
        portalApiFetch("/portal/ai/status"),
      ]);
      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data.config);
        setDefaults(data.defaults);
        setAiEnabled(data.aiEnabled);
        setAvailable(data.available);
      }
      if (statusRes.ok) {
        const data = await statusRes.json();
        setModels(data.models || []);
        setAvailable(data.available);
      }
    } catch { setError(t("common.error")); }
    finally { setLoading(false); }
  }, [t]);

  useEffect(() => { if (!authLoading && user) fetchConfig(); }, [authLoading, user, fetchConfig]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const res = await portalApiFetch("/portal/ai/config", {
        method: "PUT",
        body: JSON.stringify({ ...config, aiEnabled }),
      });
      if (res.ok) {
        premiumToast.success({
          title: t("toast.aiConfigSaved"),
          description: t("toast.aiConfigSavedDesc"),
          duration: 3000,
        });
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || t("common.error"));
      }
    } catch { setError(t("common.error")); }
    finally { setSaving(false); }
  };

  const handleTest = async () => {
    if (!testInput.trim()) return;
    setTestLoading(true);
    setTestResponse(null);
    setTestMeta(null);
    try {
      const res = await portalApiFetch("/portal/ai/test", {
        method: "POST",
        body: JSON.stringify({ message: testInput.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setTestResponse(data.response);
        setTestMeta({ model: data.model, tokens: data.tokensUsed });
      } else {
        setTestResponse(`${t("common.error")}: ${data.error || t("common.error.unknown")}`);
      }
    } catch { setTestResponse("Error: Network error"); }
    finally { setTestLoading(false); }
  };

  const updateConfig = (patch: Partial<AiConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...patch });
  };
  const temperaturePercent = config ? Math.max(0, Math.min((config.temperature / 2) * 100, 100)) : 0;
  const getRecommendedBadgeClass = (model: AiModel) => {
    const haystack = `${model.name} ${model.id}`.toLowerCase();
    if (haystack.includes("gpt-4o") && haystack.includes("mini")) return "bg-[#10B981]";
    if (haystack.includes("gemini") && haystack.includes("flash")) return "bg-[#6366F1]";
    if (haystack.includes("claude") && haystack.includes("haiku")) return "bg-[#F59E0B]";
    return "bg-[#F59E0B]";
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("ai.title")}
        subtitle={t("ai.subtitle")}
        backButton={{ href: "/portal", label: t("portalOnboarding.backToDashboard") }}
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />}

      <div className="space-y-6">
        {/* ═══ AI Usage Quota ═══ */}
        <AIUsageStats prominent onUpgradeNeeded={() => setShowUpgradeModal(true)} />

        {/* ═══ AI Status Hero ═══ */}
        <div
          className="rounded-2xl p-[22px_24px] text-white shadow-[0_4px_20px_rgba(245,158,11,0.25)]"
          style={{ background: "linear-gradient(135deg, #F59E0B 0%, #D97706 60%, #B45309 100%)" }}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/15 backdrop-blur-sm">
              <Bot size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="mb-1 font-[var(--font-heading)] text-[16px] font-bold text-white">{t("ai.heroTitle")}</h2>
              <p className="max-w-xl font-[var(--font-body)] text-[12.5px] leading-[1.5] text-white/75">{t("ai.heroDesc")}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/15 px-[10px] py-1 font-[var(--font-body)] text-[11px] font-semibold text-white/90">
                  <span className={`h-2 w-2 rounded-full ${available ? "bg-emerald-300" : "bg-red-300"}`} />
                  {available ? t("ai.statusOnline") : t("ai.statusOffline")}
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/15 px-[10px] py-1 font-[var(--font-body)] text-[11px] font-semibold text-white/90">
                  <Cpu size={12} />
                  {config?.model || "gpt-4o-mini"}
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/15 px-[10px] py-1 font-[var(--font-body)] text-[11px] font-semibold text-white/90">
                  <Zap size={12} />
                  {aiEnabled ? t("ai.autoReplyOn") : t("ai.autoReplyOff")}
                </div>
              </div>
            </div>
            {/* Master toggle */}
            <label className="relative mt-1 inline-flex cursor-pointer items-center">
              <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} disabled={!canEdit} className="sr-only peer" />
              <div className="h-7 w-[52px] rounded-[14px] bg-white/20 transition-colors peer-checked:bg-white after:absolute after:left-[4px] after:top-[6px] after:h-[16px] after:w-[16px] after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-7 peer-checked:after:bg-amber-500" />
            </label>
          </div>
        </div>

        {!available && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">{t("ai.noApiKey")}</p>
              <p className="text-xs text-amber-600 mt-0.5">{t("ai.noApiKeyDesc")}</p>
            </div>
          </div>
        )}

        {config && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* ── Left: Core AI Settings ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* System Prompt */}
              <Card className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm" padding="none">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(245,158,11,0.08)] text-[16px]">💬</div>
                  <div>
                    <h3 className="font-[var(--font-heading)] text-[15px] font-bold text-[#1A1D23]">{t("ai.systemPrompt")}</h3>
                    <p className="font-[var(--font-body)] text-[12px] text-[#94A3B8]">{t("ai.systemPromptDesc")}</p>
                  </div>
                </div>
                <textarea
                  value={config.systemPrompt}
                  onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
                  disabled={!canEdit}
                  rows={5}
                  className="w-full min-h-[120px] resize-none rounded-xl border border-black/10 bg-[#FAFAF8] px-4 py-[14px] font-[var(--font-body)] text-[13px] leading-[1.6] text-[#1A1D23] placeholder:text-slate-400 transition-all focus:border-[#F59E0B] focus:outline-none focus:ring-0 disabled:opacity-50"
                />
              </Card>

              {/* Greeting & Fallback */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" padding="none">
                  <label className="mb-2 flex items-center gap-2 font-[var(--font-heading)] text-[14px] font-bold text-[#1A1D23]">👋 {t("ai.greeting")}</label>
                  <textarea
                    value={config.greeting}
                    onChange={(e) => updateConfig({ greeting: e.target.value })}
                    disabled={!canEdit}
                    rows={3}
                    className="w-full min-h-[72px] resize-none rounded-xl border border-black/10 bg-[#FAFAF8] px-[14px] py-3 font-[var(--font-body)] text-[12.5px] leading-[1.5] text-[#1A1D23] focus:border-[#F59E0B] focus:outline-none focus:ring-0 disabled:opacity-50"
                  />
                </Card>
                <Card className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm" padding="none">
                  <label className="mb-2 flex items-center gap-2 font-[var(--font-heading)] text-[14px] font-bold text-[#1A1D23]">🔄 {t("ai.fallback")}</label>
                  <textarea
                    value={config.fallbackMessage}
                    onChange={(e) => updateConfig({ fallbackMessage: e.target.value })}
                    disabled={!canEdit}
                    rows={3}
                    className="w-full min-h-[72px] resize-none rounded-xl border border-black/10 bg-[#FAFAF8] px-[14px] py-3 font-[var(--font-body)] text-[12.5px] leading-[1.5] text-[#1A1D23] focus:border-[#F59E0B] focus:outline-none focus:ring-0 disabled:opacity-50"
                  />
                </Card>
              </div>

              {/* Model & Parameters */}
              <Card className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm" padding="none">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(99,102,241,0.08)] text-[16px]">⚡</div>
                  <div>
                    <h3 className="font-[var(--font-heading)] text-[15px] font-bold text-[#1A1D23]">{t("ai.modelSettings")}</h3>
                    <p className="font-[var(--font-body)] text-[12px] text-[#94A3B8]">{t("ai.modelSettingsDesc")}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {/* Model selection */}
                  <div>
                    <label className="mb-2 block font-[var(--font-heading)] text-[12px] font-bold uppercase tracking-[0.04em] text-[#64748B]">{t("ai.model")}</label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {models.map((m) => (
                        (() => {
                          const selected = config.model === m.id;
                          return (
                        <button key={m.id} onClick={() => updateConfig({ model: m.id })} disabled={!canEdit}
                          className={`relative cursor-pointer rounded-xl p-3.5 text-left transition-all duration-200 ${
                            selected
                              ? "border-2 border-[#F59E0B] bg-[rgba(245,158,11,0.04)] shadow-[0_2px_8px_rgba(245,158,11,0.12)]"
                              : "border border-black/10 bg-[#FAFAF8] hover:border-[#F59E0B]/50"
                          } disabled:opacity-50`}>
                          {selected && (
                            <span className="absolute left-2.5 top-2.5 h-2 w-2 rounded-full bg-[#F59E0B] shadow-[0_0_0_3px_rgba(245,158,11,0.2)]" />
                          )}
                          {m.recommended && (
                            <span className={`absolute right-2.5 top-2.5 rounded-md px-2 py-[2px] font-[var(--font-heading)] text-[10px] font-bold text-white ${getRecommendedBadgeClass(m)}`}>
                              {t("ai.recommended")}
                            </span>
                          )}
                          <p className="font-[var(--font-heading)] text-[13px] font-bold text-[#1A1D23]">{m.name}</p>
                          <p className="mt-1 font-[var(--font-body)] text-[11px] text-[#94A3B8]">{m.description}</p>
                        </button>
                          );
                        })()
                      ))}
                    </div>
                  </div>

                  {/* Temperature */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-[var(--font-heading)] text-[12px] font-bold uppercase tracking-[0.04em] text-[#64748B]">
                        🌡️ {t("ai.temperature")}
                      </label>
                      <span className="rounded-md bg-[rgba(245,158,11,0.08)] px-[10px] py-[3px] font-[var(--font-heading)] text-[13px] font-extrabold text-[#B45309]">{config.temperature.toFixed(1)}</span>
                    </div>
                    <input type="range" min="0" max="2" step="0.1" value={config.temperature} disabled={!canEdit}
                      onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) })}
                      style={{ background: `linear-gradient(90deg, #F59E0B 0%, #D97706 ${temperaturePercent}%, rgba(0,0,0,0.06) ${temperaturePercent}%, rgba(0,0,0,0.06) 100%)` }}
                      className="h-[6px] w-full cursor-pointer appearance-none rounded-full disabled:opacity-50" />
                    <div className="mt-1 flex justify-between font-[var(--font-body)] text-[11px] text-[#94A3B8]">
                      <span>{t("ai.precise")}</span>
                      <span>{t("ai.creative")}</span>
                    </div>
                  </div>

                  {/* Tone */}
                  <div>
                    <label className="mb-2 block font-[var(--font-heading)] text-[12px] font-bold uppercase tracking-[0.04em] text-[#64748B]">{t("ai.tone")}</label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {(["professional", "friendly", "casual"] as const).map((tone) => (
                        (() => {
                          const selected = config.tone === tone;
                          const emoji = tone === "professional" ? "💼" : tone === "friendly" ? "😊" : "✌️";
                          return (
                        <button key={tone} onClick={() => updateConfig({ tone })} disabled={!canEdit}
                          className={`rounded-xl p-3 text-center transition-all duration-200 ${
                            selected
                              ? "border-2 border-[#F59E0B] bg-gradient-to-br from-[#F59E0B] to-[#D97706] shadow-[0_3px_12px_rgba(245,158,11,0.25)]"
                              : "border border-black/10 bg-[#FAFAF8] hover:border-[#F59E0B]/50"
                          } disabled:opacity-50`}>
                          <div className="mb-1 text-[18px]">{emoji}</div>
                          <div className={`font-[var(--font-heading)] text-[13px] font-bold ${selected ? "text-white" : "text-[#1A1D23]"}`}>
                            {t(`ai.tone.${tone}`)}
                          </div>
                        </button>
                          );
                        })()
                      ))}
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <label className="mb-2 block font-[var(--font-heading)] text-[12px] font-bold uppercase tracking-[0.04em] text-[#64748B]">
                      🌐 {t("ai.language")}
                    </label>
                    <select value={config.language} onChange={(e) => updateConfig({ language: e.target.value })} disabled={!canEdit}
                      className="w-full rounded-xl border border-black/10 bg-[#FAFAF8] px-4 py-3 font-[var(--font-body)] text-[13px] text-[#1A1D23] focus:border-[#F59E0B] focus:outline-none focus:ring-0 disabled:opacity-50">
                      <option value="en">English</option>
                      <option value="tr">Turkce</option>
                      <option value="es">Espanol</option>
                      <option value="de">Deutsch</option>
                      <option value="fr">Francais</option>
                      <option value="auto">Auto-detect</option>
                    </select>
                  </div>
                </div>
              </Card>

              {/* Save */}
              <button onClick={handleSave} disabled={saving || !canEdit}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F59E0B] via-[#D97706] to-[#B45309] p-[14px] font-[var(--font-heading)] text-[15px] font-bold text-white shadow-[0_4px_20px_rgba(245,158,11,0.3)] transition-all hover:opacity-90 hover:shadow-[0_8px_24px_rgba(245,158,11,0.35)] disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Check size={16} />}
                {saving ? t("common.saving") : t("ai.saveConfig")}
              </button>
            </div>

            {/* ── Right: Test Playground ── */}
            <div className="space-y-5">
              <Card className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm" padding="none">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[rgba(251,113,133,0.08)] text-[16px]">🧪</div>
                  <div>
                    <h3 className="font-[var(--font-heading)] text-[15px] font-bold text-[#1A1D23]">{t("ai.testPlayground")}</h3>
                    <p className="font-[var(--font-body)] text-[12px] text-[#94A3B8]">{t("ai.testDesc")}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="min-h-[140px] rounded-xl border border-black/5 bg-[#FAFAF8] p-4">
                    <div className="flex gap-2">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#D97706]">
                        <span className="font-[var(--font-heading)] text-[12px] font-extrabold text-white">H</span>
                      </div>
                      <div className="rounded-[4px_12px_12px_12px] bg-white px-[14px] py-[10px] font-[var(--font-body)] text-[12.5px] leading-[1.5] text-[#1A1D23] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                        {testResponse || t("ai.testDesc")}
                      </div>
                    </div>
                  </div>
                  <textarea value={testInput} onChange={(e) => setTestInput(e.target.value)}
                    placeholder={t("ai.testPlaceholder")}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-black/10 bg-[#FAFAF8] px-[14px] py-[10px] font-[var(--font-body)] text-[12.5px] text-[#1A1D23] placeholder:text-slate-400 focus:border-[#F59E0B] focus:outline-none focus:ring-0 transition-all" />
                  <button onClick={handleTest} disabled={testLoading || !testInput.trim() || !available}
                    className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#F59E0B] to-[#D97706] py-[11px] font-[var(--font-heading)] text-[13px] font-bold text-white transition-all hover:opacity-90 disabled:opacity-50">
                    {testLoading ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Send size={13} />}
                    {testLoading ? t("ai.generating") : `✦ ${t("ai.testSend")}`}
                  </button>

                  {testResponse && (
                    <div className="mt-3 rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot size={14} className="text-blue-500" />
                        <span className="font-[var(--font-heading)] text-[11px] font-semibold text-blue-600">AI Response</span>
                      </div>
                      <p className="whitespace-pre-wrap font-[var(--font-body)] text-sm leading-relaxed text-slate-700">{testResponse}</p>
                      {testMeta && (
                        <div className="mt-3 flex items-center gap-3 border-t border-blue-100 pt-2">
                          <span className="font-[var(--font-body)] text-[10px] text-slate-400">{testMeta.model}</span>
                          <span className="font-[var(--font-body)] text-[10px] text-slate-400">{testMeta.tokens} tokens</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              {/* AI Tips */}
              <div
                className="rounded-2xl border border-[rgba(245,158,11,0.1)] p-5"
                style={{ background: "linear-gradient(135deg, rgba(255,251,235,0.8), rgba(254,243,199,0.6))" }}
              >
                <h4 className="mb-3 font-[var(--font-heading)] text-[13px] font-bold text-[#92400E]">💡 {t("ai.tipsTitle")}</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 text-[14px]">💡</span>
                    <p className="font-[var(--font-body)] text-[12px] leading-[1.5] text-[#78350F]/80">{t("ai.tip1")}</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 text-[14px]">🎯</span>
                    <p className="font-[var(--font-body)] text-[12px] leading-[1.5] text-[#78350F]/80">{t("ai.tip2")}</p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex-shrink-0 text-[14px]">🔒</span>
                    <p className="font-[var(--font-body)] text-[12px] leading-[1.5] text-[#78350F]/80">{t("ai.tip3")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </div>
  );
}
