"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, Share, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed / running in standalone
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    setIsStandalone(isStandaloneMode);

    // Check if user dismissed prompt previously during this session
    const isDismissed = sessionStorage.getItem("pwa_prompt_dismissed") === "true";
    setDismissed(isDismissed);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIos(isIosDevice);

    // Catch Chrome/Android install prompt
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa_prompt_dismissed", "true");
  };

  // Don't display if already installed as app or dismissed
  if (isStandalone || dismissed) {
    return null;
  }

  // Show if either Android/Desktop prompt is ready OR it's iOS Safari
  if (!deferredPrompt && !isIos) {
    return null;
  }

  return (
    <aside
      aria-label="ติดตั้งแอปพลิเคชัน"
      className="fixed bottom-20 inset-x-4 z-40 mx-auto max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="rounded-2xl border border-primary/20 bg-card/95 p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded-xl shadow-sm">
              <Image
                src="/icons/icon-192.png"
                alt="DogMeal App Icon"
                width={48}
                height={48}
                className="size-full object-cover"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground">ติดตั้ง DogMeal</span>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <Sparkles className="size-2.5" /> ไว & ออฟไลน์
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                เพิ่มลงหน้าจอหลักเพื่อใช้งานสะดวกเสมือนแอปแท้
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="ปิดกล่องแนะนำ"
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {isIos ? (
          <div className="mt-3 border-t border-border/50 pt-2.5">
            {!showIosGuide ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center gap-2 rounded-xl text-xs font-medium"
                onClick={() => setShowIosGuide(true)}
              >
                <Share className="size-3.5" /> วิธีติดตั้งบน iPhone / iPad
              </Button>
            ) : (
              <div className="flex flex-col gap-1.5 text-xs text-muted-foreground bg-secondary/60 p-2.5 rounded-xl animate-in fade-in">
                <p className="font-medium text-foreground">ขั้นตอนบน Safari:</p>
                <div className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">1</span>
                  <span>แตะปุ่มแชร์ <Share className="inline size-3.5 text-foreground align-text-bottom mx-0.5" /> ที่แถบล่างสุด</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">2</span>
                  <span>เลื่อนลงแล้วเลือก <strong>&quot;เพิ่มไปยังหน้าจอโฮม&quot; (Add to Home Screen)</strong></span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              className="w-full gap-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm hover:opacity-90"
              onClick={handleInstallClick}
            >
              <Download className="size-3.5" /> ติดตั้งลงหน้าจอหลัก
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
