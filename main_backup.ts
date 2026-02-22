// main.ts - Updated with human-like delays and delete functionality removed

// Basic utility functions

const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

interface RepeatConfig {
    enabled: boolean;
    intervalMs: number;
    interval: number;
    unit: 'hours' | 'days';
}

// Job Queue System for Anti-Spam Protection
type JobType = 'create' | 'republish';

type Job = {
    id: string;
    type: JobType;
    data: {
        spec: Car;
        images: ImageDescriptor[];
        deleteId?: string;
        repeatConfig?: RepeatConfig;
    };
    attempts: number;
    maxAttempts: number;
    createdAt: number;
    scheduledFor: number;
};

type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'retrying';

class CarPostingScheduler {
    private queue: Job[] = [];
    private isProcessing: boolean = false;
    private currentJob: Job | null = null;
    private statusCallbacks: Map<string, (status: JobStatus, message?: string) => void> = new Map();
    
    // Configuration - spacing between posts (not human delays)
    private readonly MIN_DELAY = 45000; // 45 seconds minimum between posts
    private readonly MAX_DELAY = 180000; // 3 minutes maximum between posts
    private readonly RETRY_DELAY = 300000; // 5 minutes for retries
    private readonly MAX_ATTEMPTS = 3;

    constructor() {
        // Start processing when scheduler is created
        this.startProcessing();
    }

    /**
     * Add a user-scheduled job with exact time (no delays added)
     */
    addScheduledJob(type: JobType, data: Job['data'], scheduledFor: number, callback?: (status: JobStatus, message?: string) => void): string {
        const jobId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const now = Date.now();
        
        // Validate scheduled time
        if (!scheduledFor || scheduledFor <= now) {
            console.error(`[Scheduler] Invalid scheduled time: ${scheduledFor}. Must be in the future.`);
            throw new Error('Scheduled time must be in the future');
        }
        
        console.log(`[Scheduler] Creating USER-SCHEDULED job ${jobId}`);
        console.log(`[Scheduler] Scheduled for EXACT time: ${new Date(scheduledFor).toLocaleString()}`);
        
        const job: Job = {
            id: jobId,
            type,
            data,
            attempts: 0,
            maxAttempts: this.MAX_ATTEMPTS,
            createdAt: now,
            scheduledFor: scheduledFor
        };

        // Insert job in queue sorted by scheduledFor time
        this.insertJobSorted(job);
        
        if (callback) {
            this.statusCallbacks.set(jobId, callback);
        }

        this.notifyStatus(jobId, 'queued', `USER-SCHEDULED for ${new Date(scheduledFor).toLocaleString()}`);
        
        // If this job has repeat config, pre-create future repeat jobs
        if (data.repeatConfig?.enabled) {
            this.preCreateRepeatJobs(job, data.repeatConfig, 5); // Show next 5 repeats
        }
        
        return jobId;
    }

