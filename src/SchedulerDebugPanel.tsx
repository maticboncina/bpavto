import { FC, useEffect, useState } from "react";
import { useTabContext } from "./context/TabContext";
import { Button } from "./Button";

type QueueStatus = {
    totalJobs: number;
    processingJob: string | null;
    nextJobTime: number | null;
    queuedJobs: Array<{id: string, type: 'create' | 'republish', scheduledFor: number}>;
};

type ConfigPreset = {
    name: string;
    description: string;
    minDelay: number;
    maxDelay: number;
    retryDelay: number;
};

const CONFIG_PRESETS: ConfigPreset[] = [
    {
        name: "Default",
        description: "Safe random timing (8-15m)",
        minDelay: 480000,
        maxDelay: 900000,
        retryDelay: 600000
    },
    {
        name: "Testing", 
        description: "Fast for development (10-30s)",
        minDelay: 10000,
        maxDelay: 30000,
        retryDelay: 15000
    },
    {
        name: "Aggressive",
        description: "Faster but safe (5-10m)",
        minDelay: 300000,
        maxDelay: 600000,
        retryDelay: 400000
    },
    {
        name: "Ultra Safe",
        description: "Very conservative (15-25m)",
        minDelay: 900000,
        maxDelay: 1500000,
        retryDelay: 1200000
    }
];

