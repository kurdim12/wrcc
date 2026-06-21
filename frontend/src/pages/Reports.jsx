import { useEffect, useState } from 'react';
import { FileText, Download, RefreshCw, Calendar } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import { api } from '../api.js';

export const Reports = ({ showToast }) => {
  const [reports, setReports] = useState([]);
  useEffect(() => { api.reportsList().then(setReports).catch(() => {}); }, []);

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Generated Reports</h2>
        <button
          onClick={() => { api.reportsList().then(setReports); showToast?.('Reports refreshed', 'success'); }}
          className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg flex items-center gap-2 text-sm"
        >
          <RefreshCw size={18} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report, i) => (
          <Card key={report.id} className={`p-6 flex flex-col items-start gap-4 border border-gray-100 dark:border-gray-800 hover:border-green-500/40 dark:hover:border-green-500/30 transition-colors animate-fade-in-up delay-${(i + 1) * 100}`}>
            <div className="p-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">{report.name}</h3>
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Calendar size={14} /> Live · {report.type}
              </div>
            </div>
            <a
              href={report.endpoint}
              className="mt-auto w-full py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl font-bold text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center justify-center gap-2"
            >
              <Download size={16} /> Download {report.type}
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Reports;
