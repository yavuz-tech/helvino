"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Plus, Tag, Trash2, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import { premiumToast } from "@/components/PremiumToast";
import { useI18n } from "@/i18n/I18nContext";
import { checkAuth, logout, type AdminUser } from "@/lib/auth";
import { apiFetch } from "@/utils/api";
import { useOrg } from "@/contexts/OrgContext";
import { p } from "@/styles/theme";

type DiscountType = "percentage" | "fixed";

type PromoCodeItem = {
  id: string;
  code: string;
  isGlobal: boolean;
  bannerTitle: string | null;
  bannerSubtitle: string | null;
  discountType: DiscountType;
  discountValue: number;
  maxUses: number | null;
  currentUses: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
};

type FormState = {
  code: string;
  isGlobal: boolean;
  bannerTitle: string;
  bannerSubtitle: string;
  discountType: DiscountType;
  discountValue: string;
  maxUses: string;
  validUntil: string;
};

const EMPTY_FORM: FormState = {
  code: "",
  isGlobal: false,
  bannerTitle: "",
  bannerSubtitle: "",
  discountType: "percentage",
  discountValue: "",
  maxUses: "",
  validUntil: "",
};

export default function DashboardCampaignsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const { selectedOrg, isLoading: orgLoading } = useOrg();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [items, setItems] = useState<PromoCodeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaignsEnabled, setCampaignsEnabled] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const isEditMode = useMemo(() => Boolean(editingId), [editingId]);

  useEffect(() => {
    const verifyAuth = async () => {
      const currentUser = await checkAuth();
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
      setAuthLoading(false);
    };
    verifyAuth();
  }, [router]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const loadSettings = useCallback(async () => {
    if (!selectedOrg) return;
    const res = await apiFetch("/internal/organization/settings", {
      orgKey: selectedOrg.key,
    });
    if (res.ok) {
      const data = (await res.json()) as { campaignsEnabled?: boolean };
      setCampaignsEnabled(Boolean(data.campaignsEnabled));
    }
  }, [selectedOrg]);

  const loadCodes = useCallback(async () => {
    if (!selectedOrg) return;
    const res = await apiFetch("/api/promo-codes", {
      orgKey: selectedOrg.key,
    });
    if (!res.ok) throw new Error("load_failed");
    const data = (await res.json()) as { items?: PromoCodeItem[] };
    setItems(data.items || []);
  }, [selectedOrg]);

  const loadAll = useCallback(async () => {
    if (!selectedOrg) return;
    setLoading(true);
    try {
      await Promise.all([loadSettings(), loadCodes()]);
    } catch {
      premiumToast.error({
        title: t("toast.settingsFailed"),
        description: t("toast.settingsFailedDesc"),
      });
    } finally {
      setLoading(false);
    }
  }, [selectedOrg, loadSettings, loadCodes, t]);

  useEffect(() => {
    if (!authLoading && !orgLoading) {
      if (!selectedOrg) {
        setLoading(false);
        setItems([]);
        return;
      }
      loadAll();
    }
  }, [authLoading, orgLoading, selectedOrg, loadAll]);

  const toggleGlobal = async () => {
    if (!selectedOrg) return;
    setSavingGlobal(true);
    try {
      const res = await apiFetch("/internal/organization/settings", {
        method: "PATCH",
        orgKey: selectedOrg.key,
        body: JSON.stringify({ campaignsEnabled: !campaignsEnabled }),
      });
      if (!res.ok) throw new Error("toggle_failed");
      const data = (await res.json()) as { campaignsEnabled?: boolean };
      setCampaignsEnabled(Boolean(data.campaignsEnabled));
      premiumToast.success({
        title: t("toast.settingsSaved"),
        description: t("toast.settingsSavedDesc"),
      });
    } catch {
      premiumToast.error({
        title: t("toast.settingsFailed"),
        description: t("toast.settingsFailedDesc"),
      });
    } finally {
      setSavingGlobal(false);
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (item: PromoCodeItem) => {
    setEditingId(item.id);
    setForm({
      code: item.code,
      isGlobal: item.isGlobal,
      bannerTitle: item.bannerTitle || "",
      bannerSubtitle: item.bannerSubtitle || "",
      discountType: item.discountType,
      discountValue: String(item.discountValue),
      maxUses: item.maxUses === null ? "" : String(item.maxUses),
      validUntil: item.validUntil ? item.validUntil.slice(0, 10) : "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const submit = async () => {
    if (!selectedOrg) return;
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,20}$/.test(code)) {
      premiumToast.error({
        title: t("toast.settingsFailed"),
        description: t("settingsPortal.invalidCode"),
      });
      return;
    }
    const discountValue = Number(form.discountValue);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      premiumToast.error({
        title: t("toast.settingsFailed"),
        description: t("settingsPortal.invalidDiscountValue"),
      });
      return;
    }
    const maxUses = form.maxUses.trim() === "" ? null : Number(form.maxUses.trim());
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
      premiumToast.error({
        title: t("toast.settingsFailed"),
        description: t("settingsPortal.invalidMaxUses"),
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        code,
        isGlobal: form.isGlobal,
        bannerTitle: form.bannerTitle.trim() || null,
        bannerSubtitle: form.bannerSubtitle.trim() || null,
        discountType: form.discountType,
        discountValue,
        maxUses,
        validUntil: form.validUntil || null,
      };
      const res = await apiFetch(
        isEditMode ? `/api/promo-codes/${editingId}` : "/api/promo-codes",
        {
          method: isEditMode ? "PATCH" : "POST",
          orgKey: selectedOrg.key,
          body: JSON.stringify(payload),
        }
      );
      if (res.status === 409) {
        premiumToast.error({
          title: t("settingsPortal.duplicateCodeTitle"),
          description: t("settingsPortal.duplicateCodeDesc"),
        });
        return;
      }
      if (!res.ok) throw new Error("save_failed");

      premiumToast.success({
        title: isEditMode ? t("settingsPortal.updatedCampaign") : t("settingsPortal.savedCampaign"),
        description: isEditMode
          ? t("settingsPortal.updatedCampaignDesc")
          : t("settingsPortal.savedCampaignDesc"),
      });
      closeModal();
      await loadCodes();
    } catch {
      premiumToast.error({
        title: t("toast.settingsFailed"),
        description: t("toast.settingsFailedDesc"),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: PromoCodeItem) => {
    if (!selectedOrg) return;
    try {
      const res = await apiFetch(`/api/promo-codes/${item.id}`, {
        method: "PATCH",
        orgKey: selectedOrg.key,
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!res.ok) throw new Error("toggle_failed");
      await loadCodes();
      premiumToast.success({
        title: t("toast.settingsSaved"),
        description: t("toast.settingsSavedDesc"),
      });
    } catch {
      premiumToast.error({
        title: t("toast.settingsFailed"),
        description: t("toast.settingsFailedDesc"),
      });
    }
  };

  const remove = async (item: PromoCodeItem) => {
    if (!selectedOrg) return;
    if (!window.confirm(t("settingsPortal.deleteCampaignConfirm"))) return;
    setDeletingId(item.id);
    try {
      const res = await apiFetch(`/api/promo-codes/${item.id}`, {
        method: "DELETE",
        orgKey: selectedOrg.key,
      });
      if (!res.ok) throw new Error("delete_failed");
      await loadCodes();
      premiumToast.success({
        title: t("settingsPortal.deletedCampaign"),
        description: t("settingsPortal.deletedCampaignDesc"),
      });
    } catch {
      premiumToast.error({
        title: t("toast.settingsFailed"),
        description: t("toast.settingsFailedDesc"),
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[#0F5C5C] animate-spin" />
      </div>
    );
  }

  return (
    <DashboardLayout user={user} onLogout={handleLogout}>
      {!selectedOrg ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {t("dashboard.noOrgSelected")}
        </div>
      ) : (
        <div className={p.sectionGap}>
          <PageHeader
            title={t("settingsPortal.campaigns")}
            subtitle={`${t("settingsPortal.campaignsSubtitle")} (${selectedOrg.name} / ${selectedOrg.key})`}
            action={
              <button type="button" className={p.btnPrimary} onClick={openCreateModal}>
                <Plus size={14} />
                {t("settingsPortal.createCampaign")}
              </button>
            }
          />

          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={p.h3}>{t("campaigns.globalToggleTitle")}</p>
                <p className={`${p.body} mt-1`}>{t("campaigns.globalToggleSubtitle")}</p>
              </div>
              <button
                type="button"
                onClick={toggleGlobal}
                disabled={savingGlobal}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  campaignsEnabled ? "bg-emerald-600" : "bg-slate-300"
                } ${savingGlobal ? "opacity-60" : ""}`}
                aria-label={t("campaigns.globalToggleTitle")}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    campaignsEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            {!campaignsEnabled && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {t("campaigns.disabledAlert")}
              </div>
            )}
          </Card>

          <Card noPadding>
            {loading ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                {t("common.loading")}
              </div>
            ) : items.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                {t("settingsPortal.noCampaigns")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-5 py-3 text-left font-medium">{t("settingsPortal.tableCode")}</th>
                      <th className="px-5 py-3 text-left font-medium">{t("settingsPortal.tableType")}</th>
                      <th className="px-5 py-3 text-left font-medium">{t("campaigns.tableAudience")}</th>
                      <th className="px-5 py-3 text-left font-medium">{t("settingsPortal.tableDiscount")}</th>
                      <th className="px-5 py-3 text-left font-medium">{t("settingsPortal.tableUsage")}</th>
                      <th className="px-5 py-3 text-left font-medium">{t("settingsPortal.tableValidUntil")}</th>
                      <th className="px-5 py-3 text-left font-medium">{t("settingsPortal.tableStatus")}</th>
                      <th className="px-5 py-3 text-right font-medium">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                        <td className="px-5 py-4 font-semibold text-slate-900">{item.code}</td>
                        <td className="px-5 py-4">
                          <span className={item.discountType === "percentage" ? p.badgeGreen : p.badgeAmber}>
                            {item.discountType === "percentage" ? "%" : "₺"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={item.isGlobal ? "inline-flex rounded-full bg-fuchsia-100 px-2 py-0.5 text-xs font-medium text-fuchsia-700" : "inline-flex rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"}>
                            {item.isGlobal ? t("campaigns.audienceGlobal") : t("campaigns.audienceOrg")}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {item.discountType === "percentage" ? `${item.discountValue}%` : `₺${item.discountValue}`}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {item.currentUses}/{item.maxUses === null ? "∞" : item.maxUses}
                        </td>
                        <td className="px-5 py-4 text-slate-700">
                          {item.validUntil ? new Date(item.validUntil).toLocaleDateString() : t("settingsPortal.unlimited")}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => toggleStatus(item)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              item.isActive ? "bg-emerald-600" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                item.isActive ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button type="button" onClick={() => openEditModal(item)} className={p.btnSecondary}>
                              <Edit3 size={12} />
                              {t("common.edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(item)}
                              disabled={deletingId === item.id}
                              className={p.btnDanger}
                            >
                              <Trash2 size={12} />
                              {t("common.delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {modalOpen && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 px-4">
              <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`${p.iconSm} ${p.iconRose}`}>
                      <Tag size={14} />
                    </div>
                    <h2 className={p.h2}>
                      {isEditMode ? t("settingsPortal.editCampaign") : t("settingsPortal.createCampaign")}
                    </h2>
                  </div>
                  <button type="button" className={p.btnSecondary} onClick={closeModal}>
                    <X size={14} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className={p.label}>{t("settingsPortal.campaignCode")}</label>
                    <input
                      className={`${p.input} mt-1.5`}
                      value={form.code}
                      maxLength={20}
                      onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      placeholder={t("settingsPortal.codePlaceholder")}
                    />
                  </div>

                  <div>
                    <label className={p.label}>{t("campaigns.bannerTitleLabel")}</label>
                    <input
                      className={`${p.input} mt-1.5`}
                      value={form.bannerTitle}
                      maxLength={80}
                      onChange={(e) => setForm((prev) => ({ ...prev, bannerTitle: e.target.value }))}
                      placeholder={t("campaigns.bannerTitlePlaceholder")}
                    />
                    <p className="mt-1 text-xs text-slate-400">{t("campaigns.bannerTitleHint")}</p>
                  </div>

                  <div>
                    <label className={p.label}>{t("campaigns.bannerSubtitleLabel")}</label>
                    <input
                      className={`${p.input} mt-1.5`}
                      value={form.bannerSubtitle}
                      maxLength={120}
                      onChange={(e) => setForm((prev) => ({ ...prev, bannerSubtitle: e.target.value }))}
                      placeholder={t("campaigns.bannerSubtitlePlaceholder")}
                    />
                    <p className="mt-1 text-xs text-slate-400">{t("campaigns.bannerSubtitleHint")}</p>
                  </div>

                  <div>
                    <label className={p.label}>{t("settingsPortal.discountType")}</label>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, discountType: "percentage" }))}
                        className={form.discountType === "percentage" ? p.btnPrimary : p.btnSecondary}
                      >
                        {t("settingsPortal.discountPercentage")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, discountType: "fixed" }))}
                        className={form.discountType === "fixed" ? p.btnPrimary : p.btnSecondary}
                      >
                        {t("settingsPortal.discountFixed")}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={p.label}>{t("campaigns.audienceLabel")}</label>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, isGlobal: false }))}
                        className={!form.isGlobal ? p.btnPrimary : p.btnSecondary}
                      >
                        {t("campaigns.audienceOrg")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, isGlobal: true }))}
                        className={form.isGlobal ? p.btnPrimary : p.btnSecondary}
                      >
                        {t("campaigns.audienceGlobal")}
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {form.isGlobal ? t("campaigns.audienceGlobalDesc") : t("campaigns.audienceOrgDesc")}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={p.label}>{t("settingsPortal.discountValue")}</label>
                      <input
                        className={`${p.input} mt-1.5`}
                        type="number"
                        min={1}
                        value={form.discountValue}
                        onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className={p.label}>{t("settingsPortal.maxUses")}</label>
                      <input
                        className={`${p.input} mt-1.5`}
                        type="number"
                        min={1}
                        value={form.maxUses}
                        placeholder={t("settingsPortal.maxUsesPlaceholder")}
                        onChange={(e) => setForm((prev) => ({ ...prev, maxUses: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={p.label}>{t("settingsPortal.validUntil")}</label>
                    <input
                      className={`${p.input} mt-1.5`}
                      type="date"
                      value={form.validUntil}
                      onChange={(e) => setForm((prev) => ({ ...prev, validUntil: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button type="button" className={p.btnSecondary} onClick={closeModal}>
                    {t("common.cancel")}
                  </button>
                  <button type="button" className={p.btnPrimary} onClick={submit} disabled={saving}>
                    {saving ? t("common.loading") : isEditMode ? t("common.save") : t("common.create")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
