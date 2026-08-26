import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Login from './pages/Login';
import LockScreen from './components/LockScreen';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import More from './pages/More';
import ClientList from './pages/crm/ClientList';
import ClientDetails from './pages/crm/ClientDetails';
import BillsList from './pages/bills/BillsList';
import InvoiceForm from './pages/bills/InvoiceForm';
import InvoiceDetails from './pages/bills/InvoiceDetails';
import Expenses from './pages/Expenses';
import Settings from './pages/Settings';
import Reports from './pages/Reports';
import TemplateList from './pages/templates/TemplateList';
import TemplateEditor from './pages/templates/TemplateEditor';
import MailInbox from './pages/mail/MailInbox';
import MessageView from './pages/mail/MessageView';
import PortfolioManager from './pages/website/PortfolioManager';
import PhotoBooks from './pages/website/PhotoBooks';
import AlbumDetail from './pages/website/AlbumDetail';
import Customers from './pages/website/Customers';
import CustomerDetail from './pages/website/CustomerDetail';
import Plans from './pages/website/Plans';
import Orders from './pages/website/Orders';
import Payments from './pages/website/Payments';
import Credits from './pages/website/Credits';
import RenewalsSettings from './pages/website/RenewalsSettings';
import { CustomerAuthProvider, useCustomerAuth } from './portal/CustomerAuthContext';
import PortalBackground from './portal/components/PortalBackground';
import PortalLanding from './portal/pages/Landing';
import PortalLogin from './portal/pages/Login';
import PortalSignup from './portal/pages/Signup';
import PortalDashboard from './portal/pages/Dashboard';
import PortalPlans from './portal/pages/Plans';
import CustomPlanBuilder from './portal/pages/CustomPlanBuilder';
import PortalOrders from './portal/pages/Orders';

function CustomerProtectedRoutes() {
  const { customer, loading } = useCustomerAuth();
  if (loading) return <div className="min-h-screen bg-bg" />;
  if (!customer) return <Navigate to="/album/login" replace />;
  return <Outlet />;
}

// saypx.in/portal was the customer portal's URL for less than a day before
// moving to /album - preserves the path/query/hash so an already-shared
// /portal/dashboard?x=1 link still lands somewhere sensible instead of 404ing.
function PortalUrlRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={pathname.replace(/^\/portal/, '/album') + search + hash} replace />;
}

function ProtectedRoutes() {
  const { authenticated, loading, locked } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-bg" />;
  }
  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }
  return (
    <>
      <AppShell />
      {locked && <LockScreen />}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoutes />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/crm" element={<ClientList />} />
            <Route path="/crm/new" element={<ClientList />} />
            <Route path="/crm/:id" element={<ClientDetails />} />
            <Route path="/bills" element={<BillsList />} />
            <Route path="/bills/new" element={<InvoiceForm />} />
            <Route path="/bills/:id/edit" element={<InvoiceForm />} />
            <Route path="/bills/:id" element={<InvoiceDetails />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/expenses/new" element={<Expenses />} />
            <Route path="/templates" element={<TemplateList />} />
            <Route path="/templates/:id" element={<TemplateEditor />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/more" element={<More />} />
            <Route path="/mail" element={<MailInbox />} />
            <Route path="/mail/compose" element={<MailInbox />} />
            <Route path="/mail/:folder" element={<MailInbox />} />
            <Route path="/mail/:folder/:id" element={<MessageView />} />
            <Route path="/website" element={<PortfolioManager />} />
            <Route path="/website/add" element={<PortfolioManager />} />
            <Route path="/website/photo-books" element={<PhotoBooks />} />
            <Route path="/website/photo-books/new" element={<PhotoBooks />} />
            <Route path="/website/photo-books/:id" element={<AlbumDetail />} />
            <Route path="/website/customers" element={<Customers />} />
            <Route path="/website/customers/:id" element={<CustomerDetail />} />
            <Route path="/website/plans" element={<Plans />} />
            <Route path="/website/orders" element={<Orders />} />
            <Route path="/website/payments" element={<Payments />} />
            <Route path="/website/credits" element={<Credits />} />
            <Route path="/website/renewals-settings" element={<RenewalsSettings />} />
          </Route>

          {/* Customer portal - entirely separate auth namespace from the admin app above. */}
          <Route
            element={
              <CustomerAuthProvider>
                <PortalBackground />
                <Outlet />
              </CustomerAuthProvider>
            }
          >
            <Route path="/album" element={<PortalLanding />} />
            <Route path="/album/login" element={<PortalLogin />} />
            <Route path="/album/signup" element={<PortalSignup />} />
            <Route path="/album/plans" element={<PortalPlans />} />
            <Route path="/album/custom/:planId" element={<CustomPlanBuilder />} />
            <Route element={<CustomerProtectedRoutes />}>
              <Route path="/album/dashboard" element={<PortalDashboard />} />
              <Route path="/album/orders" element={<PortalOrders />} />
            </Route>
            {/* saypx.in/portal was the URL for less than a day before moving to
                /album - redirect any already-shared link instead of 404ing. */}
            <Route path="/portal/*" element={<PortalUrlRedirect />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
