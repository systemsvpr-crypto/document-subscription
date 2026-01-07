import { useState, useEffect } from "react";
import { Download, Search, RefreshCw, FileText } from "lucide-react";
import { toast } from "react-hot-toast";

interface SharingLog {
  timestamp: string;
  email: string;
  name: string;
  documentName: string;
  documentType: string;
  category: string;
  serialNo: string;
  image: string;
  sourceSheet: string;
  shareMethod: string;
  number: string;
}

const SharingLogs = () => {
  const [logs, setLogs] = useState<SharingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMethod, setFilterMethod] = useState("");

  useEffect(() => {
    fetchSharingLogs();
  }, []);

  const fetchSharingLogs = async () => {
    try {
      setLoading(true);
      // This would fetch from your API or directly from Google Sheets
      // For now, we'll use a mock implementation

      // In a real implementation, you would fetch from your API
      // const response = await fetch('/api/sharing-logs');
      // const data = await response.json();

      // Mock data for demonstration
      const mockLogs: SharingLog[] = [
        {
          timestamp: "2024-01-15 14:30:00",
          email: "john@example.com",
          name: "John Doe",
          documentName: "Annual Report 2023",
          documentType: "PDF",
          category: "Financial",
          serialNo: "DOC-001",
          image: "https://drive.google.com/file/d/...",
          sourceSheet: "Documents",
          shareMethod: "Email",
          number: ""
        },
        {
          timestamp: "2024-01-15 15:15:00",
          email: "",
          name: "Jane Smith",
          documentName: "Contract Agreement",
          documentType: "PDF",
          category: "Legal",
          serialNo: "DOC-002",
          image: "https://drive.google.com/file/d/...",
          sourceSheet: "Documents",
          shareMethod: "WhatsApp",
          number: "+919876543210"
        }
      ];

      setLogs(mockLogs);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching sharing logs:", error);
      toast.error("Failed to load sharing logs");
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.documentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.serialNo.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMethod = filterMethod ? log.shareMethod === filterMethod : true;

    return matchesSearch && matchesMethod;
  });

  const exportToCSV = () => {
    const headers = [
      "Timestamp",
      "Email",
      "Name",
      "Document Name",
      "Document Type",
      "Category",
      "Serial No",
      "Image",
      "Source Sheet",
      "Share Method",
      "Number"
    ];

    const csvContent = [
      headers.join(","),
      ...filteredLogs.map(log => [
        log.timestamp,
        `"${log.email}"`,
        `"${log.name}"`,
        `"${log.documentName}"`,
        `"${log.documentType}"`,
        `"${log.category}"`,
        `"${log.serialNo}"`,
        `"${log.image}"`,
        `"${log.sourceSheet}"`,
        `"${log.shareMethod}"`,
        `"${log.number}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sharing_logs.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success("Export completed successfully");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl shadow-input">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Sharing Logs</h1>
          <p className="text-gray-500 text-sm mt-1">
            Track all document sharing activities
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search logs..."
              className="pl-10 pr-4 py-2.5 w-full shadow-input border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="relative">
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 shadow-input border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 text-gray-700 text-sm font-medium cursor-pointer hover:bg-gray-100 transition-colors"
            >
              <option value="">All Methods</option>
              <option value="Email">Email</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Both">Both</option>
            </select>
          </div>

          <button
            onClick={exportToCSV}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg whitespace-nowrap"
          >
            <Download className="h-5 w-5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={fetchSharingLogs}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg whitespace-nowrap"
          >
            <RefreshCw className="h-5 w-5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12 bg-white rounded-xl shadow-input">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            <p className="text-gray-500 text-sm">Loading sharing logs...</p>
          </div>
        </div>
      )}

      {/* Logs Table */}
      {!loading && (
        <div className="bg-white rounded-xl shadow-input overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Share Method</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipient</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Document Name</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Serial No</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.map((log, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                      {log.timestamp}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${log.shareMethod === 'Email'
                          ? 'bg-blue-100 text-blue-800'
                          : log.shareMethod === 'WhatsApp'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                        {log.shareMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{log.name}</p>
                        <p className="text-xs text-gray-500">
                          {log.shareMethod === 'Email' ? log.email : log.number}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-gray-400" />
                        <span className="text-sm text-gray-900">{log.documentName}</span>
                      </div>
                      <p className="text-xs text-gray-500">{log.documentType}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                        {log.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-mono">
                      {log.serialNo}
                    </td>
                    <td className="px-4 py-3">
                      {log.image && (
                        <a
                          href={log.image}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                        >
                          <FileText size={14} />
                          View Document
                        </a>
                      )}
                    </td>
                  </tr>
                ))}

                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2">
                        <FileText size={48} className="text-gray-200" />
                        <p>No sharing logs found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SharingLogs;