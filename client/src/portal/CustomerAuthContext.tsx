import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { customerApi } from './lib/customerApi';

export interface CustomerProfile {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  businessName: string | null;
}

interface CustomerAuthContextValue {
  customer: CustomerProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (data: { email: string; password: string; name?: string; phone?: string; businessName?: string }) => Promise<string | null>;
  logout: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    customerApi
      .get<CustomerProfile>('/api/customer/auth/me')
      .then(setCustomer)
      .catch(() => setCustomer(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    try {
      const profile = await customerApi.post<CustomerProfile>('/api/customer/auth/login', { email, password });
      setCustomer(profile);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Login failed';
    }
  }

  async function signup(data: { email: string; password: string; name?: string; phone?: string; businessName?: string }) {
    try {
      const profile = await customerApi.post<CustomerProfile>('/api/customer/auth/signup', data);
      setCustomer(profile);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'Signup failed';
    }
  }

  async function logout() {
    await customerApi.post('/api/customer/auth/logout');
    setCustomer(null);
  }

  return (
    <CustomerAuthContext.Provider value={{ customer, loading, login, signup, logout }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
}
