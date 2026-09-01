import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { format, addDays } from 'date-fns';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  FileText, 
  Download, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Table,
  CheckCircle2
} from 'lucide-react';
import { bulkSaveMealPlans } from '../services/mealPlanService';
import { addMember } from '../services/memberService';

export const BulkUploadModal = ({ isOpen, onClose, members, onImportSuccess }) => {
  const [activeTab, setActiveTab] = useState('excel'); // 'excel' | 'text'
  const [parsedRows, setParsedRows] = useState([]);
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [successCount, setSuccessCount] = useState(null);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Generate and download a sample CSV/Excel template
  const handleDownloadTemplate = (fileType = 'csv') => {
    const today = new Date();
    const templateData = [];

    // Pre-populate with next 7 days for each existing member
    const memberNames = members.length > 0 ? members.map(m => m.name) : ['Dad', 'Mom', 'Child 1', 'Child 2', 'Grandma'];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dateStr = format(addDays(today, dayOffset), 'yyyy-MM-dd');
      memberNames.forEach(name => {
        templateData.push({
          'Date (YYYY-MM-DD)': dateStr,
          'Member Name': name,
          'Breakfast': dayOffset === 0 ? 'Oatmeal & fruits' : '',
          'Lunch': dayOffset === 0 ? 'Quinoa salad & grilled chicken' : '',
          'Dinner': dayOffset === 0 ? 'Steamed veggies & salmon' : '',
          'Snacks': dayOffset === 0 ? 'Greek yogurt' : ''
        });
      });
    }

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MealPlanTemplate');

    if (fileType === 'xlsx') {
      XLSX.writeFile(wb, 'family_meal_plan_template.xlsx');
    } else {
      XLSX.writeFile(wb, 'family_meal_plan_template.csv', { bookType: 'csv' });
    }
  };

  // Process uploaded Excel / CSV File
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError('');
    setSuccessCount(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        if (rawJson.length === 0) {
          setError('The uploaded file is empty.');
          return;
        }

        normalizeAndSetRows(rawJson);
      } catch (err) {
        console.error('File parsing error:', err);
        setError('Failed to parse file. Please ensure it is a valid Excel or CSV file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Parse raw text or pasted schedule (e.g. copied from PDF)
  const handleParseText = () => {
    if (!rawText.trim()) {
      setError('Please paste meal plan text or schedule first.');
      return;
    }
    setError('');
    try {
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      const rows = [];
      let currentDate = format(new Date(), 'yyyy-MM-dd');
      let currentMemberName = members[0]?.name || 'Family';

      lines.forEach(line => {
        // Check if line contains a date (YYYY-MM-DD or YYYY/MM/DD)
        const dateMatch = line.match(/\b\d{4}[-/]\d{2}[-/]\d{2}\b/);
        if (dateMatch) {
          currentDate = dateMatch[0].replace(/\//g, '-');
        }

        // Check if line matches a member name
        const foundMember = members.find(m => line.toLowerCase().includes(m.name.toLowerCase()));
        if (foundMember) {
          currentMemberName = foundMember.name;
        }

        // Check for colon separated meals, e.g. "Breakfast: Eggs and toast | Lunch: Salad"
        const breakfastMatch = line.match(/breakfast[:\-]\s*([^|;,\n]+)/i);
        const lunchMatch = line.match(/lunch[:\-]\s*([^|;,\n]+)/i);
        const dinnerMatch = line.match(/dinner[:\-]\s*([^|;,\n]+)/i);
        const snacksMatch = line.match(/snacks?[:\-]\s*([^|;,\n]+)/i);

        if (breakfastMatch || lunchMatch || dinnerMatch || snacksMatch) {
          rows.push({
            date: currentDate,
            memberName: currentMemberName,
            breakfast: breakfastMatch ? breakfastMatch[1].trim() : '',
            lunch: lunchMatch ? lunchMatch[1].trim() : '',
            dinner: dinnerMatch ? dinnerMatch[1].trim() : '',
            snacks: snacksMatch ? snacksMatch[1].trim() : ''
          });
        }
      });

      if (rows.length === 0) {
        setError('Could not extract meals automatically. Try formatting as "Date | Member | Breakfast | Lunch | Dinner | Snacks" or use the Excel template.');
        return;
      }

      setParsedRows(rows);
    } catch (err) {
      setError('Failed to parse text: ' + err.message);
    }
  };

  // Helper to standardize columns regardless of user headers
  const normalizeAndSetRows = (jsonList) => {
    const rows = [];

    jsonList.forEach((item) => {
      // Find date key
      const dateKey = Object.keys(item).find(k => /date/i.test(k));
      let rawDate = dateKey ? item[dateKey] : '';
      
      // If date is Date object or number
      if (rawDate instanceof Date) {
        rawDate = format(rawDate, 'yyyy-MM-dd');
      } else if (typeof rawDate === 'string') {
        rawDate = rawDate.trim().replace(/\//g, '-');
      }

      // Find member key
      const memberKey = Object.keys(item).find(k => /member|name|person/i.test(k));
      const memberName = memberKey ? String(item[memberKey]).trim() : (members[0]?.name || 'Family');

      // Meal fields
      const bKey = Object.keys(item).find(k => /breakfast|morn/i.test(k));
      const lKey = Object.keys(item).find(k => /lunch|noon/i.test(k));
      const dKey = Object.keys(item).find(k => /dinner|night|eve/i.test(k));
      const sKey = Object.keys(item).find(k => /snack|extra/i.test(k));

      if (rawDate && (bKey || lKey || dKey || sKey)) {
        rows.push({
          date: rawDate,
          memberName: memberName || 'Family',
          breakfast: bKey ? String(item[bKey]).trim() : '',
          lunch: lKey ? String(item[lKey]).trim() : '',
          dinner: dKey ? String(item[dKey]).trim() : '',
          snacks: sKey ? String(item[sKey]).trim() : ''
        });
      }
    });

    if (rows.length === 0) {
      setError('No valid meal rows found. Please check column headers (Date, Member, Breakfast, Lunch, Dinner, Snacks).');
      return;
    }

    setParsedRows(rows);
  };

  // Commit and Save to Database
  const handleImport = async () => {
    if (parsedRows.length === 0) return;

    try {
      setImporting(true);
      setError('');

      // Build member name to ID map, create any missing members automatically
      const memberMap = new Map();
      members.forEach(m => memberMap.set(m.name.toLowerCase(), m.id));

      const payloadToSave = [];

      for (const row of parsedRows) {
        const key = row.memberName.toLowerCase();
        let memberId = memberMap.get(key);

        if (!memberId) {
          // Auto create missing member
          const created = await addMember({ name: row.memberName, telegramChatId: '' });
          memberId = created.id;
          memberMap.set(key, memberId);
        }

        payloadToSave.push({
          memberId,
          date: row.date,
          breakfast: row.breakfast || '',
          lunch: row.lunch || '',
          dinner: row.dinner || '',
          snacks: row.snacks || ''
        });
      }

      await bulkSaveMealPlans(payloadToSave);
      setSuccessCount(payloadToSave.length);

      if (onImportSuccess) {
        onImportSuccess();
      }

      setTimeout(() => {
        onClose();
        setSuccessCount(null);
        setParsedRows([]);
      }, 1800);

    } catch (err) {
      console.error(err);
      setError('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">Bulk Upload Meal Plans</h3>
              <p className="text-xs text-slate-500">Import weeks of meal plans from Excel, CSV, or pasted PDF text</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Format Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('excel')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'excel'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Excel / CSV File</span>
              </button>
              <button
                onClick={() => setActiveTab('text')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === 'text'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>Paste PDF / Text</span>
              </button>
            </div>

            {activeTab === 'excel' && (
              <div className="flex gap-1.5">
                <button
                  onClick={() => handleDownloadTemplate('xlsx')}
                  className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl font-semibold transition-colors flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .XLSX</span>
                </button>
                <button
                  onClick={() => handleDownloadTemplate('csv')}
                  className="text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-xl font-semibold transition-colors flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>.CSV</span>
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-sm flex items-center gap-2 font-semibold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>Successfully imported {successCount} meal plans!</span>
            </div>
          )}

          {/* Tab 1: Excel / CSV Drag & Drop */}
          {activeTab === 'excel' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-white text-emerald-600 flex items-center justify-center shadow-xs border border-slate-200">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {fileName ? fileName : 'Click or drop your Excel / CSV file here'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Supports columns: <code className="bg-white px-1 py-0.5 rounded border border-slate-200">Date</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-200">Member</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-200">Breakfast</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-200">Lunch</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-200">Dinner</code>, <code className="bg-white px-1 py-0.5 rounded border border-slate-200">Snacks</code>
                </p>
              </div>
            </div>
          )}

          {/* Tab 2: Paste PDF Text */}
          {activeTab === 'text' && (
            <div className="space-y-3">
              <textarea
                rows={5}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste text from your meal PDF or diet chart here, e.g.:&#10;2026-09-01 - Dad - Breakfast: Oatmeal | Lunch: Salad | Dinner: Salmon&#10;2026-09-01 - Mom - Breakfast: Smoothie | Lunch: Wrap | Dinner: Soup"
                className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
              <button
                type="button"
                onClick={handleParseText}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <span>Extract Meals from Text</span>
              </button>
            </div>
          )}

          {/* Preview Table if rows parsed */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-emerald-600" />
                  Preview Detected Plans ({parsedRows.length} rows)
                </span>
                <button
                  type="button"
                  onClick={() => setParsedRows([])}
                  className="text-xs text-rose-500 hover:underline"
                >
                  Clear Preview
                </button>
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-2xl bg-white shadow-inner">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 sticky top-0 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Date</th>
                      <th className="py-2 px-3">Member</th>
                      <th className="py-2 px-3">Breakfast</th>
                      <th className="py-2 px-3">Lunch</th>
                      <th className="py-2 px-3">Dinner</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {parsedRows.map((r, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-medium text-slate-900">{r.date}</td>
                        <td className="py-2 px-3 font-semibold text-emerald-700">{r.memberName}</td>
                        <td className="py-2 px-3 truncate max-w-[120px] text-slate-600">{r.breakfast || '—'}</td>
                        <td className="py-2 px-3 truncate max-w-[120px] text-slate-600">{r.lunch || '—'}</td>
                        <td className="py-2 px-3 truncate max-w-[120px] text-slate-600">{r.dinner || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-500">
              Ready to import: <strong className="text-slate-800">{parsedRows.length}</strong> meals
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || parsedRows.length === 0}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {importing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Import {parsedRows.length} Meal Plans</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
