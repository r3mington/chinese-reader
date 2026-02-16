import { get, set } from 'idb-keyval';

const STATS_KEY = 'reading_stats';
const STORY_CPM_KEY = 'story_cpm_stats';

// Initial state
const defaultStats = {
    totalMinutes: 0,
    dailyLog: {}, // { "YYYY-MM-DD": minutes }
    lastActive: Date.now(),
};

let currentSessionStart = null;
let savedStats = null;

// CPM tracking
let scrollEvents = []; // Array of { timestamp, charsRead }
let currentStoryId = null;
let storyStartTime = null;
let storyStartPosition = null; // Track where reading started in the story
let storyTotalChars = 0;
let lastScrollTime = null;
let storyCpmData = {}; // { storyId: { totalChars, totalSeconds, avgCpm } }

export const loadStats = async () => {
    try {
        savedStats = await get(STATS_KEY) || defaultStats;
        storyCpmData = await get(STORY_CPM_KEY) || {};
    } catch (e) {
        console.warn('Failed to load stats', e);
        savedStats = defaultStats;
        storyCpmData = {};
    }
    return savedStats;
};

export const startReadingSession = () => {
    currentSessionStart = Date.now();
};

export const endReadingSession = async () => {
    if (!currentSessionStart) return;

    const now = Date.now();
    const durationMinutes = (now - currentSessionStart) / 1000 / 60;

    if (durationMinutes > 0) {
        await updateReadingTime(durationMinutes);
    }

    currentSessionStart = null;
};

export const updateReadingTime = async (minutes) => {
    if (!savedStats) await loadStats();

    const today = new Date().toISOString().split('T')[0];

    savedStats.totalMinutes += minutes;
    savedStats.dailyLog[today] = (savedStats.dailyLog[today] || 0) + minutes;
    savedStats.lastActive = Date.now();

    try {
        await set(STATS_KEY, savedStats);
        // Dispatch event for UI updates
        window.dispatchEvent(new CustomEvent('statsUpdated', { detail: savedStats }));
    } catch (e) {
        console.warn('Failed to save stats', e);
    }
};

export const getReadingStats = async () => {
    if (!savedStats) await loadStats();

    const today = new Date().toISOString().split('T')[0];
    const daily = savedStats.dailyLog[today] || 0;

    // Calculate weekly (last 7 days)
    let weekly = 0;
    const now = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        weekly += savedStats.dailyLog[dateStr] || 0;
    }

    return {
        daily: Math.round(daily),
        weekly: Math.round(weekly),
        total: Math.round(savedStats.totalMinutes)
    };
};

// CPM Tracking Functions
export const initStoryTracking = (storyId) => {
    currentStoryId = storyId;
    storyStartTime = null; // Will be set on first scroll
    storyTotalChars = 0;
    storyStartPosition = null; // Track where reading started
    scrollEvents = [];
    lastScrollTime = null;
};

export const trackScrollProgress = (charsRead) => {
    const now = Date.now();

    // Initialize on first scroll
    if (storyStartPosition === null) {
        storyStartPosition = charsRead;
        storyStartTime = now;
        lastScrollTime = now;
        // Seed the scroll events with t=0 (now) and chars=0 so we have an anchor
        scrollEvents.push({ timestamp: now, charsRead: 0 });
        return;
    }

    // Detect pause (>5 minutes since last scroll) - effectively a new session
    if (lastScrollTime && (now - lastScrollTime) > 300000) {
        // Reset story timer after long pause
        storyStartTime = now;
        storyStartPosition = charsRead;
        storyTotalChars = 0;
        scrollEvents = [{ timestamp: now, charsRead: 0 }];
    }

    lastScrollTime = now;

    // Calculate characters read from start position
    const currentProgress = charsRead - storyStartPosition;

    // Only track forward progress
    if (currentProgress > storyTotalChars) {
        const charsAdded = currentProgress - storyTotalChars;

        // Add to rolling window (incremental chars only)
        scrollEvents.push({ timestamp: now, charsRead: charsAdded });

        // Remove events older than 60 seconds
        scrollEvents = scrollEvents.filter(e => (now - e.timestamp) <= 60000);

        // Update story total
        storyTotalChars = currentProgress;

        // Calculate story average based on time since story start
        if (currentStoryId && storyStartTime) {
            const elapsedSeconds = (now - storyStartTime) / 1000;

            // Only update story CPM after 5 seconds of reading to avoid spikes
            if (elapsedSeconds > 5) {
                // Use the cumulative chars read from start of session
                const avgCpm = Math.round((storyTotalChars / elapsedSeconds) * 60);

                // Save to storage
                storyCpmData[currentStoryId] = {
                    totalChars: storyTotalChars,
                    totalSeconds: elapsedSeconds,
                    avgCpm
                };

                // Persist
                set(STORY_CPM_KEY, storyCpmData).catch(e => console.warn('Failed to save CPM', e));
            }
        }

        // Dispatch CPM update event
        dispatchCpmUpdate();
    }
};

export const getCpmStats = () => {
    const now = Date.now();

    // Calculate 5m CPM
    let recentCpm = '--';

    // Filter events for the calculation window (last 5m)
    // Note: We do this filter here too for display accuracy
    const activeEvents = scrollEvents.filter(e => (now - e.timestamp) <= 300000);

    if (activeEvents.length > 0) {
        const totalChars = activeEvents.reduce((sum, e) => sum + e.charsRead, 0);
        const oldestEvent = activeEvents[0];

        // Use time relative to NOW to account for reading time (pauses between scrolls)
        // Ensure we don't divide by zero or very small numbers
        const timeSpan = Math.max(1, (now - oldestEvent.timestamp) / 1000);

        // Only show valid stats if we have > 0 chars and > 2s of history
        if (totalChars > 0 && timeSpan >= 2) {
            recentCpm = Math.round((totalChars / timeSpan) * 60);
        } else if (activeEvents.length > 2) {
            // If we have events but 0 chars (static), CPM is 0
            // Or if we just started
            if (timeSpan >= 2) recentCpm = 0;
        }
    }

    // User requested only ONE rolling 60s measure
    // We return recentCpm but maybe label it just 'cpm'
    return { cpm: recentCpm };
};

const dispatchCpmUpdate = () => {
    const cpmStats = getCpmStats();
    window.dispatchEvent(new CustomEvent('cpmUpdated', { detail: cpmStats }));
};
