
import React, { useState, useEffect, useRef } from 'react';
import { Download, Trash2, Upload, Plus, Volume2, VolumeX, ChevronRight, ArrowLeft, Palette, HelpCircle, Database, Phone, MessageCircle, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';
import { MasterData } from '../types';
import { useToast } from '../hooks/useToast';
import Modal from '../components/Modal';
import useLocalStorage from '../hooks/useLocalStorage';
import { useTheme } from '../hooks/useTheme';

type SettingsView = 'MAIN' | 'MASTER_DATA' | 'SOUND' | 'THEME' | 'HELP';

const Settings: React.FC = () => {
    const [view, setView] = useState<SettingsView>('MAIN');
    const [departments, setDepartments] = useState<MasterData[]>([]);
    const [shiftTimes, setShiftTimes] = useState<MasterData[]>([]);
    const [shiftIds, setShiftIds] = useState<MasterData[]>([]);
    const [workerTypes, setWorkerTypes] = useState<MasterData[]>([]);
    const [contractTypes, setContractTypes] = useState<MasterData[]>([]);
    const [loading, setLoading] = useState(true);
    const [newItemValue, setNewItemValue] = useState('');
    const [activeTab, setActiveTab] = useState<'DEPARTMENT' | 'SHIFT_TIME' | 'SHIFT_ID' | 'WORKER_TYPE' | 'CONTRACT_TYPE'>('DEPARTMENT');
    const [actionLoading, setActionLoading] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<MasterData | null>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();
    const [isSoundEnabled, setIsSoundEnabled] = useLocalStorage('isSoundEnabled', true);
    const [isDarkMode, setIsDarkMode] = useTheme();
    const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

    useEffect(() => {
        if (view === 'MASTER_DATA') {
            fetchMasterData();
        }
    }, [view]);

    const fetchMasterData = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('master_data').select('*').order('value', { ascending: true });
        if (data) {
            setDepartments(data.filter(d => d.category === 'DEPARTMENT'));
            setShiftTimes(data.filter(d => d.category === 'SHIFT_TIME'));
            setShiftIds(data.filter(d => d.category === 'SHIFT_ID'));
            setWorkerTypes(data.filter(d => d.category === 'WORKER_TYPE'));
            setContractTypes(data.filter(d => d.category === 'CONTRACT_TYPE'));
        }
        if (error) {
            console.error("Error fetching master data (Make sure table 'master_data' exists):", error);
            showToast('Gagal memuat master data.', { type: 'error', title: 'Error' });
        }
        setLoading(false);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemValue.trim()) return;
        
        setActionLoading(true);
        const { data, error } = await supabase.from('master_data').insert({
            category: activeTab,
            value: newItemValue.trim()
        }).select().single();

        if (error) {
            showToast(`Gagal menambah data: ${error.message}`, { type: 'error', title: 'Error' });
        } else if (data) {
            setNewItemValue('');
            updateLocalState(data, 'add');
            showToast(`'${data.value}' berhasil ditambahkan.`, { type: 'success', title: 'Berhasil' });
        }
        setActionLoading(false);
    };

    const openDeleteConfirm = (item: MasterData) => {
        setItemToDelete(item);
        setIsDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        
        setActionLoading(true);
        const { error } = await supabase.from('master_data').delete().eq('id', itemToDelete.id);
        
        if (error) {
            showToast(`Gagal menghapus: ${error.message}`, { type: 'error', title: 'Error' });
        } else {
            showToast(`'${itemToDelete.value}' berhasil dihapus.`, { type: 'success', title: 'Berhasil Dihapus' });
            updateLocalState(itemToDelete, 'delete');
        }
        setActionLoading(false);
        setIsDeleteConfirmOpen(false);
        setItemToDelete(null);
    };

    const updateLocalState = (item: MasterData, action: 'add' | 'delete') => {
        const listMap: Record<string, { get: MasterData[], set: React.Dispatch<React.SetStateAction<MasterData[]>> }> = {
            'DEPARTMENT': { get: departments, set: setDepartments },
            'SHIFT_TIME': { get: shiftTimes, set: setShiftTimes },
            'SHIFT_ID': { get: shiftIds, set: setShiftIds },
            'WORKER_TYPE': { get: workerTypes, set: setWorkerTypes },
            'CONTRACT_TYPE': { get: contractTypes, set: setContractTypes }
        };
        
        const target = listMap[item.category];
        if (!target) return;

        if (action === 'add') {
            target.set([...target.get, item].sort((a, b) => a.value.localeCompare(b.value)));
        } else {
            target.set(target.get.filter(d => d.id !== item.id));
        }
    };

    const handleDownloadTemplate = () => {
        const exampleValue = activeTab === 'DEPARTMENT' ? 'NAMA DEPARTEMEN BARU' 
                           : activeTab === 'SHIFT_TIME' ? '08:00 - 17:00' 
                           : activeTab === 'WORKER_TYPE' ? 'Tipe Worker Baru'
                           : activeTab === 'CONTRACT_TYPE' ? 'Tipe Kontrak Baru'
                           : 'SOCSTROPSxxxx';
        
        const data = [
            { value: exampleValue },
            { value: 'Data Lainnya...' }
        ];
        
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
        XLSX.writeFile(workbook, `Template_Import_${activeTab}.xlsx`);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            setActionLoading(true);
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws) as { value: string }[];

                if (data.length === 0) {
                    showToast("File kosong atau format salah. Pastikan ada kolom 'value'.", { type: 'error', title: 'Impor Gagal' });
                    setActionLoading(false);
                    return;
                }

                const currentList = activeTab === 'DEPARTMENT' ? departments 
                                  : activeTab === 'SHIFT_TIME' ? shiftTimes 
                                  : activeTab === 'WORKER_TYPE' ? workerTypes
                                  : activeTab === 'CONTRACT_TYPE' ? contractTypes
                                  : shiftIds;
                
                const existingValues = new Set(currentList.map(item => item.value.toLowerCase()));
                
                const toInsert = data
                    .map(row => row.value ? String(row.value).trim() : '')
                    .filter(val => val !== '' && !existingValues.has(val.toLowerCase()))
                    .map(val => ({
                        category: activeTab,
                        value: val
                    }));

                const uniqueToInsert = toInsert.filter((v, i, a) => a.findIndex(t => t.value.toLowerCase() === v.value.toLowerCase()) === i);

                if (uniqueToInsert.length === 0) {
                    showToast("Tidak ada data baru untuk diimpor (semua data mungkin sudah ada).", { type: 'info', title: 'Info Impor' });
                } else {
                    const { data: insertedData, error } = await supabase.from('master_data').insert(uniqueToInsert).select();
                    
                    if (error) throw error;
                    
                    if (insertedData) {
                        showToast(`Berhasil mengimpor ${insertedData.length} data baru.`, { type: 'success', title: 'Impor Sukses' });
                        fetchMasterData();
                    }
                }
            } catch (err: any) {
                showToast("Gagal import: " + err.message, { type: 'error', title: 'Error' });
                console.error(err);
            } finally {
                setActionLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const renderList = (items: MasterData[]) => (
        <div className="bg-white rounded-b-lg shadow border border-gray-200 overflow-hidden">
            <ul className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                {items.length === 0 ? (
                    <li className="p-4 text-center text-gray-400 italic">Belum ada data. Tambahkan di atas.</li>
                ) : (
                    items.map(item => (
                        <li key={item.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                            <span className="font-medium text-gray-700">{item.value}</span>
                            <button 
                                onClick={() => openDeleteConfirm(item)} 
                                disabled={actionLoading}
                                className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                            >
                                <Trash2 size={16} />
                            </button>
                        </li>
                    ))
                )}
            </ul>
        </div>
    );

    const renderMainContent = () => (
        <div className="pb-8 bg-transparent sm:bg-white sm:dark:bg-gray-800 sm:p-6 sm:rounded-xl sm:shadow-sm sm:border sm:border-gray-200 sm:dark:border-gray-700 transition-colors">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-white mb-8 pt-2">Pengaturan</h1>

            {/* Sistem Group */}
            <div className="mb-8">
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 ml-1">Sistem</h2>
                <div className="space-y-6">
                    <div 
                        onClick={() => setView('MASTER_DATA')}
                        className="flex justify-between items-center cursor-pointer group px-1"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-blue-500 text-white p-2 rounded-full shadow-sm">
                                <Database size={20} />
                            </div>
                            <span className="font-bold text-gray-800 dark:text-gray-100 text-[15px] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Master Data</span>
                        </div>
                        <ChevronRight className="text-gray-400" size={20} />
                    </div>
                </div>
            </div>

            {/* Preferensi Group */}
            <div className="mb-8">
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 ml-1">Preferensi</h2>
                <div className="space-y-6">
                    <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-4">
                            <div className="bg-green-500 text-white p-2 rounded-full shadow-sm">
                                <Volume2 size={20} />
                            </div>
                            <span className="font-bold text-gray-800 dark:text-gray-100 text-[15px]">Notifikasi Suara</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isSoundEnabled}
                                onChange={(e) => setIsSoundEnabled(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-focus:ring-2 peer-focus:ring-teal-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400 border-gray-100 dark:border-gray-600 outline-none"></div>
                        </label>
                    </div>
                    
                    <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-4">
                            <div className="bg-gray-800 dark:bg-gray-600 text-white p-2 rounded-full shadow-sm">
                                <Palette size={20} />
                            </div>
                            <span className="font-bold text-gray-800 dark:text-gray-100 text-[15px]">Tema (Dark Mode)</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isDarkMode}
                                onChange={(e) => setIsDarkMode(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-400 border-gray-100 dark:border-gray-600 outline-none"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Lainnya Group */}
            <div className="mb-8">
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 ml-1">Lainnya</h2>
                <div className="space-y-6">
                    <div 
                        onClick={() => setView('HELP')}
                        className="flex justify-between items-center cursor-pointer group px-1"
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-yellow-500 text-white p-2 rounded-full shadow-sm">
                                <HelpCircle size={20} />
                            </div>
                            <span className="font-bold text-gray-800 dark:text-gray-100 text-[15px] group-hover:text-amber-500 transition-colors">Pusat Bantuan</span>
                        </div>
                        <ChevronRight className="text-gray-400" size={20} />
                    </div>
                </div>
            </div>
            
            <div className="text-center mt-12 pb-4">
                <p className="text-[12px] font-bold text-gray-400">App ver 1.0.0</p>
            </div>
        </div>
    );

    const renderMasterDataContent = () => (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <button 
                    onClick={() => setView('MAIN')} 
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-xl md:text-2xl font-bold text-gray-800">Pengaturan Master Data</h1>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="bg-blue-600 p-1 flex gap-1 overflow-x-auto no-scrollbar">
                    <button 
                        onClick={() => setActiveTab('DEPARTMENT')}
                        className={`flex-1 min-w-[120px] px-4 py-3 font-black text-xs uppercase tracking-widest transition-all rounded-lg ${activeTab === 'DEPARTMENT' ? 'bg-white text-blue-600 shadow-inner' : 'text-white hover:bg-white/10'}`}
                    >
                        Departemen ({departments.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('SHIFT_TIME')}
                        className={`flex-1 min-w-[120px] px-4 py-3 font-black text-xs uppercase tracking-widest transition-all rounded-lg ${activeTab === 'SHIFT_TIME' ? 'bg-white text-blue-600 shadow-inner' : 'text-white hover:bg-white/10'}`}
                    >
                        Jam Shift ({shiftTimes.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('SHIFT_ID')}
                        className={`flex-1 min-w-[120px] px-4 py-3 font-black text-xs uppercase tracking-widest transition-all rounded-lg ${activeTab === 'SHIFT_ID' ? 'bg-white text-blue-600 shadow-inner' : 'text-white hover:bg-white/10'}`}
                    >
                        Shift ID ({shiftIds.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('WORKER_TYPE')}
                        className={`flex-1 min-w-[120px] px-4 py-3 font-black text-xs uppercase tracking-widest transition-all rounded-lg ${activeTab === 'WORKER_TYPE' ? 'bg-white text-blue-600 shadow-inner' : 'text-white hover:bg-white/10'}`}
                    >
                        Worker Type ({workerTypes.length})
                    </button>
                    <button 
                        onClick={() => setActiveTab('CONTRACT_TYPE')}
                        className={`flex-1 min-w-[120px] px-4 py-3 font-black text-xs uppercase tracking-widest transition-all rounded-lg ${activeTab === 'CONTRACT_TYPE' ? 'bg-white text-blue-600 shadow-inner' : 'text-white hover:bg-white/10'}`}
                    >
                        Contract Type ({contractTypes.length})
                    </button>
                </div>

                <div className="p-4 md:p-6">
                    <div className="flex flex-col sm:flex-row justify-end gap-2 mb-6 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <button 
                            onClick={handleDownloadTemplate}
                            className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                        >
                            <Download size={16} /> Download Template
                        </button>
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={actionLoading}
                            className="flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50"
                        >
                            <Upload size={16} /> {actionLoading ? 'Importing...' : 'Import Excel'}
                        </button>
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleImport} 
                            className="hidden" 
                            accept=".xlsx, .xls" 
                        />
                    </div>

                    <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-2 mb-6">
                        <input 
                            type="text" 
                            value={newItemValue}
                            onChange={e => setNewItemValue(e.target.value)}
                            placeholder={`Ketik manual ${activeTab === 'DEPARTMENT' ? 'Nama Departemen' : activeTab === 'SHIFT_TIME' ? 'Jam (ex: 08:00 - 17:00)' : activeTab === 'WORKER_TYPE' ? 'Tipe Worker' : activeTab === 'CONTRACT_TYPE' ? 'Tipe Kontrak' : 'Kode Shift ID'}...`}
                            className="flex-1 bg-gray-50 border border-gray-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button 
                            type="submit" 
                            disabled={actionLoading || !newItemValue.trim()}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg flex justify-center items-center gap-2 disabled:opacity-50 shrink-0"
                        >
                            <Plus size={16} /> Tambah
                        </button>
                    </form>

                    {loading ? (
                        <div className="text-center py-8 text-gray-500 animate-pulse">Memuat data...</div>
                    ) : (
                        activeTab === 'DEPARTMENT' ? renderList(departments) :
                        activeTab === 'SHIFT_TIME' ? renderList(shiftTimes) :
                        activeTab === 'WORKER_TYPE' ? renderList(workerTypes) :
                        activeTab === 'CONTRACT_TYPE' ? renderList(contractTypes) :
                        renderList(shiftIds)
                    )}
                </div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 text-sm text-yellow-800">
                <p><strong>Catatan:</strong></p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Data yang dihapus tidak akan menghapus data absensi lama yang sudah menggunakan nama tersebut.</li>
                    <li>Fitur Import Excel akan otomatis melewati data yang sudah ada di database (tidak duplikat).</li>
                </ul>
            </div>
        </div>
    );

    const renderSoundContent = () => (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <button 
                    onClick={() => setView('MAIN')} 
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-xl md:text-2xl font-bold text-gray-800">Pengaturan Suara</h1>
            </div>

             <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg ${isSoundEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                            {isSoundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-700 text-lg">Efek Suara Notifikasi</h3>
                            <p className="text-sm text-gray-500">Aktifkan efek suara ketika berhasil melakukan absensi otomatis atau manual.</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                            type="checkbox"
                            checked={isSoundEnabled}
                            onChange={(e) => setIsSoundEnabled(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-14 h-7 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>
            </div>
        </div>
    );

    const renderThemeContent = () => (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <button 
                    onClick={() => setView('MAIN')} 
                    className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-xl md:text-2xl font-bold text-gray-800">Tema (Theme)</h1>
            </div>

             <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 text-center">
                <Palette size={48} className="mx-auto text-purple-300 mb-4" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">Segera Hadir</h3>
                <p className="text-gray-500">Fitur kustomisasi tema terang/gelap sedang dalam tahap pengembangan.</p>
            </div>
        </div>
    );

    const renderHelpContent = () => (
        <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <button 
                    onClick={() => setView('MAIN')} 
                    className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">Pusat Bantuan</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
                    <div className="bg-blue-100 dark:bg-blue-900/50 p-4 rounded-full text-blue-600 dark:text-blue-400 mb-4">
                        <FileText size={32} />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white mb-2">Panduan Pengguna</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Pelajari cara menggunakan berbagai fitur aplikasi ABSENIN.</p>
                    <button 
                        onClick={() => setIsGuideModalOpen(true)}
                        className="mt-auto bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold py-2 px-4 rounded-lg w-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                        Buka Panduan
                    </button>
                </div>
                
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col items-center text-center hover:shadow-md transition-shadow">
                    <div className="bg-green-100 dark:bg-green-900/50 p-4 rounded-full text-green-600 dark:text-green-400 mb-4">
                        <MessageCircle size={32} />
                    </div>
                    <h3 className="font-bold text-gray-800 dark:text-white mb-2">Hubungi Dukungan</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Punya kendala teknis? Tim dukungan kami siap membantu Anda.</p>
                    <div className="mt-auto w-full flex flex-col gap-2">
                        <a 
                            href="https://wa.me/6285890285218" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 font-semibold py-2 px-4 rounded-lg w-full hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors flex items-center justify-center gap-2"
                        >
                            <Phone size={16} /> WhatsApp Kami
                        </a>
                        <a 
                            href="mailto:sunan.iskandar36@gmail.com" 
                            className="bg-gray-50 dark:bg-gray-700 flex-1 text-gray-700 dark:text-gray-200 font-semibold py-2 px-4 rounded-lg w-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                        >
                            <MessageCircle size={16} /> Kirim Email
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto pb-safe">
            {view === 'MAIN' && renderMainContent()}
            {view === 'MASTER_DATA' && renderMasterDataContent()}
            {view === 'SOUND' && renderSoundContent()}
            {view === 'THEME' && renderThemeContent()}
            {view === 'HELP' && renderHelpContent()}
            
            <Modal isOpen={isGuideModalOpen} onClose={() => setIsGuideModalOpen(false)} title="Panduan Pengguna ABSENIN" size="2xl">
                <div className="p-4 md:p-6 space-y-6 max-h-[70vh] overflow-y-auto no-scrollbar">
                    
                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-blue-600 dark:text-blue-400 border-b border-gray-100 dark:border-gray-700 pb-2">1. Master Data (Persiapan Awal)</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            Sebelum aplikasi dapat berjalan secara optimal, atur terlebih dahulu data dasar seperti <strong>Departemen</strong>, <strong>Shift Jam</strong>, <strong>Shift ID</strong>, dan <strong>Tipe Worker</strong> pada menu <strong>Pengaturan &gt; Master Data</strong>. Anda bisa menambahkannya satu per satu atau menggunakan fitur Import/Export Excel.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-blue-600 dark:text-blue-400 border-b border-gray-100 dark:border-gray-700 pb-2">2. Data Base Karyawan</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            Buka menu <strong>Data Base</strong> untuk mendaftarkan data karyawan (Ops ID, Nama, Tipe Worker, dll). Anda dapat menggunakan tombol <strong>Import Excel</strong> untuk memasukkan ratusan karyawan secara instan. Data dari menu ini akan digunakan sebagai rujukan utama ketika melakukan scan barcode atau mencari nama karyawan.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-blue-600 dark:text-blue-400 border-b border-gray-100 dark:border-gray-700 pb-2">3. Absensi (Proses Inti)</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            Di menu <strong>Absensi</strong>, buat "Sesi Absensi" baru dengan mengisi Tanggal, Shift, Departemen, dan target Plan MPP.
                            <br/><br/>
                            <strong>✅ Scan Barcode:</strong> Klik ikon 'Kamera Scanner' untuk membuka layar pemindai barcode. Setiap ID yang berhasil discan otomatis dianggap hadir.
                            <br/>
                            <strong>✅ Kehadiran Manual:</strong> Klik sesi list data yang ada lalu centang pada kolom 'Physical Attendance' apabila tidak bisa melakukan scan barcode. 
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-blue-600 dark:text-blue-400 border-b border-gray-100 dark:border-gray-700 pb-2">4. Dashboard & Kelola Sesi</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                            Menu <strong>Dashboard</strong> merangkum seluruh aktivitas absensi dengan grafik interaktif. Anda juga dapat melihat sesi aktif di sana dan melakukan <strong>Manage Session</strong> (melihat detail partisipan, menandai kehadiran fisik manual, hingga menyalin data format WhatsApp/Excel).
                        </p>
                    </div>
                    
                    <div className="space-y-2">
                        <h3 className="font-bold text-lg text-blue-600 dark:text-blue-400 border-b border-gray-100 dark:border-gray-700 pb-2">5. Open List & Laporan MPP</h3>
                        <ul className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed list-disc list-inside space-y-2">
                            <li><strong>Open List:</strong> Digunakan untuk memilah dengan cepat rincian data karyawan, menyalin seluruh absen harian, atau keperluan broadcast info.</li>
                            <li><strong>MPP:</strong> Fitur rekap perbandingan antara target (Plan MPP) dengan Kehadiran Aktual. Alat ini sangat membantu HR / Tim Manajemen melihat performa kehadiran harian di suatu departemen.</li>
                        </ul>
                    </div>

                    <div className="mt-8 pt-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                        <button onClick={() => setIsGuideModalOpen(false)} className="px-5 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">Mengerti, Tutup Panduan</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} title="Konfirmasi Hapus" size="sm" scrollable={false}>
                {itemToDelete && (
                    <div>
                        <p className="text-gray-600 mt-2">
                            Apakah Anda yakin ingin menghapus <strong>'{itemToDelete.value}'</strong>?
                        </p>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setIsDeleteConfirmOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium">
                                Batal
                            </button>
                            <button 
                                onClick={handleDelete} 
                                disabled={actionLoading}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold"
                            >
                                {actionLoading ? 'Menghapus...' : 'Ya, Hapus'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
             <style>{`
                .pb-safe {
                padding-bottom: env(safe-area-inset-bottom);
                }
            `}</style>
        </div>
    );
};

export default Settings;