import { useEffect, useState } from "react";

export const useIsLoggedIn = (tab: chrome.tabs.Tab | undefined) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        if (!tab || !tab.id) return;

        // Add a small delay to ensure content script is loaded
        const checkLogin = () => {
            chrome.tabs.sendMessage(tab.id!, { type: "is_logged_in" }, (resp?: boolean) => {
                // Handle Chrome extension errors gracefully
                if (chrome.runtime.lastError) {
                    console.log("Chrome runtime error:", chrome.runtime.lastError.message);
                    return;
                }
                
                console.log("[useIsLoggedIn] Response from content script:", resp);
                
                if (typeof resp === "boolean") {
                    setIsLoggedIn(resp);
                }
            });
        };

        // Check immediately
        checkLogin();
        
        // Also check after a short delay (in case content script is still loading)
        const timeoutId = setTimeout(checkLogin, 1000);
        
        return () => clearTimeout(timeoutId);
    }, [tab?.id, tab?.url]); // Re-run when tab changes

    return isLoggedIn;
};