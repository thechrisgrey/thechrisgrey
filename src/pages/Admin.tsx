import { useState, useEffect, FormEvent } from 'react';
import { typography } from '../utils/typography';
import { useAuth, useKbAdmin, KB_CATEGORIES, useSiteHealth } from '../hooks';
import type { KbEntry, KbCategory } from '../hooks';

// Login form component
function AdminLogin({
  onLogin,
  isLoading,
  error,
}: {
  onLogin: (email: string, password: string) => void;
  isLoading: boolean;
  error: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div className="min-h-screen bg-altivum-dark flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-white mb-2" style={typography.sectionHeader}>
            Admin
          </h1>
          <p className="text-altivum-silver" style={typography.bodyText}>
            Knowledge Base Management
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label
              htmlFor="admin-email"
              className="block text-xs font-medium text-altivum-gold mb-3 uppercase tracking-widest"
            >
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-0 py-4 bg-transparent border-b-2 border-white/10 text-white placeholder-white/70 focus:outline-none focus:border-altivum-gold transition-all duration-300 rounded-none"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-medium text-altivum-gold mb-3 uppercase tracking-widest"
            >
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-0 py-4 bg-transparent border-b-2 border-white/10 text-white placeholder-white/70 focus:outline-none focus:border-altivum-gold transition-all duration-300 rounded-none"
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div
              className="p-4 bg-red-900/30 border-l-4 border-red-500 text-red-300 text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 font-medium uppercase tracking-wider text-sm transition-all duration-300 ${
              isLoading
                ? 'bg-altivum-slate/50 text-altivum-silver cursor-not-allowed'
                : 'bg-altivum-gold text-altivum-dark hover:bg-white'
            }`}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Entry form component
function EntryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: KbEntry;
  onSave: (data: Omit<KbEntry, '_id' | '_createdAt' | '_updatedAt'>) => Promise<void>;
  onCancel: () => void;
}) {
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

// Main admin dashboard
function AdminDashboard() {
  const { logout, getAccessToken } = useAuth();
  const {
    entries,
    isLoading,
    isPublishing,
    error,
    fetchEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    publish,
  } = useKbAdmin(getAccessToken);

  const { data: healthData, isLoading: healthLoading } = useSiteHealth(getAccessToken);
  const [healthExpanded, setHealthExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KbEntry | null>(null);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleCreate = async (
    data: Omit<KbEntry, '_id' | '_createdAt' | '_updatedAt'>
  ) => {
    await createEntry(data);
    setShowForm(false);
  };

  const handleUpdate = async (
    data: Omit<KbEntry, '_id' | '_createdAt' | '_updatedAt'>
  ) => {
    if (!editingEntry) return;
    await updateEntry(editingEntry._id, data);
    setEditingEntry(null);
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    setDeleteConfirm(null);
  };

  const handleToggleActive = async (entry: KbEntry) => {
    await updateEntry(entry._id, { isActive: !entry.isActive });
  };

  const handlePublish = async () => {
    try {
      const result = await publish();
      setPublishResult(
        `Published ${result.entryCount} entries (${Math.round(result.documentSize / 1024)}KB). KB sync triggered.`
      );
      setTimeout(() => setPublishResult(null), 10000);
    } catch {
      // Error already set by hook
    }
  };

  // Group entries by category
  const grouped = entries.reduce<Record<string, KbEntry[]>>((acc, entry) => {
    const cat = entry.category || 'biography';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(entry);
    return acc;
  }, {});

  const activeCount = entries.filter((e) => e.isActive).length;
  const inactiveCount = entries.length - activeCount;

  return (
    <div className="min-h-screen bg-altivum-dark pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
          <div>
            <h1 className="text-white mb-1" style={typography.sectionHeader}>
              Knowledge Base
            </h1>
            <p className="text-altivum-silver" style={typography.bodyText}>
              Manage AI chat knowledge entries
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePublish}
              disabled={isPublishing || entries.length === 0}
              className={`px-6 py-3 font-medium uppercase tracking-wider text-sm transition-all duration-300 ${
                isPublishing || entries.length === 0
                  ? 'bg-altivum-slate/50 text-altivum-silver cursor-not-allowed'
                  : 'bg-altivum-gold text-altivum-dark hover:bg-white'
              }`}
            >
              {isPublishing ? 'Publishing...' : 'Publish to KB'}
            </button>
            <button
              onClick={logout}
              className="px-4 py-3 text-altivum-silver border border-white/10 text-sm hover:border-white/30 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Status messages */}
        {publishResult && (
          <div className="mb-6 p-4 bg-green-900/30 border-l-4 border-green-500 text-green-300 text-sm">
            {publishResult}
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border-l-4 border-red-500 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-altivum-navy/30 border border-white/5 rounded">
            <div className="text-2xl text-white font-semibold">{entries.length}</div>
            <div className="text-xs text-altivum-slate uppercase tracking-wider">Total Entries</div>
          </div>
          <div className="p-4 bg-altivum-navy/30 border border-white/5 rounded">
            <div className="text-2xl text-green-400 font-semibold">{activeCount}</div>
            <div className="text-xs text-altivum-slate uppercase tracking-wider">Active</div>
          </div>
          <div className="p-4 bg-altivum-navy/30 border border-white/5 rounded">
            <div className="text-2xl text-altivum-slate font-semibold">{inactiveCount}</div>
            <div className="text-xs text-altivum-slate uppercase tracking-wider">Inactive</div>
          </div>
        </div>

        {/* Site Health */}
        <div className="mb-8 border border-white/5 rounded overflow-hidden">
          <button
            onClick={() => setHealthExpanded(!healthExpanded)}
            className="w-full flex items-center justify-between p-4 bg-altivum-navy/30 hover:bg-altivum-navy/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="material-icons text-altivum-gold text-lg" aria-hidden="true">monitoring</span>
              <span className="text-sm font-medium text-white uppercase tracking-wider">Site Health</span>
              <span className="text-xs text-altivum-slate">(24h)</span>
            </div>
            <span className={`material-icons text-altivum-slate text-sm transition-transform duration-200 ${healthExpanded ? 'rotate-180' : ''}`} aria-hidden="true">
              expand_more
            </span>
          </button>
          {healthExpanded && (
            <div className="p-4 bg-altivum-navy/10">
              {healthLoading && !healthData ? (
                <p className="text-altivum-slate text-sm">Loading metrics...</p>
              ) : !healthData ? (
                <p className="text-altivum-slate text-sm">No health data available. Metrics endpoint may not be configured.</p>
              ) : (
                <div className="space-y-4">
                  {/* Web Vitals */}
                  <div>
                    <h4 className="text-xs font-medium text-altivum-gold uppercase tracking-wider mb-2">Core Web Vitals</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      {(['lcp', 'cls', 'inp', 'fcp', 'ttfb'] as const).map((key) => {
                        const vital = healthData.vitals[key];
                        const label = key.toUpperCase();
                        const value = vital.average !== null
                          ? key === 'cls' ? vital.average.toFixed(3) : `${Math.round(vital.average)}ms`
                          : '--';
                        return (
                          <div key={key} className="p-3 bg-white/5 rounded">
                            <div className="text-lg text-white font-semibold">{value}</div>
                            <div className="text-xs text-altivum-slate uppercase tracking-wider">{label}</div>
                            <div className="text-xs text-altivum-slate mt-1">{vital.count} samples</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {/* Chat Pipeline */}
                  <div>
                    <h4 className="text-xs font-medium text-altivum-gold uppercase tracking-wider mb-2">Chat Pipeline</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-white/5 rounded">
                        <div className={`text-lg font-semibold ${healthData.chat.kbSuccessRate !== null && parseFloat(healthData.chat.kbSuccessRate) >= 95 ? 'text-green-400' : healthData.chat.kbSuccessRate !== null ? 'text-amber-400' : 'text-altivum-slate'}`}>
                          {healthData.chat.kbSuccessRate !== null ? `${healthData.chat.kbSuccessRate}%` : '--'}
                        </div>
                        <div className="text-xs text-altivum-slate uppercase tracking-wider">KB Success</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded">
                        <div className={`text-lg font-semibold ${healthData.chat.kbFailures > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {healthData.chat.kbFailures}
                        </div>
                        <div className="text-xs text-altivum-slate uppercase tracking-wider">KB Failures</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded">
                        <div className="text-lg text-white font-semibold">{healthData.chat.guardrailInterventions}</div>
                        <div className="text-xs text-altivum-slate uppercase tracking-wider">Guardrails</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded">
                        <div className="text-lg text-white font-semibold">{healthData.chat.rateLimitRejections}</div>
                        <div className="text-xs text-altivum-slate uppercase tracking-wider">Rate Limits</div>
                      </div>
                    </div>
                  </div>
                  {/* Security */}
                  <div className="flex items-center gap-4">
                    <h4 className="text-xs font-medium text-altivum-gold uppercase tracking-wider">Security</h4>
                    <span className={`text-sm ${healthData.security.cspViolations > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                      {healthData.security.cspViolations} CSP violations
                    </span>
                    <span className="text-xs text-altivum-slate">
                      Updated {new Date(healthData.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Add entry button / form */}
        {showForm ? (
          <div className="mb-8">
            <h2 className="text-white mb-4" style={typography.cardTitleLarge}>
              New Entry
            </h2>
            <EntryForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
          </div>
        ) : editingEntry ? null : (
          <button
            onClick={() => setShowForm(true)}
            className="mb-8 inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 text-altivum-silver text-sm hover:border-altivum-gold hover:text-altivum-gold transition-colors"
          >
            <span className="material-icons text-lg">add</span>
            Add Entry
          </button>
        )}

        {/* Loading state */}
        {isLoading && entries.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-altivum-gold/30 border-t-altivum-gold rounded-full animate-spin" />
          </div>
        )}

        {/* Entry list grouped by category */}
        {KB_CATEGORIES.map((cat) => {
          const items = grouped[cat.value];
          if (!items || items.length === 0) return null;

          return (
            <div key={cat.value} className="mb-10">
              <h2 className="text-white text-sm font-semibold uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-altivum-gold" />
                {cat.label}
                <span className="text-altivum-slate font-normal">({items.length})</span>
              </h2>

              <div className="space-y-3">
                {items.map((entry) =>
                  editingEntry?._id === entry._id ? (
                    <div key={entry._id}>
                      <EntryForm
                        initial={entry}
                        onSave={handleUpdate}
                        onCancel={() => setEditingEntry(null)}
                      />
                    </div>
                  ) : (
                    <div
                      key={entry._id}
                      className={`p-4 border rounded-lg transition-colors ${
                        entry.isActive
                          ? 'bg-altivum-navy/30 border-white/5'
                          : 'bg-altivum-dark/50 border-white/5 opacity-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-white text-sm font-medium truncate">
                              {entry.title}
                            </h3>
                            {entry.date && (
                              <span className="text-altivum-slate text-xs flex-shrink-0">
                                {new Date(entry.date).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                })}
                              </span>
                            )}
                            {!entry.isActive && (
                              <span className="text-xs text-altivum-slate bg-white/5 px-2 py-0.5 rounded">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-altivum-silver text-sm line-clamp-2">
                            {entry.content}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleToggleActive(entry)}
                            className="p-1.5 text-altivum-slate hover:text-altivum-gold transition-colors"
                            aria-label={entry.isActive ? 'Deactivate' : 'Activate'}
                            title={entry.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <span className="material-icons text-lg">
                              {entry.isActive ? 'visibility' : 'visibility_off'}
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingEntry(entry);
                              setShowForm(false);
                            }}
                            className="p-1.5 text-altivum-slate hover:text-white transition-colors"
                            aria-label="Edit"
                          >
                            <span className="material-icons text-lg">edit</span>
                          </button>
                          {deleteConfirm === entry._id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(entry._id)}
                                className="p-1.5 text-red-400 hover:text-red-300 transition-colors"
                                aria-label="Confirm delete"
                              >
                                <span className="material-icons text-lg">check</span>
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="p-1.5 text-altivum-slate hover:text-white transition-colors"
                                aria-label="Cancel delete"
                              >
                                <span className="material-icons text-lg">close</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(entry._id)}
                              className="p-1.5 text-altivum-slate hover:text-red-400 transition-colors"
                              aria-label="Delete"
                            >
                              <span className="material-icons text-lg">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {!isLoading && entries.length === 0 && (
          <div className="text-center py-20">
            <span className="material-icons text-5xl text-altivum-slate mb-4 block">
              library_books
            </span>
            <p className="text-altivum-silver mb-2">No entries yet</p>
            <p className="text-altivum-slate text-sm">
              Add your first Knowledge Base entry to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Main export — switches between login and dashboard
const Admin = () => {
  const { isAuthenticated, isLoading, error, login } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-altivum-dark flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-altivum-gold/30 border-t-altivum-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AdminLogin onLogin={login} isLoading={isLoading} error={error} />;
  }

  return <AdminDashboard />;
};

export default Admin;
