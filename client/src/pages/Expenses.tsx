import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Edit } from 'lucide-react';
import { api, formatMoney, formatDate, type Expense } from '../lib/api';
import ExpenseDialog from '../components/ExpenseDialog';

export default function Expenses() {
  const location = useLocation();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [dialogOpen, setDialogOpen] = useState(location.pathname === '/expenses/new');
  const [editing, setEditing] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api
      .get<Expense[]>('/api/expenses')
      .then(setExpenses)
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  // Navigating to /expenses/new while already mounted doesn't remount the
  // component, so the dialogOpen useState initializer alone only catches the
  // first mount - this catches subsequent route changes too.
  useEffect(() => {
    if (location.pathname === '/expenses/new') setDialogOpen(true);
  }, [location.pathname]);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  async function handleDelete(id: number) {
    await api.delete(`/api/expenses/${id}`);
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Expenses</h1>
          <p className="text-sm text-text-muted mt-1">Total: {formatMoney(total)}</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-lg gradient-brand px-3.5 py-2 text-sm font-semibold"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : expenses.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-text-muted">No expenses yet.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {expenses.map((exp) => (
            <div
              key={exp.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="text-sm font-medium">{exp.title}</p>
                <p className="text-xs text-text-muted mt-0.5">
                  {exp.category || 'Uncategorized'} · {formatDate(exp.expense_date)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm font-semibold">{formatMoney(exp.amount)}</p>
                <button
                  onClick={() => {
                    setEditing(exp);
                    setDialogOpen(true);
                  }}
                  className="text-text-muted hover:text-brand"
                  aria-label="Edit"
                >
                  <Edit size={15} />
                </button>
                <button
                  onClick={() => handleDelete(exp.id)}
                  className="text-text-muted hover:text-danger"
                  aria-label="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ExpenseDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          if (location.pathname === '/expenses/new') navigate('/expenses', { replace: true });
        }}
        onSaved={() => {
          load();
          if (location.pathname === '/expenses/new') navigate('/expenses', { replace: true });
        }}
        editingExpense={editing}
      />
    </div>
  );
}
