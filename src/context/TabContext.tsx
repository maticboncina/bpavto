import { createContext, useContext } from "react";

export const TabContext = createContext<chrome.tabs.Tab | null>(null);

export const useTabContext = () => {
    const value = useContext(TabContext);

    if (value === null) throw new Error("useTabContext used outside of provider");

    return value;
};
