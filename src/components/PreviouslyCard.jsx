import React, { useState, useEffect } from 'react';
import { translateParagraph } from '../lib/translate';
import { getCachedRecapTranslation, saveRecapTranslation } from '../lib/recap';

const PreviouslyCard = ({ storyId, paragraphs, bookmarkCharIndex, lastRead, onDismiss }) => {
    const [translation, setTranslation] = useState(null);
    const [translating, setTranslating] = useState(true);
    const [offline, setOffline] = useState(false);

    const timeAgo = () => {
        if (!lastRead) return '';
        const diff = Date.now() - lastRead;
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours}h ago`;
        return `${mins}mn ago`;
    };

    useEffect(() => {
        const load = async () => {
            setTranslating(true);
            setOffline(false);

            // 1. Try cache first
            const cached = await getCachedRecapTranslation(storyId, bookmarkCharIndex);
            if (cached) {
                setTranslation(cached);
                setTranslating(false);
                return;
            }

            // 2. Check online
            if (!navigator.onLine) {
                setOffline(true);
                setTranslating(false);
                return;
            }

            // 3. Fetch translation for all paragraphs joined
            try {
                const combined = paragraphs.join('\n\n');
                const result = await translateParagraph(combined);
                // Split back into paragraphs by double newlines if possible
                const parts = result.split(/\n+/).map(p => p.trim()).filter(Boolean);
                const translationObj = { parts, raw: result };
                setTranslation(translationObj);
                await saveRecapTranslation(storyId, bookmarkCharIndex, translationObj);
            } catch {
                setOffline(true);
            } finally {
                setTranslating(false);
            }
        };
        if (paragraphs && paragraphs.length > 0) load();
    }, [storyId, bookmarkCharIndex, paragraphs]);

    if (!paragraphs || paragraphs.length === 0) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onDismiss}
                style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.65)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    animation: 'fadeIn 0.2s ease',
                }}
            />

            {/* Card */}
            <div style={{
                position: 'fixed',
                bottom: 0, left: 0, right: 0,
                zIndex: 1001,
                background: '#0d0d0d',
                border: '1px solid rgba(255,255,255,0.1)',
                borderBottom: 'none',
                borderRadius: '18px 18px 0 0',
                maxHeight: '72vh',
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                    flexShrink: 0,
                }}>
                    <div>
                        <div style={{ fontSize: 10, letterSpacing: '2px', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                            PREVIOUSLY
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                            {timeAgo()}
                        </div>
                    </div>
                    <button
                        onClick={onDismiss}
                        style={{
                            background: 'rgba(255,255,255,0.08)',
                            border: 'none',
                            borderRadius: '50%',
                            width: 32, height: 32,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 16,
                        }}
                    >
                        ✕
                    </button>
                </div>

                {/* Scrollable content */}
                <div style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
                    {paragraphs.map((para, i) => {
                        const transPart = translation?.parts?.[i] || null;
                        return (
                            <div key={i} style={{
                                marginBottom: i < paragraphs.length - 1 ? 20 : 0,
                                paddingBottom: i < paragraphs.length - 1 ? 20 : 0,
                                borderBottom: i < paragraphs.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                            }}>
                                {/* Chinese */}
                                <p style={{
                                    fontSize: 17,
                                    lineHeight: 1.7,
                                    color: '#fff',
                                    margin: '0 0 10px 0',
                                    fontFamily: "'Noto Serif SC', serif",
                                }}>
                                    {para}
                                </p>

                                {/* Translation */}
                                {translating && (
                                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', margin: 0, fontStyle: 'italic' }}>
                                        Translating…
                                    </p>
                                )}
                                {!translating && offline && (
                                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
                                        Translation unavailable offline
                                    </p>
                                )}
                                {!translating && !offline && transPart && (
                                    <p style={{
                                        fontSize: 13,
                                        lineHeight: 1.6,
                                        color: 'rgba(255,255,255,0.45)',
                                        margin: 0,
                                        fontStyle: 'italic',
                                        animation: 'fadeIn 0.3s ease',
                                    }}>
                                        {transPart}
                                    </p>
                                )}
                                {!translating && !offline && !transPart && translation?.raw && i === 0 && (
                                    <p style={{
                                        fontSize: 13, lineHeight: 1.6,
                                        color: 'rgba(255,255,255,0.45)', margin: 0, fontStyle: 'italic',
                                    }}>
                                        {translation.raw}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer CTA */}
                <div style={{
                    padding: '12px 20px 24px',
                    flexShrink: 0,
                    borderTop: '1px solid rgba(255,255,255,0.07)',
                }}>
                    <button
                        onClick={onDismiss}
                        style={{
                            width: '100%',
                            background: 'rgba(255,255,255,0.08)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 12,
                            padding: '12px 0',
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: 'pointer',
                            letterSpacing: '0.5px',
                        }}
                    >
                        Continue reading ↓
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            `}</style>
        </>
    );
};

export default PreviouslyCard;
