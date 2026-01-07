import { useState, useMemo, useEffect } from "react";
import useDataStore, { DocumentItem } from "../../store/dataStore";
import { toast } from "react-hot-toast";
import { X, Save, Plus, Upload, Trash2, Loader2 } from "lucide-react";
import SearchableInput from "../../components/SearchableInput";
import {
  fetchMasterFromGoogleSheets,
  submitToGoogleSheets,
  fetchDocumentsFromGoogleSheets,
} from "../../utils/googleSheetsService";

interface DocumentEntry {
  id: string;
  documentName: string;
  documentType: string;
  category: string;
  companyName: string; // The "Name" field
  needsRenewal: boolean;
  renewalDate?: string;
  file: File | null;
  fileName: string;
  fileContent?: string;
}

interface AddDocumentProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddDocument: React.FC<AddDocumentProps> = ({ isOpen, onClose }) => {
  const { addDocuments, masterData, addMasterData, documents } = useDataStore();

  const defaultCategories = ["Personal", "Company", "Director"];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [remoteDocTypes, setRemoteDocTypes] = useState<string[]>([]);
  const [remoteCategories, setRemoteCategories] = useState<string[]>([]);

  const [entries, setEntries] = useState<DocumentEntry[]>([
    {
      id: Math.random().toString(),
      documentName: "",
      documentType: "",
      category: "",
      companyName: "",
      needsRenewal: false,
      renewalDate: "",
      file: null,
      fileName: "",
    },
  ]);

  const typeOptions = useMemo(() => {
    const local = masterData?.map((m) => m.documentType) || [];
    return Array.from(new Set([...remoteDocTypes, ...local])).filter(Boolean);
  }, [masterData, remoteDocTypes]);