    // Add this helper method to insert jobs sorted by time
    private insertJobSorted(job: Job): void {
        let inserted = false;
        for (let i = 0; i < this.queue.length; i++) {
            if (job.scheduledFor < this.queue[i].scheduledFor) {
                this.queue.splice(i, 0, job);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            this.queue.push(job);
        }
    }

    // Add this method to pre-create repeat jobs
    private preCreateRepeatJobs(baseJob: Job, repeatConfig: RepeatConfig, count: number = 5): void {
        console.log(`[Scheduler] Pre-creating ${count} repeat jobs for job ${baseJob.id}`);
        
        let nextTime = baseJob.scheduledFor;
        const baseJobId = baseJob.id.split('_repeat_')[0]; // Get base ID without repeat suffix
        
        for (let i = 1; i <= count; i++) {
            nextTime += repeatConfig.intervalMs;
            
            const repeatJob: Job = {
                id: `${baseJobId}_repeat_${i}`,
                type: baseJob.type,
                data: {
                    ...baseJob.data,
                    repeatConfig: repeatConfig // Keep repeat config for chain
                },
                attempts: 0,
                maxAttempts: this.MAX_ATTEMPTS,
                createdAt: Date.now(),
                scheduledFor: nextTime
            };
            
            this.insertJobSorted(repeatJob);
            
            // Use same callback as parent job
            const parentCallback = this.statusCallbacks.get(baseJob.id);
            if (parentCallback) {
                this.statusCallbacks.set(repeatJob.id, parentCallback);
            }
            
            console.log(`[Scheduler] Pre-created repeat job ${repeatJob.id} for ${new Date(nextTime).toLocaleString()}`);
            this.notifyStatus(repeatJob.id, 'queued', `Repeat #${i} scheduled for ${new Date(nextTime).toLocaleString()}`);
        }
    }

    /**
     * Add a job to the queue with smart scheduling
     * @param scheduledFor - Optional user-defined timestamp for when to execute the job
     */
    addJob(type: JobType, data: Job['data'], callback?: (status: JobStatus, message?: string) => void): string {
        const jobId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const now = Date.now();
        const lastJobTime = this.getLastScheduledTime();
        const delay = this.calculateDelay(this.queue.length);
        const scheduledFor = Math.max(now + 5000, lastJobTime + delay);

        const job: Job = {
            id: jobId,
            type,
            data,
            attempts: 0,
            maxAttempts: this.MAX_ATTEMPTS,
            createdAt: now,
            scheduledFor
        };

        this.queue.push(job);
        
        if (callback) {
            this.statusCallbacks.set(jobId, callback);
        }

        console.log(`[Scheduler] Job ${jobId} AUTO-SCHEDULED for ${new Date(scheduledFor).toLocaleTimeString()}`);
        this.notifyStatus(jobId, 'queued', `Auto-scheduled for ${new Date(scheduledFor).toLocaleTimeString()}`);
        
        return jobId;
    }

    /**
     * Calculate smart delay with random timing between 45s-3min
     */
    private calculateDelay(queueLength: number): number {
        // Base random delay between MIN_DELAY and MAX_DELAY
        const baseDelay = this.MIN_DELAY + Math.random() * (this.MAX_DELAY - this.MIN_DELAY);
        
        // Small additional delay for each queued job (up to +30 seconds max)
        const queuePenalty = Math.min(queueLength * 10000, 30000);
        
        const finalDelay = Math.floor(baseDelay + queuePenalty);
        
        console.log(`[Scheduler] Calculated delay: ${Math.floor(finalDelay / 60000)}m ${Math.floor((finalDelay % 60000) / 1000)}s`);
        
        return finalDelay;
    }

    /**
     * Get the scheduled time of the last job in queue
     */
    private getLastScheduledTime(): number {
        if (this.queue.length === 0) return Date.now();
        return Math.max(...this.queue.map(job => job.scheduledFor));
    }

    /**
     * Start the background processing loop
     */
    private async startProcessing(): Promise<void> {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        console.log('[Scheduler] Started background processing');

        while (this.isProcessing) {
            await this.processNextJob();
            await this.sleep(5000); // Check for new jobs every 5 seconds
        }
    }

    /**
     * Process the next ready job in the queue
     */
    private async processNextJob(): Promise<void> {
        const now = Date.now();
        
        const readyJobIndex = this.queue.findIndex(job => job.scheduledFor <= now);
        
        if (readyJobIndex === -1) {
            return;
        }

        const job = this.queue[readyJobIndex];
        this.queue.splice(readyJobIndex, 1);
        this.currentJob = job;
        
        console.log(`[Scheduler] Processing job ${job.id} (attempt ${job.attempts + 1})`);
        this.notifyStatus(job.id, 'processing', `Processing... (attempt ${job.attempts + 1})`);

        try {
            await this.executeJob(job);
            
            // Success!
            console.log(`[Scheduler] Job ${job.id} completed successfully`);
            this.notifyStatus(job.id, 'completed', 'Posted successfully!');
            
            // Check if we need to create more repeat jobs
            if (job.data.repeatConfig?.enabled && job.id.includes('_repeat_')) {
                // This is a repeat job that completed, check if we need to add more
                const repeatNumber = parseInt(job.id.split('_repeat_')[1]) || 0;
                
                // Find the highest repeat number in queue
                const highestRepeat = this.queue
                    .filter(j => j.id.startsWith(job.id.split('_repeat_')[0]))
                    .reduce((max, j) => {
                        const num = parseInt(j.id.split('_repeat_')[1]) || 0;
                        return Math.max(max, num);
                    }, 0);
                
                // If we're running low on pre-created repeats, add more
                if (highestRepeat - repeatNumber < 3) {
                    const lastJob = this.queue
                        .filter(j => j.id.startsWith(job.id.split('_repeat_')[0]))
                        .sort((a, b) => b.scheduledFor - a.scheduledFor)[0];
                    
                    if (lastJob) {
                        this.preCreateRepeatJobs(lastJob, job.data.repeatConfig, 3);
                    }
                }
            }
            
            this.statusCallbacks.delete(job.id);
            
        } catch (error) {
            await this.handleJobError(job, error);
        }
        
        this.currentJob = null;
    }

    /**
     * Execute a single job
     */
    private async executeJob(job: Job): Promise<void> {
        job.attempts++;

        chrome.runtime.sendMessage({
        type: 'posting_progress',
        source: 'actual_posting',
        message: 'Starting to post your car...',
        step: 0,
        totalSteps: 1,
        timestamp: Date.now()
    });

        if (job.type === 'create') {
            const postId = await make_car(job.data.spec, job.data.images);
            // Navigation is handled inside make_car function
            // No need for additional navigation here
        } 
        else if (job.type === 'republish') {
            if (!job.data.deleteId) {
                throw new Error('No delete ID provided for republish job');
            }
            
            // Delete the old post first
            await deletePost(job.data.deleteId, false);
            
            // Wait a bit between delete and navigate
            await this.sleep(2000);
            
            // Navigate to posting page instead of creating
            document.location.replace('https://www.avto.net/_2016mojavtonet/ad_select_rubric_icons.asp?SID=10000');
        }
    }

    /**
     * Handle job execution errors
     */
    private async handleJobError(job: Job, error: any): Promise<void> {
        console.error(`[Scheduler] Job ${job.id} failed:`, error);
        
        if (job.attempts < job.maxAttempts) {
            // Schedule retry
            const retryDelay = this.RETRY_DELAY + (Math.random() * 60000); // 5-6 minutes
            job.scheduledFor = Date.now() + retryDelay;
            
            // Put job back in queue for retry
            this.queue.push(job);
            
            console.log(`[Scheduler] Job ${job.id} scheduled for retry in ${Math.floor(retryDelay / 1000)} seconds`);
            this.notifyStatus(job.id, 'retrying', `Retrying in ${Math.floor(retryDelay / 60000)} minutes...`);
        } else {
            // Max attempts reached
            console.error(`[Scheduler] Job ${job.id} failed permanently after ${job.attempts} attempts`);
            this.notifyStatus(job.id, 'failed', `Failed after ${job.attempts} attempts: ${error.message}`);
            this.statusCallbacks.delete(job.id);
        }
    }

    /**
     * Notify status callback if exists
     */
    private notifyStatus(jobId: string, status: JobStatus, message?: string): void {
        const callback = this.statusCallbacks.get(jobId);
        if (callback) {
            callback(status, message);
        }
    }

    /**
     * Get queue status for debugging
     */
    getQueueStatus(): { 
        totalJobs: number; 
        processingJob: string | null; 
        nextJobTime: number | null;
        queuedJobs: Array<{
            id: string, 
            type: JobType, 
            scheduledFor: number,
            isRepeat: boolean,
            repeatNumber?: number
        }>;
    } {
        const nextJob = this.queue.reduce((earliest, job) => 
            !earliest || job.scheduledFor < earliest.scheduledFor ? job : earliest
        , null as Job | null);

        return {
            totalJobs: this.queue.length,
            processingJob: this.currentJob?.id || null,
            nextJobTime: nextJob?.scheduledFor || null,
            queuedJobs: this.queue.map(job => ({
                id: job.id,
                type: job.type,
                scheduledFor: job.scheduledFor,
                isRepeat: job.id.includes('_repeat_'),
                repeatNumber: job.id.includes('_repeat_') ? 
                    parseInt(job.id.split('_repeat_')[1]) : undefined
            }))
        };
    }

    /**
     * Utility sleep function
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Stop the processor (for cleanup)
     */
    stop(): void {
        this.isProcessing = false;
        console.log('[Scheduler] Stopped background processing');
    }
}

// Create global scheduler instance
const scheduler = new CarPostingScheduler();

// Expose scheduler status for debugging
(window as any).getSchedulerStatus = () => scheduler.getQueueStatus();

// Auto-fill form when on posting page
if (window.location.href.includes('ad_select_rubric_icons.asp')) {
    console.log('[UI Automation] Detected posting page, checking for pending car data...');
    
    // Wait for page to load completely
    setTimeout(async () => {
        try {
            const result = await chrome.storage.local.get('pendingCarData');
            console.log('Pending car data:', result.pendingCarData);
            if (result.pendingCarData) {
                const car = result.pendingCarData;
                console.log('[UI Automation] Found pending car data, filling form...');
                
                const makeDropdown = document.querySelector('#make') as HTMLSelectElement;
                if (makeDropdown && car.make) {
                    makeDropdown.value = car.make;
                    console.log(`[UI Automation] Set make to: ${car.make}`);
                    
                    // Trigger change event to update dependent fields
                    const changeEvent = new Event('change', { bubbles: true });
                    makeDropdown.dispatchEvent(changeEvent);
                    
                    // Wait a bit for model dropdown to populate, then fill model
                    setTimeout(() => {
                        const modelDropdown = document.querySelector('#model') as HTMLSelectElement;
                        if (modelDropdown && car.model && !modelDropdown.disabled) {
                            // Try to find matching model option with normalization
                            let modelValue = car.model;
                            let found = false;
                            
                            // Try exact match first
                            if (modelDropdown.querySelector(`option[value="${modelValue}"]`)) {
                                found = true;
                            } else {
                                // Try normalized versions
                                const normalizedModel = modelValue.replace(/_/g, ' '); // Replace underscores with spaces
                                const withoutColon = normalizedModel.endsWith(':') ? normalizedModel.slice(0, -1) : normalizedModel;
                                const withColon = normalizedModel.endsWith(':') ? normalizedModel : normalizedModel + ':';
                                
                                // Try different variations - prioritize without colon for number endings
                                const variations = [normalizedModel, withoutColon, withColon];
                                
                                for (const variation of variations) {
                                    if (modelDropdown.querySelector(`option[value="${variation}"]`)) {
                                        modelValue = variation;
                                        found = true;
                                        break;
                                    }
                                }
                            }
                            
                            if (found) {
                                modelDropdown.value = modelValue;
                                console.log(`[UI Automation] Set model to: ${modelValue}`);
                                
                                // Trigger change event for model
                                const modelChangeEvent = new Event('change', { bubbles: true });
                                modelDropdown.dispatchEvent(modelChangeEvent);
                                
                                // Wait a bit, then fill month and year
                                setTimeout(() => {
                                    // Fill month dropdown
                                    const monthDropdown = document.querySelector('select[name="mesec"]') as HTMLSelectElement;
                                    if (monthDropdown && car.month) {
                                        const monthValue = car.month.toString().padStart(2, '0'); // Convert to zero-padded string
                                        monthDropdown.value = monthValue;
                                        console.log(`[UI Automation] Set month to: ${monthValue}`);
                                    }
                                    
                                    // Fill year dropdown
                                    const yearDropdown = document.querySelector('select[name="leto"]') as HTMLSelectElement;
                                    if (yearDropdown && car.year) {
                                        yearDropdown.value = car.year.toString();
                                        console.log(`[UI Automation] Set year to: ${car.year}`);
                                    }
                                    
                                    // Select fuel radio button
                                    if (car.fuel) {
                                        const fuelRadio = document.querySelector(`input[name="gorivo"][value="${car.fuel}"]`) as HTMLInputElement;
                                        if (fuelRadio) {
                                            fuelRadio.checked = true;
                                            console.log(`[UI Automation] Set fuel to: ${car.fuel}`);
                                        }
                                    }
                                }, 500);
                                
                                // Click the continue button
                                setTimeout(() => {
                                    const continueButton = document.querySelector('button[name="potrdi"][value="1"]') as HTMLButtonElement;
                                    if (continueButton) {
                                        // Store flag to click manual entry on next page
                                        chrome.storage.local.set({ 'shouldClickManualEntry': true });
                                        continueButton.click();
                                        console.log('[UI Automation] Clicked continue button');
                                    } else {
                                        console.log('[UI Automation] Could not find continue button');
                                    }
                                }, 1000);
                            } else {
                                console.log(`[UI Automation] Could not find matching model option for: ${car.model}`);
                            }
                        } else {
                            console.log('[UI Automation] Could not find model dropdown, car.model is empty, or dropdown is disabled');
                        }
                    }, 1000);
                    
                    // Don't clear the pending data yet - we need it for manual entry page
                } else {
                    console.log('[UI Automation] Could not find make dropdown');
                }
            }
        } catch (error) {
            console.log('[UI Automation] Error auto-filling form:', error);
        }
    }, 2000);
}

// Auto-click manual entry link on step 2 page
if (window.location.href.includes('ad_insert_car_step2.asp')) {
    console.log('[UI Automation] Detected step 2 page, checking if should click manual entry...');
    
    setTimeout(async () => {
        try {
            const result = await chrome.storage.local.get('shouldClickManualEntry');
            if (result.shouldClickManualEntry) {
                const manualEntryLink = document.querySelector('a.supurl[href*="ad_insert_car_step3.asp"]') as HTMLAnchorElement;
                if (manualEntryLink) {
                    manualEntryLink.click();
                    console.log('[UI Automation] Clicked manual entry link');
                    // Clear the flag
                    await chrome.storage.local.remove('shouldClickManualEntry');
                } else {
                    console.log('[UI Automation] Could not find manual entry link');
                }
            }
        } catch (error) {
            console.log('[UI Automation] Error checking manual entry flag:', error);
        }
    }, 1000);
}

// Auto-upload photos on photo edit page
if (window.location.href.includes('ad_photos_edit_1by1.asp') || document.querySelector('.PhotoEditBox')) {
    console.log('[UI Automation] Detected photo upload page, checking for pending images...');
    
    setTimeout(async () => {
        try {
            const result = await chrome.storage.local.get(['pendingCarData', 'pendingImageFiles']);
            console.log('[UI Automation] Storage contents:', result);
            let images = null;
            
            // Get images from local files
            if (result.pendingImageFiles && result.pendingImageFiles.length > 0) {
                console.log(`[UI Automation] Found ${result.pendingImageFiles.length} locally saved images`);
                images = [];
                
                for (let i = 0; i < result.pendingImageFiles.length; i++) {
                    const fileInfo = result.pendingImageFiles[i];
                    
                    try {
                        // Get download info to find the local file path
                        const downloadInfo = await new Promise((resolve, reject) => {
                            chrome.downloads.search({ id: fileInfo.downloadId }, (results) => {
                                if (chrome.runtime.lastError) {
                                    reject(chrome.runtime.lastError);
                                } else if (results.length > 0) {
                                    resolve(results[0]);
                                } else {
                                    reject(new Error('Download not found'));
                                }
                            });
                        }) as any;
                        
                        if (downloadInfo.state === 'complete' && downloadInfo.filename) {
                            // Read the local file and convert to base64
                            const response = await fetch(`file://${downloadInfo.filename}`);
                            const blob = await response.blob();
                            const base64 = await new Promise<string>((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    const result = reader.result as string;
                                    resolve(result.split(',')[1]); // Remove data URL prefix
                                };
                                reader.readAsDataURL(blob);
                            });
                            
                            images.push({
                                image: base64,
                                mimetype: fileInfo.mimetype
                            });
                            
                            console.log(`[UI Automation] Loaded local image ${i + 1}/${result.pendingImageFiles.length}: ${fileInfo.fileName}`);
                        } else {
                            console.log(`[UI Automation] Download not complete for image ${i + 1}: ${downloadInfo.state}`);
                        }
                    } catch (error) {
                        console.log(`[UI Automation] Failed to load local image ${i + 1}:`, error);
                    }
                }
                
                if (images.length > 0) {
                    console.log(`[UI Automation] Successfully loaded ${images.length} images from local files`);
                }
            } else {
                console.log('[UI Automation] Debug - pendingCarData exists:', !!result.pendingCarData);
                console.log('[UI Automation] Debug - pendingImageFiles:', result.pendingImageFiles);
            }
            
            if (images) {
                console.log(`[UI Automation] Found ${images.length} images to upload`);
                
                // Helper function to send progress updates
                const sendProgress = (message: string, step: number, totalSteps: number) => {
                    try {
                        chrome.runtime.sendMessage({
                            type: 'posting_progress',
                            source: 'actual_posting',
                            message,
                            step,
                            totalSteps,
                            timestamp: Date.now()
                        });
                    } catch (error) {
                        console.log('[UI Automation] Progress update failed:', error);
                    }
                };
                
                // Convert base64 to File object
                const base64ToFile = (base64Data: string, filename: string, mimeType: string): File => {
                    const byteCharacters = atob(base64Data.split(',')[1] || base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    return new File([byteArray], filename, { type: mimeType });
                };
                
                const totalImages = Math.min(images.length, 12); // Max 12 photos
                
                for (let i = 0; i < totalImages; i++) {
                    const imageData = images[i];
                    const photoNumber = i + 1;
                    
                    sendProgress(`Uploading photo ${photoNumber} of ${totalImages}...`, i, totalImages);
                    console.log(`[UI Automation] Processing photo ${photoNumber}`);
                    
                    try {
                        // Click the ADD button for this photo slot
                        const addButton = document.querySelector(`input[name="gumb${photoNumber}"]`) as HTMLInputElement;
                        if (addButton) {
                            addButton.click();
                            console.log(`[UI Automation] Clicked ADD button for photo ${photoNumber}`);
                            
                            // Wait for file input to appear
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            // Try to find and use the file input
                            const fileInput = document.querySelector('#gallery-photo-add') as HTMLInputElement;
                            if (fileInput) {
                                // Convert base64 to File
                                const file = base64ToFile(
                                    imageData.image, 
                                    `photo${photoNumber}.jpg`, 
                                    imageData.mimetype || 'image/jpeg'
                                );
                                
                                // Create a new FileList with our file
                                const dt = new DataTransfer();
                                dt.items.add(file);
                                fileInput.files = dt.files;
                                
                                // Trigger change event
                                const changeEvent = new Event('change', { bubbles: true });
                                fileInput.dispatchEvent(changeEvent);
                                
                                console.log(`[UI Automation] Set file for photo ${photoNumber}`);
                                
                                // Wait for upload processing
                                await new Promise(resolve => setTimeout(resolve, 2000));
                            } else {
                                console.log(`[UI Automation] Could not find file input for photo ${photoNumber}`);
                            }
                        } else {
                            console.log(`[UI Automation] Could not find ADD button for photo ${photoNumber}`);
                        }
                    } catch (error) {
                        console.log(`[UI Automation] Error uploading photo ${photoNumber}:`, error);
                    }
                    
                    // Wait between uploads
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
                sendProgress('All photos uploaded successfully!', totalImages, totalImages);
                console.log('[UI Automation] Completed photo upload process');
                
                // Clear the pending data after photo upload is complete
                await chrome.storage.local.remove(['pendingCarData', 'pendingImageFiles']);
                
                // Clean up locally saved image files
                if (result.pendingImageFiles && result.pendingImageFiles.length > 0) {
                    for (const fileInfo of result.pendingImageFiles) {
                        try {
                            // Remove the downloaded file
                            await new Promise<void>((resolve, reject) => {
                                chrome.downloads.removeFile(fileInfo.downloadId, () => {
                                    if (chrome.runtime.lastError) {
                                        console.log(`[UI Automation] Could not remove file ${fileInfo.fileName}:`, chrome.runtime.lastError);
                                    }
                                    resolve();
                                });
                            });
                            
                            // Erase the download record
                            await new Promise<void>((resolve, reject) => {
                                chrome.downloads.erase({ id: fileInfo.downloadId }, () => {
                                    if (chrome.runtime.lastError) {
                                        console.log(`[UI Automation] Could not erase download record ${fileInfo.downloadId}:`, chrome.runtime.lastError);
                                    }
                                    resolve();
                                });
                            });
                        } catch (error) {
                            console.log(`[UI Automation] Error cleaning up file ${fileInfo.fileName}:`, error);
                        }
                    }
                    console.log(`[UI Automation] Cleaned up ${result.pendingImageFiles.length} local image files`);
                }
                
            } else {
                console.log('[UI Automation] No images found to upload');
                // Clear the pending data even if no images found
                await chrome.storage.local.remove(['pendingCarData', 'pendingImageCount']);
                
                // Clean up any chunked image data that might exist
                const allKeys = await chrome.storage.local.get();
                const imageKeys = Object.keys(allKeys).filter(key => 
                    key.startsWith('pendingImageMeta_') || 
                    key.startsWith('pendingImageChunk_')
                );
                if (imageKeys.length > 0) {
                    await chrome.storage.local.remove(imageKeys);
                    console.log(`[UI Automation] Cleaned up ${imageKeys.length} orphaned image chunk keys`);
                }
            }
        } catch (error) {
            console.log('[UI Automation] Error in photo upload process:', error);
            // Clear the pending data even on error
            await chrome.storage.local.remove(['pendingCarData', 'pendingImageCount']);
            
            // Clean up any chunked image data that might exist
            const allKeys = await chrome.storage.local.get();
            const imageKeys = Object.keys(allKeys).filter(key => 
                key.startsWith('pendingImageMeta_') || 
                key.startsWith('pendingImageChunk_')
            );
            if (imageKeys.length > 0) {
                await chrome.storage.local.remove(imageKeys);
                console.log(`[UI Automation] Cleaned up ${imageKeys.length} orphaned image chunk keys after error`);
            }
        }
    }, 3000); // Wait 3 seconds for page to load
}
if (window.location.href.includes('ad_edit.asp')) {
    console.log('[UI Automation] Detected manual entry page, checking for pending car data...');
    
    setTimeout(async () => {
        try {
            const result = await chrome.storage.local.get('pendingCarData');
            console.log('Manual entry - Pending car data:', result.pendingCarData);
            if (result.pendingCarData) {
                const car = result.pendingCarData;
                console.log('[UI Automation] Found pending car data, filling fields one by one...');
                
                // Helper function to send progress updates
                const sendProgress = (message: string, step: number, totalSteps: number) => {
                    try {
                        chrome.runtime.sendMessage({
                            type: 'posting_progress',
                            source: 'actual_posting',
                            message,
                            step,
                            totalSteps,
                            timestamp: Date.now()
                        });
                    } catch (error) {
                        console.log('[UI Automation] Progress update failed:', error);
                    }
                };
                
                const totalSteps = 2;
                let currentStep = 0;
                
                // Fill type field first
                sendProgress('Filling vehicle type field...', currentStep++, totalSteps);
                const typeField = document.querySelector('input[name="tipvozila"]') as HTMLInputElement;
                if (typeField && car.type) {
                    typeField.focus(); // Trigger onfocus to remove readonly
                    await new Promise(resolve => setTimeout(resolve, 500)); // Wait a bit
                    typeField.value = car.type;
                    console.log(`[UI Automation] Set type to: ${car.type}`);
                }
                
                // Wait before filling VIN field
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Fill VIN field second
                sendProgress('Filling VIN field...', currentStep++, totalSteps);
                const vinField = document.querySelector('input[name="VIN"]') as HTMLInputElement;
                if (vinField) {
                    vinField.focus(); // Trigger onfocus to remove readonly
                    await new Promise(resolve => setTimeout(resolve, 500)); // Wait a bit
                    vinField.value = car.VIN || '';
                    console.log(`[UI Automation] Set VIN to: ${car.VIN || 'empty'}`);
                }
                
                // Wait before toggling checkboxes
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Toggle checkboxes based on data
                // Publish VIN checkbox
                const publishVinCheckbox = document.querySelector('input[name="VINobjavi"][type="checkbox"]') as HTMLInputElement;
                if (publishVinCheckbox) {
                    publishVinCheckbox.checked = car.publish_vin || false;
                    console.log(`[UI Automation] Set publish VIN to: ${car.publish_vin}`);
                }
                
                // Guarantee checkbox
                const guaranteeCheckbox = document.querySelector('input[name="guarantee"][type="checkbox"]') as HTMLInputElement;
                if (guaranteeCheckbox) {
                    guaranteeCheckbox.checked = car.guarantee || false;
                    console.log(`[UI Automation] Set guarantee to: ${car.guarantee}`);
                }
                
                // Warranty checkbox
                const warrantyCheckbox = document.querySelector('input[name="jamstvo"][type="checkbox"]') as HTMLInputElement;
                if (warrantyCheckbox) {
                    warrantyCheckbox.checked = car.warranty || false;
                    console.log(`[UI Automation] Set warranty to: ${car.warranty}`);
                }
                
                // Oldtimer checkbox
                const oldtimerCheckbox = document.querySelector('input[name="oldtimer"][type="checkbox"]') as HTMLInputElement;
                if (oldtimerCheckbox) {
                    oldtimerCheckbox.checked = car.oldtimer || false;
                    console.log(`[UI Automation] Set oldtimer to: ${car.oldtimer}`);
                }
                
                // Wait before filling age and mileage
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Select age dropdown
                const ageDropdown = document.querySelector('select[name="starost"]') as HTMLSelectElement;
                if (ageDropdown && car.age) {
                    ageDropdown.value = car.age.toString();
                    console.log(`[UI Automation] Set age to: ${car.age}`);
                }
                
                // Fill mileage field
                const mileageField = document.querySelector('input[name="prevozenikm"]') as HTMLInputElement;
                if (mileageField && car.mileage) {
                    mileageField.focus(); // Trigger onfocus if needed
                    await new Promise(resolve => setTimeout(resolve, 200));
                    mileageField.value = car.mileage.toString();
                    console.log(`[UI Automation] Set mileage to: ${car.mileage}`);
                }
                
                // Wait before filling technical data and owners
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Fill technical month dropdown
                const techMonthDropdown = document.querySelector('select[name="tehmesec"]') as HTMLSelectElement;
                if (techMonthDropdown && car.technical_month) {
                    const techMonthValue = car.technical_month.toString().padStart(2, '0'); // Convert to zero-padded string
                    techMonthDropdown.value = techMonthValue;
                    console.log(`[UI Automation] Set technical month to: ${techMonthValue}`);
                }
                
                // Fill technical year field
                const techYearField = document.querySelector('input[name="tehleto"]') as HTMLInputElement;
                if (techYearField && car.technical_year) {
                    techYearField.focus(); // Trigger onfocus if needed
                    await new Promise(resolve => setTimeout(resolve, 200));
                    techYearField.value = car.technical_year.toString();
                    console.log(`[UI Automation] Set technical year to: ${car.technical_year}`);
                }
                
                // Fill number of owners dropdown
                const ownersDropdown = document.querySelector('select[name="lastnikov"]') as HTMLSelectElement;
                if (ownersDropdown && car.prev_owners) {
                    ownersDropdown.value = car.prev_owners.toString();
                    console.log(`[UI Automation] Set number of owners to: ${car.prev_owners}`);
                }
                
                // Wait before filling offer type and price
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Select offer type radio button
                if (car.offer_type !== undefined) {
                    const offerTypeRadio = document.querySelector(`input[name="najem"][value="${car.offer_type}"]`) as HTMLInputElement;
                    if (offerTypeRadio) {
                        offerTypeRadio.checked = true;
                        console.log(`[UI Automation] Set offer type to: ${car.offer_type}`);
                    }
                }
                
                // Fill price field
                const priceField = document.querySelector('input[name="cena"]') as HTMLInputElement;
                if (priceField && car.price) {
                    priceField.focus(); // Trigger onfocus if needed
                    await new Promise(resolve => setTimeout(resolve, 200));
                    priceField.value = car.price.toString();
                    console.log(`[UI Automation] Set price to: ${car.price}`);
                }
                
                // Wait before toggling additional checkboxes
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Toggle additional checkboxes based on data
                const gotpopustCheckbox = document.querySelector('input[name="gotpopust"][type="checkbox"]') as HTMLInputElement;
                if (gotpopustCheckbox) {
                    gotpopustCheckbox.checked = car.cash_discount || false;
                    console.log(`[UI Automation] Set cash discount to: ${car.cash_discount}`);
                }
                
                const zadcenaCheckbox = document.querySelector('input[name="zadcena"][type="checkbox"]') as HTMLInputElement;
                if (zadcenaCheckbox) {
                    zadcenaCheckbox.checked = car.final_price || false;
                    console.log(`[UI Automation] Set final price to: ${car.final_price}`);
                }
                
                const kreditCheckbox = document.querySelector('input[name="kredit"][type="checkbox"]') as HTMLInputElement;
                if (kreditCheckbox) {
                    kreditCheckbox.checked = false; // No matching field found
                    console.log(`[UI Automation] Set credit to: false`);
                }
                
                const leasingCheckbox = document.querySelector('input[name="leasing"][type="checkbox"]') as HTMLInputElement;
                if (leasingCheckbox) {
                    leasingCheckbox.checked = car.leasing || false;
                    console.log(`[UI Automation] Set leasing to: ${car.leasing}`);
                }
                
                const prevzemleasCheckbox = document.querySelector('input[name="prevzemleas"][type="checkbox"]') as HTMLInputElement;
                if (prevzemleasCheckbox) {
                    prevzemleasCheckbox.checked = false; // No matching field found
                    console.log(`[UI Automation] Set lease takeover to: false`);
                }
                
                const naobrokeCheckbox = document.querySelector('input[name="naobroke"][type="checkbox"]') as HTMLInputElement;
                if (naobrokeCheckbox) {
                    naobrokeCheckbox.checked = car.installments || false;
                    console.log(`[UI Automation] Set installments to: ${car.installments}`);
                }
                
                const menjavaCheckbox = document.querySelector('input[name="menjava"][type="checkbox"]') as HTMLInputElement;
                if (menjavaCheckbox) {
                    menjavaCheckbox.checked = car.exchange || false;
                    console.log(`[UI Automation] Set exchange to: ${car.exchange}`);
                }
                
                const eutaxCheckbox = document.querySelector('input[name="eutax"][type="checkbox"]') as HTMLInputElement;
                if (eutaxCheckbox) {
                    eutaxCheckbox.checked = false; // No matching field found
                    console.log(`[UI Automation] Set EU tax to: false`);
                }
                
                const prodanoCheckbox = document.querySelector('input[name="prodano"][type="checkbox"]') as HTMLInputElement;
                if (prodanoCheckbox) {
                    prodanoCheckbox.checked = car.sold_whole || false;
                    console.log(`[UI Automation] Set sold whole to: ${car.sold_whole}`);
                }
                
                // Wait before filling internal ID and administrator fields
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Fill internal ID field
                const internalIdField = document.querySelector('input[name="interniID"]') as HTMLInputElement;
                if (internalIdField && car.internal_id) {
                    internalIdField.focus();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    internalIdField.value = car.internal_id.toString();
                    console.log(`[UI Automation] Set internal ID to: ${car.internal_id}`);
                }
                
                // Toggle publish internal ID checkbox
                const publishInternalIdCheckbox = document.querySelector('input[name="objaviID"][type="checkbox"]') as HTMLInputElement;
                if (publishInternalIdCheckbox) {
                    publishInternalIdCheckbox.checked = car.publish_internal_id || false;
                    console.log(`[UI Automation] Set publish internal ID to: ${car.publish_internal_id}`);
                }
                
                // Fill ad administrator field
                const administratorField = document.querySelector('input[name="administratoroglasa"]') as HTMLInputElement;
                if (administratorField && car.ad_administrator) {
                    administratorField.focus();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    administratorField.value = car.administrator.toString();
                    console.log(`[UI Automation] Set administrator to: ${car.administrator}`);
                }

                // Wait before setting vehicle condition radio buttons and checkboxes
                await new Promise(resolve => setTimeout(resolve, 500));

                // Set sold as whole radio button
                const soldWholeRadio = document.querySelector(`input[name="prodamvceloti"][value="${car.sold_whole ? '1' : '0'}"]`) as HTMLInputElement;
                if (soldWholeRadio) {
                    soldWholeRadio.checked = true;
                    console.log(`[UI Automation] Set sold as whole to: ${car.sold_whole ? '1' : '0'}`);
                }

                // Set driveable radio button
                const driveableRadio = document.querySelector(`input[name="vozno"][value="${car.driveable ? '1' : '0'}"]`) as HTMLInputElement;
                if (driveableRadio) {
                    driveableRadio.checked = true;
                    console.log(`[UI Automation] Set driveable to: ${car.driveable ? '1' : '0'}`);
                }

                // Set damaged radio button
                const damagedRadio = document.querySelector(`input[name="poskodovan"][value="${car.damaged ? '1' : '0'}"]`) as HTMLInputElement;
                if (damagedRadio) {
                    damagedRadio.checked = true;
                    console.log(`[UI Automation] Set damaged to: ${car.damaged ? '1' : '0'}`);
                }

                // Set carambolised radio button
                const carambolisedRadio = document.querySelector(`input[name="karambolirano"][value="${car.carambolised ? '1' : '0'}"]`) as HTMLInputElement;
                if (carambolisedRadio) {
                    carambolisedRadio.checked = true;
                    console.log(`[UI Automation] Set carambolised to: ${car.carambolised ? '1' : '0'}`);
                }

                // Toggle in failure checkbox
                const inFailureCheckbox = document.querySelector('input[name="okvara"][type="checkbox"]') as HTMLInputElement;
                if (inFailureCheckbox) {
                    inFailureCheckbox.checked = car.in_failure || false;
                    console.log(`[UI Automation] Set in failure to: ${car.in_failure}`);
                }

                // Toggle flooded checkbox
                const floodedCheckbox = document.querySelector('input[name="poplavljeno"][type="checkbox"]') as HTMLInputElement;
                if (floodedCheckbox) {
                    floodedCheckbox.checked = car.flooded || false;
                    console.log(`[UI Automation] Set flooded to: ${car.flooded}`);
                }
                
                // Wait before setting vehicle history checkboxes
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Toggle service book checkbox
                const serviceBookCheckbox = document.querySelector('input[name="SK"][type="checkbox"]') as HTMLInputElement;
                if (serviceBookCheckbox) {
                    serviceBookCheckbox.checked = car.service_book || false;
                    console.log(`[UI Automation] Set service book to: ${car.service_book}`);
                }
                
                // Toggle service book confirmed checkbox
                const serviceBookConfirmedCheckbox = document.querySelector('input[name="SKpotrjena"][type="checkbox"]') as HTMLInputElement;
                if (serviceBookConfirmedCheckbox) {
                    serviceBookConfirmedCheckbox.checked = car.service_book_confirmed || false;
                    console.log(`[UI Automation] Set service book confirmed to: ${car.service_book_confirmed}`);
                }
                
                // Toggle Slovenian origin checkbox
                const slovenianOriginCheckbox = document.querySelector('input[name="SLOporeklo"][type="checkbox"]') as HTMLInputElement;
                if (slovenianOriginCheckbox) {
                    slovenianOriginCheckbox.checked = car.slovenian_origin || false;
                    console.log(`[UI Automation] Set Slovenian origin to: ${car.slovenian_origin}`);
                }
                
                // Toggle garaged checkbox
                const garagedCheckbox = document.querySelector('input[name="gar"][type="checkbox"]') as HTMLInputElement;
                if (garagedCheckbox) {
                    garagedCheckbox.checked = car.garaged || false;
                    console.log(`[UI Automation] Set garaged to: ${car.garaged}`);
                }
                
                // Toggle not in collision checkbox
                const notInCollisionCheckbox = document.querySelector('input[name="nek"][type="checkbox"]') as HTMLInputElement;
                if (notInCollisionCheckbox) {
                    notInCollisionCheckbox.checked = car.not_carambolised || false;
                    console.log(`[UI Automation] Set not in collision to: ${car.not_carambolised}`);
                }
                
                // Wait before filling powertrain and engine details
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Fill powertrain text field
                const powertrainField = document.querySelector('input[name="PowertrainTXT"]') as HTMLInputElement;
                if (powertrainField && car.powertrain) {
                    powertrainField.focus();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    powertrainField.value = car.powertrain;
                    console.log(`[UI Automation] Set powertrain to: ${car.powertrain}`);
                }
                
                // Fill gearbox dropdown
                const gearboxDropdown = document.querySelector('select[name="menjalnik"]') as HTMLSelectElement;
                if (gearboxDropdown && car.gearbox) {
                    gearboxDropdown.value = car.gearbox.toString();
                    console.log(`[UI Automation] Set gearbox to: ${car.gearbox}`);
                }
                
                // Fill engine power field (kW)
                const enginePowerField = document.querySelector('input[name="kw"]') as HTMLInputElement;
                if (enginePowerField && car.engine_strength) {
                    enginePowerField.focus();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    enginePowerField.value = car.engine_strength.toString();
                    console.log(`[UI Automation] Set engine power to: ${car.engine_strength}`);
                }
                
                // Fill engine displacement field (ccm)
                const engineDisplacementField = document.querySelector('input[name="ccm"]') as HTMLInputElement;
                if (engineDisplacementField && car.engine_displacement) {
                    engineDisplacementField.focus();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    engineDisplacementField.value = car.engine_displacement.toString();
                    console.log(`[UI Automation] Set engine displacement to: ${car.engine_displacement}`);
                }
                
                // Wait before filling color details
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Fill color dropdown
                const colorDropdown = document.querySelector('select[name="barva"]') as HTMLSelectElement;
                if (colorDropdown && car.car_color) {
                    colorDropdown.value = car.car_color;
                    console.log(`[UI Automation] Set color to: ${car.car_color}`);
                }
                
                // Toggle metallic checkbox
                const metallicCheckbox = document.querySelector('input[name="kovinska"][type="checkbox"]') as HTMLInputElement;
                if (metallicCheckbox) {
                    metallicCheckbox.checked = car.metalic || false;
                    console.log(`[UI Automation] Set metallic to: ${car.metalic}`);
                }
                
                // Toggle matte color checkbox
                const matteCheckbox = document.querySelector('input[name="BarvaMatt"][type="checkbox"]') as HTMLInputElement;
                if (matteCheckbox) {
                    matteCheckbox.checked = false; // No matching field found in API
                    console.log(`[UI Automation] Set matte color to: false`);
                }

                // Wait before filling roof and doors details
                await new Promise(resolve => setTimeout(resolve, 500));

                // Fill roof dropdown
                const roofDropdown = document.querySelector('select[name="streha"]') as HTMLSelectElement;
                if (roofDropdown && car.car_roof) {
                    roofDropdown.value = car.car_roof;
                    console.log(`[UI Automation] Set roof to: ${car.car_roof}`);
                }

                // Toggle electric roof checkbox
                const electricRoofCheckbox = document.querySelector('input[name="elstreha"][type="checkbox"]') as HTMLInputElement;
                if (electricRoofCheckbox) {
                    electricRoofCheckbox.checked = car.electric_car_roof || false;
                    console.log(`[UI Automation] Set electric roof to: ${car.electric_car_roof}`);
                }

                // Fill doors dropdown
                const doorsDropdown = document.querySelector('select[name="vrata"]') as HTMLSelectElement;
                if (doorsDropdown && car.doors) {
                    doorsDropdown.value = car.doors.toString();
                    console.log(`[UI Automation] Set doors to: ${car.doors}`);
                }

                // Toggle sliding door checkbox
                const slidingDoorCheckbox = document.querySelector('input[name="dostvrat04"][type="checkbox"]') as HTMLInputElement;
                if (slidingDoorCheckbox) {
                    slidingDoorCheckbox.checked = car.sliding_door || false;
                    console.log(`[UI Automation] Set sliding door to: ${car.sliding_door}`);
                }

                // Wait before filling seat and upholstery details
                await new Promise(resolve => setTimeout(resolve, 500));

                // Fill number of seats field
                const seatsField = document.querySelector('input[name="sedezev"]') as HTMLInputElement;
                if (seatsField && car.seats) {
                    seatsField.focus();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    seatsField.value = car.seats.toString();
                    console.log(`[UI Automation] Set seats to: ${car.seats}`);
                }

                // Fill upholstery dropdown
                const upholsteryDropdown = document.querySelector('select[name="oblazinjenje"]') as HTMLSelectElement;
                if (upholsteryDropdown && car.oblazinjenje) {
                    upholsteryDropdown.value = car.oblazinjenje;
                    console.log(`[UI Automation] Set upholstery to: ${car.oblazinjenje}`);
                }

                // Fill upholstery color dropdown
                // Note: No matching field found in Car interface for upholstery color
                const upholsteryColorDropdown = document.querySelector('select[name="barvaoblazin"]') as HTMLSelectElement;
                if (upholsteryColorDropdown) {
                    upholsteryColorDropdown.value = car.color_oblazinjenje;
                    console.log(`[UI Automation] Upholstery color field found but no matching data in Car interface`);
                }

                // Wait before filling emissions data
                await new Promise(resolve => setTimeout(resolve, 500));

                // Fill combined fuel consumption field
                const fuelConsumptionField = document.querySelector('input[name="porabaKombi"]') as HTMLInputElement;
                if (fuelConsumptionField && car.fuel_use_combined) {
                    fuelConsumptionField.focus();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    fuelConsumptionField.value = car.fuel_use_combined.toString();
                    console.log(`[UI Automation] Set fuel consumption to: ${car.fuel_use_combined}`);
                }

                // Fill emissions standard field
                const emissionsStandardField = document.querySelector('input[name="EmisijeStandard"]') as HTMLInputElement;
                if (emissionsStandardField && car.emissions_standard) {
                    emissionsStandardField.focus();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    emissionsStandardField.value = car.emissions_standard.toString();
                    console.log(`[UI Automation] Set emissions standard to: ${car.emissions_standard}`);
                }

                // Fill CO2 emissions field
                const co2EmissionsField = document.querySelector('input[name="CO2"]') as HTMLInputElement;
                if (co2EmissionsField && car.co2_emissions) {
                    co2EmissionsField.focus();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    co2EmissionsField.value = car.co2_emissions.toString();
                    console.log(`[UI Automation] Set CO2 emissions to: ${car.co2_emissions}`);
                }

                // Toggle publish consumption checkbox
                const publishConsumptionCheckbox = document.querySelector('input[name="porabaOBJAVI"][type="checkbox"]') as HTMLInputElement;
                if (publishConsumptionCheckbox) {
                    publishConsumptionCheckbox.checked = car.publish_consumption || false;
                    console.log(`[UI Automation] Set publish consumption to: ${car.publish_consumption}`);
                }
                
                // Wait before filling chassis features
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Fill chassis features checkboxes
                if (car.chassis_features) {
                    const chassisFeatures = car.chassis_features.split(',').map((feature: string) => feature.trim());
                    console.log(`[UI Automation] Processing chassis features: ${chassisFeatures.join(', ')}`);
                    
                    chassisFeatures.forEach((feature: string) => {
                        const checkbox = document.querySelector(`input[name="${feature}"][type="checkbox"]`) as HTMLInputElement;
                        if (checkbox) {
                            checkbox.checked = true;
                            console.log(`[UI Automation] Set chassis feature ${feature} to: true`);
                        } else {
                            console.log(`[UI Automation] Could not find checkbox for chassis feature: ${feature}`);
                        }
                    });
                }
                
                // Toggle ALU checkbox
                const aluCheckbox = document.querySelector('input[name="ALU"][type="checkbox"]') as HTMLInputElement;
                if (aluCheckbox) {
                    aluCheckbox.checked = car.alu || false;
                    console.log(`[UI Automation] Set ALU to: ${car.alu}`);
                }
                
                // Wait before filling security features
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Fill airbags field
                const airbagsField = document.querySelector('input[name="airbagov"]') as HTMLInputElement;
                if (airbagsField && car.airbags !== undefined) {
                    airbagsField.focus();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    airbagsField.value = car.airbags.toString();
                    console.log(`[UI Automation] Set airbags to: ${car.airbags}`);
                }
                
                // Fill security features checkboxes
                if (car.varnosti) {
                    const securityFeatures = car.varnosti.split(',').map((feature: string) => feature.trim());
                    console.log(`[UI Automation] Processing security features: ${securityFeatures.join(', ')}`);
                    
                    securityFeatures.forEach((feature: string) => {
                        const checkbox = document.querySelector(`input[name="${feature}"][type="checkbox"]`) as HTMLInputElement;
                        if (checkbox) {
                            checkbox.checked = true;
                            console.log(`[UI Automation] Set security feature ${feature} to: true`);
                        } else {
                            console.log(`[UI Automation] Could not find checkbox for security feature: ${feature}`);
                        }
                    });
                }
                
                // Wait before filling interior features
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Fill interior features checkboxes
                if (car.inside) {
                    const interiorFeatures = car.inside.split(',').map((feature: string) => feature.trim());
                    console.log(`[UI Automation] Processing interior features: ${interiorFeatures.join(', ')}`);
                    
                    interiorFeatures.forEach((feature: string) => {
                        const checkbox = document.querySelector(`input[name="${feature}"][type="checkbox"]`) as HTMLInputElement;
                        if (checkbox) {
                            checkbox.checked = true;
                            console.log(`[UI Automation] Set interior feature ${feature} to: true`);
                        } else {
                            console.log(`[UI Automation] Could not find checkbox for interior feature: ${feature}`);
                        }
                    });
                }
                
                // Wait before filling comfort features
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Fill comfort features checkboxes
                if (car.comfort) {
                    const comfortFeatures = car.comfort.split(',').map((feature: string) => feature.trim());
                    console.log(`[UI Automation] Processing comfort features: ${comfortFeatures.join(', ')}`);
                    
                    comfortFeatures.forEach((feature: string) => {
                        const checkbox = document.querySelector(`input[name="${feature}"][type="checkbox"]`) as HTMLInputElement;
                        if (checkbox) {
                            checkbox.checked = true;
                            console.log(`[UI Automation] Set comfort feature ${feature} to: true`);
                        } else {
                            console.log(`[UI Automation] Could not find checkbox for comfort feature: ${feature}`);
                        }
                    });
                }
                
                // Wait before filling multimedia features
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Toggle car radio checkbox
                const carRadioCheckbox = document.querySelector('input[name="avtoradio"][type="checkbox"]') as HTMLInputElement;
                if (carRadioCheckbox) {
                    carRadioCheckbox.checked = car.car_radio || false;
                    console.log(`[UI Automation] Set car radio to: ${car.car_radio}`);
                }
                
                // Toggle CD checkbox
                const cdCheckbox = document.querySelector('input[name="cd"][type="checkbox"]') as HTMLInputElement;
                if (cdCheckbox) {
                    cdCheckbox.checked = car.cd_disk || false;
                    console.log(`[UI Automation] Set CD to: ${car.cd_disk}`);
                }
                
                // Toggle HiFi checkbox
                const hifiCheckbox = document.querySelector('input[name="hifi"][type="checkbox"]') as HTMLInputElement;
                if (hifiCheckbox) {
                    hifiCheckbox.checked = car.hifi || false;
                    console.log(`[UI Automation] Set HiFi to: ${car.hifi}`);
                }
                
                // Fill multimedia features checkboxes
                if (car.multimedia) {
                    const multimediaFeatures = car.multimedia.split(',').map((feature: string) => feature.trim());
                    console.log(`[UI Automation] Processing multimedia features: ${multimediaFeatures.join(', ')}`);
                    
                    multimediaFeatures.forEach((feature: string) => {
                        const checkbox = document.querySelector(`input[name="${feature}"][type="checkbox"]`) as HTMLInputElement;
                        if (checkbox) {
                            checkbox.checked = true;
                            console.log(`[UI Automation] Set multimedia feature ${feature} to: true`);
                        } else {
                            console.log(`[UI Automation] Could not find checkbox for multimedia feature: ${feature}`);
                        }
                    });
                }
                
                // Wait before filling appliance features
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Fill appliance features checkboxes
                if (car.appliance) {
                    const applianceFeatures = car.appliance.split(',').map((feature: string) => feature.trim());
                    console.log(`[UI Automation] Processing appliance features: ${applianceFeatures.join(', ')}`);
                    
                    applianceFeatures.forEach((feature: string) => {
                        const checkbox = document.querySelector(`input[name="${feature}"][type="checkbox"]`) as HTMLInputElement;
                        if (checkbox) {
                            checkbox.checked = true;
                            console.log(`[UI Automation] Set appliance feature ${feature} to: true`);
                        } else {
                            console.log(`[UI Automation] Could not find checkbox for appliance feature: ${feature}`);
                        }
                    });
                }
                
                // Wait before filling comments
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Fill comments textarea
                const commentsTextarea = document.querySelector('textarea[name="opombe"]') as HTMLTextAreaElement;
                if (commentsTextarea && car.comment) {
                    commentsTextarea.focus();
                    await new Promise(resolve => setTimeout(resolve, 200));
                    commentsTextarea.value = car.comment;
                    console.log(`[UI Automation] Set comments to: ${car.comment.substring(0, 100)}${car.comment.length > 100 ? '...' : ''}`);
                }
                
                // Wait before filling delivery time
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Select delivery time radio button
                if (car.delivery_time !== undefined) {
                    const deliveryRadio = document.querySelector(`input[name="rokdobave"][value="${car.delivery_time}"]`) as HTMLInputElement;
                    if (deliveryRadio) {
                        deliveryRadio.checked = true;
                        console.log(`[UI Automation] Set delivery time to: ${car.delivery_time}`);
                    } else {
                        console.log(`[UI Automation] Could not find delivery time radio button for value: ${car.delivery_time}`);
                    }
                }
                
                // Wait before clicking the add/edit photos button
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // Click the add/edit photos button
                const addPhotosButton = document.querySelector('button[name="EDITAD"][value="1"]') as HTMLButtonElement;
                if (addPhotosButton) {
                    addPhotosButton.click();
                    console.log('[UI Automation] Clicked add/edit photos button');
                } else {
                    console.log('[UI Automation] Could not find add/edit photos button');
                }
                
                sendProgress('Fields filled successfully!', totalSteps, totalSteps);
                
                // Don't clear the pending data yet - we need it for photo upload
                // await chrome.storage.local.remove(['pendingCarData', 'pendingImageCount']);
            }
        } catch (error) {
            console.log('[UI Automation] Error auto-filling manual entry form:', error);
        }
    }, 4000);
}

const make_car = async (car: Car, images: ImageDescriptor[]) => {
    // Helper function to send progress updates
    const sendProgress = (message: string, step: number, totalSteps: number) => {
        try {
            chrome.runtime.sendMessage({
                type: 'posting_progress',
                source: 'actual_posting',
                message,
                step,
                totalSteps,
                timestamp: Date.now()
            });
        } catch (error) {
            console.log('[UI Automation] Progress update failed:', error);
        }
    };
    
    const totalSteps = 2;
    let currentStep = 0;

    console.log('[UI Automation] Starting navigation to posting page...');
    sendProgress('Preparing to navigate to posting page...', currentStep++, totalSteps);
    
    console.log('[UI Automation] Images received:', images ? images.length : 'null/undefined');
    
    // Clear any existing pending data first to free up storage space
    try {
        const allKeys = await chrome.storage.local.get();
        const keysToRemove = Object.keys(allKeys).filter(key => 
            key.startsWith('pendingCarData') || 
            key.startsWith('pendingImages') || 
            key.startsWith('pendingImage_') ||
            key === 'pendingImageCount' ||
            key === 'currentJobKey' ||
            key.startsWith('pendingImageMeta_') ||
            key.startsWith('pendingImageChunk_')
        );
        if (keysToRemove.length > 0) {
            await chrome.storage.local.remove(keysToRemove);
            console.log(`[UI Automation] Cleared ${keysToRemove.length} existing storage keys to free space`);
        }
        
        // Also clean up any existing job keys from window object
        const windowKeys = Object.keys(window as any).filter(key => key.startsWith('job_'));
        windowKeys.forEach(key => {
            delete (window as any)[key];
        });
        if (windowKeys.length > 0) {
            console.log(`[UI Automation] Cleaned up ${windowKeys.length} existing job keys from memory`);
        }
    } catch (cleanupError) {
        console.log('[UI Automation] Error during storage cleanup:', cleanupError);
    }
    
    // Store only car data (no images) to avoid quota issues
    await chrome.storage.local.set({ 'pendingCarData': car });
    console.log('[UI Automation] Stored car data without images');
    
    // ONLY use local file download approach - NO Chrome storage for images
    if (images && images.length > 0) {
        console.log(`[UI Automation] Saving ${images.length} images locally via downloads API`);
        const imageFiles = [];
        
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            const fileName = `bpavto_temp_image_${Date.now()}_${i}.${image.mimetype === 'image/png' ? 'png' : 'jpg'}`;
            
            try {
                // Convert base64 to blob URL
                const dataUrl = `data:${image.mimetype || 'image/jpeg'};base64,${image.image}`;
                const response = await fetch(dataUrl);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                
                // Download the image to local folder
                const downloadId = await new Promise<number>((resolve, reject) => {
                    chrome.downloads.download({
                        url: blobUrl,
                        filename: `bpavto_temp/${fileName}`,
                        saveAs: false
                    }, (downloadId) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(downloadId);
                        }
                    });
                });
                
                // Store download info
                imageFiles.push({
                    downloadId: downloadId,
                    fileName: fileName,
                    mimetype: image.mimetype
                });
                
                // Clean up blob URL
                URL.revokeObjectURL(blobUrl);
                
                console.log(`[UI Automation] Saved image ${i + 1}/${images.length} locally: ${fileName}`);
            } catch (error) {
                console.log(`[UI Automation] Failed to save image ${i + 1}:`, error);
            }
        }
        
