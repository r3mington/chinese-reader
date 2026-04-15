import React, { useState, useEffect, useRef } from 'react';
import { lookupAt } from '../lib/dictionary';
import { saveBookmark, getBookmark } from '../lib/storage';
import { startReadingSession, endReadingSession, initStoryTracking, trackScrollProgress, trackSessionLookup, pauseStats, resumeStats, getIsPaused, checkpointSession, recoverSessionDraft } from '../lib/stats';
import { trackWordClick, getVocabularyList } from '../lib/vocabulary';
import { useIsMobile } from '../lib/useIsMobile';
import { tokenizeText } from '../lib/tokenizer';
import { translateParagraph } from '../lib/translate';
import { shouldShowRecap, getPreviousContext } from '../lib/recap';
import WordPopup from './WordPopup';
import MobileBottomSheet from './MobileBottomSheet';
import ColorizedText from './ColorizedText';
import FloatingActionMenu from './FloatingActionMenu';
import RecentLookups from './RecentLookups';
import LexiconSidebar from './LexiconSidebar';
import StatsToolbar from './StatsToolbar';
import PreviouslyCard from './PreviouslyCard';
import { checkToneSandhi } from '../lib/tones';
import '../styles/oled.css';

const Reader = ({ story, onViewGlobalStats }) => {
    const [fontSize, setFontSize] = useState(() => {
        return parseInt(localStorage.getItem('fontSize')) || 20;
    });
    const [hoverPopupData, setHoverPopupData] = useState(null);
    const [lockedPopupData, setLockedPopupData] = useState(null);
    const popupData = hoverPopupData || lockedPopupData;

    const [toneColorsEnabled, setToneColorsEnabled] = useState(() => {
        return localStorage.getItem('toneColorsEnabled') === 'true';
    });
    const [lookedUpWords, setLookedUpWords] = useState(new Set());
    const [recentWordsList, setRecentWordsList] = useState([]); // Track recent words for watermark animation
    const [properNames, setProperNames] = useState(new Set());
    const [readingProgress, setReadingProgress] = useState(0);

    const [hoverHighlight, setHoverHighlight] = useState(null);
    const [lockedHighlight, setLockedHighlight] = useState(null);
    const activeHighlight = hoverHighlight || lockedHighlight;

    const [starAnimationWord, setStarAnimationWord] = useState(null);

    const [isPaused, setIsPaused] = useState(getIsPaused());

    const contentRef = useRef(null);
    const hoverTimer = useRef(null);
    const navSaveTimeoutRef = useRef(null);
    const isRestoringScroll = useRef(true);
    const isMobile = useIsMobile();

    // "Previously..." recap card state
    const [recapData, setRecapData] = useState(null); // { paragraphs, bookmarkCharIndex, lastRead }

    useEffect(() => {
        const loadWords = async () => {
            const list = await getVocabularyList();
            setLookedUpWords(new Set(list.map(w => w.word)));
        };
        const loadNames = async () => {
            const names = await import('../lib/names').then(m => m.getProperNames());
            setProperNames(new Set(names));
        };
        loadWords();
        loadNames();

        const handleNamesChanged = (e) => {
            setProperNames(prev => {
                const next = new Set(prev);
                if (e.detail.isName) {
                    next.add(e.detail.word);
                } else {
                    next.delete(e.detail.word);
                }
                return next;
            });
        };
        window.addEventListener('properNamesChanged', handleNamesChanged);
        return () => window.removeEventListener('properNamesChanged', handleNamesChanged);
    }, []);

    // Clear active word highlight 1 second after popup closes to allow CSS fade
    useEffect(() => {
        if (!popupData && activeHighlight !== null) {
            const timer = setTimeout(() => {
                setHoverHighlight(null);
                setLockedHighlight(null);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [popupData, activeHighlight]);

    useEffect(() => {
        const handlePauseChange = (e) => setIsPaused(e.detail.paused);
        window.addEventListener('statsPauseChanged', handlePauseChange);

        const handleKeyDown = (e) => {
            // Only trigger if user is not typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.code === 'Space' || e.key === ';') {
                e.preventDefault();
                if (getIsPaused()) {
                    resumeStats();
                } else {
                    pauseStats();
                }
            } else if ((e.key === 'd' || e.key === 'a' || e.key === 'w' || e.key === 's' || e.key === '[' || e.key === ']') && !isMobile && story) {
                // Navigation: Next/Prev (d/a or ]/[) or Up/Down (w/s)
                e.preventDefault();

                // Handle Up/Down (w/s) Visual Navigation
                if (e.key === 'w' || e.key === 's') {
                    if (!activeHighlight || !contentRef.current) return;

                    // Find the physical DOM element for the current active highlight
                    const activeSpan = contentRef.current.querySelector(
                        `p[data-para-index="${activeHighlight.paraIdx}"] span[data-index="${activeHighlight.charIdx}"]`
                    );

                    if (!activeSpan) return;

                    const rect = activeSpan.getBoundingClientRect();

                    const dir = e.key === 's' ? 1 : -1;
                    // Start safely just outside the physical bounding box
                    const startY = e.key === 's'
                        ? rect.bottom + 5
                        : rect.top - 5;
                    const targetX = rect.left + (rect.width / 2);

                    const hitTest = (x, y) => {
                        const hitEls = document.elementsFromPoint(x, y);
                        return hitEls.find(el => {
                            if (!el.hasAttribute('data-index')) return false;
                            if (!el.hasAttribute('data-word')) return false; // MUST be a dictionary word
                            if (!el.closest('.reader-para')) return false;

                            // Ignore the currently highlighted word to properly escape its
                            // bounding box, especially since its Pinyin ::after pseudo-element
                            // can make it very tall and trap the raycast.
                            if (el.classList.contains('word-active-highlight')) return false;

                            // Prevent hitting an adjacent word on the SAME physical line.
                            // If the element's top is roughly the same as our active word's top,
                            // ignore it so we keep searching up/down.
                            const elRect = el.getBoundingClientRect();
                            if (Math.abs(elRect.top - rect.top) < (fontSize / 2)) {
                                return false;
                            }

                            return true;
                        });
                    };

                    let targetSpan = null;
                    const maxSearch = window.innerHeight; // Max distance to search up/down
                    const stepY = 15;
                    const sweepDist = 200; // Max horizontal sweep distance
                    const stepX = 20;

                    for (let dy = 0; dy < maxSearch && !targetSpan; dy += stepY) {
                        const testY = startY + (dir * dy);

                        targetSpan = hitTest(targetX, testY);
                        if (targetSpan) break;

                        // Horizontal sweep at this Y level
                        for (let offset = stepX; offset <= sweepDist; offset += stepX) {
                            let sweepHit = hitTest(targetX - offset, testY);
                            if (sweepHit) {
                                targetSpan = sweepHit;
                                break;
                            }
                            sweepHit = hitTest(targetX + offset, testY);
                            if (sweepHit) {
                                targetSpan = sweepHit;
                                break;
                            }
                        }
                    }

                    if (targetSpan) {
                        // We found a target! Extract its properties.
                        const charIdxRaw = targetSpan.getAttribute('data-index');
                        const paraEl = targetSpan.closest('[data-para-index]');
                        if (charIdxRaw === null || !paraEl) return;

                        const charIdx = parseInt(charIdxRaw, 10);
                        const paraIdx = parseInt(paraEl.getAttribute('data-para-index'), 10);

                        // Look it up. Try data-word first, then single index fallback
                        const word = targetSpan.getAttribute('data-word');
                        let result = word ? lookupAt(word, 0) : null;

                        if (!result) {
                            result = lookupAt(paraEl.textContent, charIdx);
                        }

                        if (result) {
                            trackSessionLookup();
                            setHoverPopupData(null);
                            setHoverHighlight(null);
                            setLockedPopupData(result);

                            // Prefer the word start index instead of middle-character click
                            const finalCharIdx = result.index !== undefined ? result.index : charIdx;
                            setLockedHighlight({ paraIdx, charIdx: finalCharIdx });

                            // Scroll if it hits the 150px comfortable margin from the edge
                            const rect = targetSpan.getBoundingClientRect();
                            const containerRect = contentRef.current.getBoundingClientRect();
                            const margin = 150;
                            const isVisible = (rect.top >= containerRect.top + margin) && (rect.bottom <= containerRect.bottom - margin);
                            
                            if (!isVisible) {
                                targetSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setTimeout(() => measureProgress(), 350);
                            }

                            // Debounce vocabulary addition so we don't spam IDB when fast scrolling
                            clearTimeout(navSaveTimeoutRef.current);
                            navSaveTimeoutRef.current = setTimeout(() => {
                                trackSessionLookup();
                                setLookedUpWords(prev => new Set(prev).add(result.word));
                                setRecentWordsList(prev => {
                                    const filtered = prev.filter(w => w !== result.word);
                                    return [...filtered, result.word].slice(-5);
                                });
                                trackWordClick(result.word, story.id);
                            }, 500);
                        }
                    }
                    return; // End of w/s logic
                }

                // Handle Next/Prev (d/a or ]/[) Sequential Navigation
                const isForward = e.key === 'd' || e.key === ']';
                const paras = story.content.split('\n');

                let startPara = 0;
                let startChar = isForward ? -1 : Infinity;

                if (activeHighlight) {
                    startPara = activeHighlight.paraIdx;
                    startChar = activeHighlight.charIdx;
                }

                // Depending on direction, iterate paragraphs
                const paraStep = isForward ? 1 : -1;
                for (let pIdx = startPara; pIdx >= 0 && pIdx < paras.length; pIdx += paraStep) {
                    const paraText = paras[pIdx];
                    if (!paraText.trim()) continue;

                    // Parse paragraph into words
                    const tokens = tokenizeText(paraText);

                    // Filter down to valid dictionary words
                    const validTokens = tokens.filter(t => t.type === 'dict');

                    if (validTokens.length === 0) continue;

                    let targetToken = null;

                    if (pIdx === startPara) {
                        if (isForward) {
                            // Find first token AFTER current char index
                            targetToken = validTokens.find(t => t.startIndex > startChar);
                        } else {
                            // Find first token BEFORE current char index
                            // iterate backwards through validTokens to find the closest one
                            for (let i = validTokens.length - 1; i >= 0; i--) {
                                if (validTokens[i].startIndex < startChar) {
                                    targetToken = validTokens[i];
                                    break;
                                }
                            }
                        }
                    } else {
                        // We jumped to a new paragraph. Grab the first or last token based on direction
                        targetToken = isForward ? validTokens[0] : validTokens[validTokens.length - 1];
                    }

                    if (targetToken) {
                        // Found a word!
                        trackSessionLookup();
                        setHoverPopupData(null);
                        setHoverHighlight(null);
                        setLockedPopupData(targetToken.result);

                        setLockedHighlight({
                            paraIdx: pIdx,
                            charIdx: targetToken.startIndex
                        });

                        // Scroll into view comfortably before it hits the extreme edge of the screen
                        const spanEl = contentRef.current?.querySelector(`[data-para-index="${pIdx}"] [data-index="${targetToken.startIndex}"]`);
                        if (spanEl && contentRef.current) {
                            const rect = spanEl.getBoundingClientRect();
                            const containerRect = contentRef.current.getBoundingClientRect();
                            const margin = 150; // pixels
                            const isVisible = (rect.top >= containerRect.top + margin) && (rect.bottom <= containerRect.bottom - margin);
                            
                            if (!isVisible) {
                                spanEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                setTimeout(() => measureProgress(), 350);
                            }
                        }

                        // Debounce IDB history tracking so holding down arrow keys doesn't lag
                        clearTimeout(navSaveTimeoutRef.current);
                        navSaveTimeoutRef.current = setTimeout(() => {
                            trackSessionLookup();
                            setLookedUpWords(prev => new Set(prev).add(targetToken.word));
                            setRecentWordsList(prev => {
                                const filtered = prev.filter(w => w !== targetToken.word);
                                return [...filtered, targetToken.word].slice(-5);
                            });
                            trackWordClick(targetToken.word, story.id);
                        }, 500);

                        found = true;
                        break;
                    }
                }
            } else if (e.key === 'm' && !isMobile && story) {
                // Sentence Context Translation Mode
                e.preventDefault();

                const paras = story.content.split('\n');
                let activeParaIdx = 0;

                if (activeHighlight) {
                    activeParaIdx = activeHighlight.paraIdx;
                } else if (contentRef.current) {
                    // Try to find the first visible paragraph if no highlight
                    const paraEls = contentRef.current.querySelectorAll('.reader-para');
                    for (let i = 0; i < paraEls.length; i++) {
                        const rect = paraEls[i].getBoundingClientRect();
                        if (rect.top >= 0 && rect.top <= window.innerHeight / 2) {
                            activeParaIdx = parseInt(paraEls[i].getAttribute('data-para-index'), 10);
                            break;
                        }
                    }
                }

                const paraText = paras[activeParaIdx];
                if (!paraText || !paraText.trim()) return;

                // Indicate loading state (optional, but good for UX)
                setHoverPopupData(null);
                setLockedPopupData({
                    type: 'sentence',
                    text: paraText,
                    translation: 'Translating...',
                    isLoading: true
                });

                // Fetch translation
                translateParagraph(paraText).then(translation => {
                    setLockedPopupData({
                        type: 'sentence',
                        text: paraText,
                        translation: translation,
                        isLoading: false
                    });
                });
            } else if (e.key === 'l' && !isMobile && story) {
                // Star word shortcut
                e.preventDefault();
                if (activeHighlight && popupData && popupData.word && popupData.type !== 'sentence') {
                    import('../lib/vocabulary').then(({ toggleStarred }) => {
                        toggleStarred(popupData.word).then(isStarred => {
                            if (isStarred) {
                                setStarAnimationWord(activeHighlight);
                                setTimeout(() => setStarAnimationWord(null), 1000); // 1s animation
                            }
                        });
                    });
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeHighlight, popupData, lookedUpWords, story, isMobile]);

    useEffect(() => {
        localStorage.setItem('toneColorsEnabled', toneColorsEnabled);
    }, [toneColorsEnabled]);

    // Theme state
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
    const [toneColorTheme, setToneColorTheme] = useState(() => localStorage.getItem('toneColorTheme') || 'vibrant');

    useEffect(() => {
        localStorage.setItem('theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        localStorage.setItem('toneColorTheme', toneColorTheme);
        document.documentElement.setAttribute('data-tone-theme', toneColorTheme);
    }, [toneColorTheme]);

    const toggleTheme = () => {
        setTheme(prev => {
            if (prev === 'dark') return 'light';
            if (prev === 'light') return 'sepia';
            return 'dark';
        });
    };

    const cycleToneTheme = () => {
        setToneColorTheme(prev => {
            if (prev === 'vibrant') return 'pastel';
            if (prev === 'pastel') return 'standard';
            return 'vibrant';
        });
    };

    // Managing reading session
    useEffect(() => {
        if (!story) return;

        // On each story mount, recover any crashed session draft first
        recoverSessionDraft();

        // Start session immediately if page is visible
        if (!document.hidden) {
            startReadingSession();
        }

        let autoPaused = false;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (!getIsPaused()) {
                    pauseStats();
                    autoPaused = true;
                }
            } else {
                if (autoPaused) {
                    resumeStats();
                    autoPaused = false;
                }
            }
        };

        const handleAbsoluteJump = (e) => {
            const pos = e.detail.position;
            if (contentRef.current && story && story.content) {
                // Determine absolute scroll target by measuring the proportion of the book character location
                const ratio = pos / Math.max(1, story.content.length);
                contentRef.current.scrollTop = ratio * contentRef.current.scrollHeight;
                measureProgress();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('readerJumpAbsolute', handleAbsoluteJump);

        // pagehide is the most reliable signal for mobile PWA close / background
        const handlePageHide = () => {
            endReadingSession();
        };
        window.addEventListener('pagehide', handlePageHide);

        // Periodic checkpoint: save in-flight session every 60s so a crash doesn't lose it
        const checkpointInterval = setInterval(() => {
            checkpointSession();
        }, 60000);

        return () => {
            // Story changed or component unmounted — save current session
            endReadingSession();
            clearInterval(checkpointInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('readerJumpAbsolute', handleAbsoluteJump);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [story]);

    // Restore bookmark when story changes
    useEffect(() => {
        if (!story || !contentRef.current) return;

        isRestoringScroll.current = true;
        contentRef.current.scrollTop = 0;

        // Initialize CPM tracking for this story
        initStoryTracking(story.id, !!story.isRead);

        const restorePos = async () => {
            const bookmark = await getBookmark(story.id);
            if (bookmark && contentRef.current) {
                // Prefer click-based charIndex if available (more accurate than scrollTop)
                const charIndex = bookmark.charIndex ?? Math.floor(
                    (bookmark.scrollPosition / (contentRef.current.scrollHeight || 1)) * story.content.length
                );

                // Show "Previously..." card if the user has been away long enough
                if (shouldShowRecap(bookmark.lastRead) && story.content) {
                    const paragraphs = getPreviousContext(story.content, charIndex, 3);
                    if (paragraphs.length > 0) {
                        setRecapData({ paragraphs, bookmarkCharIndex: charIndex, lastRead: bookmark.lastRead });
                    }
                }

                isRestoringScroll.current = true;

                if (bookmark.charIndex != null) {
                    // Find the span closest to charIndex across all paragraphs and scroll to it
                    const allParaEls = Array.from(
                        contentRef.current.querySelectorAll('[data-para-index]')
                    ).sort((a, b) =>
                        parseInt(a.getAttribute('data-para-index'), 10) -
                        parseInt(b.getAttribute('data-para-index'), 10)
                    );
                    let remaining = bookmark.charIndex;
                    let targetPara = null;
                    let targetLocalIdx = 0;
                    for (const p of allParaEls) {
                        const len = p.textContent.length;
                        if (remaining <= len) {
                            targetPara = p;
                            targetLocalIdx = remaining;
                            break;
                        }
                        remaining -= len;
                    }
                    if (targetPara) {
                        // Find span with closest data-index
                        const spans = Array.from(targetPara.querySelectorAll('[data-index]'));
                        let best = null;
                        let bestDist = Infinity;
                        for (const s of spans) {
                            const d = Math.abs(parseInt(s.getAttribute('data-index'), 10) - targetLocalIdx);
                            if (d < bestDist) { bestDist = d; best = s; }
                        }
                        if (best) {
                            best.scrollIntoView({ block: 'center' });
                        } else {
                            targetPara.scrollIntoView({ block: 'center' });
                        }
                    } else {
                        contentRef.current.scrollTop = bookmark.scrollPosition;
                    }
                } else {
                    contentRef.current.scrollTop = bookmark.scrollPosition;
                }

                setTimeout(() => {
                    measureProgress();
                    isRestoringScroll.current = false;
                }, 100);
            } else {
                isRestoringScroll.current = false;
            }
        };

        // Give the DOM a moment to paint the text before restoring
        setTimeout(restorePos, 50);
    }, [story]);

    // Centralize progress calculation so both scrolling and keyboard nav can trigger it
    const measureProgress = () => {
        if (!contentRef.current || !story) return;

        const target = contentRef.current;
        const scrollTop = target.scrollTop;
        const scrollHeight = target.scrollHeight;
        const clientHeight = target.clientHeight;

        // Save bookmark
        saveBookmark(story.id, scrollTop);

        // Calculate progress
        const progressRatio = scrollHeight > 0 ? (scrollTop + clientHeight) / scrollHeight : 0;
        const percentage = Math.min(100, Math.max(0, Math.round(progressRatio * 100)));

        // Update progress bar state
        setReadingProgress(percentage);

        // Calculate approximate chars read
        const chineseChars = story.content
            ? (story.content.match(/[\u4e00-\u9fff]/g) || []).length
            : 0;
        const charsRead = Math.round(chineseChars * progressRatio);

        // Track CPM
        trackScrollProgress(charsRead);

        // Dispatch event for StatsToolbar
        window.dispatchEvent(new CustomEvent('readingProgressUpdated', {
            detail: { percentage, charsRead, totalChars: chineseChars }
        }));
    };

    // Save bookmark and update progress on scroll
    const handleScroll = (e) => {
        if (isRestoringScroll.current) return;
        measureProgress();
    };

    const handleTextClick = (e) => {
        setHoverPopupData(null);
        setHoverHighlight(null);

        // Check if the clicked element (or parent) has a data-word attribute
        const target = e.target.closest('[data-word], [data-index]');

        let clickParaIdx = null;
        let clickCharIdx = null;

        if (target) {
            const indexStr = target.getAttribute('data-index');
            const paraEl = target.closest('[data-para-index]');
            if (indexStr !== null && paraEl) {
                clickCharIdx = parseInt(indexStr, 10);
                clickParaIdx = parseInt(paraEl.getAttribute('data-para-index'), 10);
                setLockedHighlight({
                    charIdx: clickCharIdx,
                    paraIdx: clickParaIdx
                });
            }

            const word = target.getAttribute('data-word');
            // Look up the word directly
            let result = word ? lookupAt(word, 0) : null;

            // If no word attribute, use the exact index from the span itself
            if (!result && indexStr !== null && paraEl) {
                const exactIndex = parseInt(indexStr, 10);
                result = lookupAt(paraEl.textContent, exactIndex);
            }

            if (result) {
                trackSessionLookup(); // Track stats
                setLockedPopupData(result);

                // Update Background watermark history
                setLookedUpWords(prev => new Set(prev).add(result.word));
                setRecentWordsList(prev => {
                    // Remove if already exists so it moves to front, keep max 5
                    const filtered = prev.filter(w => w !== result.word);
                    return [...filtered, result.word].slice(-5);
                });

                if (story && story.id) {
                    trackWordClick(result.word, story.id);
                }

                // --- Option A: Click-based POS tracking ---
                // Compute global char index by summing textContent of all preceding paragraphs
                if (clickCharIdx !== null && clickParaIdx !== null && contentRef.current && story) {
                    const allParaEls = Array.from(
                        contentRef.current.querySelectorAll('[data-para-index]')
                    ).sort((a, b) =>
                        parseInt(a.getAttribute('data-para-index'), 10) -
                        parseInt(b.getAttribute('data-para-index'), 10)
                    );
                    let globalCharIdx = clickCharIdx;
                    for (const p of allParaEls) {
                        const pIdx = parseInt(p.getAttribute('data-para-index'), 10);
                        if (pIdx < clickParaIdx) {
                            globalCharIdx += p.textContent.length;
                        }
                    }
                    const totalChineseChars = (story.content?.match(/[\u4e00-\u9fff]/g) || []).length || 1;
                    const progressRatio = Math.min(1, globalCharIdx / (story.content?.length || 1));
                    const percentage = Math.round(progressRatio * 100);
                    trackScrollProgress(globalCharIdx);
                    setReadingProgress(percentage);
                    window.dispatchEvent(new CustomEvent('readingProgressUpdated', {
                        detail: { percentage, charsRead: globalCharIdx, totalChars: totalChineseChars }
                    }));
                    // Save bookmark with precise char index so reload restores to this word
                    saveBookmark(story.id, contentRef.current?.scrollTop ?? 0, globalCharIdx);
                }

                return;
            }
        }

        // Fallback for non-word clicks (e.g. single chars not part of a word)
        // This handles cases where ColorizedText rendered a single char without data-word
        // OR standard paragraph text if tone colors are disabled
        const paragraph = e.target.closest('.reader-para');
        if (!paragraph) return;

        let range;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(e.clientX, e.clientY);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
            range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.setEnd(pos.offsetNode, pos.offset);
        }

        if (!range) return;

        // Calculate global offset relative to the paragraph
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(paragraph);
        preCaretRange.setEnd(range.endContainer, range.endOffset);

        const globalOffset = preCaretRange.toString().length;
        const text = paragraph.textContent;

        // Try lookup at current position
        let result = lookupAt(text, globalOffset);

        // If no result (e.g. clicked at end of char), try previous char
        if (!result && globalOffset > 0) {
            result = lookupAt(text, globalOffset - 1);
        }

        if (result) {
            trackSessionLookup(); // Track stats
            setLockedPopupData(result);

            // Re-calculate the indices for the locked highlight since this was a fallback click
            const paraEl = paragraph;
            const clickParaIdx = parseInt(paraEl.getAttribute('data-para-index'), 10);

            // To find the charIdx, we need the exact position of the word.
            // But since this is a fallback, we at least know the global offset.
            setLockedHighlight({
                charIdx: result.index !== undefined ? result.index : Math.max(0, globalOffset - 1),
                paraIdx: clickParaIdx
            });

            // Update Background watermark history
            setLookedUpWords(prev => new Set(prev).add(result.word));
            setRecentWordsList(prev => {
                const filtered = prev.filter(w => w !== result.word);
                return [...filtered, result.word].slice(-5);
            });

            if (story && story.id) {
                trackWordClick(result.word, story.id);
            }
        }
    };

    const handleTextHover = (e) => {
        if (isMobile) return;

        const target = e.target.closest('[data-word], [data-index]');
        if (!target) return;

        if (hoverTimer.current) {
            clearTimeout(hoverTimer.current);
            hoverTimer.current = null;
        }

        const indexStr = target.getAttribute('data-index');
        const paraEl = target.closest('[data-para-index]');

        let word = target.getAttribute('data-word');
        let result = word ? lookupAt(word, 0) : null;

        if (!result && indexStr !== null && paraEl) {
            const exactIndex = parseInt(indexStr, 10);
            result = lookupAt(paraEl.textContent, exactIndex);
        }

        if (result) {
            // Prevent flicker if hovering the same word
            if (hoverPopupData && hoverPopupData.word === result.word) return;

            trackSessionLookup();
            setHoverPopupData(result);

            // Update background watermark history
            setLookedUpWords(prev => new Set(prev).add(result.word));
            setRecentWordsList(prev => {
                const filtered = prev.filter(w => w !== result.word);
                return [...filtered, result.word].slice(-5);
            });

            if (indexStr !== null && paraEl) {
                setHoverHighlight({
                    charIdx: parseInt(indexStr, 10),
                    paraIdx: parseInt(paraEl.getAttribute('data-para-index'), 10)
                });
            }

            if (story && story.id) {
                trackWordClick(result.word, story.id);
            }
        }
    };

    const handleTextOut = (e) => {
        if (isMobile) return;

        const target = e.target.closest('[data-word], [data-index]');
        if (!target) return;

        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => {
            setHoverHighlight(null);
            setHoverPopupData(null);
        }, 300); // Give user time to move mouse before clearing highlight
    };

    const toggleToneColors = () => {
        setToneColorsEnabled(!toneColorsEnabled);
    };

    const handleFontSizeChange = (delta) => {
        let anchorPara = null;
        let percentOffset = 0;

        if (contentRef.current) {
            const paras = contentRef.current.querySelectorAll('.reader-para');
            const scrollTop = contentRef.current.scrollTop;
            for (let p of paras) {
                if (p.offsetTop + p.offsetHeight > scrollTop) {
                    anchorPara = p.getAttribute('data-para-index');
                    percentOffset = (scrollTop - p.offsetTop) / Math.max(1, p.offsetHeight);
                    if (percentOffset < 0) percentOffset = 0;
                    break;
                }
            }
        }

        const newSize = Math.max(12, Math.min(48, fontSize + delta));
        setFontSize(newSize);
        localStorage.setItem('fontSize', newSize);

        if (anchorPara !== null) {
            setTimeout(() => {
                if (contentRef.current) {
                    const p = contentRef.current.querySelector(`.reader-para[data-para-index="${anchorPara}"]`);
                    if (p) {
                        contentRef.current.scrollTop = p.offsetTop + (p.offsetHeight * percentOffset);
                    }
                }
            }, 50);
        }
    };

    if (!story) return <div className="reader-empty">Select a story to start reading</div>;

    return (
        <div className="reader-container">
            {/* Reading Progress Bar */}
            <div className="reading-progress-bar">
                <div
                    className="reading-progress-fill"
                    style={{ width: `${readingProgress}%` }}
                />
            </div>

            <div className="reader-main">
                {!isMobile && (
                    <div className={`reader-toolbar ${isPaused ? 'paused-bar-orange' : ''}`}>
                        <div className="toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <RecentLookups words={recentWordsList} />
                            <h3 style={{
                                fontSize: '14px',
                                opacity: 1,
                                margin: 0,
                                fontWeight: isPaused ? 700 : 500
                            }}>
                                {story?.title}
                            </h3>
                        </div>

                        <div className="toolbar-center">
                            <StatsToolbar currentStoryId={story ? story.id : null} />
                        </div>

                        <div className="toolbar-right">
                            <button onClick={() => handleFontSizeChange(-2)}>A-</button>
                            <span style={{ margin: '0 8px' }}>{fontSize}px</span>
                            <button onClick={() => handleFontSizeChange(2)}>A+</button>
                            <button
                                onClick={toggleToneColors}
                                className={toneColorsEnabled ? 'active' : ''}
                                style={{ marginLeft: '8px' }}
                                title="Toggle tone dots"
                            >
                                •
                            </button>
                        </div>
                    </div>
                )}

                <div
                    className="reader-content"
                    style={{ fontSize: `${fontSize}px` }}
                    onClick={handleTextClick}
                    onMouseOver={!isMobile ? handleTextHover : undefined}
                    onMouseOut={!isMobile ? handleTextOut : undefined}
                    onScroll={handleScroll}
                    ref={contentRef}
                >
                    {isMobile && story.title && (
                        <h2 className="mobile-story-title">{story.title}</h2>
                    )}
                    {story.content.split('\n').map((para, idx) => {
                        return (
                            <div key={idx} style={{ position: 'relative' }}>
                                <p className="reader-para" data-para-index={idx}>
                                    <ColorizedText
                                        text={para}
                                        enabled={true}
                                        lookedUpWords={lookedUpWords}
                                        properNames={properNames}
                                        overrideToneColors={toneColorsEnabled ? null : false}
                                        activeIndex={activeHighlight?.paraIdx === idx ? activeHighlight.charIdx : null}
                                        starAnimationIndex={starAnimationWord?.paraIdx === idx ? starAnimationWord.charIdx : null}
                                    />
                                </p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {isMobile ? (
                <>
                    <StatsToolbar currentStoryId={story ? story.id : null} />
                    <MobileBottomSheet
                        data={popupData}
                        onClose={() => {
                            setHoverPopupData(null);
                            setLockedPopupData(null);
                        }}
                    />
                    <FloatingActionMenu
                        fontSize={fontSize}
                        onFontSizeChange={handleFontSizeChange}
                        theme={theme}
                        onThemeToggle={toggleTheme}
                        toneColorsEnabled={toneColorsEnabled}
                        onToneColorsToggle={toggleToneColors}
                        toneColorTheme={toneColorTheme}
                        onToneThemeCycle={cycleToneTheme}
                        onViewGlobalStats={onViewGlobalStats}
                    />
                </>
            ) : (
                <LexiconSidebar data={popupData} />
            )}

            {/* Previously card — shown when returning after 30+ min gap */}
            {recapData && (
                <PreviouslyCard
                    storyId={story.id}
                    paragraphs={recapData.paragraphs}
                    bookmarkCharIndex={recapData.bookmarkCharIndex}
                    lastRead={recapData.lastRead}
                    onDismiss={() => setRecapData(null)}
                />
            )}
        </div>
    );
};

export default Reader;
