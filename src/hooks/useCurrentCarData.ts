import { useEffect, useState } from "react";
import { useTabContext } from "../context/TabContext";

type OnPageCarData = {
    make_model: string;
    shape: string;
    month: number;
    year: number;
};

export const useCurrentCarData = () => {
    const tab = useTabContext();

    const [onPageCarData, setOnPageCarData] = useState<OnPageCarData | undefined>();

    useEffect(() => {
        chrome.tabs.sendMessage(tab.id!, { type: "current_car_data" }, (resp?: OnPageCarData) => {
            if (typeof resp !== "object") return;

            setOnPageCarData(resp);
        });
    }, [tab]);

    return onPageCarData;
};
