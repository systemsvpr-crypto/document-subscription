import { DocumentItem, LoanItem, RenewalItem } from '../store/dataStore';
import { User } from '../store/authStore';
const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbxgmfdTJW--pSl-ypu83Lj01yksjLFZGLMRwvnvi_gEJh4xdYkb1Sx7smMjSnkYtm7U-A/exec";

interface SheetPayload {
  action: string;
  sheetName?: string;
  tableName?: string;
  data?: any;
  rowIndex?: number;
  folderId?: string;
  fileName?: string;
  fileContent?: string;
  sn?: string;
  cellUpdates?: any;
}

export interface SharingLogData {
  email?: string;
  recipientName: string;
  documentName: string;
  documentType?: string;
  category?: string;
  serialNo?: string;
  fileContent?: string;
  sourceSheet?: string;
  shareMethod: 'Email' | 'WhatsApp' | 'Both';
  number?: string;
}

export interface MasterSheetRow {
  documentType: string;
  category: string;
}

export const submitToGoogleSheets = async (payload: SheetPayload) => {
  if (!GOOGLE_SCRIPT_URL) {
    throw new Error(
      "Google Script URL is not defined in environment variables"
    );
  }

  try {
    const params = new URLSearchParams();
    params.append("action", payload.action);
    if (payload.sheetName) params.append("sheetName", payload.sheetName);
    if (payload.tableName) params.append("tableName", payload.tableName);
    if (payload.rowIndex !== undefined) {
      params.append("rowIndex", payload.rowIndex.toString());
    }

    if (payload.sn) {
      params.append("sn", payload.sn);
    }

    if (payload.cellUpdates) {
      params.append("cellUpdates", typeof payload.cellUpdates === 'string' ? payload.cellUpdates : JSON.stringify(payload.cellUpdates));
    }

    if (
      (payload.action === "insert" || payload.action === "update") &&
      payload.data
    ) {
      params.append("rowData", JSON.stringify(payload.data));
    }

    if (payload.action === "updateColumns" && payload.data) {
      params.append("updates", JSON.stringify(payload.data));
    }

    if (payload.action === "uploadFile" && typeof payload.data === "object") {
      const paramMap = {
        base64Data: payload.data.base64Data,
        fileName: payload.data.fileName,
        mimeType: payload.data.mimeType,
        folderId: payload.data.folderId,
      };
      Object.entries(paramMap).forEach(([key, value]) => {
        params.append(key, String(value));
      });
    } else if (
      payload.data &&
      payload.action !== "insert" &&
      payload.action !== "update" &&
      payload.action !== "updateColumns"
    ) {
      params.append("data", JSON.stringify(payload.data));
    }

    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Server error: ${res.status} ${txt}`);
    }

    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch (e) {
      // If the response is the string "undefined", it might be a script error returning undefined
      if (text.trim() === "undefined") {
        throw new Error("Google Script returned 'undefined'. Check if the action and parameters are correct.");
      }
      throw new Error(`Failed to parse response as JSON: ${text}`);
    }

    if (!json.success) {
      throw new Error(json.error || "Script reported failure");
    }

    return json;
  } catch (error) {
    console.error("Error submitting to Google Sheets:", error);
    throw error;
  }
};

export const fetchMasterFromGoogleSheets = async () => {
  if (!GOOGLE_SCRIPT_URL) {
    throw new Error(
      "Google Script URL is not defined in environment variables"
    );
  }

  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.set("sheet", "Master");
  url.searchParams.set("_t", new Date().getTime().toString());

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      mode: "cors",
    });

    if (!res.ok) {
      throw new Error(
        `Failed to fetch master data: ${res.status} ${res.statusText}`
      );
    }

    const json = (await res.json()) as any;
    const rows = json.data;
    const body = rows.length > 0 ? rows.slice(1) : rows;

    return body
      .map((r: any) => ({
        documentType: (r?.[0] || "").toString().trim(),
        category: (r?.[1] || "").toString().trim(),
      }))
      .filter((r: any) => r.documentType.length > 0 || r.category.length > 0);
  } catch (error) {
    console.error("Fetch Master Sheet Error:", error);
    throw error;
  }
};

export const fetchDocumentsFromGoogleSheets = async (): Promise<DocumentItem[]> => {
  if (!GOOGLE_SCRIPT_URL) {
    throw new Error(
      "Google Script URL is not defined in environment variables"
    );
  }

  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.set("sheet", "Documents");
  url.searchParams.set("_t", new Date().getTime().toString());

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      mode: "cors",
    });

    if (!res.ok) {
      throw new Error(
        `Failed to fetch documents: ${res.status} ${res.statusText}`
      );
    }

    const json = (await res.json()) as any;
    const rows = json.data;

    // Find the header row dynamically
    let headerIndex = -1;
    if (rows && rows.length > 0) {
      // Look for "Serial No" in the second column (index 1) or "Timestamp" in first (index 0)
      headerIndex = rows.findIndex((r: any) =>
        (r?.[1] && String(r[1]).trim() === "Serial No") ||
        (r?.[1] && String(r[1]).trim() === "Serial no")
      );
    }

    const startObjIndex = headerIndex !== -1 ? headerIndex + 1 : 1;
    const body = rows.length > startObjIndex ? rows.slice(startObjIndex) : [];

    const getDateString = (dateVal: any): string => {
      if (!dateVal) return '';

      // Handle Date Object
      if (dateVal instanceof Date) {
        return dateVal.toISOString().split('T')[0];
      }

      const strVal = String(dateVal).trim();

      // Already ISO? (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) return strVal;

      // Handle DD/MM/YYYY or DD-MM-YYYY
      // Regex detects 1-2 digits, separator, 1-2 digits, separator, 4 digits
      const dmyMatch = strVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (dmyMatch) {
        const day = dmyMatch[1].padStart(2, '0');
        const month = dmyMatch[2].padStart(2, '0');
        const year = dmyMatch[3];
        return `${year}-${month}-${day}`;
      }

      // Handle ISO with Time (YYYY-MM-DDTHH:mm...)
      if (strVal.includes('T')) {
        return strVal.split('T')[0];
      }

      return strVal;
    };

    return body
      .map((r: any, index: number) => {
        const fileUrl = (r?.[8] || "").toString().trim();
        const dateStr = getDateString(r?.[0]);
        const renewalDateStr = getDateString(r?.[7]); // Column H (Index 7)
        const issueDateStr = getDateString(r?.[12]);  // Column M (Index 12)
        const status = (r?.[9] || "Active").toString().trim();

        // Robust rowIndex logic similar to fetchLoansFromGoogleSheets
        const lastVal = r[r.length - 1];
        const serverRowIndex = (typeof lastVal === 'number' && lastVal > 1) ? lastVal : null;

        const fallbackBase = headerIndex !== -1 ? (headerIndex + 2) : 2;
        const rowIndex = serverRowIndex || (index + fallbackBase);

        return {
          id: `doc-${index}-${Date.now()}`,
          sn: (r?.[1] || "").toString().trim(),
          documentName: (r?.[2] || "").toString().trim(),
          documentType: (r?.[3] || "").toString().trim(),
          category: (r?.[4] || "").toString().trim(),
          companyName: (r?.[5] || "").toString().trim(),
          needsRenewal: (r?.[6] || "").toString().toLowerCase() === "yes",
          renewalDate: renewalDateStr,
          file: fileUrl ? "View Document" : null,
          fileContent: fileUrl,
          date: dateStr,
          status: status,
          rowIndex: rowIndex,
          planned1: (r?.[10] || "").toString().trim(), // Column K is index 10
          actual1: (r?.[11] || "").toString().trim(), // Column L is index 11
          issueDate: issueDateStr,                    // Column M is index 12
          concernPersonName: (r?.[13] || "").toString().trim(), // Column N is index 13
          concernPersonMobile: (r?.[14] || "").toString().trim(), // Column O is index 14
          concernPersonDepartment: (r?.[15] || "").toString().trim(), // Column P is index 15
        };
      })
      .filter(
        (r: any) => (r.sn.length > 0 || r.documentName.length > 0) && r.status.toLowerCase() !== "deleted"
      );
  } catch (error) {
    console.error("Fetch Documents Sheet Error:", error);
    throw error;
  }
};

export const fetchRenewalHistoryFromGoogleSheets = async (): Promise<RenewalItem[]> => {
  if (!GOOGLE_SCRIPT_URL) {
    throw new Error(
      "Google Script URL is not defined in environment variables"
    );
  }

  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.set("sheet", "Document Renewal");
  url.searchParams.set("_t", new Date().getTime().toString());

  try {
    const res = await fetch(url.toString(), { method: "GET", mode: "cors" });
    if (!res.ok) throw new Error(`Failed to fetch renewal history: ${res.status}`);

    const json = (await res.json()) as any;
    const rows = json.data;

    // Dynamic Header Detection for Renewal Sheet
    let headerIndex = -1;
    if (rows && rows.length > 0) {
      headerIndex = rows.findIndex((r: any) =>
        (r?.[1] && String(r[1]).trim().toLowerCase().includes("serial no"))
      );
    }

    // Data starts after header. If no header found, assume row 1 (index 0) is header, so start at index 1.
    const startObjIndex = headerIndex !== -1 ? headerIndex + 1 : 1;
    const body = rows.length > startObjIndex ? rows.slice(startObjIndex) : [];

    const getDateString = (dateVal: any): string => {
      if (!dateVal) return '';
      if (typeof dateVal === 'string') return dateVal.trim();
      if (dateVal instanceof Date) return dateVal.toISOString().split('T')[0];
      return String(dateVal).trim();
    };

    return body.map((r: any, index: number) => {
      // Standard Mapping if we assume the user hasn't changed column order but just added rows/headers.
      // A: Timestamp (0), B: Serial No (1), C: Last Renewal Date (2), D: old Image (3)
      // E: Need Renewal (4), F: New Renewal Date (5), G: New Image (6)

      const oldFileUrl = (r?.[3] || "").toString().trim();
      const newFileUrl = (r?.[6] || "").toString().trim();

      return {
        id: `renewal-${index}-${Date.now()}`,
        documentId: '', // Will be matched in UI
        sn: (r?.[1] || "").toString().trim(),
        documentName: '', // Will be matched in UI via SN
        documentType: '', // Will be matched in UI via SN
        category: '', // Will be matched in UI via SN
        companyName: '', // Will be matched in UI via SN
        entryDate: getDateString(r?.[0]),
        oldRenewalDate: getDateString(r?.[2]),
        oldFile: oldFileUrl ? "View File" : null,
        oldFileContent: oldFileUrl,
        renewalStatus: (r?.[4] || "No") as "Yes" | "No",
        nextRenewalDate: getDateString(r?.[5]),
        newFile: newFileUrl ? "View File" : null,
        newFileContent: newFileUrl,
      };
    }).filter((r: any) => r.sn.length > 0 && r.sn.toLowerCase() !== "serial no");
  } catch (error) {
    console.error("Fetch Renewal History Error:", error);
    return []; // Return empty on error to avoid crashing app
  }
};

export const fetchUsersFromGoogleSheets = async (): Promise<User[]> => {
  if (!GOOGLE_SCRIPT_URL) {
    throw new Error("Google Script URL is not defined");
  }

  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.set("sheet", "Pass");
  url.searchParams.set("_t", new Date().getTime().toString());

  try {
    const res = await fetch(url.toString(), { method: "GET", mode: "cors" });
    if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);

    const json = (await res.json()) as any;
    const rows = json.data;
    const body = rows.length > 0 ? rows.slice(1) : rows;

    return body.map((r: any) => {
      return {
        name: (r?.[0] || "").toString().trim(), // Name from Column A
        id: (r?.[1] || "").toString().trim(), // Username
        password: (r?.[2] || "").toString().trim(), // Password
        role: (r?.[3] || "user").toString().trim().toLowerCase() as 'admin' | 'user',
        permissions: (r?.[4] || "").toString().split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0),
        deleted: (r?.[5] || "").toString().trim(),
        rawData: r
      };
    }).filter((u: User) => u.id.length > 0);
  } catch (error) {
    console.error("Fetch Users Error:", error);
    return [];
  }
};

export const fetchLoansFromGoogleSheets = async (): Promise<LoanItem[]> => {
  if (!GOOGLE_SCRIPT_URL) {
    throw new Error(
      "Google Script URL is not defined in environment variables"
    );
  }

  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.set("sheet", "Loan");
  url.searchParams.set("_t", new Date().getTime().toString());

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      mode: "cors",
    });

    if (!res.ok) {
      throw new Error(
        `Failed to fetch loans: ${res.status} ${res.statusText}`
      );
    }

    const json = (await res.json()) as any;
    const rows = json.data;
    const body = rows.length > 0 ? rows.slice(1) : rows;

    return body
      .map((r: any, index: number) => {
        const fileUrl = (r?.[9] || "").toString().trim();

        // Robust rowIndex logic: 
        // If the App Script returns the original row index as the last element (number), use it.
        // Otherwise, fallback to basic index + 2 calculation (which works if no rows are filtered).
        const lastVal = r[r.length - 1];
        const serverRowIndex = (typeof lastVal === 'number' && lastVal > 1) ? lastVal : null;
        const rowIndex = serverRowIndex || (index + 2);

        return {
          id: `loan-${index}-${Date.now()}`,
          sn: (r?.[1] || "").toString().trim(),
          loanName: (r?.[2] || "").toString().trim(),
          bankName: (r?.[3] || "").toString().trim(),
          amount: (r?.[4] || "").toString().trim(),
          emi: (r?.[5] || "").toString().trim(),
          startDate: (r?.[6] || "").toString().trim(),
          endDate: (r?.[7] || "").toString().trim(),
          providedDocument: (r?.[8] || "").toString().trim(),
          file: fileUrl === "No File" ? null : fileUrl,
          fileContent: fileUrl === "No File" ? undefined : fileUrl,
          remarks: (r?.[10] || "").toString().trim(),
          planned1: (r?.[11] || "").toString().trim(),
          actual1: (r?.[12] || "").toString().trim(),
          delay1: (r?.[13] || "").toString().trim(),
          requestDate: (r?.[14] || "").toString().trim(),
          requesterName: (r?.[15] || "").toString().trim(),
          planned2: (r?.[16] || "").toString().trim(),
          actual2: (r?.[17] || "").toString().trim(),
          delay2: (r?.[18] || "").toString().trim(),
          planned3: (r?.[19] || "").toString().trim(),
          actual3: (r?.[20] || "").toString().trim(),
          delay3: (r?.[21] || "").toString().trim(),
          closingStatus: (r?.[22] || "").toString().trim(),
          foreclosureStatus: (r?.[22] || "") as any,
          documentFile: (r?.[23] || "").toString().trim(),
          documentStatus: (r?.[24] || "").toString().trim() as any,
          collectNocStatus: (r?.[19] || "").toString().trim() as any,
          finalSettlementStatus: (r?.[26] || "").toString().trim() as any,
          rowIndex: rowIndex,
          date: (r?.[0] || "").toString().trim(),
        };
      })
      .filter((r: any) =>
        r.sn &&
        r.sn.toString().startsWith("SN-") &&
        r.loanName.toLowerCase() !== "new loan details" &&
        r.loanName.toLowerCase() !== "loan name"
      );
  } catch (error) {
    console.error("Fetch Loans Sheet Error:", error);
    throw error;
  }
};

export interface EmailData {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
  attachmentUrl?: string;
  documentName?: string;
  recipientName?: string;
  documentType?: string;
  category?: string;
  serialNo?: string;
}

export const sendEmailViaGoogleSheets = async (emailData: EmailData) => {
  try {
    const params = new URLSearchParams();
    params.append('action', 'sendEmail');
    params.append('to', emailData.to);
    params.append('subject', emailData.subject);
    params.append('body', emailData.body);
    params.append('isHtml', emailData.isHtml ? 'true' : 'false');
    if (emailData.attachmentUrl) params.append('attachmentUrl', emailData.attachmentUrl);
    if (emailData.recipientName) params.append('recipientName', emailData.recipientName);
    if (emailData.documentName) params.append('documentName', emailData.documentName);
    if (emailData.documentType) params.append('documentType', emailData.documentType);
    if (emailData.category) params.append('category', emailData.category);
    if (emailData.serialNo) params.append('serialNo', emailData.serialNo);

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    return await response.json();
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: 'Failed' };
  }
};

export const getFileInfoFromGoogleDrive = async (fileId: string) => {
  try {
    const params = new URLSearchParams();
    params.append('action', 'getFileInfo');
    params.append('fileId', fileId);
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    return await response.json();
  } catch (error) {
    console.error('Error getting file info:', error);
    return { success: false, error: 'Failed' };
  }
};

export const logSharingActivity = async (logData: SharingLogData) => {
  try {
    const params = new URLSearchParams();
    params.append('action', 'logSharing');
    params.append('recipientName', logData.recipientName || '');
    params.append('documentName', logData.documentName || '');
    params.append('documentType', logData.documentType || '');
    params.append('category', logData.category || '');
    params.append('serialNo', logData.serialNo || '');
    params.append('fileContent', logData.fileContent || '');
    params.append('shareMethod', logData.shareMethod);
    if (logData.email) params.append('email', logData.email);
    if (logData.number) params.append('number', logData.number);

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    });
    return await response.json();
  } catch (error) {
    console.error('Error logging sharing activity:', error);
    return { success: false, error: 'Failed' };
  }
};

export interface ApprovalData {
  Timestamp: string;
  'Approval No': string;
  'Subscription No': string;
  'Approved By': string;
  'Approval Status': string;
  Note: string;
}

export const submitApprovalToGoogleSheet = async (data: ApprovalData) => {
  try {
    const payload = {
      action: 'insert',
      sheetName: 'Subscription Approval',
      data: data
    };
    return await submitToGoogleSheets(payload);
  } catch (error) {
    console.error('Error submitting approval:', error);
    return { success: false, error: 'Failed' };
  }
};


export const updateGoogleSheetCells = async (
  sheetName: string,
  rowIndex: number,
  cellUpdates: Array<{ column: number; value: any }>
) => {
  try {
    // Prepare the payload with the correct structure
    const payload = {
      action: 'updateCells',
      sheetName,
      rowIndex,
      cellUpdates: JSON.stringify(cellUpdates), // Stringify here
    };

    const params = new URLSearchParams();
    params.append("action", payload.action);
    if (payload.sheetName) params.append("sheetName", payload.sheetName);
    if (payload.rowIndex !== undefined) {
      params.append("rowIndex", payload.rowIndex.toString());
    }
    if (payload.cellUpdates) {
      params.append("cellUpdates", payload.cellUpdates);
    }

    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Server error: ${res.status} ${txt}`);
    }

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Script reported failure");
    }

    return json;
  } catch (error) {
    console.error("Error updating Google Sheet cells:", error);
    throw error;
  }
};

