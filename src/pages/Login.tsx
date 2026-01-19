import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Eye, EyeOff, FileText } from "lucide-react";
import useAuthStore from "../store/authStore";
import toast from "react-hot-toast";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const setAuthenticatedUser = useAuthStore((state) => state.setAuthenticatedUser);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error("Please enter both username and password");
      return;
    }

    try {
      setIsLoading(true);
      const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbxgmfdTJW--pSl-ypu83Lj01yksjLFZGLMRwvnvi_gEJh4xdYkb1Sx7smMjSnkYtm7U-A/exec";
      if (!GOOGLE_SCRIPT_URL) {
        toast.error("Google Script URL is missing");
        return;
      }

      const url = new URL(GOOGLE_SCRIPT_URL);
      url.searchParams.set("sheet", "Pass");
      url.searchParams.set("_t", Date.now().toString());

      const response = await fetch(url.toString());
      const json = await response.json();

      if (!json.success || !Array.isArray(json.data)) {
        throw new Error("Failed to fetch login data");
      }

      const rows: any[][] = json.data.slice(1); // Skip header [Name, username, Password, Role]
      const foundRow = rows.find(row =>
        String(row[1] || "").trim() === username.trim() &&
        String(row[2] || "").trim() === password.trim()
      );

      if (foundRow) {
        // Check for Deleted status in Column F (index 5)
        const deletionStatus = (foundRow[5] || "").toString().trim();
        if (deletionStatus === 'Deleted') {
          toast.error("User Does not exist");
          return;
        }

        const role = (foundRow[3] || "user").toLowerCase() as 'admin' | 'user';

        let permissions: string[] = [];

        if (role === 'admin') {
          permissions = ['Dashboard', 'Document', 'Subscription', 'Loan', 'Calendar', 'Master', 'Settings'];
        } else {
          // Parse permissions from Column E (index 4) for users
          const rawPermissions = (foundRow[4] || "").toString();
          permissions = rawPermissions.split(',').map((p: string) => p.trim()).filter((p: string) => p.length > 0);
        }

        setAuthenticatedUser({
          id: foundRow[1], // username
          name: (foundRow[0] || "").toString().trim(), // Name from Column A
          role: role,
          permissions: permissions
        });

        toast.success(`Welcome back, ${foundRow[0] || foundRow[1]}!`);
        navigate("/", { replace: true });
      } else {
        toast.error("Invalid username or password");
      }
    } catch (error) {
      console.error("Login Error:", error);
      toast.error("An error occurred during login. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-indigo-50 to-indigo-50 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="max-w-md w-full space-y-8 relative">
        {/* Main card */}
        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-2xl shadow-input transform transition-all duration-300 hover:shadow-indigo-100">
          {/* Header section */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="h-40 w-40 flex items-center justify-center rounded-full bg-white shadow-md overflow-hidden transform transition-all duration-300 hover:scale-105">
                  <FileText className="h-20 w-20 text-indigo-600" />
                </div>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-1 tracking-tight">
              Document & Subscription System
            </h2>
          </div>

          {/* Form section */}
          <div className="mt-4 space-y-2">
            {/* Username field */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-1 text-center">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User
                    className={`h-5 w-5 transition-all duration-200 ${focusedField === "username"
                      ? "text-indigo-600"
                      : "text-gray-400"
                      }`}
                  />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                  className="block w-full pl-12 pr-4 py-3 shadow-input border-none rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-gray-300"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-1 text-center">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock
                    className={`h-5 w-5 transition-all duration-200 ${focusedField === "password"
                      ? "text-indigo-600"
                      : "text-gray-400"
                      }`}
                  />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  className="block w-full pl-12 pr-12 py-3 shadow-input border-none rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all duration-200 hover:border-gray-300"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-indigo-600 transition-colors duration-200" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-indigo-600 transition-colors duration-200" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <div className="">
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className={`w-full flex justify-center py-3 px-4 border border-transparent text-base font-semibold rounded-xl text-white transition-all duration-200 transform shadow-lg hover:shadow-xl ${isLoading
                  ? "bg-indigo-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 hover:scale-105"
                  }`}
              >
                {isLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>

          </div>
        </div>

        {/* Footer - Matching your Layout footer */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Powered by{' '}
            <a
              href="https://www.botivate.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors duration-200"
            >
              Botivate
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;