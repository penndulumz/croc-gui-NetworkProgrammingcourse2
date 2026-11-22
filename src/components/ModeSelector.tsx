import { useState, useEffect } from "react";
import { ShieldCheck, Layers, Info, X, Zap } from "lucide-react";
import type { Locale } from "../lib/i18n";

export interface ModeSelectorProps {
  mode: "standard" | "enhanced";
  onChangeMode: (mode: "standard" | "enhanced") => void;
  disabled?: boolean;
  locale?: Locale;
}

export function ModeSelector({
  mode,
  onChangeMode,
  disabled = false,
  locale = "vi",
}: ModeSelectorProps) {
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showInfo) {
        setShowInfo(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showInfo]);

  const isVi = locale === "vi";

  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      {/* Segmented Control */}
      <div
        role="tablist"
        aria-label={isVi ? "Chế độ giao thức" : "Protocol mode"}
        className="inline-flex items-center rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/60"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "standard"}
          disabled={disabled}
          onClick={() => onChangeMode("standard")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            mode === "standard"
              ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{isVi ? "Chuẩn Croc v11" : "Standard (Croc v11)"}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "enhanced"}
          disabled={disabled}
          onClick={() => onChangeMode("enhanced")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
            mode === "enhanced"
              ? "bg-white text-zinc-900 shadow-xs dark:bg-zinc-900 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <Layers className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>{isVi ? "Turbo (Dual-Relay)" : "Turbo (Dual-Relay)"}</span>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-300">
            <Zap className="h-2.5 w-2.5" />
            2x
          </span>
        </button>
      </div>

      {/* Info popover button */}
      <button
        type="button"
        onClick={() => setShowInfo(true)}
        aria-label={isVi ? "So sánh hai chế độ truyền" : "Compare protocol modes"}
        title={isVi ? "So sánh hai chế độ truyền" : "Compare protocol modes"}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Protocol Mode Comparison Modal */}
      {showInfo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mode-comparison-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h2
                id="mode-comparison-title"
                className="text-base font-bold text-zinc-900 dark:text-zinc-100"
              >
                {isVi ? "So Sánh Hai Chế Độ Truyền" : "Transfer Protocol Comparison"}
              </h2>
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                aria-label={isVi ? "Đóng" : "Close"}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-zinc-600 dark:text-zinc-300">
              {/* Standard Croc v11 */}
              <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                <div className="flex items-center gap-2 font-semibold text-zinc-900 dark:text-zinc-100">
                  <ShieldCheck className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                  <span>{isVi ? "Chuẩn Croc v11 (CLI Compatible)" : "Standard Croc v11 (CLI Compatible)"}</span>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-4 leading-relaxed text-zinc-600 dark:text-zinc-400">
                  <li>
                    {isVi
                      ? "Tương thích 100% với croc CLI chính thức và getcroc.com."
                      : "100% interoperable with official croc CLI and getcroc.com."}
                  </li>
                  <li>
                    {isVi
                      ? "Bắt tay mật mã PAKE P-256 + mã hóa đối xứng AES-GCM qua một luồng duy nhất."
                      : "PAKE P-256 cryptographic handshake + AES-GCM single stream."}
                  </li>
                  <li>
                    {isVi
                      ? "Phù hợp khi gửi/nhận với máy chủ dòng lệnh hoặc thiết bị không cài CrocFlow."
                      : "Ideal for terminal users or systems running the upstream Go CLI."}
                  </li>
                </ul>
              </div>

              {/* Turbo Dual-Relay */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/40 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200">
                  <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{isVi ? "Turbo CrocFlow (Dual-Relay + Resume)" : "Turbo CrocFlow (Dual-Relay + Resume)"}</span>
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-4 leading-relaxed text-emerald-800 dark:text-emerald-300">
                  <li>
                    {isVi
                      ? "Truyền song song 2 Relay: Chunk chẵn qua Relay Alpha, chunk lẻ qua Relay Beta để tối đa băng thông."
                      : "Concurrent Dual-Relay: Even chunks on Lane Alpha, odd chunks on Lane Beta for 2x bandwidth."}
                  </li>
                  <li>
                    {isVi
                      ? "Tự động Failover: Khi Relay Alpha ngắt kết nối, các chunk còn lại lập tức chuyển sang Beta."
                      : "Active Failover: If Lane Alpha disconnects, in-flight chunks dynamically migrate to Lane Beta."}
                  </li>
                  <li>
                    {isVi
                      ? "Tiếp tục từ Resume Cache IndexedDB: Bỏ qua các chunk SHA-256 đã nhận khi mạng bị đứt."
                      : "Delta Resume via IndexedDB: Skips verified SHA-256 chunks after reconnecting."}
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfo(false)}
                className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {isVi ? "Đã hiểu" : "Got it"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
