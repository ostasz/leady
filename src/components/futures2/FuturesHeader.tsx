import { useState, useRef, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Calendar, ChevronDown, Search, X } from 'lucide-react';

interface FuturesHeaderProps {
    selectedContract: string;
    onContractChange: (c: string) => void;
    range: string;
    onRangeChange: (r: string) => void;
    selectedDate: string;
    onDateChange: (d: string) => void;
}

export default function FuturesHeader({ selectedContract, onContractChange, range, onRangeChange, selectedDate, onDateChange }: FuturesHeaderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Generate comprehensive contracts list
    const contracts = useMemo(() => {
        const list: string[] = [];
        const now = new Date();
        const nextYear = now.getFullYear() + 1;
        const currentYearShort = now.getFullYear().toString().slice(-2);
        const nextYearShort = nextYear.toString().slice(-2);
        const nextNextYearShort = (nextYear + 1).toString().slice(-2);
        const nextNextNextYearShort = (nextYear + 2).toString().slice(-2); // Y+3 (2028)

        const prefixes = ['BASE', 'PEAK5'];

        prefixes.forEach(prefix => {
            // 1. Years (Current Y, Y+1, Y+2, Y+3)
            list.push(`${prefix}_Y-${currentYearShort}`);
            list.push(`${prefix}_Y-${nextYearShort}`);
            list.push(`${prefix}_Y-${nextNextYearShort}`);
            list.push(`${prefix}_Y-${nextNextNextYearShort}`);

            // 2. Quarters (Q1-Q4 of Next Year)
            for (let i = 1; i <= 4; i++) {
                list.push(`${prefix}_Q-${i}-${nextYearShort}`);
            }

            // 3. Months (Next 12 Months)
            let mDate = new Date();
            mDate.setMonth(mDate.getMonth() + 1); // Start next month
            for (let i = 0; i < 12; i++) {
                const mStr = (mDate.getMonth() + 1).toString().padStart(2, '0');
                const yStr = mDate.getFullYear().toString().slice(-2);
                list.push(`${prefix}_M-${mStr}-${yStr}`);
                mDate.setMonth(mDate.getMonth() + 1);
            }
        });
        return list;
    }, []);

    // Ensure selected contract is in list (if loaded from URL/Props but not generated)
    const allContracts = useMemo(() => {
        if (!contracts.includes(selectedContract)) {
            return [selectedContract, ...contracts];
        }
        return contracts;
    }, [contracts, selectedContract]);

    // Filter contracts based on search
    const filteredContracts = useMemo(() => {
        if (!searchQuery) return allContracts;
        return allContracts.filter(c => c.toLowerCase().includes(searchQuery.toLowerCase()));
    }, [allContracts, searchQuery]);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    return (
        <div className="flex flex-col md:flex-row items-center gap-4">
            {/* Product Selector with Search */}
            <div className="flex items-center gap-4 relative" ref={dropdownRef}>
                <div
                    className="bg-[#1f2937] p-2 rounded-lg flex items-center gap-2 border border-gray-700 shadow-sm cursor-pointer hover:bg-gray-800 transition-colors min-w-[200px]"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="p-1.5 bg-[#009D8F]/20 rounded-md text-[#009D8F]">
                        <span className="text-xl">⚡</span>
                    </div>
                    <div className="flex flex-col flex-1">
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Produkt</span>
                        <div className="flex items-center justify-between">
                            <span className="text-white font-bold text-sm">{selectedContract}</span>
                            <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        </div>
                    </div>
                </div>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="absolute top-full left-0 mt-2 w-[240px] bg-[#1f2937] border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-[400px]">
                        {/* Search Input */}
                        <div className="p-2 border-b border-gray-700 relative">
                            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Szukaj..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#111827] border border-gray-700 rounded-md py-1.5 pl-8 pr-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#009D8F]"
                            />
                        </div>
                        {/* List */}
                        <div className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                            {filteredContracts.length > 0 ? (
                                filteredContracts.map((contract) => (
                                    <div
                                        key={contract}
                                        onClick={() => {
                                            onContractChange(contract);
                                            setIsOpen(false);
                                            setSearchQuery('');
                                        }}
                                        className={`px-4 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between ${selectedContract === contract
                                                ? 'bg-[#009D8F]/10 text-[#009D8F] font-bold'
                                                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                                            }`}
                                    >
                                        {contract}
                                        {selectedContract === contract && <div className="w-1.5 h-1.5 rounded-full bg-[#009D8F]"></div>}
                                    </div>
                                ))
                            ) : (
                                <div className="p-4 text-center text-xs text-gray-500">
                                    Brak wyników
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Date Picker */}
                <div className="bg-[#1f2937] px-3 py-2 rounded-lg flex items-center gap-3 border border-gray-700 shadow-sm">
                    <div className="p-1 bg-[#009D8F]/20 rounded text-[#009D8F]">
                        <Calendar className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Data Wyceny</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => onDateChange(e.target.value)}
                            className="bg-transparent text-white font-bold text-sm outline-none cursor-pointer focus:ring-0 border-none p-0 w-[130px] -ml-1 text-right sm:text-left [color-scheme:dark]"
                        />
                    </div>
                </div>
            </div>

            {/* Range Selector */}
            <div className="flex items-center gap-2 bg-[#1f2937] p-1 rounded-lg border border-gray-700 shadow-sm">
                {['1M', '3M', '6M', 'YTD', 'ALL'].map((r) => (
                    <button
                        key={r}
                        onClick={() => onRangeChange(r)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${range === r
                            ? 'bg-[#009D8F] text-white shadow-sm'
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                            }`}
                    >
                        {r}
                    </button>
                ))}
            </div>
        </div>
    );
}
