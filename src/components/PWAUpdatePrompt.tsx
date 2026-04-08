import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";

/**
 * Handles the full PWA update lifecycle:
 *
 * 1. Registers the service worker via vite-plugin-pwa's virtual module.
 * 2. Adds an `updatefound` listener so the browser logs (and could act on)
 *    the moment a new SW starts installing.
 * 3. Polls for a new service worker every hour — essential for long-lived
 *    sessions where no navigation would otherwise trigger an update check.
 * 4. When a new SW finishes installing (enters the "waiting" state), shows
 *    a Sonner toast prompting the user to reload.
 * 5. On "Reload": posts SKIP_WAITING to the waiting SW so it calls
 *    self.skipWaiting() and becomes active. The library then listens for
 *    the resulting `controllerchange` event and calls window.location.reload().
 *
 * Renders nothing — it is a pure side-effect component.
 */
export default function PWAUpdatePrompt() {
  // Tracks whether we've already shown a toast for the current pending update
  // so repeated renders don't spawn duplicate toasts.
  const toastIdRef = useRef<string | number | null>(null);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    /**
     * Called once the SW has been successfully registered.
     * We use the registration handle to:
     *   - attach an `updatefound` listener (satisfies the requirement for
     *     detecting new SW installs at the registration level), and
     *   - schedule hourly update checks via registration.update().
     */
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;

      // Log (or act on) each new SW that starts downloading.
      registration.addEventListener("updatefound", () => {
        const incoming = registration.installing;
        if (!incoming) return;
        console.info("[PWA] New service worker installing…", incoming);
      });

      // Force an update check every hour so the user gets notified
      // even if they leave the tab open all day without navigating.
      const ONE_HOUR = 60 * 60 * 1000;
      setInterval(() => {
        registration.update().catch((err) => {
          console.warn("[PWA] Update check failed:", err);
        });
      }, ONE_HOUR);
    },

    onRegisterError(error) {
      console.error("[PWA] Service worker registration failed:", error);
    },
  });

  // Show / dismiss the update toast whenever the needRefresh flag changes.
  useEffect(() => {
    if (needRefresh && toastIdRef.current === null) {
      // New version is sitting in the "waiting" state — prompt the user.
      toastIdRef.current = toast("Update available", {
        description: "A new version of Advance is ready.",
        duration: Infinity, // Stay until the user acts.
        action: {
          label: "Reload",
          onClick: () => {
            // Posts SKIP_WAITING → SW calls self.skipWaiting() → becomes
            // active → controllerchange fires → library calls location.reload().
            updateServiceWorker(true);
          },
        },
        cancel: {
          label: "Later",
          onClick: () => {
            setNeedRefresh(false);
          },
        },
        onDismiss: () => {
          toastIdRef.current = null;
          setNeedRefresh(false);
        },
      });
    }

    if (!needRefresh && toastIdRef.current !== null) {
      // Update was dismissed — clean up the ref so next update works.
      toast.dismiss(toastIdRef.current);
      toastIdRef.current = null;
    }
  }, [needRefresh, updateServiceWorker, setNeedRefresh]);

  return null;
}
