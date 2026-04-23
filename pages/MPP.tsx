import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

interface MPPData {
  rowIndex?: number;
  tanggal: string;
  totalRequest: string;
  schedule: string;
  position: string;
  request: string;
  totalFulfillment: string;
  gapNexus: string;
  achievement: string;
}

const FIELDS: (keyof MPPData)[] = [
  'tanggal', 'totalRequest', 'schedule', 'position', 'request', 'totalFulfillment', 'gapNexus', 'achievement'
];

const MPP: React.FC = () => {
  const [data, setData] = useState<MPPData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needAuth, setNeedAuth] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/mpp')
      .then(async (res) => {
        if (res.status === 401) {
          setNeedAuth(true);
          throw new Error('Not authenticated');
        }
        if (!res.ok) {
          throw new Error('Failed to fetch data from server');
        }
        return res.json();
      })
      .then((parsed) => {
        setData(parsed);
        setLoading(false);
      })
      .catch((err) => {
        if (err.message !== 'Not authenticated') {
          setError(err.message);
        }
        setLoading(false);
      });
  }, []);

  const handleEdit = (index: number, field: keyof MPPData, value: string) => {
    const newData = [...data];
    newData[index][field] = value as never;
    setData(newData);
  };

  const handleSave = async (index: number, field: keyof MPPData) => {
    const rowData = data[index];
    if (!rowData.rowIndex) return;

    setSaving(true);
    try {
      const response = await fetch('/api/mpp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rowIndex: rowData.rowIndex,
          field,
          value: rowData[field]
        })
      });
      if (response.status === 401) {
        setNeedAuth(true);
        throw new Error('Unauthenticated or missing write permissions');
      }
      if (!response.ok) {
        throw new Error('Failed to update Google Sheet');
      }
    } catch (err: any) {
      console.error(err);
      alert('Gagal menyimpan perubahan ke Google Sheets. Silakan muat ulang atau klik "Hubungkan dengan Akun Google" kembali untuk mendapakan izin baca & tulis yang utuh.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-6">Memuat data MPP...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  if (needAuth) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">MPP (Manpower Planning)</h1>
        <div className="bg-white p-8 max-w-lg mx-auto shadow rounded-lg border border-gray-200 text-center mt-10">
          <div className="mb-4">
            <svg className="w-12 h-12 text-blue-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Autentikasi Diperlukan</h2>
          <p className="text-gray-600 mb-6">
            Aplikasi sekarang telah diubah ke <strong>Metode Real-time</strong>. 
            Anda perlu mengizinkan aplikasi untuk membaca data Google Sheets secara langsung.
          </p>
          <a href="/api/auth/google" className="bg-blue-600 text-white font-medium px-6 py-3 rounded-md shadow-sm hover:bg-blue-700 transition">
            Hubungkan dengan Akun Google
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-end mb-4">
        <h1 className="text-2xl font-bold">MPP (Manpower Planning)</h1>
        {saving && <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded font-medium animate-pulse">Menyimpan ke Google Sheets...</span>}
      </div>
      <div className="shadow rounded-lg border border-gray-200 overflow-hidden">
        <div className="max-h-[70vh] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200 table-auto border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                {['Tanggal', 'Total Request', 'Schedule', 'Position', 'Request', 'Total Fulfillment', 'GAP NEXUS', '% Achievement'].map(h => (
                  <th key={h} className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap border-b">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  {FIELDS.map((field) => (
                    <td key={field} className="px-4 py-2 text-sm text-gray-700 text-center border-b">
                      <input
                        type="text"
                        value={row[field]}
                        onChange={(e) => handleEdit(index, field, e.target.value)}
                        onBlur={() => handleSave(index, field)}
                        className="w-full text-center border-none focus:ring-2 focus:ring-blue-500 rounded p-1 bg-transparent hover:bg-gray-100 transition-colors"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MPP;
