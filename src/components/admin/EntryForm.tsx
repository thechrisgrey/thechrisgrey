import { useState, FormEvent } from 'react';
import { KB_CATEGORIES } from '../../hooks';
import type { KbEntry, KbCategory } from '../../hooks';

export interface EntryFormProps {
  initial?: KbEntry;
  onSave: (data: Omit<KbEntry, '_id' | '_createdAt' | '_updatedAt'>) => Promise<void>;
  onCancel: () => void;
}

function EntryForm({ initial, onSave, onCancel }: EntryFormProps) {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState<KbCategory>(
    (initial?.category as KbCategory) || 'biography'
  );
  const [content, setContent] = useState(initial?.content || '');
  const [date, setDate] = useState(initial?.date || '');
  const [sortOrder, setSortOrder] = useState<number | ''>(initial?.sortOrder ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive !== false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave({
        title,
        category,
        content,
        date: date || undefined,
        sortOrder: sortOrder !== '' ? sortOrder : undefined,
        isActive,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 bg-altivum-navy/50 border border-white/10 rounded-lg space-y-6"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-medium text-altivum-gold mb-2 uppercase tracking-widest">
            Title *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded focus:outline-none focus:border-altivum-gold transition-colors"
            placeholder="Entry title"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-altivum-gold mb-2 uppercase tracking-widest">
            Category *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as KbCategory)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded focus:outline-none focus:border-altivum-gold transition-colors"
          >
            {KB_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value} className="bg-altivum-navy">
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-altivum-gold mb-2 uppercase tracking-widest">
          Content *
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={8}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded focus:outline-none focus:border-altivum-gold transition-colors resize-y"
          placeholder="Entry content (plain text)"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-medium text-altivum-silver mb-2 uppercase tracking-widest">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 text-white rounded focus:outline-none focus:border-altivum-gold transition-colors"
          />
        </div>

        <div className="flex items-end pb-1">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-white/5 text-altivum-gold focus:ring-altivum-gold"
            />
            <span className="text-altivum-silver text-sm">Active</span>
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-altivum-slate text-xs uppercase tracking-wider hover:text-altivum-silver transition-colors"
      >
        {showAdvanced ? 'Hide' : 'Show'} Advanced
      </button>

      {showAdvanced && (
        <div>
          <label className="block text-xs font-medium text-altivum-silver mb-2 uppercase tracking-widest">
            Sort Order
          </label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) =>
              setSortOrder(e.target.value ? parseInt(e.target.value, 10) : '')
            }
            className="w-full max-w-xs px-4 py-3 bg-white/5 border border-white/10 text-white rounded focus:outline-none focus:border-altivum-gold transition-colors"
            placeholder="Optional numeric order"
          />
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSaving}
          className={`px-8 py-3 font-medium uppercase tracking-wider text-sm transition-all duration-300 ${
            isSaving
              ? 'bg-altivum-slate/50 text-altivum-silver cursor-not-allowed'
              : 'bg-altivum-gold text-altivum-dark hover:bg-white'
          }`}
        >
          {isSaving ? 'Saving...' : initial ? 'Update' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-8 py-3 text-altivum-silver border border-white/10 uppercase tracking-wider text-sm hover:border-white/30 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default EntryForm;
