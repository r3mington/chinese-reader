import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

function ReloadPrompt() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW Registered', r);
        },
        onRegisterError(error) {
            console.error('SW registration error', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    if (!offlineReady && !needRefresh) return null;

    return (
        <div className="pwa-toast-container">
            <div className="pwa-toast">
                <div className="pwa-toast-message">
                    {offlineReady ? (
                        <span>App ready to work offline</span>
                    ) : (
                        <span>New content available, click on reload button to update.</span>
                    )}
                </div>
                <div className="pwa-toast-buttons">
                    {needRefresh && (
                        <button className="pwa-toast-btn" onClick={() => updateServiceWorker(true)}>
                            Reload
                        </button>
                    )}
                    <button className="pwa-toast-btn outline" onClick={() => close()}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ReloadPrompt;
