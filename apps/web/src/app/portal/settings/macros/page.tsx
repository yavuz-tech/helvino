"use client";

import { useEffect, useState } from "react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { FileText, Plus, Trash2, Check, AlertCircle } from "lucide-react";

type MacroItem = {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
};

export default function PortalSettingsMacrosPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<MacroItem[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("");

  const load = async () => {
    const res = await portalApiFetch("/portal/settings/macros");
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!title.trim() || !content.trim()) return;
    const res = await portalApiFetch("/portal/settings/macros", {
      method: "POST",
      body: JSON.stringify({ title: title.trim(), content: content.trim(), enabled: true }),
    });
    if (res.ok) {
      setTitle("");
      setContent("");
      setStatus(t("portal.settingsSaved"));
      load();
    } else {
      setStatus(t("portal.failedSaveSettings"));
    }
  };

  const remove = async (id: string) => {
    const res = await portalApiFetch(`/portal/settings/macros/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStatus(t("portal.settingsSaved"));
      load();
    } else {
      setStatus(t("portal.failedSaveSettings"));
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-amber-50/40 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-1">
          <FileText size={18} className="text-amber-600" />
          <h1 className="text-2xl font-bold text-slate-900">{t("settingsPortal.macros")}</h1>
        </div>
        <p className="text-sm text-slate-600 mt-1">{t("settingsPortal.macrosSubtitle")}</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("settingsPortal.macros")}</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{items.length}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("common.enabled")}</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">{items.filter((m) => m.enabled).length}</p>
          </div>
        </div>
      </div>

      {status && (
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${
          status.includes(t("portal.settingsSaved"))
            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
            : "bg-red-50 border-red-200 text-red-900"
        }`}>
          {status.includes(t("portal.settingsSaved")) ? <Check size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{status}</span>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{t("settingsPortal.addMacro")}</h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("settingsPortal.macroTitle")}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("settingsPortal.macroContent")}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm min-h-[100px] focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all resize-none"
        />
        <button
          onClick={create}
          className="w-full py-3 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          {t("settingsPortal.addMacro")}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">{t("settingsPortal.macros")}</h3>
        {items.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <FileText size={24} className="text-slate-300" />
            </div>
            <p className="text-sm text-slate-500">{t("settingsPortal.macros")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="border-2 border-slate-200 rounded-xl p-4 hover:border-amber-200 hover:bg-amber-50/20 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{item.title}</p>
                      <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{item.content}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(item.id)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 size={12} />
                    {t("common.delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
