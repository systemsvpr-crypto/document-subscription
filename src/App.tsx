import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";

import Settings from "./pages/Settings";
import ResourceManager from "./pages/ResourceManager";
import DocumentRenewal from "./pages/document/Renewal";
import SubscriptionRenewal from "./pages/subscription/Renewal";

// Document Pages
import AllDocuments from "./pages/document/AllDocuments";
import SharedDocuments from "./pages/document/Shared";

// Subscription Pages
import AllSubscriptions from "./pages/subscription/AllSubscriptions";
import SubscriptionApproval from "./pages/subscription/Approval";
import SubscriptionPayment from "./pages/subscription/Payment";

// Loan Pages
import AllLoans from "./pages/loan/AllLoans";
import LoanForeclosure from "./pages/loan/Foreclosure";
import LoanNOC from "./pages/loan/NOC";

import MasterPage from "./pages/master/MasterPage";

// Main Router Configuration
function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          
          {/* Document Routes */}
          <Route path="document">
            <Route index element={<Navigate to="all" replace />} />
            <Route path="all" element={<AllDocuments />} />
            <Route path="renewal" element={<DocumentRenewal />} />
            <Route path="shared" element={<SharedDocuments />} />
          </Route>

          {/* Subscription Routes */}
          <Route path="subscription">
             <Route index element={<Navigate to="all" replace />} />
             <Route path="all" element={<AllSubscriptions />} />
             <Route path="approval" element={<SubscriptionApproval />} />
             <Route path="payment" element={<SubscriptionPayment />} />
             <Route path="renewal" element={<SubscriptionRenewal />} />
          </Route>

          {/* Loan Routes */}
          <Route path="loan">
             <Route index element={<Navigate to="all" replace />} />
             <Route path="all" element={<AllLoans />} />
             <Route path="foreclosure" element={<LoanForeclosure />} />
             <Route path="noc" element={<LoanNOC />} />
          </Route>

          <Route path="master" element={<MasterPage />} />
          <Route path="resource-manager" element={<ResourceManager />} />

          <Route path="settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;