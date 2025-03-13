// Document management functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize event listeners
    const deleteAllDocsBtn = document.getElementById('deleteAllDocs');
    if (deleteAllDocsBtn) {
        deleteAllDocsBtn.addEventListener('click', handleDeleteAll);
    }

    // File upload functionality
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const selectedFiles = document.getElementById('selectedFiles');
    const error = document.getElementById('error');

    if (fileInput && uploadButton && selectedFiles) {
        // Handle file selection
        fileInput.addEventListener('change', function() {
            const files = Array.from(this.files);
            if (files.length > 0) {
                // Clear previous selection
                selectedFiles.innerHTML = '';
                
                // Display selected files
                files.forEach(file => {
                    const fileDiv = document.createElement('div');
                    fileDiv.className = 'selected-file d-flex align-items-center gap-2 p-2 mb-2 rounded';
                    fileDiv.style.backgroundColor = 'var(--surface-color-hover)';
                    fileDiv.innerHTML = `
                        <i class="fas fa-file-alt" style="color: var(--text-tertiary);"></i>
                        <span style="color: var(--text-primary);">${file.name}</span>
                        <span class="ms-auto" style="color: var(--text-secondary); font-size: var(--font-size-sm);">
                            ${(file.size / 1024).toFixed(1)} KB
                        </span>
                    `;
                    selectedFiles.appendChild(fileDiv);
                });

                // Enable upload button
                uploadButton.disabled = false;
                error.style.display = 'none';
            } else {
                // Clear selection and disable upload button
                selectedFiles.innerHTML = '';
                uploadButton.disabled = true;
            }
        });

        // Handle file upload
        uploadButton.addEventListener('click', async function() {
            const files = fileInput.files;
            if (!files.length) return;

            try {
                // Show loading state
                uploadButton.disabled = true;
                uploadButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

                // Create form data
                const formData = new FormData();
                for (let i = 0; i < files.length; i++) {
                    formData.append('files', files[i]);
                }

                // Upload files
                const response = await fetch('/api/documents', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Failed to upload files');
                }

                // Clear selection and reset UI
                fileInput.value = '';
                selectedFiles.innerHTML = '';
                uploadButton.disabled = true;
                uploadButton.innerHTML = '<i class="fas fa-upload"></i> Upload Files';

                // Show success message and reload documents
                showToast('Files uploaded successfully', 'success');
                await loadDocuments();
            } catch (e) {
                console.error('Error uploading files:', e);
                error.textContent = `Error uploading files: ${e.message}`;
                error.style.display = 'block';
                uploadButton.disabled = false;
                uploadButton.innerHTML = '<i class="fas fa-upload"></i> Upload Files';
            }
        });
    }

    // Initial load
    loadDocuments();
});

