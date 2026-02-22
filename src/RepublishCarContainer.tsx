import { FC, useEffect, useMemo, useState } from "react";
import { useTabContext } from "./context/TabContext";
import { Button } from "./Button";
import { useIsOwned } from "./hooks/useIsOwned";
import { ShortCarData } from "./PublishCarContainer";
import { useCurrentCarData } from "./hooks/useCurrentCarData";
import { http } from "./http";
import tw from "twin.macro";

// Moved from DeleteButton.tsx
export const AD_PAGE_REGEX = /details\.asp\?id=(\d+)/;

const DateTimeInput = tw.input`outline-none border border-solid border-black p-1`;

export const RepublishCarContainer: FC<{ cars: ShortCarData[] }> = ({ cars }) => {
    const tab = useTabContext();

    const isOwned = useIsOwned();

    const [match, setMatch] = useState<ShortCarData | undefined>();

    const currentCarData = useCurrentCarData();

    const [isProcessing, setIsProcessing] = useState(false);
    const [jobMessage, setJobMessage] = useState<string>("");
    const [lastJobId, setLastJobId] = useState<string | null>(null);
    const [useScheduler, setUseScheduler] = useState(false);
    const [scheduledDateTime, setScheduledDateTime] = useState<string>("");
    const [useRepeater, setUseRepeater] = useState(false);
    const [repeatInterval, setRepeatInterval] = useState<number>(6);
    const [repeatUnit, setRepeatUnit] = useState<'minutes' | 'hours' | 'days'>('hours');

    const getRepeatIntervalMs = (): number => {
        let multiplier: number;
        switch (repeatUnit) {
            case 'minutes':
                multiplier = 1000 * 60;
                break;
            case 'hours':
                multiplier = 1000 * 60 * 60;
                break;
            case 'days':
                multiplier = 1000 * 60 * 60 * 24;
                break;
        }
        return repeatInterval * multiplier;
    };

    useEffect(() => {
        if (!currentCarData) return;

        setMatch(
            cars.find(
                (car) =>
                    `${car.make} ${car.model}` === currentCarData.make_model &&
                    car.shape === currentCarData.shape &&
                    car.month === currentCarData.month &&
                    car.year === currentCarData.year
            )
        );
    }, [cars, currentCarData]);

    // Set default datetime to current time + 1 hour
    useEffect(() => {
        const now = new Date();
        now.setHours(now.getHours() + 1);
        const defaultDateTime = now.toISOString().slice(0, 16);
        setScheduledDateTime(defaultDateTime);
    }, []);

    const shouldShow = useMemo(() => {
        return AD_PAGE_REGEX.test(tab.url!) && isOwned && !!match;
    }, [tab, isOwned, match]);

    const republishCar= () => {
        if (!match) return;

        setIsProcessing(true);
        setJobMessage("Preparing republish job...");

        const id = tab.url!.match(AD_PAGE_REGEX)![1];
        http.get(`cars/${match.id}`)
            .then((it) => it.data.data)
            .then((carData) => {
                const message: any = { 
                    type: "republish", 
                    arg: { id: id, ...carData } 
                };

                // Add scheduled time if scheduler is enabled
                if (useScheduler && scheduledDateTime) {
                    message.scheduledFor = new Date(scheduledDateTime).getTime();
                    
                    // Add repeat configuration if enabled
                    if (useRepeater) {
                        message.repeatConfig = {
                            enabled: true,
                            intervalMs: getRepeatIntervalMs(),
                            interval: repeatInterval,
                            unit: repeatUnit
                        };
                    }
                }

                chrome.tabs.sendMessage(
                    tab.id!,
                    message,
                    (response: any) => {
                        setIsProcessing(false);
                        if (response?.jobId) {
                            setLastJobId(response.jobId);
                            const scheduledText = useScheduler 
                                ? ` for ${new Date(scheduledDateTime).toLocaleString('en-GB', { 
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false,
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                })}`
                                : " with random delay";
                            setJobMessage(`Republish job queued successfully${scheduledText}!`);
                        } else if (response?.error) {
                            setJobMessage(`Error: ${response.error}`);
                        }
                    }
                );
            })
            .catch((err) => {
                setIsProcessing(false);
                setJobMessage("Failed to republish");
                console.error(err);
            });
    };

    if (!shouldShow) return null;

    return (
        <div tw={"w-full flex flex-col gap-2 p-3 bg-yellow-50 rounded border border-yellow-300"}>
            <h4 tw={"font-semibold"}>Republish Current Car</h4>
            <p tw={"text-sm text-gray-600"}>
                Detected: {currentCarData?.make_model} ({currentCarData?.month}/{currentCarData?.year})
            </p>

            <div tw={"flex items-center gap-2"}>
                <input
                    type="checkbox"
                    id="useSchedulerRepublish"
                    checked={useScheduler}
                    onChange={(e) => setUseScheduler(e.target.checked)}
                />
                <label htmlFor="useSchedulerRepublish">Schedule for specific time</label>
            </div>

            {useScheduler && (
                <div tw={"flex flex-col gap-2"}>
                    <label htmlFor="scheduledDateTime">Schedule for:</label>
                    <DateTimeInput
                        type="datetime-local"
                        id="scheduledDateTime"
                        value={scheduledDateTime}
                        onChange={(e) => setScheduledDateTime(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                    />
                    
                    {/* Repeater Section */}
                    <div tw={"flex items-center gap-2 mt-2"}>
                        <input
                            type="checkbox"
                            id="useRepeater"
                            checked={useRepeater}
                            onChange={(e) => setUseRepeater(e.target.checked)}
                        />
                        <label htmlFor="useRepeater">Repeat posting</label>
                    </div>
                    
                    {useRepeater && (
                        <div tw={"flex gap-2 items-center"}>
                            <span>Repeat every</span>
                            <input
                                type="number"
                                min="1"
                                max="999"
                                value={repeatInterval}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value) || 1;
                                    setRepeatInterval(Math.max(1, Math.min(999, value)));
                                }}
                                tw={"w-16 border border-black p-1 rounded"}
                            />
                            <select
                                value={repeatUnit}
                                onChange={(e) => setRepeatUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                                tw={"border border-black p-1 rounded"}
                            >
                                <option value="minutes">minutes</option>
                                <option value="hours">hours</option>
                                <option value="days">days</option>
                            </select>
                        </div>
                    )}
                </div>
            )}

            <Button onClick={republishCar} disabled={isProcessing}>
                {isProcessing ? "Processing..." : "Republish Car"}
            </Button>

            {jobMessage && (
                <p tw={"text-sm mt-2"} style={{ color: jobMessage.includes("Error") ? "red" : "green" }}>
                    {jobMessage}
                </p>
            )}
        </div>
    );
};