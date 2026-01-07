import { SubscriptionItem } from "../store/dataStore";

export const syncSubscriptions = async (): Promise<SubscriptionItem[]> => {
    const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || "";
    if (!GOOGLE_SCRIPT_URL) throw new Error("Google Script URL is not defined");

    // Parallel Fetch all necessary sheets
    const [subRes, appRes, payRes] = await Promise.all([
        fetch(`${GOOGLE_SCRIPT_URL}?sheet=Subscription&_t=${Date.now()}`),
        fetch(`${GOOGLE_SCRIPT_URL}?sheet=Subscription%20Approval&_t=${Date.now()}`),
        fetch(`${GOOGLE_SCRIPT_URL}?sheet=PAYMENT&_t=${Date.now()}`)
    ]);

    const [subJson, appJson, payJson] = await Promise.all([
        subRes.json(),
        appRes.json(),
        payRes.json()
    ]);

    if (!subJson.success) throw new Error(subJson.error || "Failed to fetch subscriptions");

    // 1. Create Maps for Lookup (Approval & Details)
    const approvalMap = new Map();
    if (appJson.success && Array.isArray(appJson.data)) {
        appJson.data.slice(1).forEach((row: any[]) => {
            if (row[2]) {
                const sn = row[2].toString().trim();
                approvalMap.set(sn, { status: row[4], date: row[0], note: row[5] });
            }
        });
    }

    // Build Details Map from Subscription Sheet (to fill N/A in payment history)
    const detailsMap = new Map<string, { company: string, subscriber: string, subName: string, price: string, freq: string, actual2: string, renewalStatus: string }>();
    if (subJson.success && Array.isArray(subJson.data)) {
        subJson.data.slice(1).forEach((row: any[]) => {
            let sn = (row[1] || '').toString().trim();
            // Normalize SN
             const snMatch = sn.match(/(\d+)/);
            if (snMatch && sn.toUpperCase().startsWith('SN')) {
                 sn = `SN-${String(snMatch[0]).padStart(3, '0')}`;
            } else if (snMatch && !sn.toUpperCase().startsWith('SN')) {
                 sn = `SN-${String(snMatch[0]).padStart(3, '0')}`;
            }

            if (sn) {
                 const companyName = (row[2] || '').toString().trim();
                 const subscriberName = (row[3] || '').toString().trim();
                 const subscriptionName = (row[4] || '').toString().trim();
                 const price = (row[5] || '').toString().trim();
                 const frequency = (row[6] || '').toString().trim();
                 const actual2 = (row[14] || '').toString().trim(); // Column O: Approved On
                 const renewalStatus = (row[11] || '').toString().trim(); // Column L: Renewal Status
                 
                 detailsMap.set(sn, { company: companyName, subscriber: subscriberName, subName: subscriptionName, price: price, freq: frequency, actual2: actual2, renewalStatus });
            }
        });
    }

    const paymentList: SubscriptionItem[] = [];
    if (payJson.success && Array.isArray(payJson.data)) {
        payJson.data.slice(1).forEach((row: any[], index: number) => {
            if (row[1]) {
                const sn = row[1].toString().trim();
                const details = detailsMap.get(sn);
                const approval = approvalMap.get(sn);
                
                // Use actual2 from master sheet (details) or approval log
                const approvedOn = details?.actual2 || approval?.date || '';

                paymentList.push({
                    id: `pay-history-${index}`,
                    sn: sn,
                    requestedDate: '',
                    companyName: details?.company || 'N/A',
                    subscriberName: details?.subscriber || 'N/A',
                    subscriptionName: details?.subName || 'N/A',
                    price: row[7] || details?.price || 'N/A',
                    frequency: details?.freq || 'N/A',
                    purpose: 'History Record',
                    status: 'Paid',
                    startDate: row[4] || '',
                    endDate: row[6] || '',
                    paymentDate: row[0] || '',
                    paymentMethod: row[2] || '',
                    transactionId: row[3] || '',
                    paymentFile: row[5] || '',
                    updatedPrice: row[7] || '',
                    paymentReceipt: row[8] || '',
                    actual2: approvedOn,
                    actual3: 'Yes',
                    renewalStatus: details?.renewalStatus || ''
                });
            }
        });
    }

    // 2. Transform Base Subscriptions (Show ALL items from Subscription Sheet)
    // Iterate all rows and filter for valid data to avoid index-slicing issues
    const subscriptionList: SubscriptionItem[] = subJson.data
        .map((row: any[], index: number) => {
            if (!row || row.length < 2) return null;

            let sn = (row[1] || '').toString().trim();
            const companyName = (row[2] || '').toString().trim();
            const subscriptionName = (row[4] || '').toString().trim();

            // Skip headers, empty rows, or metadata rows
            if (!sn || 
                sn.toLowerCase() === 'serial no' || 
                sn.toLowerCase().includes('create subscription') || 
                (!companyName && !subscriptionName)) {
                return null;
            }

            // Robust check: Ensure SN looks like a serial number (starts with SN or is numeric)
            // If it's just random text in Col B, it might be a header or instruction.
            // But we'll be permissive: if it has company/sub name, we take it.
            
            const snMatch = sn.match(/(\d+)/);
            if (snMatch && sn.toUpperCase().startsWith('SN')) {
                 sn = `SN-${String(snMatch[0]).padStart(3, '0')}`;
            } else if (snMatch && !sn.toUpperCase().startsWith('SN')) {
                // If just number, format it
                 sn = `SN-${String(snMatch[0]).padStart(3, '0')}`;
            }

            const planned2 = (row[13] || '').toString().trim(); // Column N (Planned 2)
            const actual2 = (row[14] || '').toString().trim(); // Column O (Actual 2)
            const approvalStatusCol = (row[16] || '').toString().trim(); // Column Q (Approval Status)
            const actual3 = (row[18] || '').toString().trim(); // Column S (Payment)
            const transactionId = (row[19] || '').toString().trim(); // Column T (Transaction ID)
            const renewalCount = (row[12] || '0').toString().trim(); // Column M (Renewal Count)
            const renewalStatusSheet = (row[11] || '').toString().trim(); // Column L (Renewal Status)
            const planned1 = (row[8] || '').toString().trim(); // Column I (Planned 1)
            const actual1 = (row[9] || '').toString().trim(); // Column J (Actual 1)

            // Determine Status based on workflow columns
            let computedStatus = 'Pending';
            if (actual3) {
                computedStatus = 'Paid';
            } else if (approvalStatusCol.toLowerCase() === 'approved') {
                computedStatus = 'Approved';
            } else if (approvalStatusCol.toLowerCase() === 'rejected') {
                computedStatus = 'Rejected';
            } else if (actual2) {
                computedStatus = 'Approved';
            }

            const approval = approvalMap.get(sn);

            // Helper to format ISO timestamps to YYYY-MM-DD HH:mm
            const formatTimestamp = (dateStr: string) => {
                if (!dateStr) return '';
                // Check if likely ISO (contains T and Z or just T)
                if (dateStr.includes('T') || dateStr.includes('Z')) {
                    const d = new Date(dateStr);
                    if (!isNaN(d.getTime())) {
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        const hours = String(d.getHours()).padStart(2, '0');
                        const minutes = String(d.getMinutes()).padStart(2, '0');
                        return `${year}-${month}-${day} ${hours}:${minutes}`;
                    }
                }
                return dateStr;
            };

            const rawDate = (row[0] || '').toString().trim();

            return {
                id: `sub-${sn}-${index}`,
                sn: sn,
                requestedDate: formatTimestamp(rawDate),
                companyName: companyName || 'N/A',
                subscriberName: (row[3] || 'N/A').toString().trim(),
                subscriptionName: subscriptionName || 'N/A',
                price: (row[5] || 'N/A').toString().trim(),
                frequency: (row[6] || 'N/A').toString().trim(),
                purpose: (row[7] || 'N/A').toString().trim(),
                status: computedStatus,
                startDate: (row[20] || '').toString().trim(), // Col U
                endDate: (row[21] || '').toString().trim(),   // Col V
                paymentDate: actual3, // Use Actual 3 as payment date for Master item
                paymentMethod: '', // Not stored in Master
                transactionId: transactionId,
                paymentFile: (row[22] || '').toString().trim(), // Col W
                approvalDate: approval?.date || '',
                remarks: '',
                actual2,
                actual3,
                renewalStatus: renewalStatusSheet,
                planned1,
                planned2,
                actual1,
                renewalCount
            };
        })
        .filter((item: SubscriptionItem | null): item is SubscriptionItem => item !== null);

    // Return the Master Subscription List directly.
    // We do not merge paymentList (History) here because this view is for "All Subscriptions" (the contracts),
    // not the transaction ledger. The Subscription sheet contains the current state.
    // Merging payment history caused duplicates and obscured the original "Purpose" with "History Record".
    return subscriptionList;
};
