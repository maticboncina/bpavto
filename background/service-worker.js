// Background script to handle image storage for DataTransfer technique
// This avoids quota issues by storing ImageDescriptor objects in memory

// In-memory storage for images and files
const imageStorage = new Map();
const fileStorage = new Map();

console.log('[Background] Service worker started');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Received message:', message.type);
    
    if (message.type === 'STORE_IMAGES') {
        // Store images in memory with the provided jobId
        const { jobId, images } = message;
        
        console.log(`[Background] Storing ${images.length} images for jobId: ${jobId}`);
        
        // Store ImageDescriptor objects directly
        imageStorage.set(jobId, images);
        console.log(`[Background] Stored ${images.length} images directly`);
        
        // Send success response
        sendResponse({ success: true, stored: images.length });
        return;
    }
    
    if (message.type === 'GET_IMAGES') {
        // Retrieve images and send them back to content script
        const { jobId } = message;
        
        console.log(`[Background] Retrieving images for jobId: ${jobId}`);
        const images = imageStorage.get(jobId);
        
        if (images) {
            console.log(`[Background] Found ${images.length} images for jobId: ${jobId}`);
            
            // Send images back directly
            chrome.tabs.sendMessage(sender.tab.id, {
                type: 'UPLOAD_IMAGES',
                jobId: jobId,
                images: images
            }, (response) => {
                console.log(`[Background] Sent images to tab, response:`, response);
            });
            
            sendResponse({ success: true, found: images.length });
        } else {
            console.log(`[Background] No images found for jobId: ${jobId}`);
            sendResponse({ success: false, error: 'No images found' });
        }
        return true; // Keep message channel open
    }
    
    if (message.type === 'CLEANUP_IMAGES') {
        // Clean up stored images to free memory
        const { jobId } = message;
        
        console.log(`[Background] Cleaning up images for jobId: ${jobId}`);
        const deleted = imageStorage.delete(jobId);
        
        sendResponse({ success: deleted });
        return;
    }
    
    // Keep existing handlers for backward compatibility
    if (message.type === 'STORE_FILES') {
        // Store files in memory with the provided jobId
        const { jobId, files } = message;
        
        console.log(`[Background] Storing ${files.length} files for jobId: ${jobId}`);
        
        // Store files directly without conversion (they should already be File objects)
        fileStorage.set(jobId, files);
        console.log(`[Background] Stored ${files.length} files directly`);
        
        // Send success response
        sendResponse({ success: true, stored: files.length });
        return;
    }
    
    if (message.type === 'GET_FILES') {
        // Retrieve files and send them back to content script
        const { jobId } = message;
        
        console.log(`[Background] Retrieving files for jobId: ${jobId}`);
        const files = fileStorage.get(jobId);
        
        if (files) {
            console.log(`[Background] Found ${files.length} files for jobId: ${jobId}`);
            
            // Send files back directly (no conversion needed)
            chrome.tabs.sendMessage(sender.tab.id, {
                type: 'UPLOAD_FILES',
                jobId: jobId,
                files: files
            }, (response) => {
                console.log(`[Background] Sent files to tab, response:`, response);
            });
            
            sendResponse({ success: true, found: files.length });
        } else {
            console.log(`[Background] No files found for jobId: ${jobId}`);
            sendResponse({ success: false, error: 'No files found' });
        }
        return true; // Keep message channel open
    }
    
    if (message.type === 'CLEANUP_FILES') {
        // Clean up stored files to free memory
        const { jobId } = message;
        
        console.log(`[Background] Cleaning up files for jobId: ${jobId}`);
        const deleted = fileStorage.delete(jobId);
        
        sendResponse({ success: deleted });
        return;
    }
    
    if (message.type === 'DOWNLOAD_FILE') {
        // Handle file download using Chrome downloads API
        const { url, filename } = message;
        
        console.log(`[Background] Starting download: ${filename}`);
        
        if (chrome && chrome.downloads) {
            chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: false, // Don't prompt user, save directly
                conflictAction: 'overwrite' // Overwrite if file exists
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error('[Background] Download failed:', chrome.runtime.lastError);
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    console.log(`[Background] Download started with ID: ${downloadId}`);
                    sendResponse({ success: true, downloadId: downloadId });
                }
            });
        } else {
            console.error('[Background] Chrome downloads API not available');
            sendResponse({ success: false, error: 'Downloads API not available' });
        }
        return true; // Keep message channel open for async response
    }
    
    // Handle other message types (keep existing functionality)
    if (message.type === 'posting_progress') {
        // Forward progress messages if needed
        console.log(`[Background] Progress: ${message.message}`);
        return;
    }
});

// Optional: Clean up old files periodically to prevent memory leaks
setInterval(() => {
    console.log(`[Background] Storage status: ${imageStorage.size} image jobs, ${fileStorage.size} file jobs stored`);
    
    // Optional: Implement cleanup of old files based on timestamp
    // For now, just log the status
}, 300000); // Every 5 minutes
