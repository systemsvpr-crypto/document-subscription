import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface DocumentItem {
  id: string;
  sn: string; // Serial Number
  companyName: string;
  documentType: string;
  category: string;
  documentName: string;
  needsRenewal: boolean;
  renewalDate?: string; // Optional renewal date
  file: string | null; // File name
  fileContent?: string; // Base64 data for download
  date: string;
  status: string;
  rowIndex?: number; // Row index in Google Sheet (1-based or 0-based depending on usage)
  planned1?: string; // Column K from Google Sheet
  actual1?: string; // Column L from Google Sheet
}

export interface SubscriptionItem {
  id: string;
  sn: string;
  requestedDate: string;
  companyName: string;
  subscriberName: string;
  subscriptionName: string;
  price: string;
  frequency: string;
  purpose: string;
  startDate: string; // Blank initially
  endDate: string; // Blank initially
  status: string; // Blank initially or Active
  // keeping legacy fields optional for compatibility if needed, or mapping them
  service?: string;
  plan?: string;
  renewalDate?: string;
  renewalStatus?: string; // For renewal workflow
  renewalNumber?: string; // RN-xxx
  approvalNo?: string;
  remarks?: string;
  approvalDate?: string;
  paymentDate?: string;
  paymentMethod?: string;
  transactionId?: string;
  paymentFile?: string;
  paymentFileContent?: string;
  actual3?: string;
  planned2?: string; // Column N (13)
  actual2?: string; // Column O (14)
  planned1?: string;
  actual1?: string;
  updatedPrice?: string;
  paymentReceipt?: string;
  file?: string | null; // Generic file
  fileContent?: string;
  renewalCount?: string;
}

export interface LoanItem {
  id: string;
  Timestamp: string;
  sn: string; // SN-xxx
  loanName: string;
  bankName: string;
  amount: string;
  emi: string;
  startDate: string;
  endDate: string;
  providedDocument: string;
  remarks: string;
  file?: string | null;
  fileContent?: string;

  // Foreclosure & Close Request
  foreclosureStatus?: "Pending" | "Approved" | "Rejected"; // "Action" stage status
  requestDate?: string;
  requesterName?: string;
  planned1?: string;
  actual1?: string;
  delay1?: string;
  planned2?: string;
  actual2?: string;
  delay2?: string;
  planned3?: string;
  actual3?: string;
  delay3?: string;
  closingStatus?: string;
  documentFile?: string;
  rowIndex?: number;
  date?: string;

  // Collect All Document
  documentStatus?: "Yes" | "No";
  documentCollectionRemarks?: string;
  closerRequestDate?: string; // Appears in Collect Document table

  // Collect NOC
  collectNocStatus?: "Yes" | "No";

  // Final Settlement
  finalSettlementStatus?: "Yes" | "No";
  nextDate?: string;
  settlementDate?: string; // Date when settled
}

export interface MasterItem {
  id: string;
  companyName: string;
  documentType: string;
  category: string;
}

export interface RenewalItem {
  id: string;
  documentId: string;
  sn: string;
  documentName: string;
  documentType: string;
  category: string;
  companyName: string; // "Name"
  entryDate: string;
  oldRenewalDate: string; // "Renewal" column in history
  oldFile: string | null; // "Document File" column
  renewalStatus: "Yes" | "No"; // "Renewal Status"
  nextRenewalDate: string | null; // "Next Renewal Data"
  newFile: string | null; // "New Document file"
  newFileContent?: string;
  oldFileContent?: string;
}

export interface SubscriptionRenewalItem {
  id: string;
  renewalNo: string;
  subscriptionId: string;
  sn: string;
  companyName: string;
  subscriberName: string;
  subscriptionName: string;
  frequency: string;
  price: string;
  endDate: string;
  renewalStatus: string;
}

export interface ShareItem {
  id: string;
  shareNo: string;
  dateTime: string;
  docSerial: string;
  docName: string;
  docFile: string;
  sharedVia: "Email" | "WhatsApp";
  recipientName: string;
  contactInfo: string;
}

