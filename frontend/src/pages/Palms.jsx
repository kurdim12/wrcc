import { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Download, MoreHorizontal } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import { Badge, severityType } from '../components/ui/Badge.jsx';

export const Palms = ({ palms = [], onSelectPalm }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return palms.filter(p => {
      const matchQ = !q || p.id.toLowerCase().includes(q) || (p.classification || '').toLowerCase().includes(q);
      const matchF = filter === 'all' || (p.classification || 'low') === filter;
      return matchQ && matchF;
    });
  }, [palms, searchTerm, filter]);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search palm ID or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 dark:text-white shadow-sm"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 md:flex-none px-4 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-gray-700 dark:text-gray-200 font-medium shadow-sm cursor-pointer hover:border-green-500 dark:hover:border-green-500 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All</option>
            <option value="low">Healthy</option>
            <option value="medium">At risk</option>
            <option value="high">Critical</option>
          </select>
          <a
            href="/api/v1/reports/weekly.csv"
            className="flex-1 md:flex-none px-4 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 flex items-center justify-center gap-2 shadow-sm"
          >
            <Download size={18} /> Export
          </a>
        </div>
      </div>

      <Card className="overflow-hidden border border-gray-100 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                <th className="p-4 md:p-6 rounded-tl-2xl">Palm ID</th>
                <th className="p-4 md:p-6">Location</th>
                <th className="p-4 md:p-6">Variety</th>
                <th className="p-4 md:p-6">Status</th>
                <th className="p-4 md:p-6">Risk Score</th>
                <th className="p-4 md:p-6">Device</th>
                <th className="p-4 md:p-6 rounded-tr-2xl text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.slice(0, 80).map((palm) => (
                <tr key={palm.id} onClick={() => onSelectPalm?.(palm)} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer text-sm md:text-base">
                  <td className="p-4 md:p-6 font-bold text-gray-900 dark:text-white">{palm.id}</td>
                  <td className="p-4 md:p-6 text-gray-500 dark:text-gray-400">
                    {palm.farm_id || '-'}{palm.row_idx != null ? ` · R${palm.row_idx + 1}` : ''}
                  </td>
                  <td className="p-4 md:p-6 text-gray-500 dark:text-gray-400">{palm.variety || '-'}</td>
                  <td className="p-4 md:p-6">
                    <Badge type={severityType(palm.classification || 'low')} text={palm.classification || 'low'} />
                  </td>
                  <td className="p-4 md:p-6 font-mono text-xs text-gray-700 dark:text-gray-300">
                    {palm.risk_score != null ? Math.round(palm.risk_score) : '-'}
                  </td>
                  <td className="p-4 md:p-6 text-gray-500 dark:text-gray-400 text-xs">
                    {palm.device_id ? <span className="font-mono">{palm.device_id}</span> : <span className="italic">unassigned</span>}
                  </td>
                  <td className="p-4 md:p-6 text-right">
                    <button className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white">
                      <MoreHorizontal size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-gray-400 dark:text-gray-500">
            No palms found. Run <code className="font-mono">python tools/seed_palms.py</code> to seed the demo grid.
          </div>
        )}
      </Card>
    </div>
  );
};

export default Palms;