export const updateGoogleSheetCellsBySn = async (
  sheetName: string,
  sn: string,
  cellUpdates: Array<{ column: number; value: any }>
) => {
  try {
    const payload = {
      action: 'updateCellsBySn',
      sheetName,
      sn,
      cellUpdates: JSON.stringify(cellUpdates),
    };

    const params = new URLSearchParams();
    params.append("action", payload.action);
    params.append("sheetName", payload.sheetName);
    params.append("sn", payload.sn);
    params.append("cellUpdates", payload.cellUpdates);

    const res = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "cors",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Server error: ${res.status} ${txt}`);
    }

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Script reported failure");
    }

    return json;
  } catch (error) {
    console.error("Error updating Google Sheet cells by SN:", error);
    throw error;
  }
};

export interface RawSubscriptionRenewal {
  timestamp: string;
  renewalNo: string;
  sn: string;
  approvedBy: string;
  status: string;
}

export const fetchSubscriptionRenewalHistoryFromGoogleSheets = async (): Promise<RawSubscriptionRenewal[]> => {
  if (!GOOGLE_SCRIPT_URL) {
    throw new Error("Google Script URL is not defined");
  }

  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.set("sheet", "RENEWAL");
  url.searchParams.set("_t", new Date().getTime().toString());

  try {
    const res = await fetch(url.toString(), { method: "GET", mode: "cors" });
    if (!res.ok) throw new Error(`Failed to fetch subscription renewal history: ${res.status}`);

    const json = (await res.json()) as any;
    const rows = json.data;

    // Header logic: Look for "Renewal No"
    let headerIndex = -1;
    if (rows && rows.length > 0) {
      headerIndex = rows.findIndex((r: any) =>
        (r?.[1] && String(r[1]).trim().toLowerCase().includes("renewal no"))
      );
    }

    const startObjIndex = headerIndex !== -1 ? headerIndex + 1 : 1;
    const body = rows.length > startObjIndex ? rows.slice(startObjIndex) : [];

    return body.map((r: any) => ({
      timestamp: (r?.[0] || "").toString().trim(),
      renewalNo: (r?.[1] || "").toString().trim(),
      sn: (r?.[2] || "").toString().trim(),
      approvedBy: (r?.[3] || "").toString().trim(),
      status: (r?.[4] || "").toString().trim(),
    })).filter((r: any) => r.renewalNo.length > 0);
  } catch (error) {
    console.error("Fetch Subscription Renewal History Error:", error);
    return [];
  }
};
