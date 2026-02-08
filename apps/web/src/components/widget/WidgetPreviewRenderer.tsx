"use client";

import { useState } from "react";
import { MessageCircle, X, Send, ChevronDown, Home, HelpCircle, User } from "lucide-react";

interface WidgetSettings {
  primaryColor: string;
  position: "right" | "left";
  launcher: "bubble" | "icon";
  welcomeTitle: string;
  welcomeMessage: string;
  brandName: string | null;
}

interface WidgetPreviewRendererProps {
  settings: WidgetSettings;
}

type WidgetState = "closed" | "open" | "welcome";

export default function WidgetPreviewRenderer({ settings }: WidgetPreviewRendererProps) {
  const [widgetState, setWidgetState] = useState<WidgetState>("closed");
  const [messageInput, setMessageInput] = useState("");

  const toggleWidget = () => {
    if (widgetState === "closed") {
      setWidgetState("welcome");
    } else {
      setWidgetState("closed");
    }
  };

  const startChat = () => {
    setWidgetState("open");
  };

  return (
    <div className="relative bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl h-[600px] overflow-hidden border border-slate-200/80 shadow-sm">
      {/* Simulated Website Background */}
      <div className="absolute inset-0 p-8">
        <div className="text-slate-400 text-sm mb-3">Your Website</div>
        <div className="space-y-2">
          <div className="h-4 bg-slate-200 rounded w-3/4 opacity-50" />
          <div className="h-4 bg-slate-200 rounded w-1/2 opacity-50" />
          <div className="h-4 bg-slate-200 rounded w-5/6 opacity-50" />
        </div>
      </div>

      {/* Widget Launcher */}
      {widgetState === "closed" && (
        <button
          onClick={toggleWidget}
          style={{ backgroundColor: settings.primaryColor }}
          className={`absolute bottom-6 ${
            settings.position === "right" ? "right-6" : "left-6"
          } w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white hover:scale-110 transition-all duration-200 group`}
          aria-label="Open chat widget"
        >
          {settings.launcher === "bubble" ? (
            <MessageCircle size={24} strokeWidth={2} className="group-hover:rotate-12 transition-transform" />
          ) : (
            <HelpCircle size={24} strokeWidth={2} className="group-hover:rotate-12 transition-transform" />
          )}
          {/* Unread badge (simulated) */}
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold shadow-md">
            2
          </span>
        </button>
      )}

      {/* Welcome State */}
      {widgetState === "welcome" && (
        <div
          className={`absolute bottom-6 ${
            settings.position === "right" ? "right-6" : "left-6"
          } w-[360px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in slide-in-from-bottom-4 duration-300`}
        >
          {/* Header */}
          <div
            style={{ backgroundColor: settings.primaryColor }}
            className="px-5 py-4 text-white flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white flex items-center justify-center">
                  <User size={16} />
                </div>
                <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white flex items-center justify-center">
                  <User size={16} />
                </div>
              </div>
              <div>
                <div className="font-semibold text-sm">
                  {settings.brandName || "Support Team"}
                </div>
                <div className="text-xs opacity-90 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Online
                </div>
              </div>
            </div>
            <button
              onClick={toggleWidget}
              className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
              aria-label="Close widget"
            >
              <ChevronDown size={20} />
            </button>
          </div>

          {/* Welcome Content */}
          <div className="p-6">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-50 mb-3">
                <MessageCircle size={24} className="text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                {settings.welcomeTitle}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {settings.welcomeMessage}
              </p>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 mb-4">
              <button
                onClick={startChat}
                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-left transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle size={18} className="text-slate-600 group-hover:text-slate-900" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">Send us a message</div>
                    <div className="text-xs text-slate-500">We typically reply in a few minutes</div>
                  </div>
                </div>
              </button>
              <button className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-left transition-colors group">
                <div className="flex items-center gap-3">
                  <HelpCircle size={18} className="text-slate-600 group-hover:text-slate-900" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">Search for help</div>
                    <div className="text-xs text-slate-500">Browse our help articles</div>
                  </div>
                </div>
              </button>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-slate-400">
              Powered by Helvino
            </div>
          </div>
        </div>
      )}

      {/* Open Chat State */}
      {widgetState === "open" && (
        <div
          className={`absolute bottom-6 ${
            settings.position === "right" ? "right-6" : "left-6"
          } w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-300`}
        >
          {/* Header */}
          <div
            style={{ backgroundColor: settings.primaryColor }}
            className="px-5 py-4 text-white flex items-center justify-between flex-shrink-0"
          >
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white flex items-center justify-center">
                  <User size={16} />
                </div>
                <div className="w-8 h-8 rounded-full bg-white/20 border-2 border-white flex items-center justify-center">
                  <User size={16} />
                </div>
              </div>
              <div>
                <div className="font-semibold text-sm">
                  {settings.brandName || "Support Team"}
                </div>
                <div className="text-xs opacity-90 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Online • Reply in a few minutes
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWidgetState("welcome")}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
                aria-label="Back to home"
              >
                <Home size={18} />
              </button>
              <button
                onClick={toggleWidget}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
                aria-label="Close widget"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {/* Bot Welcome Message */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                AI
              </div>
              <div className="flex-1">
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-200/80">
                  <p className="text-sm text-slate-800 leading-relaxed">
                    👋 Hi there! How can I help you today?
                  </p>
                </div>
                <div className="text-xs text-slate-500 mt-1 px-1">Just now</div>
              </div>
            </div>

            {/* Quick Reply Buttons */}
            <div className="flex flex-wrap gap-2 px-2">
              <button className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors">
                Just browsing
              </button>
              <button className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors">
                I need help
              </button>
              <button className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors">
                Pricing question
              </button>
            </div>

            {/* User Message (Example) */}
            <div className="flex items-start gap-3 justify-end">
              <div className="flex-1 flex flex-col items-end">
                <div
                  style={{ backgroundColor: settings.primaryColor }}
                  className="rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm max-w-[80%]"
                >
                  <p className="text-sm text-white leading-relaxed">
                    I have a question about pricing
                  </p>
                </div>
                <div className="text-xs text-slate-500 mt-1 px-1">2m ago • Seen</div>
              </div>
            </div>

            {/* Bot Response */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                AI
              </div>
              <div className="flex-1">
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-200/80">
                  <p className="text-sm text-slate-800 leading-relaxed">
                    I&apos;d be happy to help with pricing! We have flexible plans starting at $29/month. Would you like me to connect you with our sales team for a custom quote?
                  </p>
                </div>
                <div className="text-xs text-slate-500 mt-1 px-1">Just now</div>
              </div>
            </div>
          </div>

          {/* Message Composer */}
          <div className="px-4 py-3 bg-white border-t border-slate-200/80 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-3 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
              />
              <button
                style={{ backgroundColor: settings.primaryColor }}
                disabled={!messageInput.trim()}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white hover:opacity-90 disabled:opacity-40 transition-all flex-shrink-0"
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            </div>
            <div className="text-xs text-slate-400 mt-2 text-center">
              Press Enter to send
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
