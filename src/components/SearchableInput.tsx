import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

interface SearchableInputProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    required?: boolean;
    compact?: boolean;
}

const SearchableInput: React.FC<SearchableInputProps> = ({
    label,
    value,
    onChange,
    options,
    placeholder = "Select or type...",
    required = false,
    compact = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredOptions = useMemo(() => {
        if (showAll) return options;
        return options.filter(opt =>
            opt.toLowerCase().includes(value.toLowerCase())
        );
    }, [options, value, showAll]);

    useEffect(() => {
        if (isOpen && wrapperRef.current) {
            const updatePosition = () => {
                if (wrapperRef.current) {
                    const rect = wrapperRef.current.getBoundingClientRect();
                    setCoords({
                        top: rect.bottom, // Fixed position is relative to viewport
                        left: rect.left,
                        width: rect.width
                    });
                }
            };

            updatePosition();
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);

            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, true);
            };
        }
    }, [isOpen]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const dropdownEl = document.getElementById('searchable-dropdown-portal');
            if (
                wrapperRef.current &&
                !wrapperRef.current.contains(event.target as Node) &&
                dropdownEl &&
                !dropdownEl.contains(event.target as Node)
            ) {
                setIsOpen(false);
                setShowAll(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleSelect = (option: string) => {
        onChange(option);
        setIsOpen(false);
        setShowAll(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
        setShowAll(false);
        if (!isOpen) setIsOpen(true);
    };

    const inputClasses = compact
        ? "w-full p-2 pr-8 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
        : "w-full p-3 pr-10 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all";

    const labelClasses = compact
        ? "block text-xs font-semibold text-gray-600 mb-1"
        : "block text-sm font-semibold text-gray-700 mb-1.5";

    return (
        <div className="relative" ref={wrapperRef}>
            <label className={labelClasses}>{label}</label>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    className={inputClasses}
                    value={value}
                    onChange={handleInputChange}
                    onFocus={() => {
                        setIsOpen(true);
                        setShowAll(true); // Show all options on focus/click so user sees the list
                    }}
                    placeholder={placeholder}
                    required={required}
                />
                <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    onClick={() => {
                        if (isOpen) {
                            setIsOpen(false);
                            setShowAll(false);
                        } else {
                            inputRef.current?.focus();
                            setIsOpen(true);
                            setShowAll(true);
                        }
                    }}
                >
                    <ChevronDown size={compact ? 16 : 18} />
                </button>
            </div>

            {isOpen && createPortal(
                <div
                    id="searchable-dropdown-portal"
                    className="fixed z-[9999] bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                    style={{
                        top: `${coords.top + 4}px`,
                        left: `${coords.left}px`,
                        width: `${coords.width}px`
                    }}
                >
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((option: string, index: number) => (
                            <button
                                key={index}
                                type="button"
                                className={`w-full text-left px-4 py-2.5 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 flex items-center justify-between transition-colors ${compact ? 'text-xs' : 'text-sm'}`}
                                onClick={() => handleSelect(option)}
                            >
                                <span>{option}</span>
                                {value === option && <Check size={16} className="text-indigo-600" />}
                            </button>
                        ))
                    ) : (
                        <div className={`p-3 text-center text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>
                            {value ? "Press enter to add new..." : "No options found"}
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

export default SearchableInput;
