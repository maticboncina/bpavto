import { useEffect, useState } from "react";
import { useTabContext } from "../context/TabContext";

export const useIsOwned = () => {
    const tab = useTabContext();

    const [isOwned, useIsOwned] = useState(false);

    useEffect(() => {
        chrome.tabs.sendMessage(tab.id!, { type: "is_owned" }, (resp?: boolean) => {
            if (typeof resp === "boolean") useIsOwned(resp);
        });
    }, [tab]);

    return isOwned;
};