// Load documents with modern UI
async function loadDocuments() {
    const documentList = document.getElementById('documentList');
    const documentCount = document.getElementById('documentCount');
    const noDocuments = document.getElementById('noDocuments');
    const error = document.getElementById('error');

    try {
        const response = await fetch('/api/documents');
        if (!response.ok) throw new Error('Failed to load documents');
        const data = await response.json();
        
        documentCount.textContent = `${data.documents.length} document${data.documents.length !== 1 ? 's' : ''}`;
        noDocuments.style.display = data.documents.length === 0 ? 'block' : 'none';
        documentList.innerHTML = '';
        
        data.documents.forEach(doc => {
            const docDiv = document.createElement('div');
            docDiv.className = 'p-4 document-item';
            docDiv.style.transition = 'background-color var(--transition-fast) ease';
            docDiv.dataset.docId = doc.id;
            
            // Truncate content for preview
            const truncatedContent = doc.content.length > 500 
                ? doc.content.substring(0, 500) + '...' 
                : doc.content;
            
            // Escape HTML to prevent XSS
            const escapeHtml = (unsafe) => {
                return unsafe
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;")
                    .replace(/"/g, "&quot;")
                    .replace(/'/g, "&#039;");
            };
            
            const safeContent = escapeHtml(truncatedContent);
            
            // Create the inner content div
            const contentDiv = document.createElement('div');
            contentDiv.className = 'd-flex justify-content-between align-items-start gap-4';
            contentDiv.innerHTML = `
                <div style="flex: 1; max-width: calc(100% - 50px);">
                    <div class="d-flex align-items-center gap-3 mb-3">
                        <div class="d-flex align-items-center gap-2">
                            <i class="fas fa-file-alt" style="color: var(--color-primary);"></i>
                            <span class="font-medium" style="color: var(--text-primary);">${escapeHtml(doc.metadata.filename || 'Untitled')}</span>
                        </div>
                        <span class="px-2 py-1 rounded-full text-xs" 
                              style="background-color: var(--surface-color-hover); color: var(--text-secondary);">
                            ${escapeHtml(doc.metadata.content_type || 'text')}
                        </span>
                    </div>
                    <button class="btn btn-sm btn-outline d-inline-flex align-items-center gap-2" 
                            onclick="toggleContent(this)" 
                            style="color: var(--text-secondary);">
                        <i class="fas fa-chevron-down"></i>
                        <span>Show Content</span>
                    </button>
                    <div class="document-preview hidden mt-3 p-3 rounded" 
                         style="background-color: var(--surface-color-hover); font-family: var(--font-family-mono); font-size: var(--font-size-sm);">
                        ${safeContent}
                    </div>
                </div>
                <div>
                    <button class="btn btn-sm btn-outline" 
                            onclick="deleteDocument('${doc.id}')" 
                            style="color: var(--color-error);">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            docDiv.appendChild(contentDiv);
            
            docDiv.addEventListener('mouseover', function() {
                this.style.backgroundColor = 'var(--surface-color-hover)';
            });
            
            docDiv.addEventListener('mouseout', function() {
                this.style.backgroundColor = 'transparent';
            });
            
            documentList.appendChild(docDiv);
        });
    } catch (e) {
        error.textContent = `Error loading documents: ${e.message}`;
        error.style.display = 'block';
    }
}

// Toggle content visibility
function toggleContent(button) {
    const preview = button.nextElementSibling;
    const isHidden = preview.classList.contains('hidden');
    
    preview.classList.toggle('hidden');
    button.innerHTML = isHidden
        ? '<i class="fas fa-chevron-up mr-1"></i> Hide Content'
        : '<i class="fas fa-chevron-down mr-1"></i> Show Content';
}

// Delete single document with confirmation
async function deleteDocument(docId) {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    try {
        const response = await fetch(`/api/documents/${docId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to delete document');
        await loadDocuments();
        showToast('Document deleted successfully', 'success');
    } catch (e) {
        console.error('Error deleting document:', e);
        showToast(`Error deleting document: ${e.message}`, 'error');
    }
}

// Handle delete all documents
async function handleDeleteAll() {
    try {
        // First, fetch the list of documents
        const response = await fetch('/api/documents');
        const data = await response.json();
        
        if (!data.documents || data.documents.length === 0) {
            showToast('No documents to delete', 'info');
            return;
        }

        // Create and show confirmation dialog
        const dialog = document.createElement('div');
        dialog.innerHTML = `
            <div class="dialog-overlay"></div>
            <div class="confirmation-dialog">
                <div class="dialog-content">
                    <p>Delete All Documents?</p>
                    <p>This action cannot be undone. All documents will be permanently deleted.</p>
                </div>
                <div class="dialog-buttons">
                    <button class="dialog-button dialog-button-cancel">Cancel</button>
                    <button class="dialog-button dialog-button-confirm">Delete All</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);

        // Handle dialog actions
        const handleConfirm = async () => {
            try {
                // Show loading state
                const loadingToast = showToast('Deleting all documents...', 'info', false);
                let failedCount = 0;

                // Delete documents one by one
                for (const doc of data.documents) {
                    try {
                        const response = await fetch(`/api/documents/${doc.id}`, {
                            method: 'DELETE'
                        });

                        if (!response.ok) {
                            failedCount++;
                            console.error(`Failed to delete document ${doc.id}`);
                        }
                    } catch (error) {
                        failedCount++;
                        console.error(`Error deleting document ${doc.id}:`, error);
                    }
                }

                // Remove loading toast
                loadingToast.remove();

                // Show result message
                if (failedCount === 0) {
                    showToast('All documents deleted successfully', 'success');
                } else if (failedCount === data.documents.length) {
                    showToast('Failed to delete documents', 'error');
                } else {
                    showToast(`Deleted ${data.documents.length - failedCount} out of ${data.documents.length} documents`, 'info');
                }

                // Refresh document list
                await loadDocuments();
            } catch (error) {
                console.error('Error in delete all operation:', error);
                showToast('Failed to delete all documents', 'error');
            } finally {
                dialog.remove();
            }
        };

        const handleCancel = () => {
            dialog.remove();
        };

        // Add click handlers to dialog buttons
        dialog.querySelector('.dialog-button-confirm').addEventListener('click', handleConfirm);
        dialog.querySelector('.dialog-button-cancel').addEventListener('click', handleCancel);
        dialog.querySelector('.dialog-overlay').addEventListener('click', handleCancel);

    } catch (error) {
        console.error('Error fetching documents:', error);
        showToast('Failed to fetch documents', 'error');
    }
}

// Toast notification function
function showToast(message, type = 'info', autoHide = true) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 24px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
        color: white;
    `;

    // Set background color based on type
    switch (type) {
        case 'success':
            toast.style.backgroundColor = '#10B981';
            break;
        case 'error':
            toast.style.backgroundColor = '#EF4444';
            break;
        case 'info':
            toast.style.backgroundColor = '#3B82F6';
            break;
        default:
            toast.style.backgroundColor = '#6B7280';
    }

    toast.textContent = message;
    document.body.appendChild(toast);

    // Fade in
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);

    if (autoHide) {
        // Fade out and remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 300);
        }, 3000);
    }

    return toast;
} 