        // Store only image file references in storage (much smaller than base64 data)
        await chrome.storage.local.set({ 'pendingImageFiles': imageFiles });
        console.log(`[UI Automation] Stored ${imageFiles.length} image file references`);
    }
    
    // Small delay before navigation
    await sleep(1000);
    
    console.log('[UI Automation] Navigating to posting page...');
    sendProgress('Navigating to posting page...', currentStep++, totalSteps);
    
    // Navigate directly to the posting page
    document.location.replace('https://www.avto.net/_2016mojavtonet/ad_select_rubric_icons.asp?SID=10000');
    
    // Return a fake post ID since we're not actually creating a post
    return 'ui_automation_' + Date.now();
};

// https://stackoverflow.com/a/30580060
const getDirectLastText = (ele: Element) => {
    return Array.from(ele.childNodes).reduce(
        (acc, curr) => (curr.nodeType === 3 ? acc + curr.textContent : acc),
        ""
    );
};

type OnPageCarData = {
    make_model: string;
    shape: string;
    month: number;
    year: number;
};

chrome.runtime.onMessage.addListener(
    (
        msg: {
            type: "is_owned" | "create" | "republish" | "is_logged_in" | "current_car_data" | "queue_status";
            arg?: any;
            scheduledFor?: number; // Add this field
            repeatConfig?: RepeatConfig;
        },
        _,
        sendResponse
    ) => {
        if (msg.type === "is_owned") {
            const editBox = document.querySelector(".OglasMenuBoxDodatno");
            const alert = document.querySelector(".Alert");
            const alertGreen = document.querySelector(".Alert.Potrditev");
            sendResponse(!!editBox && (!alert || !!alertGreen));
        }

        // REMOVED DELETE HANDLER

        // Create job with proper callback
        if (msg.type === "create") {
            let jobId: string;
            const { arg, scheduledFor, repeatConfig } = msg;
            
            const jobData = {
                spec: arg.spec,
                images: arg.images,
                repeatConfig: repeatConfig // Include repeatConfig in job data
            };
            
            if (scheduledFor) {
                jobId = scheduler.addScheduledJob(
                    'create',
                    jobData, // This now includes repeatConfig
                    scheduledFor,
                    (status: JobStatus, message?: string) => {
                        console.log(`[Create Job] Status: ${status}${message ? ` - ${message}` : ''}`);
                    }
                );
            } else {
                jobId = scheduler.addJob(
                    'create', 
                    jobData, // This now includes repeatConfig
                    (status: JobStatus, message?: string) => {
                        console.log(`[Create Job] Status: ${status}${message ? ` - ${message}` : ''}`);
                    }
                );
            }
            
            // Remove the immediate repeat scheduling - it should happen after completion
            
            console.log(`[Scheduler] Create job ${jobId} queued successfully`);
            sendResponse({ jobId, message: 'Job queued for processing' });
            return false;
        }

        if (msg.type === "republish") {
            const arg = msg.arg as any;
            const id = new URL(window.location.href).searchParams.get('id') || 
                    window.location.href.match(/id=(\d+)/)?.[1];
                    
            if (!id) {
                sendResponse({ error: 'Could not determine post ID for republish' });
                return false;
            }

            const jobData = {
                spec: arg.spec,
                images: arg.images,
                deleteId: id,
                repeatConfig: msg.repeatConfig // Include repeatConfig
            };

            let jobId: string;
            
            if (msg.scheduledFor) {
                jobId = scheduler.addScheduledJob('republish', jobData, msg.scheduledFor, 
                    (status: JobStatus, message?: string) => {
                        console.log(`[Republish Job] Status: ${status}${message ? ` - ${message}` : ''}`);
                    }
                );
            } else {
                jobId = scheduler.addJob('republish', jobData,
                    (status: JobStatus, message?: string) => {
                        console.log(`[Republish Job] Status: ${status}${message ? ` - ${message}` : ''}`);
                    }
                );
            }
            
            console.log(`[Scheduler] Republish job ${jobId} queued successfully`);
            sendResponse({ jobId, message: 'Republish job queued for processing' });
            return false;
        }

        if (msg.type === "is_logged_in") {
            // Check multiple indicators of being logged in
            const uporabnikEl = document.querySelector(".uporabnik");
            const dashboardEl = document.querySelector(".OglasMenuBoxDodatno, .AdPreview, .merchant");
            
            // Check if we're on a dashboard/welcome page (indicates logged in)
            const isDashboardPage = window.location.href.includes("welcome.asp") || 
                                   window.location.href.includes("my.avto.net") ||
                                   document.body.textContent?.includes("Merchant ID:");
            
            // Check if we're on the posting page (only accessible when logged in)
            const isPostingPage = window.location.href.includes("ad_select_rubric_icons.asp") ||
                                 window.location.href.includes("ad_insert") ||
                                 window.location.href.includes("ad_insert_car_step2.asp") ||
                                 window.location.href.includes("ad_edit.asp") ||
                                 window.location.href.includes("ad_photos_edit_1by1.asp");
            
            // Check for "Post a new ad" button (only visible when logged in)
            const postAdButton = document.querySelector("a[href*='ad_insert']") || 
                                document.querySelector(".post-ad") ||
                                Array.from(document.querySelectorAll('button')).find(btn => 
                                    btn.textContent?.toLowerCase().includes('post')
                                );
            
            const isLoggedIn = !!(uporabnikEl || dashboardEl || isDashboardPage || postAdButton || isPostingPage);
            
            console.log("[Content Script] Login Check Elements found:", {
                uporabnik: !!uporabnikEl,
                dashboard: !!dashboardEl,
                isDashboardPage,
                isPostingPage,
                postAdButton: !!postAdButton,
                result: isLoggedIn
            });
            
            sendResponse(isLoggedIn);
        }

        // Get scheduler queue status
        if (msg.type === "queue_status") {
            sendResponse(scheduler.getQueueStatus());
        }

        if (msg.type === "current_car_data") {
            const editBox = document.querySelector(".OglasMenuBoxDodatno");
            if (!editBox) return sendResponse(undefined);

            const makeModelEl = document.querySelector<HTMLElement>(".OglasDataTitle h1");
            if (!makeModelEl) return sendResponse(undefined);

            const basicDataNodeList = document.querySelectorAll(".OglasData");
            if (!basicDataNodeList) return sendResponse(undefined);

            const basicDataArr = Array.from(basicDataNodeList);

            const shape = basicDataArr
                .find((it) => it.querySelector(".OglasDataLeft")?.textContent === "Oblika karoserije:")
                ?.querySelector(".OglasDataRight")
                ?.textContent?.trim();

            if (!shape) return sendResponse(undefined);

            const monthYear = basicDataArr
                .find((it) => it.querySelector(".OglasDataLeft")?.textContent === "Prva registracija:")
                ?.querySelector(".OglasDataRight")
                ?.textContent?.trim();

            if (!monthYear) return sendResponse(undefined);

            const [month, year] = monthYear.split("/");

            if (!month || !year) return sendResponse(undefined);

            const car: OnPageCarData = {
                make_model: getDirectLastText(makeModelEl)
                    .trim()
                    .replace(/\u00a0/g, " "),
                shape: shape,
                month: Number(month),
                year: Number(year),
            };

            return sendResponse(car);
        }
    }
);

