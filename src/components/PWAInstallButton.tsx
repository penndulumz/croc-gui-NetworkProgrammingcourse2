import { useState } from "react";
import { Download, Share, X, CheckCircle2, WifiOff } from "lucide-react";
import { usePWAInstall, useOnlineStatus } from "../hooks/usePWAInstall";

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { canInstall, isInstalled, isIOS, promptInstall } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    if (compact) return null;
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        Đã cài đặt ứng dụng
      </span>
    );
  }

  const handleClick = async () => {
    if (canInstall) {
      await promptInstall();
    } else {
      setShowGuideModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-label="Cài đặt ứng dụng CrocFlow"
        className={`inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 shadow-xs transition-all ${
          compact ? "px-2.5" : "px-3.5"
        }`}
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{compact ? "Cài App" : "Cài ứng dụng (PWA)"}</span>
      </button>

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Hướng dẫn cài đặt ứng dụng CrocFlow"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Cài đặt CrocFlow lên thiết bị
                </h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Chạy độc lập như ứng dụng Android/Desktop, không cần mở trình duyệt.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Đóng hộp thoại cài đặt"
                className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    01.
                  </span>
                  <span>
                    Nhấn biểu tượng <Share className="mx-1 inline h-4 w-4" aria-hidden="true" />{" "}
                    <strong>Chia sẻ (Share)</strong> ở thanh công cụ Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    02.
                  </span>
                  <span>
                    Chọn <strong>Thêm vào Màn hình chính (Add to Home Screen)</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    03.
                  </span>
                  <span>Nhấn <strong>Thêm</strong> để mở CrocFlow toàn màn hình.</span>
                </li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    01.
                  </span>
                  <span>
                    <strong>Trên Android (Chrome):</strong> Mở menu ⋮ góc trên phải → chọn{" "}
                    <strong>Cài đặt ứng dụng / Thêm vào màn hình chính</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    02.
                  </span>
                  <span>
                    <strong>Trên Máy tính (Chrome / Edge):</strong> Nhấn biểu tượng cài đặt ở thanh địa chỉ → chọn <strong>Install CrocFlow</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    03.
                  </span>
                  <span>
                    Hoặc tải file <strong>.apk / .exe / .dmg</strong> tự động build từ GitHub Actions ở mục <strong>Tải App & Tài liệu</strong>.
                  </span>
                </li>
              </ol>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="min-h-[38px] rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white shadow-xs transition-all"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-900 shadow-lg md:bottom-5 dark:border-amber-400/30 dark:bg-amber-950 dark:text-amber-200"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Đang ngoại tuyến — Tài liệu, Lịch sử và Resume Cache vẫn sẵn sàng.</span>
    </div>
  );
}
