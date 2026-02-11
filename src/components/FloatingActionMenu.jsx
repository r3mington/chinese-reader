import React, { useState } from 'react';
import '../styles/oled.css';

const FloatingActionMenu = ({
    fontSize,
    onFontSizeChange,
    theme,
    onThemeToggle,
    toneColorsEnabled,
    onToneColorsToggle,
    toneColorTheme,
    onToneThemeCycle
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    return (
        <>
            {isOpen && <div className="fab-backdrop" onClick={() => setIsOpen(false)} />}

            <div className={`fab-container ${isOpen ? 'open' : ''}`}>
                {isOpen && (
                    <div className="fab-menu">
                        <button className="fab-menu-item" onClick={() => { onFontSizeChange(-2); }}>
                            <span className="fab-icon">A-</span>
                        </button>
                        <button className="fab-menu-item" onClick={() => { onFontSizeChange(2); }}>
                            <span className="fab-icon">A+</span>
                        </button>
                        <button className="fab-menu-item" onClick={() => { onThemeToggle(); }}>
                            {theme === 'light' ? (
                                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                                    <circle cx="10" cy="10" r="4" />
                                    <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" strokeWidth="2" />
                                    <line x1="10" y1="16" x2="10" y2="18" stroke="currentColor" strokeWidth="2" />
                                    <line x1="2" y1="10" x2="4" y2="10" stroke="currentColor" strokeWidth="2" />
                                    <line x1="16" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="2" />
                                </svg>
                            ) : theme === 'dark' ? (
                                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M17 10.5C16.5 15 12.5 18 8 17.5C4.5 17 2 14 2 10.5C2 6.5 5 3 9 3C9 3 8 5 8 7C8 10 10 12 13 12C15 12 17 11 17 11V10.5Z" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M6 14C6 14 6 10 10 10C14 10 14 14 14 14M10 2V4M10 8C8.5 8 7 6.5 7 5C7 3.5 8.5 2 10 2C11.5 2 13 3.5 13 5C13 6.5 11.5 8 10 8ZM4 18H16C17 18 18 17 18 16V14C18 13 17 12 16 12H4C3 12 2 13 2 14V16C2 17 3 18 4 18Z" />
                                </svg>
                            )}
                        </button>
                        <button
                            className={`fab-menu-item ${toneColorsEnabled ? 'active' : ''}`}
                            onClick={() => { onToneColorsToggle(); }}
                        >
                            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <circle cx="10" cy="10" r="7" />
                                <circle cx="7" cy="8" r="1" fill="currentColor" />
                                <circle cx="13" cy="8" r="1" fill="currentColor" />
                                <circle cx="10" cy="12" r="1" fill="currentColor" />
                            </svg>
                        </button>
                        {toneColorsEnabled && (
                            <button className="fab-menu-item" onClick={() => { onToneThemeCycle(); }}>
                                {toneColorTheme === 'vibrant' ? (
                                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                                        <polygon points="10,2 12,8 18,8 13,12 15,18 10,14 5,18 7,12 2,8 8,8" />
                                    </svg>
                                ) : toneColorTheme === 'pastel' ? (
                                    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                                        <circle cx="10" cy="8" r="3" />
                                        <path d="M6 12C6 12 7 14 10 14C13 14 14 12 14 12" stroke="currentColor" strokeWidth="1.5" fill="none" />
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                                        <circle cx="10" cy="10" r="3" />
                                        <line x1="10" y1="2" x2="10" y2="5" />
                                        <line x1="10" y1="15" x2="10" y2="18" />
                                        <line x1="2" y1="10" x2="5" y2="10" />
                                        <line x1="15" y1="10" x2="18" y2="10" />
                                    </svg>
                                )}
                            </button>
                        )}
                    </div>
                )}

                <button className="fab-main" onClick={toggleMenu}>
                    {isOpen ? (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="4" y1="4" x2="16" y2="16" />
                            <line x1="16" y1="4" x2="4" y2="16" />
                        </svg>
                    ) : (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <circle cx="10" cy="10" r="7" />
                            <line x1="10" y1="6" x2="10" y2="10" />
                            <line x1="6" y1="10" x2="10" y2="10" />
                            <line x1="10" y1="10" x2="14" y2="10" />
                            <line x1="10" y1="10" x2="10" y2="14" />
                        </svg>
                    )}
                </button>
            </div>
        </>
    );
};

export default FloatingActionMenu;
