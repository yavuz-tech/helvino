"use client";

import { useEffect, useState } from "react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { Workflow as WorkflowIcon, Plus, Trash2, Check, AlertCircle, Zap } from "lucide-react";

type Workflow = {
  id: string;
  name: string;
  trigger: string;
  enabled: boolean;
  actionsJson?: { autoReplyText?: string; closeConversation?: boolean };
};

export default function PortalSettingsWorkflowsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Workflow[]>([]);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("message_created");
  const [autoReplyText, setAutoReplyText] = useState("");
  const [closeConversation, setCloseConversation] = useState(false);
  const [status, setStatus] = useState("");

  const load = async () => {
    const res = await portalApiFetch("/portal/settings/workflows");
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items || []);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    const res = await portalApiFetch("/portal/settings/workflows", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        trigger,
        enabled: true,
        actionsJson: {
          autoReplyText: autoReplyText || undefined,
          closeConversation,
        },
      }),
    });
    if (res.ok) {
      setName("");
      setAutoReplyText("");
      setCloseConversation(false);
      setStatus(t("portal.settingsSaved"));
      load();
    } else {
      setStatus(t("portal.failedSaveSettings"));
    }
  };

  const remove = async (id: string) => {
    const res = await portalApiFetch(`/portal/settings/workflows/${id}`, { method: "DELETE" });
    if (res.ok) {
      setStatus(t("portal.settingsSaved"));
      load();
    } else {
      setStatus(t("portal.failedSaveSettings"));
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-indigo-50/40 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-1">
          <WorkflowIcon size={18} className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-900">{t("settingsPortal.workflows")}</h1>
        </div>
        <p className="text-sm text-slate-600 mt-1">{t("settingsPortal.workflowsSubtitle")}</p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("settingsPortal.workflows")}</p>
            <p className="text-lg font-bold text-slate-900 mt-1">{items.length}</p>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">{t("common.enabled")}</p>
            <p className="text-lg font-bold text-emerald-600 mt-1">{items.filter((w) => w.enabled).length}</p>
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
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">{t("settingsPortal.addWorkflow")}</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("settingsPortal.workflowName")}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
        />
        <select
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
        >
          <option value="message_created">{t("settingsPortal.triggerMessageCreated")}</option>
          <option value="conversation_created">{t("settingsPortal.triggerConversationCreated")}</option>
          <option value="conversation_closed">{t("settingsPortal.triggerConversationClosed")}</option>
        </select>
        <textarea
          value={autoReplyText}
          onChange={(e) => setAutoReplyText(e.target.value)}
          placeholder={t("settingsPortal.workflowAutoReply")}
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm min-h-[100px] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none"
        />
        <label className="flex items-center gap-3 border-2 rounded-xl p-4 hover:border-indigo-200 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={closeConversation}
            onChange={(e) => setCloseConversation(e.target.checked)}
            className="w-5 h-5 rounded accent-indigo-600"
          />
          <span className="text-sm font-medium text-slate-700">{t("settingsPortal.workflowCloseConversation")}</span>
        </label>
        <button
          onClick={create}
          className="w-full py-3 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          {t("settingsPortal.addWorkflow")}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">{t("settingsPortal.workflows")}</h3>
        {items.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-14 h-14 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
              <WorkflowIcon size={24} className="text-slate-300" />
            </div>
            <p className="text-sm text-slate-500">{t("settingsPortal.workflows")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="border-2 border-slate-200 rounded-xl p-4 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                      <Zap size={16} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.trigger.replace(/_/g, " ")}</p>
                      {item.actionsJson?.autoReplyText && (
                        <p className="text-sm text-slate-600 mt-2 bg-slate-50 rounded-lg p-2">{item.actionsJson.autoReplyText}</p>
                      )}
                      {item.actionsJson?.closeConversation && (
                        <span className="inline-flex items-center gap-1 mt-2 text-xs text-violet-700 bg-violet-50 px-2 py-1 rounded-lg font-medium">
                          <Check size={12} />
                          {t("settingsPortal.workflowCloseConversation")}
                        </span>
                      )}
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