export const SchedulerDebugPanel: FC = () => {
    const tab = useTabContext();
    const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState<string>("Default");
    const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

    const pollQueueStatus = () => {
        chrome.tabs.sendMessage(tab.id!, { type: "queue_status" }, (response?: QueueStatus) => {
            if (response) {
                setQueueStatus(response);
            }
        });
    };

    useEffect(() => {
        if (isExpanded) {
            // Poll more frequently when debug panel is open
            pollQueueStatus();
            const interval = setInterval(pollQueueStatus, 2000);
            setRefreshInterval(interval);
            
            return () => {
                if (interval) clearInterval(interval);
            };
        } else {
            if (refreshInterval) {
                clearInterval(refreshInterval);
                setRefreshInterval(null);
            }
        }
    }, [isExpanded, tab.id]);

    const formatDuration = (ms: number): string => {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
        if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
        return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
    };

    const formatTimestamp = (timestamp: number): string => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    };

    const getTimeUntil = (timestamp: number): string => {
        const now = Date.now();
        const diff = timestamp - now;
        
        if (diff <= 0) return "Now";
        return formatDuration(diff);
    };

    const applyPreset = (preset: ConfigPreset) => {
        // Send configuration update to content script
        chrome.tabs.sendMessage(tab.id!, { 
            type: "update_config", 
            arg: {
                MIN_DELAY: preset.minDelay,
                MAX_DELAY: preset.maxDelay,
                RETRY_DELAY: preset.retryDelay
            }
        });
        
        setSelectedPreset(preset.name);
        alert(`Applied ${preset.name} configuration`);
    };

    const clearQueue = () => {
        if (confirm("Are you sure you want to clear all queued jobs?")) {
            chrome.tabs.sendMessage(tab.id!, { type: "clear_queue" });
            pollQueueStatus();
        }
    };

    if (!isExpanded) {
        return (
            <div className="w-full p-2 bg-neutral-800 text-white rounded-lg">
                <button 
                    onClick={() => setIsExpanded(true)}
                    className="w-full text-left text-sm hover:bg-neutral-700 p-1 rounded"
                >
                    🔧 Scheduler Debug Panel
                    {queueStatus && queueStatus.totalJobs > 0 && (
                        <span className="float-right bg-orange-500 text-white px-2 py-0.5 rounded-full text-xs">
                            {queueStatus.totalJobs}
                        </span>
                    )}
                </button>
            </div>
        );
    }

    return (
        <div className="w-full p-3 bg-neutral-800 text-white rounded-lg space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">🔧 Scheduler Debug Panel</h3>
                <button 
                    onClick={() => setIsExpanded(false)}
                    className="text-neutral-400 hover:text-white text-xl"
                >
                    ×
                </button>
            </div>

            {/* Queue Status */}
            <div className="bg-neutral-700 p-3 rounded">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">Queue Status</h4>
                    <button 
                        onClick={pollQueueStatus}
                        className="text-xs bg-neutral-600 hover:bg-neutral-500 px-2 py-1 rounded"
                    >
                        Refresh
                    </button>
                </div>
                
                {queueStatus ? (
                    <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                            <div>Total Jobs: <span className="font-mono">{queueStatus.totalJobs}</span></div>
                            <div>Processing: <span className="font-mono">{queueStatus.processingJob ? "Yes" : "No"}</span></div>
                        </div>
                        
                        {queueStatus.nextJobTime && (
                            <div>
                                Next Job: <span className="font-mono">{formatTimestamp(queueStatus.nextJobTime)}</span>
                                <span className="text-orange-300 ml-2">({getTimeUntil(queueStatus.nextJobTime)})</span>
                            </div>
                        )}
                        
                        {queueStatus.processingJob && (
                            <div className="flex items-center gap-2 text-yellow-300">
                                <div className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse"></div>
                                Processing: {queueStatus.processingJob}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-neutral-400">No status available</div>
                )}
            </div>

            {/* Queued Jobs Details */}
            {queueStatus && queueStatus.queuedJobs.length > 0 && (
                <div className="bg-neutral-700 p-3 rounded">
                    <h4 className="font-semibold mb-2">Queued Jobs</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                        {queueStatus.queuedJobs.map((job, index) => (
                            <div key={job.id} className="text-xs bg-neutral-600 p-2 rounded flex justify-between">
                                <span>
                                    #{index + 1} {job.type} 
                                    <span className="text-neutral-300 ml-1">({job.id.split('_').pop()})</span>
                                </span>
                                <span className="text-orange-300">
                                    {formatTimestamp(job.scheduledFor)} ({getTimeUntil(job.scheduledFor)})
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Configuration Presets */}
            <div className="bg-neutral-700 p-3 rounded">
                <h4 className="font-semibold mb-2">Configuration Presets</h4>
                <div className="space-y-2">
                    {CONFIG_PRESETS.map((preset) => (
                        <div key={preset.name} className="flex items-center justify-between">
                            <div className="flex-1">
                                <div className="font-medium text-sm">{preset.name}</div>
                                <div className="text-xs text-neutral-300">{preset.description}</div>
                            </div>
                            <button
                                onClick={() => applyPreset(preset)}
                                className={`text-xs px-3 py-1 rounded ${
                                    selectedPreset === preset.name 
                                        ? 'bg-orange-500 text-white' 
                                        : 'bg-neutral-600 hover:bg-neutral-500 text-neutral-200'
                                }`}
                            >
                                {selectedPreset === preset.name ? 'Active' : 'Apply'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Actions */}
            <div className="bg-neutral-700 p-3 rounded">
                <h4 className="font-semibold mb-2">Actions</h4>
                <div className="flex gap-2">
                    <button
                        onClick={clearQueue}
                        className="text-xs bg-red-600 hover:bg-red-500 px-3 py-1 rounded"
                        disabled={!queueStatus || queueStatus.totalJobs === 0}
                    >
                        Clear Queue
                    </button>
                    <button
                        onClick={() => {
                            chrome.tabs.sendMessage(tab.id!, { type: "force_process_next" });
                            setTimeout(pollQueueStatus, 1000);
                        }}
                        className="text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded"
                        disabled={!queueStatus || queueStatus.totalJobs === 0}
                    >
                        Force Next
                    </button>
                </div>
            </div>

            {/* Runtime Info */}
            <div className="bg-neutral-700 p-3 rounded text-xs">
                <h4 className="font-semibold mb-1">Runtime Info</h4>
                <div className="text-neutral-300 space-y-1">
                    <div>Current Time: {new Date().toLocaleTimeString()}</div>
                    <div>Peak Hours: {new Date().getHours() >= 9 && new Date().getHours() <= 17 ? "Yes" : "No"}</div>
                    <div>Weekend: {[0, 6].includes(new Date().getDay()) ? "Yes" : "No"}</div>
                </div>
            </div>
        </div>
    );
};