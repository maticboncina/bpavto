import { FC, useEffect, useState } from "react";
import { Button } from "./Button";
import { useTabContext } from "./context/TabContext";
import { http } from "./http";
import { RepublishCarContainer } from "./RepublishCarContainer";
import tw from "twin.macro";
import { PostingProgress } from "./PostingProgress";

export type ShortCarData = {
    id: number;
    make: string;
    model: string;
    shape: string;
    VIN: string;
    month: number;
    year: number;
    image: string;
};

type QueueStatus = {
    totalJobs: number;
    processingJob: string | null;
    nextJobTime: number | null;
    queuedJobs: Array<{
        id: string;
        type: 'create' | 'republish';
        scheduledFor: number;
        isRepeat?: boolean;
        repeatNumber?: number;
    }>;
};

const DateTimeInput = tw.input`outline-none border border-solid border-black p-1`;

export const PublishCarContainer: FC = () => {
    const tab = useTabContext();

    const [cars, setCars] = useState<ShortCarData[]>([]);
    const [selected, setSelected] = useState<ShortCarData | undefined>();
    const [isProcessing, setIsProcessing] = useState(false);
    const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
    const [jobMessage, setJobMessage] = useState<string>("");
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

    const [postingProgress, setPostingProgress] = useState({
        isPosting: false,
        message: '',
        step: 0,
        totalSteps: 0
    });

    const [isListeningForProgress, setIsListeningForProgress] = useState(false);

    useEffect(() => {
        http.get<{ data: { cars: ShortCarData[] } }>(`cars`)
            .then((it) => it.data.data.cars)
            .then(setCars);
    }, []);

    useEffect(() => {
        if (cars.length > 0) setSelected(cars[0]);
    }, [cars]);

    // Set default datetime to current time + 1 hour
useEffect(() => {
    const now = new Date();
    now.setHours(now.getHours());
    
    // Convert to local datetime string
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    
    const defaultDateTime = `${year}-${month}-${day}T${hours}:${minutes}`;
    setScheduledDateTime(defaultDateTime);
}, []);

    // Poll queue status every 5 seconds
    useEffect(() => {
        const pollQueueStatus = () => {
            chrome.tabs.sendMessage(tab.id!, { type: "queue_status" }, (response?: QueueStatus) => {
                if (response) {
                    setQueueStatus(response);
                }
            });
        };

        pollQueueStatus();
        const interval = setInterval(pollQueueStatus, 5000);

        return () => clearInterval(interval);
    }, [tab]);

    // Listen for progress updates
    useEffect(() => {
        const handleMessage = (message: any) => {
            if (message.type === 'posting_progress' && message.source === 'actual_posting') {
                setPostingProgress({
                    isPosting: true,
                    message: message.message,
                    step: message.step,
                    totalSteps: message.totalSteps
                });
                
                // If it's the last step, hide after a delay
                if (message.step === message.totalSteps) {
                    setTimeout(() => {
                        setPostingProgress(prev => ({ ...prev, isPosting: false }));
                    }, 2000);
                }
            }
        };

        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, []);

const publishCar = () => {
    if (!selected) return;

    setIsProcessing(true);
    setJobMessage("Preparing job...");

        http.get(`cars/${selected.id}`)
            .then((it) => it.data.data)
            .then((carData) => {
                const message: any = { 
                    type: "create", 
                    arg: {
                        spec: carData.spec,
                        images: carData.images.map((img: {
                            id: number;
                            image: string;
                            mimetype: string;
                            order_num: number;
                        }) => ({
                            mimetype: img.mimetype,
                            image: img.image
                        }))
                    }
                };

                // Add scheduled time if scheduler is enabled
                if (useScheduler && scheduledDateTime) {
                    const timestamp = new Date(scheduledDateTime).getTime();
                    message.scheduledFor = timestamp;
                    
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
                        setIsListeningForProgress(false);
                        if (response?.jobId) {
                            let scheduledText = "";
                            if (useScheduler) {
                                scheduledText = ` for ${new Date(scheduledDateTime).toLocaleString('en-GB', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false,
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric'
                                })}`;
                                if (useRepeater) {
                                    scheduledText += ` (repeating every ${repeatInterval} ${repeatUnit})`;
                                }
                            } else {
                                scheduledText = " with random delay";
                            }
                            setJobMessage(`Job queued successfully${scheduledText}!`);
                        } else if (response?.error) {
                            setJobMessage(`Error: ${response.error}`);
                        }
                    }
                );

                console.log('Car data:', carData);
                console.log('First image:', carData.images?.[0]);
                
                const images = carData.images.map((img: any) => {
                    console.log('Mapping image:', {
                        hasImages: !!img.images,
                        hasImage: !!img.image,
                        hasBase64: !!img.base64,
                        keys: Object.keys(img)
                    });
                    
                    return {
                        mimetype: img.mimetype || 'image/jpeg',
                        image: img.images || img.image || img.base64 // Try different property names
                    };
                });
                
                // Verify mapped images
                console.log('Mapped images:', images);
                console.log('First mapped image data length:', images[0]?.image?.length);
            })
            .catch((err) => {
                setIsListeningForProgress(false);
                setIsProcessing(false);
                setJobMessage("Failed to fetch car data");
                setPostingProgress({ isPosting: false, message: '', step: 0, totalSteps: 0 });                
                console.error(err);
            });
    };

    const formatTimeRemaining = (scheduledFor: number) => {
        const now = Date.now();
        const diff = scheduledFor - now;
        
        if (diff <= 0) return "Processing...";
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        if (hours > 0) return `${hours}h ${minutes}m`;
        if (minutes > 0) return `${minutes}m ${seconds}s`;
        return `${seconds}s`;
    };

    return (
        <>
            {/* Progress Modal */}
            <PostingProgress 
                isPosting={postingProgress.isPosting}
                message={postingProgress.message}
                step={postingProgress.step}
                totalSteps={postingProgress.totalSteps}
            />
            
            <div tw={"w-full flex flex-col gap-4"}>
                <RepublishCarContainer cars={cars} />

                <h3 tw={"text-lg font-semibold"}>Create new post</h3>

                {cars.length === 0 ? (
                    <p>Loading cars...</p>
                ) : (
                    <>
                        <select
                            tw={"w-full p-2 border border-black rounded"}
                            value={selected?.id}
                            onChange={(e) => setSelected(cars.find((c) => c.id === parseInt(e.target.value)))}
                        >
                            {cars.map((car) => (
                                <option key={car.id} value={car.id}>
                                    {car.make} {car.model} - {car.shape} ({car.month}/{car.year})
                                </option>
                            ))}
                        </select>

                        <div className="flex gap-2 items-center justify-between p-2 border border-solid border-neutral-600 rounded-lg bg-orange-500">
                            {selected && (
                                <img src={`data:image/png;base64,${selected.image}`} className="w-24" />
                            )}
                            <div className="flex flex-col flex-grow">
                                <span>
                                    {selected?.make} {selected?.model} - {selected?.shape}
                                </span>
                                <span className="text-neutral-800 text-sm">
                                    VIN: {selected?.VIN} ({selected?.month}/{selected?.year})
                                </span>
                            </div>
                        </div>

                        {/* Scheduler checkbox */}
                        <div tw={"flex items-center gap-2"}>
                            <input
                                type="checkbox"
                                id="useScheduler"
                                checked={useScheduler}
                                onChange={(e) => setUseScheduler(e.target.checked)}
                            />
                            <label htmlFor="useScheduler">Schedule for specific time</label>
                        </div>

                        {/* Scheduler datetime input */}
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
                                
                                {/* Repeater checkbox */}
                                <div tw={"flex items-center gap-2 mt-2"}>
                                    <input
                                        type="checkbox"
                                        id="useRepeater"
                                        checked={useRepeater}
                                        onChange={(e) => setUseRepeater(e.target.checked)}
                                    />
                                    <label htmlFor="useRepeater">Repeat posting</label>
                                </div>
                                
                                {/* Repeat interval configuration */}
                                {useRepeater && (
                                    <div tw={"flex items-center gap-2 ml-6"}>
                                        <label>Every:</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={repeatInterval}
                                            onChange={(e) => setRepeatInterval(parseInt(e.target.value) || 1)}
                                            tw={"w-16 p-1 border border-black rounded"}
                                        />
                                        <select
                                            value={repeatUnit}
                                            onChange={(e) => setRepeatUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                                            tw={"p-1 border border-black rounded"}
                                        >
                                            <option value="minutes">minutes</option>
                                            <option value="hours">hours</option>
                                            <option value="days">days</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}

                        <Button onClick={publishCar} disabled={isProcessing}>
                            {isProcessing ? "Processing..." : "Publish Car"}
                        </Button>

                        {/* Inline Progress Indicator (Alternative to modal) */}
                        {isProcessing && postingProgress.message && (
                            <div tw="flex items-center gap-2 p-3 bg-orange-100 rounded-lg border border-orange-300">
                                <div className="animate-spin h-5 w-5 border-3 border-orange-500 border-t-transparent rounded-full" />
                                <div tw="flex-1">
                                    <p tw="text-sm font-medium text-orange-800">
                                        {postingProgress.message}
                                    </p>
                                    {postingProgress.totalSteps > 0 && (
                                        <div tw="mt-1">
                                            <div tw="text-xs text-orange-600">
                                                Step {postingProgress.step} of {postingProgress.totalSteps}
                                            </div>
                                            <div tw="w-full bg-orange-200 rounded-full h-1.5 mt-1">
                                                <div 
                                                    tw="bg-orange-500 h-1.5 rounded-full transition-all duration-300"
                                                    style={{ 
                                                        width: `${(postingProgress.step / postingProgress.totalSteps) * 100}%` 
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Success/Error message */}
                        {jobMessage && !isProcessing && (
                            <p tw={"text-sm"} style={{ color: jobMessage.includes("Error") ? "red" : "green" }}>
                                {jobMessage}
                            </p>
                        )}
                    </>
                )}

                {/* Queue Status */}
                {queueStatus && queueStatus.totalJobs > 0 && (
                    <div tw={"mt-4 p-3 bg-gray-100 rounded border border-gray-300"}>
                        <h4 tw={"font-semibold mb-2"}>Queue Status ({queueStatus.totalJobs} jobs)</h4>
                        <div className="posting-queue">
                            {queueStatus.processingJob && (
                                <div tw={"bg-blue-100 p-2 rounded mb-2"}>
                                    <span tw={"font-medium"}>Processing:</span> {queueStatus.processingJob}
                                </div>
                            )}
                            {queueStatus.queuedJobs.map((job, index) => (
                                <div key={job.id} className="queue-item">
                                    <span tw={"text-sm"}>
                                        #{index + 1} - {job.type} - {formatTimeRemaining(job.scheduledFor)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};