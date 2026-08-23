import { useEffect, useState } from 'react';
import { api, type Expense } from '../lib/api';

const CATEGORIES = ['Rent', 'Salary', 'Travel', 'Marketing', 'Software', 'Equipment', 'Other'];

function toDateInput(ts: number | undefined): string {
  if (!ts) return new Date().toISOString().slice(0, 10);
  return new Date(ts).toISOString().slice(0, 10);
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (expense: Expense) => void;
  editingExpense?: Expense | null;
}

export default function ExpenseDialog({ open, onClose, onSaved, editingExpense }: Props) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [expenseDate, setExpenseDate] = useState(toDateInput(undefined));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(editingExpense?.title || '');
      setAmount(editingExpense ? String(editingExpense.amount) : '');
      setCategory(editingExpense?.category || CATEGORIES[0]);
      setExpenseDate(toDateInput(editingExpense?.expense_date));
      setNotes(editingExpense?.notes || '');
      setError(null);
    }
  }, [open, editingExpense]);

  if (!open) return null;

  async function handleSave() {
    if (!title.trim()) return setError('Title is required');
    const amt = Number(amount);
    if (!amt || amt <= 0) return setError('Amount must be greater than 0');

    setSaving(true);
    setError(null);
    try {
      const body = { title, amount: amt, category, expenseDate, notes };
      const expense = editingExpense
        ? await api.put<Expense>(`/api/expenses/${editingExpense.id}`, body)
        : await api.post<Expense>('/api/expenses', body);
      onSaved(expense);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-bg-secondary p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-4">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>

        {error && (
          <div className="mb-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Title *</label>
            <input
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted mb-1">Amount *</label>
              <input
                type="number"
                className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Category</label>
            <select
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-1">Notes</label>
            <textarea
              className="w-full rounded-lg border border-border bg-[#171921] px-3 py-2 text-sm outline-none focus:border-brand"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border py-2 text-sm text-text-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-lg gradient-brand py-2 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
