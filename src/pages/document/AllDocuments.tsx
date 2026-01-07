import { useState, useEffect } from "react";
import {
  Plus,
  Search,
  FileText,
  Download,
  Edit,
  Trash2,
  MoreHorizontal,
  Mail,
  MessageCircle,
  Share2,
} from "lucide-react";
import useDataStore from "../../store/dataStore";
import useHeaderStore from "../../store/headerStore";
import AddDocument from "./AddDocument";
import EditDocument from "./EditDocument";
import ShareModal from "./ShareModal";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { formatDate } from "../../utils/dateFormatter";
import { fetchDocumentsFromGoogleSheets, submitToGoogleSheets } from "../../utils/googleSheetsService";
import { toast } from "react-hot-toast";
import type { DocumentItem } from "../../store/dataStore";

const AllDocuments = () => {
  const { deleteDocument, setDocuments: setStoreDocuments, documents: storeDocuments } = useDataStore();
  const { setTitle } = useHeaderStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle("All Document");
    loadDocuments();
  }, [setTitle]);

  // Helper function to remove duplicate documents
  const deduplicateDocuments = (docs: DocumentItem[]): DocumentItem[] => {
    const uniqueMap = new Map<string, DocumentItem>();

    docs.forEach(doc => {
      const uniqueKey = `${doc.sn}_${doc.documentName}_${doc.companyName}_${doc.category}`.toLowerCase().trim();

      if (!uniqueMap.has(uniqueKey)) {
        uniqueMap.set(uniqueKey, doc);
      } else {
        console.warn('Duplicate document found:', {
          serialNo: doc.sn,
          name: doc.documentName,
          company: doc.companyName,
          category: doc.category
        });
      }
    });

    return Array.from(uniqueMap.values());
  };

  const loadDocuments = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const fetchedDocs = await fetchDocumentsFromGoogleSheets();
      const uniqueDocs = deduplicateDocuments(fetchedDocs);

      console.log(`Loaded ${uniqueDocs.length} documents from sheet`);
      setDocuments(uniqueDocs);
      // Replace store data instead of appending to avoid staleness
      setStoreDocuments(uniqueDocs);
    } catch (err: unknown) {
      console.error("Error loading documents from Google Sheets:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load documents";

      // Fall back to local store data
      if (storeDocuments && storeDocuments.length > 0) {
        console.log("Falling back to local store data");
        const uniqueStoreDocs = deduplicateDocuments(storeDocuments);
        setDocuments(uniqueStoreDocs);
        setError(null);
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredData = documents
    .filter((item) => {
      const matchesSearch =
        item.documentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sn.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = filterCategory
        ? item.category === filterCategory
        : true;

      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      const getSnNumber = (sn: string) => {
        if (!sn) return -1;
        const match = sn.match(/SN-(\d+)/i);
        return match ? parseInt(match[1], 10) : -1;
      };
      return getSnNumber(a.sn) - getSnNumber(b.sn);
    });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map((d) => d.id)));
    }
  };

  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Share Modal State - Updated to include batch documents
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [shareType, setShareType] = useState<
    "email" | "whatsapp" | "both" | null
  >(null);
  const [shareDoc, setShareDoc] = useState<{
    id: string;
    name: string;
    fileContent?: string;
    document?: DocumentItem;
    isBatch?: boolean;
    batchDocuments?: DocumentItem[];
  } | null>(null);

  // Delete Modal State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleEdit = (id: string) => {
    setEditingDocId(id);
    setIsEditModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    const id = deleteId;
    setDeleteId(null); // Close modal immediately

    const doc = documents.find((d) => d.id === id);

    // Remove locally first for immediate feedback
    deleteDocument(id);
    setDocuments(documents.filter((d) => d.id !== id));
    if (selectedIds.has(id)) {
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
    }

    if (doc && doc.rowIndex) {
      try {
        toast.loading("Deleting from cloud...", { id: "delete-toast" });
        const sheetRow = [
          doc.date || new Date().toLocaleString(),
          doc.sn,
          doc.documentName,
          doc.documentType,
          doc.category,
          doc.companyName,
          doc.needsRenewal ? "Yes" : "No",
          doc.renewalDate ? new Date(doc.renewalDate).toLocaleDateString("en-GB") : "",
          doc.fileContent || "",
          "Deleted"
        ];

        await submitToGoogleSheets({
          action: "update",
          sheetName: "Documents",
          data: sheetRow,
          rowIndex: doc.rowIndex
        });
        toast.success("Document deleted from cloud", { id: "delete-toast" });
      } catch (error) {
        console.error("Failed to delete from cloud", error);
        toast.error("Deleted locally, but cloud update failed.", { id: "delete-toast" });
      }
    } else {
      toast.success("Document deleted locally");
    }
  };

  // Updated openShare function to handle batch
  const openShare = (
    type: "email" | "whatsapp" | "both",
    doc: {
      id: string;
      name: string;
      fileContent?: string;
      document?: DocumentItem;
      isBatch?: boolean;
      batchDocuments?: DocumentItem[];
    }
  ) => {
    setShareType(type);
    setShareDoc(doc);
    setIsShareModalOpen(true);
  };

  // Function to handle batch sharing
  const handleBatchShare = (type: "email" | "whatsapp") => {
    const selectedDocuments = filteredData.filter(d => selectedIds.has(d.id));

    if (selectedDocuments.length === 0) {
      toast.error("No documents selected");
      return;
    }

    if (selectedDocuments.length === 1) {
      // Single document selected
      const doc = selectedDocuments[0];
      openShare(type, {
        id: doc.id,
        name: doc.documentName,
        fileContent: doc.fileContent,
        document: doc,
        isBatch: false
      });
    } else {
      // Multiple documents selected - batch mode
      openShare(type, {
        id: "batch",
        name: `${selectedIds.size} Documents`,
        isBatch: true,
        batchDocuments: selectedDocuments,
        // Include first document for reference
        document: selectedDocuments[0],
        fileContent: selectedDocuments[0]?.fileContent
      });
    }
  };

  const handleDownload = (fileContent: string | undefined) => {
    if (!fileContent) {
      alert("File content not available for download.");
      return;
    }

    let fileUrl = fileContent;

    // Convert Google Drive view/edit URLs to direct view URLs
    if (fileUrl.includes('drive.google.com')) {
      let fileId = null;

      const viewMatch = fileUrl.match(/\/file\/d\/([^/]+)/);
      if (viewMatch) {
        fileId = viewMatch[1];
      }

      const openMatch = fileUrl.match(/[?&]id=([^&]+)/);
      if (openMatch) {
        fileId = openMatch[1];
      }

      if (fileId) {
        fileUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }

    if (fileUrl.startsWith("data:")) {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = "document";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    window.open(fileUrl, '_blank');
  };

  const handleAddModalClose = () => {
    setIsAddModalOpen(false);
    loadDocuments();
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    loadDocuments();
  };

  return (
    <>
      <div className="space-y-3">
        {/* Search and Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-3 rounded-xl shadow-input">
          <div className="min-h-[38px] flex items-center">
            {selectedIds.size > 0 ? (
              <div className="flex flex-wrap items-center gap-3 animate-fade-in-right w-full sm:w-auto">
                <span className="text-sm text-indigo-600 font-semibold bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 whitespace-nowrap">
                  {selectedIds.size} Selected
                </span>
                <div className="hidden sm:block h-4 w-px bg-gray-200 mx-1"></div>
                <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                  <button
                    onClick={() => handleBatchShare("email")}
                    className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100"
                    title="Share via Email"
                  >
                    <Mail size={14} />
                    Email {selectedIds.size > 1 && `(${selectedIds.size})`}
                  </button>
                  <button
                    onClick={() => handleBatchShare("whatsapp")}
                    className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors border border-green-100"
                    title="Share via WhatsApp"
                  >
                    <MessageCircle size={14} />
                    WhatsApp {selectedIds.size > 1 && `(${selectedIds.size})`}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  All Documents
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  Manage your documents repository
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-3">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search documents..."
                className="pl-10 pr-4 py-2.5 w-full shadow-input border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2.5 shadow-input border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-700 text-sm font-medium cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <option value="">All Categories</option>
                {Array.from(new Set(documents.map((d) => d.category)))
                  .filter(Boolean)
                  .sort()
                  .map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
              </select>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-gray-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg whitespace-nowrap"
            >
              <Plus className="h-5 w-5" />
              <span>Add New</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12 bg-white rounded-xl shadow-input">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              <p className="text-gray-500 text-sm">Loading documents...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">
                  Error loading documents
                </h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                <button
                  onClick={loadDocuments}
                  className="mt-3 text-sm font-medium text-red-600 hover:text-red-500"
                >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Desktop Table View */}
        {!isLoading && !error && (
          <div className="hidden md:flex flex-col bg-white rounded-xl shadow-input overflow-hidden h-[calc(100vh-350px)]">
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
                  <tr className="border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                    <th className="px-3 py-2 w-10 text-center bg-gray-50">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                        checked={
                          filteredData.length > 0 &&
                          selectedIds.size === filteredData.length
                        }
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-3 py-2 w-12 text-center bg-gray-50">
                      Share
                    </th>
                    <th className="px-3 py-2 w-20 text-center bg-gray-50">
                      Action
                    </th>
                    <th className="px-3 py-2 whitespace-nowrap bg-gray-50">
                      Serial No
                    </th>
                    <th className="px-3 py-2 whitespace-nowrap bg-gray-50">
                      Document Name
                    </th>
                    <th className="px-3 py-2 whitespace-nowrap bg-gray-50">
                      Document Type
                    </th>
                    <th className="px-3 py-2 whitespace-nowrap bg-gray-50">
                      Category
                    </th>
                    <th className="px-3 py-2 whitespace-nowrap bg-gray-50">
                      Name
                    </th>
                    <th className="px-3 py-2 whitespace-nowrap text-center bg-gray-50">
                      Renewal
                    </th>
                    <th className="px-3 py-2 whitespace-nowrap bg-gray-50">
                      Renewal Date
                    </th>
                    <th className="px-3 py-2 whitespace-nowrap bg-gray-50">
                      File
                    </th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-50">
                  {filteredData.map((item) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50/80 transition-colors ${selectedIds.has(item.id) ? "bg-indigo-50/30" : ""
                        }`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelection(item.id)}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors outline-none">
                              <MoreHorizontal size={20} />
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              className="min-w-[160px] bg-white rounded-lg shadow-xl border border-gray-100 p-1.5 z-50 animate-fade-in-up"
                              sideOffset={5}
                              align="start"
                            >
                              <DropdownMenu.Item
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md cursor-pointer outline-none"
                                onClick={() =>
                                  openShare("email", {
                                    id: item.id,
                                    name: item.documentName,
                                    fileContent: item.fileContent,
                                    document: item,
                                    isBatch: false
                                  })
                                }
                              >
                                <Mail size={16} className="text-blue-500" />
                                Email
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md cursor-pointer outline-none"
                                onClick={() =>
                                  openShare("whatsapp", {
                                    id: item.id,
                                    name: item.documentName,
                                    fileContent: item.fileContent,
                                    document: item,
                                    isBatch: false
                                  })
                                }
                              >
                                <MessageCircle
                                  size={16}
                                  className="text-green-500"
                                />
                                WhatsApp
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator className="h-px bg-gray-100 my-1" />
                              <DropdownMenu.Item
                                className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md cursor-pointer outline-none"
                                onClick={() =>
                                  openShare("both", {
                                    id: item.id,
                                    name: item.documentName,
                                    fileContent: item.fileContent,
                                    document: item,
                                    isBatch: false
                                  })
                                }
                              >
                                <Share2 size={16} className="text-purple-500" />
                                Share Both
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </td>
                      <td className="px-3 py-2 flex justify-center items-center gap-2">
                        <button
                          onClick={() => handleEdit(item.id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                      <td className="px-3 py-2 font-bold text-gray-700 text-xs">
                        {item.sn}
                      </td>
                      <td className="px-3 py-2 text-gray-900 flex items-center gap-2">
                        <FileText size={16} className="text-gray-400" />
                        {item.documentName}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {item.documentType}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                          {item.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {item.companyName}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {item.needsRenewal ? (
                          <span className="inline-flex items-center justify-center px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-100 rounded text-xs font-medium">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center px-2.5 py-1 bg-gray-50 text-gray-500 border border-gray-100 rounded text-xs font-medium">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-500 font-mono text-xs">
                        {formatDate(item.renewalDate)}
                      </td>
                      <td className="px-3 py-2">
                        {item.file ? (
                          <div
                            onClick={() =>
                              handleDownload(item.fileContent)
                            }
                            className="flex items-center gap-2 text-indigo-600 text-xs cursor-pointer hover:underline"
                          >
                            <Download size={14} />
                            <span className="truncate max-w-[100px]">View</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredData.length === 0 && (
                    <tr>
                      <td colSpan={11} className="p-12 text-center text-gray-500">
                        <div className="flex flex-col items-center gap-2">
                          <FileText size={48} className="text-gray-200" />
                          <p>No documents found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mobile Card View */}
        {!isLoading && !error && (
          <div className="md:hidden grid sm:grid-cols-2 gap-4">
            {filteredData.map((item) => (
              <div
                key={item.id}
                className="bg-white p-4 rounded-xl shadow-input space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                      {item.sn}
                    </span>
                    <h3 className="font-semibold text-gray-900 mt-1">
                      {item.companyName}
                    </h3>
                    <p className="text-xs text-gray-500">{item.documentType}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[10px] font-medium border border-indigo-100">
                    {item.category}
                  </span>
                </div>

                <div className="pt-2 border-t border-gray-50">
                  <div className="flex items-start gap-2 mb-2">
                    <FileText
                      size={16}
                      className="text-gray-400 mt-0.5 max-w-4"
                    />
                    <span className="text-sm text-gray-700 font-medium line-clamp-2">
                      {item.documentName}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs mt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Renewal:</span>
                      {item.needsRenewal ? (
                        <span className="text-amber-600 font-medium bg-amber-50 px-1.5 rounded">
                          Yes
                        </span>
                      ) : (
                        <span className="text-gray-400 font-medium bg-gray-50 px-1.5 rounded">
                          No
                        </span>
                      )}
                    </div>
                    {item.needsRenewal && (
                      <span className="font-mono text-red-500 bg-red-50 px-1.5 rounded">
                        {formatDate(item.renewalDate)}
                      </span>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-gray-50 flex justify-between items-center bg-gray-50/50 -mx-4 -mb-4 px-4 py-3">
                    {item.file ? (
                      <button
                        onClick={() =>
                          handleDownload(item.fileContent)
                        }
                        className="flex items-center gap-1.5 text-indigo-600 text-xs font-medium"
                      >
                        <Download size={14} />
                        Download
                      </button>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                    <div className="flex gap-2">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button className="p-1.5 text-indigo-600 bg-indigo-50 rounded-lg">
                            <Share2 size={14} />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            className="min-w-[160px] bg-white rounded-lg shadow-xl border border-gray-100 p-1.5 z-50 animate-fade-in-up"
                            sideOffset={5}
                            align="end"
                          >
                            <DropdownMenu.Item
                              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md cursor-pointer outline-none"
                              onClick={() =>
                                openShare("email", {
                                  id: item.id,
                                  name: item.documentName,
                                  fileContent: item.fileContent,
                                  document: item,
                                  isBatch: false
                                })
                              }
                            >
                              <Mail size={16} className="text-blue-500" />
                              Email
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md cursor-pointer outline-none"
                              onClick={() =>
                                openShare("whatsapp", {
                                  id: item.id,
                                  name: item.documentName,
                                  fileContent: item.fileContent,
                                  document: item,
                                  isBatch: false
                                })
                              }
                            >
                              <MessageCircle
                                size={16}
                                className="text-green-500"
                              />
                              WhatsApp
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator className="h-px bg-gray-100 my-1" />
                            <DropdownMenu.Item
                              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md cursor-pointer outline-none"
                              onClick={() =>
                                openShare("both", {
                                  id: item.id,
                                  name: item.documentName,
                                  fileContent: item.fileContent,
                                  document: item,
                                  isBatch: false
                                })
                              }
                            >
                              <Share2 size={16} className="text-purple-500" />
                              Share Both
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>

                      <button
                        onClick={() => handleEdit(item.id)}
                        className="p-1.5 text-blue-600 bg-blue-50 rounded-lg"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-red-600 bg-red-50 rounded-lg"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filteredData.length === 0 && (
              <div className="col-span-full p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-100 border-dashed">
                <div className="flex flex-col items-center gap-2">
                  <FileText size={40} className="text-gray-200" />
                  <p>No documents found</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <AddDocument
        isOpen={isAddModalOpen}
        onClose={handleAddModalClose}
      />
      <EditDocument
        isOpen={isEditModalOpen}
        onClose={handleEditModalClose}
        documentId={editingDocId}
      />
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        type={shareType}
        documentId={shareDoc?.id || ""}
        documentName={shareDoc?.name || ""}
        fileContent={shareDoc?.fileContent}
        document={shareDoc?.document}
        isBatch={shareDoc?.isBatch}
        batchDocuments={shareDoc?.batchDocuments}
      />

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden transform transition-all scale-100 opacity-100">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Document?</h3>
              <p className="text-gray-500 mb-6">
                Are you sure you want to delete this document? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AllDocuments;