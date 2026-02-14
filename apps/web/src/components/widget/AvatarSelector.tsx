"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useI18n } from "@/i18n/I18nContext";

type Plan = "FREE" | "STARTER" | "PRO" | "ENTERPRISE";
type RoleId = "bot" | "user" | "rep";

interface AvatarSelectorProps {
  currentPlan: Plan;
  onAvatarChange: (role: string, avatarId: string) => void;
}

const AVATARS = [
  { id: "female9", name: "Mia", src: "/avatars/female9.png" },
  { id: "female17", name: "Luna", src: "/avatars/female17.png" },
  { id: "male1", name: "Atlas", src: "/avatars/male1.png" },
  { id: "male4", name: "Neon", src: "/avatars/male4.png" },
  { id: "male8", name: "Kai", src: "/avatars/male8.png" },
  { id: "male9", name: "Zion", src: "/avatars/male9.png" },
] as const;

export default function AvatarSelector({ currentPlan, onAvatarChange }: AvatarSelectorProps) {
  const { t } = useI18n();
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [activeRole, setActiveRole] = useState<RoleId>("bot");
  const [hoveredAvatarId, setHoveredAvatarId] = useState<string | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [modalEntered, setModalEntered] = useState(false);
  const [selected, setSelected] = useState<Record<RoleId, string | null>>({
    bot: "female9",
    user: "female17",
    rep: null,
  });

  const roles: Array<{ id: RoleId; icon: string; label: string }> = useMemo(
    () => [
      { id: "bot", icon: "🤖", label: t("avatarSelector.role.bot") },
      { id: "user", icon: "👤", label: t("avatarSelector.role.user") },
      { id: "rep", icon: "👥", label: t("avatarSelector.role.rep") },
    ],
    [t]
  );

  const isRepLocked = currentPlan === "FREE" || currentPlan === "STARTER";
  const activeRoleSelectedAvatarId = selected[activeRole];
  const activeRoleSelectedAvatar =
    AVATARS.find((avatar) => avatar.id === activeRoleSelectedAvatarId) ?? AVATARS[0];
  const activeRoleLabel =
    roles.find((r) => r.id === activeRole)?.label ?? t("avatarSelector.role.bot");

  const handleRoleChange = (roleId: RoleId) => {
    if (roleId === "rep" && isRepLocked) {
      setShowProModal(true);
      return;
    }
    setActiveRole(roleId);
  };

  const handleAvatarClick = (avatarId: string) => {
    if (activeRole === "rep" && isRepLocked) {
      setShowProModal(true);
      return;
    }
    setSelected((prev) => ({ ...prev, [activeRole]: avatarId }));
    onAvatarChange(activeRole, avatarId);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(t("avatarSelector.logoTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl !== "string") return;
      onAvatarChange("logo", dataUrl);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!showProModal) {
      setModalEntered(false);
      return;
    }
    const timer = window.setTimeout(() => setModalEntered(true), 0);
    return () => window.clearTimeout(timer);
  }, [showProModal]);

  return (
    <div className="relative rounded-2xl border border-black/5 bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {roles.map((role) => {
            const isActive = activeRole === role.id;
            const isDisabled = role.id === "rep" && isRepLocked;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => handleRoleChange(role.id)}
                data-testid={`avatar-role-${role.id}`}
                className="inline-flex h-[38px] items-center gap-1.5 rounded-[12px] px-3 text-[12px] font-semibold transition-all duration-[250ms]"
                style={{
                  background: isActive
                    ? "linear-gradient(135deg, #F59E0B, #D97706)"
                    : "rgba(0,0,0,0.03)",
                  transform: isActive ? "scale(1.1)" : "scale(1)",
                  boxShadow: isActive ? "0 3px 10px rgba(245,158,11,0.3)" : "none",
                  color: isActive ? "#fff" : "#1A1D23",
                  opacity: isDisabled ? 0.5 : 1,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                }}
              >
                <span className="relative">
                  {role.icon}
                  {isDisabled ? (
                    <span
                      className="absolute z-[2] flex h-3 w-3 items-center justify-center rounded-full bg-[#1A1D23] text-[8px] leading-none text-white"
                      style={{ right: -6, bottom: -4 }}
                    >
                      🔒
                    </span>
                  ) : null}
                </span>
                <span>{role.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <div className="h-[28px] w-px bg-black/5" />
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{
              borderRadius: "50%",
              background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
              overflow: "hidden",
              border: "2.5px solid #F59E0B",
              boxShadow: "0 3px 12px rgba(245,158,11,0.2)",
            }}
          >
            <img
              src={activeRoleSelectedAvatar.src}
              alt={activeRoleSelectedAvatar.name}
              className="h-full w-full"
              style={{
                borderRadius: "50%",
                objectFit: "cover",
                width: "100%",
                height: "100%",
              }}
            />
          </span>
          <div className="min-w-[110px]">
            <p className="text-[13px] font-bold text-[#1A1D23]">{activeRoleSelectedAvatar.name}</p>
            <p className="text-[10px] text-[#CBD5E1]">
              {t("avatarSelector.selectedWithRole", { role: activeRoleLabel })}
            </p>
          </div>
          <button
            type="button"
            data-testid="avatar-logo-upload"
            onClick={() => logoInputRef.current?.click()}
            className="rounded-[10px] px-4 py-[7px] text-[12px] font-semibold"
            style={{ background: "rgba(245,158,11,0.1)", color: "#F59E0B" }}
          >
            {t("avatarSelector.logoUpload")}
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            style={{ display: "none" }}
            onChange={handleLogoUpload}
          />
        </div>
      </div>

      <p
        className="mb-[14px] text-[10px] font-bold uppercase"
        style={{ color: "#F59E0B", letterSpacing: "0.1em" }}
      >
        {t("avatarSelector.readyAvatars")}
      </p>

      <div className="flex justify-center gap-3 py-2">
        {AVATARS.map((avatar) => {
          const isSelected = selected[activeRole] === avatar.id;
          const isHovered = hoveredAvatarId === avatar.id;
          const size = isSelected ? 72 : isHovered ? 68 : 64;
          const translateY = isSelected ? -4 : isHovered ? -8 : 0;
          return (
            <button
              key={avatar.id}
              type="button"
              onClick={() => handleAvatarClick(avatar.id)}
              onMouseEnter={() => setHoveredAvatarId(avatar.id)}
              onMouseLeave={() => setHoveredAvatarId(null)}
              className="relative flex cursor-pointer flex-col items-center gap-1.5 border-none bg-transparent p-0"
              style={{ outline: "none" }}
            >
              <span
                className="relative overflow-hidden rounded-full transition-all duration-300"
                style={{
                  width: size,
                  height: size,
                  borderRadius: "50%",
                  overflow: "hidden",
                  transform: `translateY(${translateY}px)`,
                  border: isSelected ? "3px solid #F59E0B" : "3px solid transparent",
                  boxShadow: isSelected
                    ? "0 6px 20px rgba(245,158,11,0.25)"
                    : isHovered
                      ? "0 6px 16px rgba(0,0,0,0.12)"
                      : "0 2px 6px rgba(0,0,0,0.06)",
                  background: "linear-gradient(135deg, #6366F1, #8B5CF6)",
                  transitionTimingFunction: "cubic-bezier(0.4,0,0.2,1)",
                }}
              >
                {!isSelected && isHovered ? (
                  <span
                    className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2"
                    style={{
                      bottom: "calc(100% + 6px)",
                      padding: "4px 10px",
                      borderRadius: 8,
                      background: "#1A1D23",
                      color: "#fff",
                      fontSize: 10,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    }}
                  >
                    {avatar.name}
                  </span>
                ) : null}
                <img
                  src={avatar.src}
                  alt={avatar.name}
                  className="h-full w-full"
                  style={{
                    borderRadius: "50%",
                    objectFit: "cover",
                    width: "100%",
                    height: "100%",
                  }}
                />
                {isSelected ? (
                  <span
                    className="absolute bottom-0 right-0 flex h-[18px] w-[18px] items-center justify-center rounded-full"
                    style={{
                      background: "#F59E0B",
                      border: "2px solid #fff",
                    }}
                  >
                    <svg width={8} height={8} viewBox="0 0 24 24" fill="none">
                      <polyline
                        points="20 6 9 17 4 12"
                        stroke="#fff"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                ) : null}
              </span>
              <span
                className="text-[10px] font-bold"
                style={{ color: isSelected ? "#F59E0B" : "#64748B" }}
              >
                {avatar.name}
              </span>
            </button>
          );
        })}
      </div>

      {isRepLocked ? (
        <div
          className="mt-[18px] flex items-center gap-[10px] rounded-[14px] border px-[18px] py-[14px]"
          style={{
            background: "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(139,92,246,0.02))",
            borderColor: "rgba(139,92,246,0.1)",
          }}
        >
          <span className="text-[18px]">✨</span>
          <p className="flex-1 text-[12px] text-[#64748B]">
            <strong className="font-bold text-[#1A1D23]">
              {t("avatarSelector.repLockedBannerTitle")}
            </strong>{" "}
            {t("avatarSelector.repLockedBannerDesc")}
          </p>
          <button
            type="button"
            onClick={() => router.push("/portal/pricing")}
            data-testid="avatar-banner-upgrade"
            className="inline-flex shrink-0 items-center rounded-[8px] px-[14px] py-[6px] text-[11px] font-bold text-white transition hover:brightness-105"
            style={{
              background: "linear-gradient(135deg, #8B5CF6, #6D28D9)",
            }}
          >
            {t("avatarSelector.upgradeCta")} →
          </button>
        </div>
      ) : null}

      {showProModal
        ? createPortal(
            <div
              data-testid="avatar-pro-modal-overlay"
              className="fixed inset-0 flex items-center justify-center transition-opacity duration-200"
              style={{
                opacity: modalEntered ? 1 : 0,
                background: "rgba(0,0,0,0.4)",
                zIndex: 9999,
                backdropFilter: "blur(4px)",
              }}
              onClick={() => setShowProModal(false)}
            >
              <div
                data-testid="avatar-pro-modal-panel"
                className="w-[calc(100%-24px)] max-w-[380px] rounded-[20px] bg-white p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.2)] transition-all duration-200"
                style={{
                  opacity: modalEntered ? 1 : 0,
                  transform: modalEntered ? "scale(1)" : "scale(0.95)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-3 text-[48px] leading-none">👥</div>
                <h3 className="text-[18px] font-extrabold text-[#1A1D23]">
                  {t("avatarSelector.modalTitle")}
                </h3>
                <p className="mt-2 text-[13px] text-[#94A3B8]">
                  {t("avatarSelector.modalDesc")}
                </p>
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowProModal(false)}
                    data-testid="avatar-pro-modal-close"
                    className="rounded-[10px] border border-black/10 bg-white px-5 py-2.5 text-[13px] font-semibold text-[#64748B]"
                  >
                    {t("avatarSelector.modalClose")}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push("/portal/pricing")}
                    data-testid="avatar-pro-modal-upgrade"
                    className="rounded-[10px] px-5 py-2.5 text-[13px] font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #8B5CF6, #6D28D9)" }}
                  >
                    {t("avatarSelector.modalUpgrade")}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
