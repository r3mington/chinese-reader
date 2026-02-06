import React, { useEffect, useRef } from 'react';
import { convertPinyin } from '../lib/pinyin';
import '../styles/index.css';

const MobileBottomSheet = ({ data, onClose }) => {
    const sheetRef = useRef(null);

    useEffect(() => {
        if (data) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [data]);

    if (!data) return null;

    return (
        <>
            <div className="bottom-sheet-backdrop" onClick={onClose} />
            <div className="bottom-sheet" ref={sheetRef}>
                <div className="bottom-sheet-handle" />
                <button className="bottom-sheet-close" onClick={onClose}>✕</button>

                <div className="bottom-sheet-content">
                    {data.entries.map((entry, idx) => (
                        <div key={idx} className="bottom-sheet-entry">
                            <div className="bottom-sheet-header">
                                <span className="bottom-sheet-word">{entry.simplified}</span>
                                <span className="bottom-sheet-pinyin">{convertPinyin(entry.pinyin)}</span>
                            </div>
                            <div className="bottom-sheet-definitions">
                                {entry.definitions.map((def, i) => (
                                    <div key={i} className="bottom-sheet-def-item">
                                        {i + 1}. {def}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

export default MobileBottomSheet;