  const categoryOptions = useMemo(() => {
    const local = masterData?.map((m) => m.category) || [];
    return Array.from(
      new Set([...remoteCategories, ...local, ...defaultCategories])
    ).filter(Boolean);
  }, [masterData, remoteCategories]);
  // nameOptions removed as we switched to Input for Name per requirement interpretation

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    (async () => {
      try {
        const rows = await fetchMasterFromGoogleSheets();
        if (!mounted) return;

        const docTypes = rows
          .map((r: { documentType: string; category: string }) => r.documentType)
          .filter((v: string) => typeof v === "string" && v.trim().length > 0);
        const cats = rows
          .map((r: { documentType: string; category: string }) => r.category)
          .filter((v: string) => typeof v === "string" && v.trim().length > 0);

        setRemoteDocTypes(Array.from(new Set(docTypes)));
        setRemoteCategories(Array.from(new Set(cats)));
      } catch (err) {
        console.error(err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (id: string, field: keyof DocumentEntry, value: any) => {
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleFileChange = (
    id: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEntries((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                ...item,
                file: file,
                fileName: file.name,
                fileContent: reader.result as string,
              }
              : item
          )
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const addEntry = () => {
    if (entries.length >= 10) {
      toast.error("You can add maximum 10 documents at a time.");
      return;
    }
    setEntries((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        documentName: "",
        documentType: "",
        category: "",
        companyName: "",
        needsRenewal: false,
        renewalDate: "",
        file: null,
        fileName: "",
      },
    ]);
  };

  const removeEntry = (id: string) => {
    if (entries.length === 1) {
      toast.error("At least one document is required.");
      return;
    }
    setEntries((prev) => prev.filter((item) => item.id !== id));
  };

  const getNameLabel = (category: string) => {
    const c = category?.toLowerCase() || "";
    if (c.includes("personal")) return "Person Name";
    if (c.includes("director")) return "Director Name";
    if (c.includes("company")) return "Company Name";
    return "Name";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    for (const entry of entries) {
      if (
        !entry.documentName ||
        !entry.documentType ||
        !entry.category ||
        !entry.companyName
      ) {
        toast.error("Please fill all required fields.");
        return;
      }
      if (entry.needsRenewal && !entry.renewalDate) {
        toast.error("Please select a renewal date.");
        return;
      }
    }

    setIsSubmitting(true);

    // FETCH LATEST DATA: Critical for multi-user SN generation
    let currentDocs: DocumentItem[] = documents;
    try {
      const freshDocs = await fetchDocumentsFromGoogleSheets();
      if (freshDocs && freshDocs.length > 0) {
        currentDocs = freshDocs;
      }
    } catch (error) {
      console.warn("Could not fetch latest docs for SN generation, using local cache", error);
    }

    const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;

    // Calculate allocated SNs for all entries based on FRESH data
    const snList: string[] = [];
    let maxSn = 0;

    if (currentDocs) {
      currentDocs.forEach((d) => {
        if (d.sn && d.sn.trim().startsWith("SN-")) {
          const part = d.sn.trim().replace("SN-", "");
          const n = parseInt(part, 10);
          if (!isNaN(n) && n > maxSn) {
            maxSn = n;
          }
        }
      });
    }

    // Generate strict sequence based on Max SN
    for (let i = 0; i < entries.length; i++) {
      const nextVal = maxSn + 1 + i;
      snList.push(`SN-${nextVal.toString().padStart(3, '0')}`);
    }

    try {
      const newDocuments: DocumentItem[] = [];

      // Process sequentially to ensure order in Google Sheets
      for (const [index, entry] of entries.entries()) {
        const exists = masterData?.some(
          (m) =>
            m.companyName.toLowerCase() === entry.companyName.toLowerCase() &&
            m.documentType.toLowerCase() === entry.documentType.toLowerCase() &&
            m.category.toLowerCase() === entry.category.toLowerCase()
        );

        if (!exists) {
          addMasterData({
            id: Math.random().toString(36).substr(2, 9),
            companyName: entry.companyName,
            documentType: entry.documentType,
            category: entry.category,
          });
        }

        // Assign Pre-calculated SN
        const newSN = snList[index];
        const randomSN = newSN;
        let fileUrl = "";

        // 1. Upload File if present
        if (entry.file && entry.fileContent && folderId) {
          try {
            const uploadRes = await submitToGoogleSheets({
              action: "uploadFile",
              sheetName: "Documents",
              data: {
                base64Data: entry.fileContent,
                fileName: entry.fileName,
                mimeType: entry.file.type,
                folderId: folderId,
              },
            });

            if (uploadRes && uploadRes.fileUrl) {
              fileUrl = uploadRes.fileUrl;
            }
          } catch (uploadErr) {
            console.error(`Failed to upload file ${entry.fileName}`, uploadErr);
            toast.error(
              `Failed to upload ${entry.fileName}, saving without file.`
            );
          }
        }

        // 2. Prepare Payload
        const now = new Date();
        const formattedTimestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

        const sheetData = {
          Timestamp: formattedTimestamp,
          "Serial No": randomSN,
          "Document name": entry.documentName,
          "Document Type": entry.documentType,
          Category: entry.category,
          Name: entry.companyName,
          "Need Renewal": entry.needsRenewal ? "Yes" : "No",
          "Renewal Date": entry.renewalDate
            ? entry.renewalDate // Send YYYY-MM-DD directly to avoid locale confusion
            : "",
          Image: fileUrl || "",
        };

        // 3. Submit Document
        await submitToGoogleSheets({
          action: "insert",
          sheetName: "Documents",
          data: [
            sheetData.Timestamp,
            sheetData["Serial No"],
            sheetData["Document name"],
            sheetData["Document Type"],
            sheetData.Category,
            sheetData.Name,
            sheetData["Need Renewal"],
            sheetData["Renewal Date"],
            sheetData.Image,
          ],
        });

        // 4. Update Local State
        newDocuments.push({
          id: Math.random().toString(36).substr(2, 9),
          sn: randomSN,
          documentName: entry.documentName,
          companyName: entry.companyName,
          documentType: entry.documentType,
          category: entry.category,
          needsRenewal: entry.needsRenewal,
          renewalDate: entry.needsRenewal ? entry.renewalDate : undefined,
          file: entry.fileName || null,
          fileContent: entry.fileContent,
          date: new Date().toISOString().split("T")[0],
          status: "Active",
        });
      }
      addDocuments(newDocuments);
      toast.success(`${newDocuments.length} Document(s) added successfully`);
      onClose();

      setEntries([
        {
          id: Math.random().toString(),
          documentName: "",
          documentType: "",
          category: "",
          companyName: "",
          needsRenewal: false,
          renewalDate: "",
          file: null,
          fileName: "",
        },
      ]);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save to Google Sheets.");
      // Do not close so user can retry
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/40 backdrop-blur-sm overflow-y-auto">
      <div className="relative my-4 w-full max-w-4xl bg-white rounded-xl shadow-input">
        {/* Header Compact */}
        <div className="flex justify-between items-center px-5 py-3 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800">
              New Document Entry
            </h2>
            <p className="text-xs text-gray-500">Add details (Max 10)</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body Compact */}
        <div className="p-4 max-h-[75vh] overflow-y-auto bg-gray-50/30">
          <form id="add-doc-form" onSubmit={handleSubmit} className="space-y-3">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className="relative p-4 bg-white rounded-lg shadow-input group"
              >
                <div className="flex justify-between items-center pb-1 mb-2 border-b border-gray-50">
                  <h3 className="text-xs font-bold tracking-wider text-gray-600 uppercase">
                    Document #{index + 1}
                  </h3>
                  {entries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEntry(entry.id)}
                      className="p-1 text-red-500 rounded transition-colors hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {/* Compact Grid: Gaps reduced */}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {/* 1. Document Name (Input) */}
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-600">
                      Document Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="p-2 w-full text-xs font-medium rounded-lg border-none transition-colors outline-none shadow-input focus:ring-1 focus:ring-indigo-500 bg-gray-50/50 focus:bg-white"
                      value={entry.documentName}
                      onChange={(e) =>
                        handleChange(entry.id, "documentName", e.target.value)
                      }
                      placeholder="e.g. Agreement"
                    />
                  </div>

                  {/* 2. Document Type (Searchable) */}
                  <div>
                    {/* Note: SearchableInput styles are internal, but we can wrap it or accept it's slightly larger. 
                                             For compacting, we might just use it as is but careful with layout. 
                                             Ideally, SearchableInput should support size prop. 
                                             For now, we leave it as 'proper' update focused on layout gaps. */}
                    <SearchableInput
                      compact
                      label="Document Type"
                      value={entry.documentType}
                      onChange={(val) =>
                        handleChange(entry.id, "documentType", val)
                      }
                      options={typeOptions}
                      placeholder="Select Type..."
                      required
                    />
                  </div>

                  {/* 3. Category (Searchable) */}
                  <div>
                    <SearchableInput
                      compact
                      label="Category"
                      value={entry.category}
                      onChange={(val) =>
                        handleChange(entry.id, "category", val)
                      }
                      options={categoryOptions}
                      placeholder="Select Category..."
                      required
                    />
                  </div>

                  {/* 4. Name (Input - as changed from Searchable per 'Input' requirement) */}
                  <div>
                    <label className="block mb-1 text-xs font-semibold text-gray-600">
                      {getNameLabel(entry.category)}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="p-2 w-full text-xs font-medium rounded-lg border-none transition-colors outline-none shadow-input focus:ring-1 focus:ring-indigo-500 bg-gray-50/50 focus:bg-white"
                      value={entry.companyName}
                      onChange={(e) =>
                        handleChange(entry.id, "companyName", e.target.value)
                      }
                      placeholder={`Enter ${getNameLabel(entry.category)}...`}
                    />
                  </div>

                  {/* 5. Needs Renewal & Date */}
                  <div className="flex gap-3 items-center p-2 rounded-lg border border-gray-100 bg-gray-50/50">
                    <label className="flex gap-2 items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        checked={entry.needsRenewal}
                        onChange={(e) =>
                          handleChange(
                            entry.id,
                            "needsRenewal",
                            e.target.checked
                          )
                        }
                      />
                      <span className="text-xs font-medium text-gray-700">
                        Need Renewal
                      </span>
                    </label>

                    {entry.needsRenewal && (
                      <div className="flex-1">
                        <input
                          type="date"
                          className="w-full p-1.5 text-xs shadow-input border-none rounded focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                          value={entry.renewalDate || ""}
                          onChange={(e) =>
                            handleChange(
                              entry.id,
                              "renewalDate",
                              e.target.value
                            )
                          }
                          required
                        />
                      </div>
                    )}
                  </div>

                  {/* 6. File Upload */}
                  <div>
                    <div className="relative">
                      <label className="block mb-1 text-xs font-semibold text-gray-600">
                        Upload File
                      </label>
                      <input
                        type="file"
                        id={`file-${entry.id}`}
                        className="hidden"
                        onChange={(e) => handleFileChange(entry.id, e)}
                      />
                      <label
                        htmlFor={`file-${entry.id}`}
                        className="flex gap-2 justify-center items-center p-2 w-full text-gray-600 bg-white rounded-lg border border-gray-300 border-dashed transition-all cursor-pointer hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-600"
                      >
                        <Upload size={14} />
                        <span className="text-xs font-medium truncate max-w-[180px]">
                          {entry.fileName || "Choose File"}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={addEntry}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-indigo-200 text-indigo-600 text-xs font-bold hover:bg-indigo-50 transition-colors bg-white shadow-sm"
              >
                <Plus size={16} />
                Add Another Document ({entries.length}/10)
              </button>
            </div>
          </form>
        </div>

        {/* Footer Compact */}
        <div className="flex gap-3 px-5 py-4 bg-gray-50 rounded-b-xl border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm font-bold text-gray-700 rounded-lg border border-gray-200 shadow-sm transition-all hover:bg-white hover:border-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-doc-form"
            disabled={isSubmitting}
            className={`flex-[2] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-white text-sm font-bold transition-all shadow-md shadow-indigo-100 ${isSubmitting
              ? "bg-indigo-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
              }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddDocument;
