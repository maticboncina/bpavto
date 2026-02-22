import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type StateType = {
    portalUrl: string;
    accessToken: string;
    setPortalUrl: (url: string) => void;
    setAccessToken: (accessToken: string) => void;
};

export const useChromeState = create(
    persist<StateType>(
        (set) => ({
            portalUrl: "https://portal.bpavto.si",
            accessToken: "",
            setPortalUrl: (url: string) => set({ portalUrl: url }),
            setAccessToken: (accessToken: string) => set({ accessToken: accessToken }),
        }),
        {
            storage: createJSONStorage(() => ({
                getItem: async (name) => {
                    return chrome.storage.local.get(name).then((it) => it[name]);
                },
                setItem: (name, value) => {
                    return chrome.storage.local.set({ [name]: value });
                },
                removeItem: (name) => {
                    return chrome.storage.local.remove(name);
                },
            })),
            name: "@avtonet-helper/settings",
        }
    )
);