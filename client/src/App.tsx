import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
