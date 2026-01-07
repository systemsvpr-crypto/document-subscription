// utils/dateFormatter.ts
export const formatDate = (dateStr: string | undefined | null): string => {
    if (!dateStr) return '-';

    // If it's already empty or just whitespace
    const trimmedStr = dateStr.toString().trim();
    if (!trimmedStr) return '-';

    try {
        // Check if it's already in a readable format (like "15 Jan 2024")
        // If it contains month names, return as is
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const lowerStr = trimmedStr.toLowerCase();
        if (monthNames.some(month => lowerStr.includes(month))) {
            return trimmedStr;
        }

        // Try to parse the date string
        let date: Date;

        // Handle multiple date formats

        // Format 1: YYYY-MM-DD (from input type="date")
        const ymdMatch = trimmedStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (ymdMatch) {
            const [_, year, month, day] = ymdMatch;
            // Create date in local timezone (midnight)
            date = new Date(
                parseInt(year, 10),
                parseInt(month, 10) - 1, // Months are 0-indexed
                parseInt(day, 10),
                12, // Set to noon to avoid timezone issues
                0, 0, 0
            );
        }
        // Format 2: DD/MM/YYYY
        else if (trimmedStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)) {
            const parts = trimmedStr.split('/');
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const year = parseInt(parts[2], 10);
            date = new Date(year, month, day, 12, 0, 0, 0);
        }
        // Format 3: MM/DD/YYYY (US format)
        else if (trimmedStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)) {
            // Check if it could be US format by trying both
            const parts = trimmedStr.split('/');
            if (parts.length === 3) {
                const month = parseInt(parts[0], 10) - 1;
                const day = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                date = new Date(year, month, day, 12, 0, 0, 0);
            } else {
                date = new Date(trimmedStr);
            }
        }
        // Format 4: ISO string (from JavaScript Date)
        else if (trimmedStr.includes('T')) {
            date = new Date(trimmedStr);
        }
        // Format 5: Try parsing as is
        else {
            date = new Date(trimmedStr);
        }

        // Check if date is valid
        if (isNaN(date.getTime())) {
            console.warn('Invalid date string:', trimmedStr);
            return trimmedStr;
        }

        // Format as DD MMM YYYY (professional format)
        const day = date.getDate().toString().padStart(2, '0');
        const monthNamesFull = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = monthNamesFull[date.getMonth()];
        const year = date.getFullYear();

        return `${day} ${month} ${year}`;
    } catch (error) {
        console.error('Error formatting date:', trimmedStr, error);
        return trimmedStr;
    }
};

// Helper function to format date for Google Sheets (without timezone shift)
export const formatDateForGoogleSheets = (dateStr: string | Date): string => {
    if (!dateStr) return '';

    try {
        let date: Date;

        if (dateStr instanceof Date) {
            date = dateStr;
        } else if (typeof dateStr === 'string') {
            // If it's already in YYYY-MM-DD format, return as is
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                return dateStr;
            }
            date = new Date(dateStr);
        } else {
            return '';
        }

        if (isNaN(date.getTime())) {
            return '';
        }

        // Format as YYYY-MM-DD (local date, not UTC)
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('Error formatting date for Google Sheets:', error);
        return '';
    }
};

// Function to parse date from input field (YYYY-MM-DD) and avoid timezone issues
export const parseDateFromInput = (inputDate: string): string => {
    if (!inputDate) return '';

    // Input from <input type="date"> is already YYYY-MM-DD
    // But we need to ensure it's treated as local date, not UTC
    const parts = inputDate.split('-');
    if (parts.length !== 3) return inputDate;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    // Create date at noon to avoid timezone issues
    const date = new Date(year, month, day, 12, 0, 0, 0);

    // Format back to YYYY-MM-DD for consistency
    const formattedYear = date.getFullYear();
    const formattedMonth = String(date.getMonth() + 1).padStart(2, '0');
    const formattedDay = String(date.getDate()).padStart(2, '0');

    return `${formattedYear}-${formattedMonth}-${formattedDay}`;
};