interface DataState {
  documents: DocumentItem[];
  subscriptions: SubscriptionItem[];
  loans: LoanItem[];
  masterData: MasterItem[];
  renewalHistory: RenewalItem[];
  subscriptionRenewalHistory: SubscriptionRenewalItem[];
  shareHistory: ShareItem[];
  addDocument: (item: DocumentItem) => void;
  addDocuments: (items: DocumentItem[]) => void;
  setDocuments: (items: DocumentItem[]) => void;
  addSubscription: (item: SubscriptionItem) => void;
  addLoan: (item: LoanItem) => void;
  addLoans: (items: LoanItem[]) => void;
  setLoans: (items: LoanItem[]) => void;
  addMasterData: (item: MasterItem) => void;
  addRenewalHistory: (item: RenewalItem) => void;
  addSubscriptionRenewalHistory: (item: SubscriptionRenewalItem) => void;
  addShareHistory: (item: ShareItem) => void;
  resetShareHistory: () => void;
  resetSubscriptions: () => void;
  setSubscriptions: (items: SubscriptionItem[]) => void;
  updateDocument: (id: string, updatedItem: Partial<DocumentItem>) => void;
  updateSubscription: (
    id: string,
    updatedItem: Partial<SubscriptionItem>
  ) => void;
  updateLoan: (id: string, updatedItem: Partial<LoanItem>) => void;
  deleteDocument: (id: string) => void;
  setSubscriptionRenewalHistory: (items: SubscriptionRenewalItem[]) => void;
}

const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      documents: [],
      subscriptions: [],
      loans: [],
      masterData: [],
      renewalHistory: [],
      shareHistory: [],
      subscriptionRenewalHistory: [],
      addDocument: (item) =>
        set((state) => ({ documents: [...state.documents, item] })),
      addDocuments: (items) =>
        set((state) => ({ documents: [...state.documents, ...items] })),
      addSubscription: (item) =>
        set((state) => ({ subscriptions: [...state.subscriptions, item] })),
      addLoan: (item) => set((state) => ({ loans: [...state.loans, item] })),
      addLoans: (items) => set((state) => ({ loans: [...state.loans, ...items] })),
      setLoans: (items) => set({ loans: items }),
      addMasterData: (item) =>
        set((state) => ({ masterData: [...state.masterData, item] })),
      addRenewalHistory: (item) =>
        set((state) => ({ renewalHistory: [item, ...state.renewalHistory] })),
      addSubscriptionRenewalHistory: (item) =>
        set((state) => ({
          subscriptionRenewalHistory: [
            item,
            ...state.subscriptionRenewalHistory,
          ],
        })),
      setSubscriptionRenewalHistory: (items) => set({ subscriptionRenewalHistory: items }),
      addShareHistory: (item) =>
        set((state) => ({ shareHistory: [item, ...state.shareHistory] })),
      resetShareHistory: () => set({ shareHistory: [] }),
      resetSubscriptions: () => set({ subscriptions: [] }),
      setSubscriptions: (items) => set({ subscriptions: items }),
      setDocuments: (items) => set({ documents: items }),
      updateDocument: (id, updatedItem) =>
        set((state) => ({
          documents: state.documents.map((doc) =>
            doc.id === id ? { ...doc, ...updatedItem } : doc
          ),
        })),
      updateSubscription: (id, updatedItem) =>
        set((state) => ({
          subscriptions: state.subscriptions.map((sub) =>
            sub.id === id ? { ...sub, ...updatedItem } : sub
          ),
        })),
      updateLoan: (id, updatedItem) =>
        set((state) => ({
          loans: state.loans.map((loan) =>
            loan.id === id ? { ...loan, ...updatedItem } : loan
          ),
        })),
      deleteDocument: (id) =>
        set((state) => ({
          documents: state.documents.filter((doc) => doc.id !== id),
        })),
    }),
    {
      name: "app-data-storage-v8",
    }
  )
);

export default useDataStore;
