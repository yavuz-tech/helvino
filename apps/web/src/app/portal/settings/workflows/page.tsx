"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { portalApiFetch } from "@/lib/portal-auth";
import { useI18n } from "@/i18n/I18nContext";
import { premiumToast } from "@/components/PremiumToast";
import ErrorBanner from "@/components/ErrorBanner";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Toggle from "@/components/ui/Toggle";
import { InputField, TextareaField, SelectField } from "@/components/ui/Field";
import { p } from "@/styles/theme";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { can } = useFeatureAccess();
  const starterPlus = can("workflows");

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await portalApiFetch("/portal/settings/workflows");
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error("LOAD_FAILED");
      setItems(data?.items || []);
    } catch {
      setItems([]);
      setLoadError(t("common.networkError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    if (!starterPlus) {
      premiumToast.info({ title: t("settings.starterRequired"), description: t("billing.viewPlans") });
      return;
    }
    try {
      const res = await portalApiFetch("/portal/settings/workflows", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(), trigger, enabled: true,
          actionsJson: { autoReplyText: autoReplyText || undefined, closeConversation },
        }),
      });
      if (res.ok) {
        setName(""); setAutoReplyText(""); setCloseConversation(false); load();
        premiumToast.success({ title: t("toast.created"), description: t("toast.createdDesc") });
      } else {
        premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
      }
    } catch {
      premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
    }
  };

  const remove = async (id: string) => {
    if (!starterPlus) {
      premiumToast.info({ title: t("settings.starterRequired"), description: t("billing.viewPlans") });
      return;
    }
    try {
      const res = await portalApiFetch(`/portal/settings/workflows/${id}`, { method: "DELETE" });
      if (res.ok) {
        load();
        premiumToast.success({ title: t("toast.deleted"), description: t("toast.deletedDesc") });
      } else {
        premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
      }
    } catch {
      premiumToast.error({ title: t("toast.settingsFailed"), description: t("toast.settingsFailedDesc") });
    }
  };

  const enabledCount = items.filter((w) => w.enabled).length;

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
      </div>
    );

  return (
    <div className={p.sectionGap} style={{ background: "#FFFBF5", borderRadius: 16, padding: 16 }}>
      <PageHeader title={t("settingsPortal.workflows")} subtitle={t("settingsPortal.workflowsSubtitle")} />

      {loadError && <ErrorBanner message={loadError} onDismiss={() => setLoadError(null)} />}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("settingsPortal.workflows")} value={String(items.length)} icon={WorkflowIcon} color="violet" />
        <StatCard label={t("common.enabled")} value={String(enabledCount)} icon={WorkflowIcon} color="emerald" />
        <StatCard label={t("common.disabled")} value={String(items.length - enabledCount)} icon={WorkflowIcon} color="slate" />
      </div>

      <Card className="border-[#F3E8D8] hover:border-[#E8D5BC]">
        {!starterPlus && (
          <div
            style={{
              marginBottom: 10,
              background: "#FEF3C7",
              border: "1px solid #FCD34D",
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "#B45309",
            }}
          >
            🔒 {t("settings.starterRequired")}
          </div>
        )}
        <div className="mb-4 flex items-center gap-2.5">
          <div className={`${p.iconSm} ${p.iconViolet}`}><Plus size={13} /></div>
          <h2 className={p.h2}>{t("settingsPortal.addWorkflow")}</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <InputField label={t("settingsPortal.workflowName")} value={name} onChange={setName} placeholder={t("settingsPortal.workflowName")} />
          <SelectField label={t("settingsPortal.workflows")} value={trigger} onChange={setTrigger} options={[
            { value: "message_created", label: t("settingsPortal.triggerMessageCreated") },
            { value: "conversation_created", label: t("settingsPortal.triggerConversationCreated") },
            { value: "conversation_closed", label: t("settingsPortal.triggerConversationClosed") },
          ]} />
        </div>
        <div className="mt-4">
          <TextareaField label={t("settingsPortal.workflowAutoReply")} value={autoReplyText} onChange={setAutoReplyText} placeholder={t("settingsPortal.workflowAutoReply")} />
        </div>
        <div className="mt-3">
          <Toggle label={t("settingsPortal.workflowCloseConversation")} checked={closeConversation} disabled={!starterPlus} onChange={setCloseConversation} />
        </div>
        <button
          onClick={create}
          disabled={!starterPlus}
          className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-[12px] font-semibold text-white transition-all hover:scale-[1.02] disabled:opacity-60"
          style={{ background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
        >
          <Plus size={13} />
          {t("settingsPortal.addWorkflow")}
        </button>
      </Card>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id} className="border-[#F3E8D8] hover:border-[#E8D5BC]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className={`${p.iconSm} ${item.enabled ? p.iconViolet : p.iconSlate} mt-0.5`}><WorkflowIcon size={13} /></div>
                  <div className="min-w-0 flex-1">
                    <p className={p.h3}>{item.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={p.badgeSlate}>{item.trigger.replace(/_/g, " ")}</span>
                      <span className={item.enabled ? p.badgeGreen : p.badgeRed}>
                        {item.enabled ? t("common.enabled") : t("common.disabled")}
                      </span>
                    </div>
                    {item.actionsJson?.autoReplyText && (
                      <p className={`${p.body} mt-1.5`}>{item.actionsJson.autoReplyText}</p>
                    )}
                  </div>
                </div>
                <button onClick={() => remove(item.id)} className={p.btnDanger}><Trash2 size={12} /></button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
