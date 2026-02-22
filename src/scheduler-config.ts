// scheduler-config.ts
// Configuration for the CarPostingScheduler
// Adjust these values to fine-tune anti-spam timing

export interface SchedulerConfig {
    // Base delays between posts
    MIN_DELAY: number;        // Minimum delay between posts (milliseconds)
    MAX_DELAY: number;        // Maximum delay between posts (milliseconds)
    
    // Retry configuration
    RETRY_DELAY: number;      // Base delay before retrying failed jobs (milliseconds)
    MAX_ATTEMPTS: number;     // Maximum retry attempts per job
    
    // Timing variations
    RANDOMIZATION_FACTOR: number;  // How much to randomize delays (0.0 - 1.0)
    QUEUE_SCALING_FACTOR: number;  // How much to increase delay per queued job (milliseconds)
    
    // Safety delays
    DELETE_TO_CREATE_DELAY: number;  // Delay between delete and create in republish (milliseconds)
    STARTUP_DELAY: number;           // Initial delay before processing first job (milliseconds)
    
    // Anti-detection features
    ENABLE_SMART_SPACING: boolean;    // Spread posts more during peak hours
    ENABLE_WEEKEND_MODE: boolean;     // Different timing on weekends
    PEAK_HOURS_MULTIPLIER: number;    // Multiply delays during peak hours (9-17)
    WEEKEND_MULTIPLIER: number;       // Multiply delays on weekends
}

// Default configuration - Safe and conservative timing
export const DEFAULT_CONFIG: SchedulerConfig = {
    // Conservative timing: 45 seconds to 3 minutes between posts
    MIN_DELAY: 45000,           // 45 seconds
    MAX_DELAY: 180000,          // 3 minutes
    
    // Retry failed jobs after 5+ minutes
    RETRY_DELAY: 300000,        // 5 minutes
    MAX_ATTEMPTS: 3,            // Try up to 3 times
    
    // Add randomness to appear human-like
    RANDOMIZATION_FACTOR: 0.3,  // ±30% variation
    QUEUE_SCALING_FACTOR: 10000, // +10 seconds per queued job
    
    // Safety delays
    DELETE_TO_CREATE_DELAY: 5000,  // 5 seconds between delete/create
    STARTUP_DELAY: 5000,           // 5 seconds before first job
    
    // Smart timing features
    ENABLE_SMART_SPACING: true,
    ENABLE_WEEKEND_MODE: true,
    PEAK_HOURS_MULTIPLIER: 1.5,    // 50% longer delays during peak hours
    WEEKEND_MULTIPLIER: 0.8        // 20% shorter delays on weekends
};

// Alternative configurations for different scenarios

// AGGRESSIVE - For testing or when you need faster posting
export const AGGRESSIVE_CONFIG: SchedulerConfig = {
    MIN_DELAY: 20000,          // 20 seconds
    MAX_DELAY: 60000,          // 1 minute
    RETRY_DELAY: 120000,       // 2 minutes
    MAX_ATTEMPTS: 2,
    RANDOMIZATION_FACTOR: 0.2,
    QUEUE_SCALING_FACTOR: 5000,
    DELETE_TO_CREATE_DELAY: 3000,
    STARTUP_DELAY: 2000,
    ENABLE_SMART_SPACING: false,
    ENABLE_WEEKEND_MODE: false,
    PEAK_HOURS_MULTIPLIER: 1.0,
    WEEKEND_MULTIPLIER: 1.0
};

// ULTRA_SAFE - For when anti-spam is very aggressive
export const ULTRA_SAFE_CONFIG: SchedulerConfig = {
    MIN_DELAY: 120000,         // 2 minutes
    MAX_DELAY: 600000,         // 10 minutes
    RETRY_DELAY: 900000,       // 15 minutes
    MAX_ATTEMPTS: 5,
    RANDOMIZATION_FACTOR: 0.5,
    QUEUE_SCALING_FACTOR: 30000,
    DELETE_TO_CREATE_DELAY: 15000,
    STARTUP_DELAY: 10000,
    ENABLE_SMART_SPACING: true,
    ENABLE_WEEKEND_MODE: true,
    PEAK_HOURS_MULTIPLIER: 2.0,
    WEEKEND_MULTIPLIER: 0.6
};

// NIGHT_MODE - Optimized for posting during low-traffic hours
export const NIGHT_MODE_CONFIG: SchedulerConfig = {
    MIN_DELAY: 30000,          // 30 seconds
    MAX_DELAY: 90000,          // 1.5 minutes
    RETRY_DELAY: 180000,       // 3 minutes
    MAX_ATTEMPTS: 3,
    RANDOMIZATION_FACTOR: 0.4,
    QUEUE_SCALING_FACTOR: 8000,
    DELETE_TO_CREATE_DELAY: 4000,
    STARTUP_DELAY: 3000,
    ENABLE_SMART_SPACING: false,
    ENABLE_WEEKEND_MODE: false,
    PEAK_HOURS_MULTIPLIER: 1.0,
    WEEKEND_MULTIPLIER: 1.0
};

// Helper functions for dynamic timing adjustments
export class TimingHelper {
    static isWeekend(): boolean {
        const day = new Date().getDay();
        return day === 0 || day === 6; // Sunday = 0, Saturday = 6
    }
    
    static isPeakHours(): boolean {
        const hour = new Date().getHours();
        return hour >= 9 && hour <= 17; // 9 AM to 5 PM
    }
    
    static isNightTime(): boolean {
        const hour = new Date().getHours();
        return hour >= 22 || hour <= 6; // 10 PM to 6 AM
    }
    
    static calculateSmartDelay(baseDelay: number, config: SchedulerConfig): number {
        let multiplier = 1.0;
        
        if (config.ENABLE_SMART_SPACING && this.isPeakHours()) {
            multiplier *= config.PEAK_HOURS_MULTIPLIER;
        }
        
        if (config.ENABLE_WEEKEND_MODE && this.isWeekend()) {
            multiplier *= config.WEEKEND_MULTIPLIER;
        }
        
        return Math.floor(baseDelay * multiplier);
    }
    
    static getRecommendedConfig(): SchedulerConfig {
        // Night time - less aggressive anti-spam
        if (this.isNightTime()) {
            return NIGHT_MODE_CONFIG;
        }
        
        // Peak hours - be more careful
        if (this.isPeakHours()) {
            return ULTRA_SAFE_CONFIG;
        }
        
        // Default for other times
        return DEFAULT_CONFIG;
    }
}

// Configuration storage for runtime adjustments
export class ConfigManager {
    private static STORAGE_KEY = 'avtonet_scheduler_config';
    
    static async saveConfig(config: SchedulerConfig): Promise<void> {
        await chrome.storage.local.set({ [this.STORAGE_KEY]: config });
    }
    
    static async loadConfig(): Promise<SchedulerConfig> {
        const result = await chrome.storage.local.get(this.STORAGE_KEY);
        return result[this.STORAGE_KEY] || DEFAULT_CONFIG;
    }
    
    static async resetToDefault(): Promise<void> {
        await this.saveConfig(DEFAULT_CONFIG);
    }
}

// Example usage:
// const config = await ConfigManager.loadConfig();
// const scheduler = new CarPostingScheduler(config);

// Or use a recommended config based on time:
// const smartConfig = TimingHelper.getRecommendedConfig();
// const scheduler = new CarPostingScheduler(smartConfig);