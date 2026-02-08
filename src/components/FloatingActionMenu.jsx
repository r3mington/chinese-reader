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
                            <span className="fab-icon">
                                {theme === 'light' ? '☀️' : theme === 'dark' ? '🌙' : '☕'}
                            </span>
                        </button>
                        <button
                            className={`fab-menu-item ${toneColorsEnabled ? 'active' : ''}`}
                            onClick={() => { onToneColorsToggle(); }}
                        >
                            <span className="fab-icon">🎨</span>
                        </button>
                        {toneColorsEnabled && (
                            <button className="fab-menu-item" onClick={() => { onToneThemeCycle(); }}>
                                <span className="fab-icon">
                                    {toneColorTheme === 'vibrant' ? '💥' : toneColorTheme === 'pastel' ? '🌸' : '✨'}
                                </span>
                            </button>
                        )}
                    </div>
                )}

                <button className="fab-main" onClick={toggleMenu}>
                    <span className="fab-icon">{isOpen ? '✕' : '⚙️'}</span>
                </button>
            </div>
        </>
    );
};

export default FloatingActionMenu;
