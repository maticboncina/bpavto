import { useEffect, useState } from "react";

export const useInterval = (interval: number, fn: () => void) => {
    const [intervalId, setIntervalId] = useState<NodeJS.Timeout | undefined>();

    useEffect(() => {
        if (intervalId) clearInterval(intervalId);

        const i = setInterval(fn, interval);
        setIntervalId(i);

        return () => {
            if (intervalId) clearInterval(intervalId);

            clearInterval(i);
        };
    }, [interval, fn]);
};