// Keep deletePost function for republish functionality
const deletePost = async (id: string, redirect: boolean = true): Promise<void> => {
    const resp = await fetch(
        `https://www.avto.net/_2016mojavtonet/ad_delete.asp?id=${encodeURIComponent(id)}`,
        {
            method: "GET",
        }
    );

    console.log("delete post, status code:", resp.status);
    if (resp.status === 200) {
        if (redirect)
            document.location.replace(
                "https://www.avto.net/_2016mojavtonet/results321_makes.asp?arhiv=1"
            );
        return;
    }

    alert("Delete failed");
};

type ImageDescriptor = {
    mimetype: string;
    image: string;
};

type Car = {
    make: string;
    model: string;
    shape: string;
    month: number;
    year: number;
    fuel: number;
    type: string;
    VIN: string;
    publish_vin: boolean;
    age: number;
    guarantee: boolean;
    oldtimer: boolean;
    warranty: boolean;
    reg_month: number;
    reg_year: number;
    letnik: number;
    technical_month: number;
    technical_year: number;
    mileage: number;
    prev_owners: number;
    offer_type: number;
    price: number;
    cash_discount: boolean;
    final_price: boolean;
    leasing: boolean;
    installments: boolean;
    exchange: boolean;
    sold_whole: boolean;
    driveable: boolean;
    damaged: boolean;
    carambolised: boolean;
    in_failure: boolean;
    flooded: boolean;
    service_book: boolean;
    service_book_confirmed: boolean;
    slovenian_origin: boolean;
    garaged: boolean;
    not_carambolised: boolean;
    powertrain: string;
    gearbox: number;
    engine_strength: number;
    engine_strength_unit: string;
    engine_displacement: number;
    car_color: string;
    metalic: boolean;
    electric_car_roof: boolean;
    doors: number;
    sliding_door: boolean;
    seats: number;
    fuel_use_combined: number;
    emissions_standard: number;
    co2_emissions: number;
    publish_consumption: boolean;
    alu: boolean;
    alu_description: string;
    chassis_features: string;
    airbags: number;
    varnosti: string;
    inside: string;
    comfort: string;
    car_radio: boolean;
    car_radio_description: string;
    cd_disk: boolean;
    cd_description: string;
    hifi: boolean;
    hifi_description: string;
    multimedia: string;
    appliance: string;
    comment: string;
    car_roof?: string;
    oblazinjenje?: string;
};