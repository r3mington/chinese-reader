import React, { useEffect, useRef } from 'react';
import { convertPinyin } from '../lib/pinyin';
import '../styles/index.css';

const WordPopup = ({ data, position, onClose }) => {
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    if (!data) return null;

    // Simple positioning logic to prevent overflow
    const style = {
        position: 'fixed',
        left: Math.min(position.x, window.innerWidth - 320), // Prevent right overflow
        top: Math.min(position.y + 20, window.innerHeight - 300), // Prevent bottom overflow
        zIndex: 1000,
    };

    return (
        <div
            ref={ref}
            className="word-popup"
            style={style}
        >
            <button className="popup-close-btn" onClick={onClose}>×</button>
            <div className="popup-content">
                {data.entries.map((entry, idx) => (
                    <div key={idx} className="popup-entry">
                        <div className="popup-header-row">
                            <span className="popup-word-text">{entry.simplified}</span>
                            <span className="popup-pinyin-text">{convertPinyin(entry.pinyin)}</span>
                        </div>
                        <div className="popup-definitions-text">
                            {entry.definitions.join(' ◆ ')}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WordPopup;
