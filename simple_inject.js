// Simple approach - inject into PhotoInputLabel and click ADD
window.simpleInject = async function(file, photoNumber) {
    console.log(`[UI Automation] Simple inject for image ${photoNumber}`);
    
    if (!file) {
        console.log(`[UI Automation] No file for photo ${photoNumber}`);
        return;
    }
    
    // Find the PhotoInputLabel container
    const photoInputLabel = document.querySelector('.PhotoInputLabel');
    
    if (photoInputLabel) {
        console.log(`[UI Automation] Found PhotoInputLabel container`);
        
        // Create image URL
        const imageUrl = URL.createObjectURL(file);
        
        // Create image element
        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.width = '100px';
        img.style.height = '100px';
        img.style.objectFit = 'cover';
        img.style.border = '3px solid green';
        img.style.margin = '5px';
        img.title = `Image ${photoNumber}: ${file.name}`;
        
        // Inject image into the PhotoInputLabel
        photoInputLabel.insertBefore(img, photoInputLabel.firstChild);
        
        console.log(`[UI Automation] ✅ Injected image ${photoNumber} into PhotoInputLabel`);
        
        // Now click the ADD button for this photo
        const addButton = document.querySelector(`input[name="gumb${photoNumber}"][value="ADD"]`);
        
        if (addButton) {
            console.log(`[UI Automation] Clicking ADD button for photo ${photoNumber}`);
            addButton.click();
            console.log(`[UI Automation] ✅ Clicked ADD button for photo ${photoNumber}`);
        } else {
            console.log(`[UI Automation] ❌ Could not find ADD button for photo ${photoNumber}`);
        }
        
    } else {
        console.log(`[UI Automation] ❌ Could not find PhotoInputLabel container`);
    }
};

console.log('[UI Automation] Simple inject function ready as window.simpleInject');
