"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Zap, MessageSquare, Settings2, Sparkles, TestTube, Send, Check, AlertTriangle, Globe, Thermometer, Cpu } from "lucide-react";
import ErrorBanner from "@/components/ErrorBanner";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import AIUsageStats from "@/components/AIUsageStats";
import UpgradeModal from "@/components/UpgradeModal";
import { portalApiFetch } from "@/lib/portal-auth";
import { usePortalAuth } from "@/contexts/PortalAuthContext";
import { useI18n } from "@/i18n/I18nContext";

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
  const [defaults, setDefaults] = useState<AiConfig | null>(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [models, setModels] = useState<AiModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

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
        setSaveMsg(t("ai.saved"));
        setTimeout(() => setSaveMsg(null), 3000);
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
        setTestResponse(`Error: ${data.error || "Unknown error"}`);
      }
    } catch { setTestResponse("Error: Network error"); }
    finally { setTestLoading(false); }
  };

  const updateConfig = (patch: Partial<AiConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...patch });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={t("ai.title")}
        subtitle={t("ai.subtitle")}
        backButton={{ href: "/portal", label: t("portalOnboarding.backToDashboard") }}
      />

      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} className="mb-4" />}
      {saveMsg && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700 font-medium flex items-center gap-2">
          <Check size={16} className="text-emerald-500" /> {saveMsg}
        </div>
      )}

      <div className="space-y-6">
        {/* ═══ AI Usage Quota ═══ */}
        <AIUsageStats prominent onUpgradeNeeded={() => setShowUpgradeModal(true)} />

        {/* ═══ AI Status Hero ═══ */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-700 p-6 text-white">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
          <div className="relative flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Bot size={28} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">{t("ai.heroTitle")}</h2>
              <p className="text-sm text-white/70 leading-relaxed max-w-xl">{t("ai.heroDesc")}</p>
              <div className="flex items-center gap-3 mt-4">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-xs font-medium">
                  <span className={`w-2 h-2 rounded-full ${available ? "bg-emerald-400" : "bg-red-400"}`} />
                  {available ? t("ai.statusOnline") : t("ai.statusOffline")}
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-xs font-medium">
                  <Cpu size={12} />
                  {config?.model || "gpt-4o-mini"}
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-xs font-medium">
                  <Zap size={12} />
                  {aiEnabled ? t("ai.autoReplyOn") : t("ai.autoReplyOff")}
                </div>
              </div>
            </div>
            {/* Master toggle */}
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-2">
              <input type="checkbox" checked={aiEnabled} onChange={(e) => setAiEnabled(e.target.checked)} disabled={!canEdit} className="sr-only peer" />
              <div className="w-12 h-6 bg-white/20 rounded-full peer peer-checked:bg-emerald-400 transition-colors after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:rounded-full after:h-[18px] after:w-[18px] after:transition-all peer-checked:after:translate-x-6" />
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
              <Card>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center"><MessageSquare size={16} className="text-indigo-500" /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{t("ai.systemPrompt")}</h3>
                    <p className="text-xs text-slate-400">{t("ai.systemPromptDesc")}</p>
                  </div>
                </div>
                <textarea
                  value={config.systemPrompt}
                  onChange={(e) => updateConfig({ systemPrompt: e.target.value })}
                  disabled={!canEdit}
                  rows={5}
                  className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl bg-slate-50/50 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 focus:bg-white disabled:opacity-50 resize-none transition-all font-mono"
                />
              </Card>

              {/* Greeting & Fallback */}
              <Card>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center"><Sparkles size={16} className="text-emerald-500" /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{t("ai.messages")}</h3>
                    <p className="text-xs text-slate-400">{t("ai.messagesDesc")}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{t("ai.greeting")}</label>
                    <input type="text" value={config.greeting} onChange={(e) => updateConfig({ greeting: e.target.value })} disabled={!canEdit}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 transition-all" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">{t("ai.fallback")}</label>
                    <input type="text" value={config.fallbackMessage} onChange={(e) => updateConfig({ fallbackMessage: e.target.value })} disabled={!canEdit}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-50 transition-all" />
                  </div>
                </div>
              </Card>

              {/* Model & Parameters */}
              <Card>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center"><Settings2 size={16} className="text-violet-500" /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{t("ai.modelSettings")}</h3>
                    <p className="text-xs text-slate-400">{t("ai.modelSettingsDesc")}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {/* Model selection */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">{t("ai.model")}</label>
                    <div className="grid grid-cols-3 gap-2">
                      {models.map((m) => (
                        <button key={m.id} onClick={() => updateConfig({ model: m.id })} disabled={!canEdit}
                          className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                            config.model === m.id ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                          } disabled:opacity-50`}>
                          {m.recommended && <span className="absolute top-1.5 right-1.5 text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">{t("ai.recommended")}</span>}
                          <p className="text-xs font-semibold text-slate-800">{m.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{m.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Temperature */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                        <Thermometer size={13} className="text-slate-400" />
                        {t("ai.temperature")}
                      </label>
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">{config.temperature.toFixed(1)}</span>
                    </div>
                    <input type="range" min="0" max="2" step="0.1" value={config.temperature} disabled={!canEdit}
                      onChange={(e) => updateConfig({ temperature: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-500 disabled:opacity-50" />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>{t("ai.precise")}</span>
                      <span>{t("ai.creative")}</span>
                    </div>
                  </div>

                  {/* Tone */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-2">{t("ai.tone")}</label>
                    <div className="flex gap-2">
                      {(["professional", "friendly", "casual"] as const).map((tone) => (
                        <button key={tone} onClick={() => updateConfig({ tone })} disabled={!canEdit}
                          className={`flex-1 px-3 py-2.5 text-xs font-medium rounded-xl border-2 transition-all ${
                            config.tone === tone ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
                          } disabled:opacity-50`}>
                          {t(`ai.tone.${tone}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <label className="text-xs font-medium text-slate-600 flex items-center gap-1.5 mb-2">
                      <Globe size={13} className="text-slate-400" />{t("ai.language")}
                    </label>
                    <select value={config.language} onChange={(e) => updateConfig({ language: e.target.value })} disabled={!canEdit}
                      className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 disabled:opacity-50">
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
                className="w-full py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex items-center justify-center gap-2">
                {saving ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Check size={16} />}
                {saving ? t("common.saving") : t("ai.saveConfig")}
              </button>
            </div>

            {/* ── Right: Test Playground ── */}
            <div className="space-y-5">
              <Card>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center"><TestTube size={16} className="text-amber-500" /></div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{t("ai.testPlayground")}</h3>
                    <p className="text-xs text-slate-400">{t("ai.testDesc")}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <textarea value={testInput} onChange={(e) => setTestInput(e.target.value)}
                    placeholder={t("ai.testPlaceholder")}
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-slate-50/50 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-none transition-all" />
                  <button onClick={handleTest} disabled={testLoading || !testInput.trim() || !available}
                    className="w-full py-2.5 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                    {testLoading ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Send size={13} />}
                    {testLoading ? t("ai.generating") : t("ai.testSend")}
                  </button>

                  {testResponse && (
                    <div className="mt-3 p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot size={14} className="text-blue-500" />
                        <span className="text-[11px] font-semibold text-blue-600">AI Response</span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{testResponse}</p>
                      {testMeta && (
                        <div className="flex items-center gap-3 mt-3 pt-2 border-t border-blue-100">
                          <span className="text-[10px] text-slate-400">{testMeta.model}</span>
                          <span className="text-[10px] text-slate-400">{testMeta.tokens} tokens</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </Card>

              {/* AI Tips */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200 p-5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">{t("ai.tipsTitle")}</h4>
                <div className="space-y-3">
                  <div className="flex gap-2.5">
                    <span className="text-lg">💡</span>
                    <p className="text-[12px] text-slate-600 leading-relaxed">{t("ai.tip1")}</p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="text-lg">🎯</span>
                    <p className="text-[12px] text-slate-600 leading-relaxed">{t("ai.tip2")}</p>
                  </div>
                  <div className="flex gap-2.5">
                    <span className="text-lg">🔒</span>
                    <p className="text-[12px] text-slate-600 leading-relaxed">{t("ai.tip3")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <UpgradeModal isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </>
  );
}
