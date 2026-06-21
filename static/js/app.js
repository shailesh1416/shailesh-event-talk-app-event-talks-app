document.addEventListener('DOMContentLoaded', () => {
    // ---------------------------------------------------------
    // DOM SELECTORS
    // ---------------------------------------------------------
    const feedContainer = document.getElementById('feed-container');
    const searchInput = document.getElementById('search-input');
    const categoryFilters = document.getElementById('category-filters');
    const refreshBtn = document.getElementById('refresh-btn');
    const syncIcon = document.getElementById('sync-icon');
    const exportBtn = document.getElementById('export-btn');
    
    // Toast elements
    const toast = document.getElementById('status-toast');
    const toastMsg = toast.querySelector('.toast-message');
    const toastCloseBtn = toast.querySelector('.toast-close-btn');

    // Composer elements
    const composerEmptyState = document.getElementById('composer-empty-state');
    const composerForm = document.getElementById('composer-form');
    const compCategoryBadge = document.getElementById('comp-category-badge');
    const compDateText = document.getElementById('comp-date-text');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charProgress = document.getElementById('char-progress');
    const charCount = document.getElementById('char-count');
    const charWarning = document.getElementById('char-warning');
    const tweetBtn = document.getElementById('tweet-btn');
    const origDocLink = document.getElementById('orig-doc-link');

    // ---------------------------------------------------------
    // APP STATE
    // ---------------------------------------------------------
    let allUpdates = [];
    let activeCategory = 'ALL';
    let searchQuery = '';
    let selectedUpdateId = null;
    let currentFilteredUpdates = [];

    // ---------------------------------------------------------
    // API ACTIONS
    // ---------------------------------------------------------
    async function fetchUpdates(forceRefresh = false) {
        setLoadingState(true);
        showToast(forceRefresh ? 'Syncing latest release notes from Google Cloud...' : 'Loading release notes...');

        try {
            const url = `/api/updates${forceRefresh ? '?force_refresh=true' : ''}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Server returned HTTP ${response.status}`);
            }

            const data = await response.json();
            allUpdates = data.updates || [];

            // If backend returned a fallback/cache error, show it
            if (data.error) {
                showToast(data.error, true);
            } else {
                const sourceText = data.source === 'cache' ? 'loaded from cache' : 'freshly synced';
                showToast(`Success: ${allUpdates.length} updates ${sourceText}!`);
            }

            applyFilters();
            
            // Auto-select first card if list is not empty and no card is selected
            if (allUpdates.length > 0 && !selectedUpdateId) {
                const firstCard = document.querySelector('.update-card');
                if (firstCard) {
                    firstCard.click();
                }
            } else if (selectedUpdateId) {
                // Keep the selection if it still exists
                const updateExists = allUpdates.find(u => u.id === selectedUpdateId);
                if (updateExists) {
                    selectUpdate(updateExists);
                } else {
                    resetComposer();
                }
            }

        } catch (error) {
            console.error('Error fetching release notes:', error);
            showToast(`Error: ${error.message || 'Failed to load updates. Check server logs.'}`, true);
            
            // Show empty state if there are no cards
            if (allUpdates.length === 0) {
                renderEmptyFeed('Failed to fetch data. Try syncing again.');
            }
        } finally {
            setLoadingState(false);
        }
    }

    // ---------------------------------------------------------
    // RENDERING & FILTERING
    // ---------------------------------------------------------
    function applyFilters() {
        const filtered = allUpdates.filter(update => {
            // Category check
            const matchesCategory = (activeCategory === 'ALL' || 
                update.category.toUpperCase() === activeCategory.toUpperCase());
            
            // Search query check
            const searchLower = searchQuery.toLowerCase().trim();
            const matchesSearch = !searchLower || 
                update.category.toLowerCase().includes(searchLower) ||
                update.date.toLowerCase().includes(searchLower) ||
                update.content_text.toLowerCase().includes(searchLower);

            return matchesCategory && matchesSearch;
        });

        currentFilteredUpdates = filtered;
        renderUpdates(filtered);
    }

    function renderUpdates(updates) {
        feedContainer.innerHTML = '';

        if (updates.length === 0) {
            renderEmptyFeed('No matching release notes found.');
            return;
        }

        updates.forEach(update => {
            const card = document.createElement('article');
            card.className = `update-card ${selectedUpdateId === update.id ? 'selected' : ''}`;
            card.dataset.id = update.id;
            
            // Map category to class names for border colors and badges
            const catLower = update.category.toLowerCase();
            let catClass = 'update';
            if (['feature', 'fix', 'announcement', 'change'].includes(catLower)) {
                catClass = catLower;
            }
            
            card.style.setProperty('--card-accent', `var(--cat-${catClass})`);

            card.innerHTML = `
                <div class="card-header">
                    <span class="badge ${catClass}">${update.category}</span>
                    <time class="card-date">${update.date}</time>
                </div>
                <div class="card-body">
                    ${update.content_html}
                </div>
                <div class="card-footer">
                    <button class="btn-card-action btn-copy-card" aria-label="Copy update details to clipboard">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                        <span>Copy</span>
                    </button>
                    <button class="btn-card-action btn-export-card" aria-label="Export this card to CSV">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="7 10 12 15 17 10"/>
                            <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        <span>CSV</span>
                    </button>
                    <button class="btn-card-action btn-draft-card" aria-label="Compose tweet for this update">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Draft Post</span>
                    </button>
                </div>
            `;

            // Clipboard Copy handler (Copies ONLY raw description text)
            const copyBtn = card.querySelector('.btn-copy-card');
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents selecting the card when copying
                const textToCopy = update.content_text; // Copy ONLY card description

                // Secure Context Check
                if (navigator.clipboard) {
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        const textSpan = copyBtn.querySelector('span');
                        const originalText = textSpan.textContent;
                        textSpan.textContent = 'Copied!';
                        copyBtn.classList.add('copied');
                        setTimeout(() => {
                            textSpan.textContent = originalText;
                            copyBtn.classList.remove('copied');
                        }, 1500);
                    }).catch(err => {
                        console.error('Failed to copy: ', err);
                        showToast('Failed to copy to clipboard', true);
                    });
                } else {
                    // Fallback clipboard method using temporary textarea
                    const tempInput = document.createElement('textarea');
                    tempInput.value = textToCopy;
                    tempInput.style.position = 'fixed';
                    tempInput.style.opacity = '0';
                    document.body.appendChild(tempInput);
                    tempInput.select();
                    try {
                        document.execCommand('copy');
                        const textSpan = copyBtn.querySelector('span');
                        const originalText = textSpan.textContent;
                        textSpan.textContent = 'Copied!';
                        copyBtn.classList.add('copied');
                        setTimeout(() => {
                            textSpan.textContent = originalText;
                            copyBtn.classList.remove('copied');
                        }, 1500);
                    } catch (err) {
                        showToast('Failed to copy to clipboard', true);
                    }
                    document.body.removeChild(tempInput);
                }
            });

            // Single Card CSV Export handler (Exports ONLY this card's details)
            const cardExportBtn = card.querySelector('.btn-export-card');
            cardExportBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents selecting the card when exporting
                exportToCSV([update]);
            });

            // Click listener for selecting card
            card.addEventListener('click', () => {
                // Toggle active card CSS
                document.querySelectorAll('.update-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                
                selectedUpdateId = update.id;
                selectUpdate(update);
            });

            feedContainer.appendChild(card);
        });
    }

    function renderEmptyFeed(message) {
        feedContainer.innerHTML = `
            <div class="empty-feed">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
                <p style="margin-top: 1rem; font-weight: 500;">${message}</p>
            </div>
        `;
    }

    // ---------------------------------------------------------
    // COMPOSER LOGIC
    // ---------------------------------------------------------
    function selectUpdate(update) {
        // Show composer form
        composerEmptyState.classList.add('hidden');
        composerForm.classList.remove('hidden');

        // Setup details
        compCategoryBadge.textContent = update.category;
        compCategoryBadge.className = `badge ${update.category.toLowerCase()}`;
        compDateText.textContent = update.date;
        origDocLink.href = update.ref_link;

        // Auto-generate character limit safe draft
        // Base structure: BigQuery Release (Date) - Category: [Summary] Read more: [Link]
        const prefix = `BigQuery Release (${update.date}) - ${update.category}:\n\n`;
        const suffix = `\n\nRead more: ${update.ref_link}`;
        
        // Calculate maximum description characters allowed
        const reservedLen = prefix.length + suffix.length;
        const maxDescLen = 280 - reservedLen;
        
        let desc = update.content_text.trim();
        if (desc.length > maxDescLen) {
            // Subtract extra for the ellipsis (...)
            desc = desc.substring(0, maxDescLen - 3) + '...';
        }

        const draftTweet = `${prefix}${desc}${suffix}`;
        tweetTextarea.value = draftTweet;

        updateCharCount();
        
        // On mobile, scroll composer into view smoothly
        if (window.innerWidth <= 900) {
            composerSidebar.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function resetComposer() {
        composerEmptyState.classList.remove('hidden');
        composerForm.classList.add('hidden');
        selectedUpdateId = null;
        document.querySelectorAll('.update-card').forEach(c => c.classList.remove('selected'));
    }

    function updateCharCount() {
        const text = tweetTextarea.value;
        const count = text.length;
        charCount.textContent = `${count} / 280`;

        // Update progress bar
        const percentage = Math.min((count / 280) * 100, 100);
        charProgress.style.width = `${percentage}%`;

        // Clear warning classes
        charProgress.className = 'progress-bar';
        charCount.className = 'char-count';
        charWarning.classList.add('hidden');
        tweetBtn.disabled = false;

        if (count > 280) {
            charProgress.classList.add('danger');
            charCount.classList.add('danger');
            charWarning.classList.remove('hidden');
            tweetBtn.disabled = true;
        } else if (count > 240) {
            charProgress.classList.add('warning');
            charCount.classList.add('warning');
        }
    }

    function shareOnX() {
        const text = tweetTextarea.value.trim();
        if (!text || text.length > 280) return;

        // X (Twitter) Share Intent URL
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(shareUrl, '_blank', 'noopener,noreferrer');
    }

    // ---------------------------------------------------------
    // UI FEEDBACKS
    // ---------------------------------------------------------
    function setLoadingState(isLoading) {
        if (isLoading) {
            refreshBtn.disabled = true;
            syncIcon.classList.add('spinning');
            // If feed is empty, show loading skeletons
            if (allUpdates.length === 0) {
                feedContainer.querySelectorAll('.update-card, .empty-feed').forEach(el => el.classList.add('hidden'));
                feedContainer.querySelectorAll('.skeleton-card').forEach(el => el.classList.remove('hidden'));
            }
        } else {
            refreshBtn.disabled = false;
            syncIcon.classList.remove('spinning');
            feedContainer.querySelectorAll('.skeleton-card').forEach(el => el.classList.add('hidden'));
        }
    }

    let toastTimeout;
    function showToast(message, isError = false) {
        clearTimeout(toastTimeout);
        
        toastMsg.textContent = message;
        toast.className = `toast show ${isError ? 'toast-error' : ''}`;
        
        // Auto hide after 4 seconds unless it's a critical error
        if (!isError) {
            toastTimeout = setTimeout(() => {
                toast.classList.remove('show');
            }, 4000);
        }
    }

    // ---------------------------------------------------------
    // EVENT LISTENERS
    // ---------------------------------------------------------
    // Export CSV Button
    exportBtn.addEventListener('click', () => {
        exportToCSV(currentFilteredUpdates);
    });

    // Sync Button
    refreshBtn.addEventListener('click', () => {
        fetchUpdates(true);
    });

    // Search Input
    let searchDebounce;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(() => {
            searchQuery = e.target.value;
            applyFilters();
        }, 150); // fast responsive search
    });

    // Category Pill Clicks
    categoryFilters.addEventListener('click', (e) => {
        const targetPill = e.target.closest('.pill');
        if (!targetPill) return;

        // Remove active class from other pills
        categoryFilters.querySelectorAll('.pill').forEach(pill => pill.classList.remove('active'));
        targetPill.classList.add('active');

        activeCategory = targetPill.dataset.category;
        applyFilters();
    });

    // Tweet composition input trigger
    tweetTextarea.addEventListener('input', updateCharCount);

    // Share Button
    tweetBtn.addEventListener('click', shareOnX);

    // Toast Close Button
    toastCloseBtn.addEventListener('click', () => {
        toast.classList.remove('show');
    });

    // CSV Exporter Helper
    function exportToCSV(updatesToExport) {
        if (updatesToExport.length === 0) {
            showToast('No updates to export', true);
            return;
        }

        const headers = ['Date', 'Category', 'Summary', 'Reference Link'];
        
        const escapeCSV = (val) => {
            if (val === null || val === undefined) return '';
            let formatted = val.toString().trim();
            formatted = formatted.replace(/"/g, '""');
            if (formatted.includes('"') || formatted.includes(',') || formatted.includes('\n') || formatted.includes('\r')) {
                formatted = `"${formatted}"`;
            }
            return formatted;
        };

        const csvRows = [
            headers.join(','),
            ...updatesToExport.map(update => [
                escapeCSV(update.date),
                escapeCSV(update.category),
                escapeCSV(update.content_text),
                escapeCSV(update.ref_link)
            ].join(','))
        ];

        const csvContent = '\uFEFF' + csvRows.join('\r\n'); // Add UTF-8 BOM
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const dateStr = new Date().toISOString().slice(0, 10);
        
        link.href = url;
        link.setAttribute('download', `bigquery_release_notes_${dateStr}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast(`Successfully exported ${updatesToExport.length} updates to CSV!`);
    }

    // ---------------------------------------------------------
    // INITIALIZATION
    // ---------------------------------------------------------
    fetchUpdates(false);
});
