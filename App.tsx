
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Menu, LogOut } from 'lucide-react';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import Modal from './components/Modal';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Database from './pages/Database';
import MPP from './pages/MPP';
import OpenList from './pages/OpenList';
import PublicAttendance from './pages/PublicAttendance';
import Settings from './pages/Settings';
import LoginPage from './pages/LoginPage';
import WelcomePage from './pages/WelcomePage';
import UpdatePasswordPage from './pages/UpdatePasswordPage';
import { Worker, AttendanceSession, AttendanceRecord } from './types';
import { supabase } from './lib/supabaseClient';
import { ToastProvider } from './contexts/ToastContext';
import { checkAndDeactivateWorkers } from './lib/attendanceUtils';

export type Page = 'Dashboard' | 'Absensi' | 'Open List' | 'Data Base' | 'MPP' | 'Pengaturan';
type AuthAction = 'IDLE' | 'RECOVERY';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authAction, setAuthAction] = useState<AuthAction>('IDLE');
  const [showWelcome, setShowWelcome] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>(() => {
    return (localStorage.getItem('activePage') as Page) || 'Dashboard';
  });
  
  useEffect(() => {
    localStorage.setItem('activePage', currentPage);
  }, [currentPage]);

  const [workers, setWorkers] = useState<Worker[]>(() => {
    const cached = localStorage.getItem('workersCache');
    return cached ? JSON.parse(cached) : [];
  });
  
  useEffect(() => {
    localStorage.setItem('workersCache', JSON.stringify(workers));
  }, [workers]);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPublicMode, setIsPublicMode] = useState(false);
  
  const workersRef = useRef<Worker[]>([]);
  useEffect(() => {
    workersRef.current = workers;
  }, [workers]);
  
  const [autoOpenSessionId, setAutoOpenSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      // Give it a tiny bit of time to settle or let the listener take over
      setTimeout(() => setAuthLoading(false), 500); 
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      
      setAuthAction(currentAuthAction => {
        if (event === 'PASSWORD_RECOVERY') {
          return 'RECOVERY';
        }
        if (currentAuthAction === 'RECOVERY' && event !== 'SIGNED_OUT') {
          return 'RECOVERY'; 
        }
        return 'IDLE';
      });

      setAuthLoading(false);
    });

    // Failsafe: Force authLoading to false after 5 seconds
    const timeout = setTimeout(() => {
      setAuthLoading(false);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    
    if (path.startsWith('/attend/')) {
        setIsPublicMode(true);
    } else {
        const pageParam = searchParams.get('page');
        const manageId = searchParams.get('manageId');
        
        if (pageParam === 'Dashboard') {
            setCurrentPage('Dashboard');
        }
        if (manageId) {
            setAutoOpenSessionId(manageId);
            // Hapus parameter dari URL setelah dibaca agar tidak memicu lagi saat refresh
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
  }, []);

  const [activeSession, setActiveSession] = useState<Omit<AttendanceSession, 'records' | 'id'> | null>(null);
  const [activeRecords, setActiveRecords] = useState<Omit<AttendanceRecord, 'id' | 'checkout_timestamp' | 'manual_status' | 'is_takeout'>[]>([]);

  const fetchData = useCallback(async (customStartDate?: Date, customEndDate?: Date) => {
    if (!session) return;
    setLoading(true); 
    setError(null);

    try {
        const fetchAll = async (table: string, select: string, dateColumn?: string, startDate?: string, endDate?: string) => {
            let allData: any[] = [];
            let lastData: any[] | null = null;
            let page = 0;
            const pageSize = 1000;

            do {
                let query = supabase.from(table).select(select);
                if (dateColumn && startDate && endDate) {
                    query = query.gte(dateColumn, startDate).lte(dateColumn, endDate);
                }
                
                const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);

                if (error) throw error;

                if (data) {
                    allData = [...allData, ...data];
                    lastData = data;
                } else {
                    lastData = [];
                }
                page++;
            } while (lastData && lastData.length === pageSize);
            
            return allData;
        };

        const workersData = await fetchAll('workers', '*');
        
        // Calculate default dates if not provided (start of current month to end of current month)
        const now = new Date();
        const effectiveStart = customStartDate || new Date(now.getFullYear(), now.getMonth(), 1);
        const effectiveEnd = customEndDate || new Date(now.getFullYear(), now.getMonth() + 1, 0);

        // Format dates as YYYY-MM-DD to match the generic 'date' column in database
        const formatDateForDB = (d: Date) => {
            return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
        };

        const startStr = formatDateForDB(effectiveStart);
        const endStr = formatDateForDB(effectiveEnd);

        const sessionsData = await fetchAll('attendance_sessions', '*', 'date', startStr, endStr);
        
        // Fetch ALL attendance_records globally since extracting them efficiently requires 
        // joining or fetching all and we are optimizing sessions. 
        // ACTUALLY wait! To optimize we SHOULD only fetch records for the filtered sessions.
        // We will do this by using IN clause or just fetching all if there are very few sessions?
        // Since we cannot do subqueries easily in basic select, let's just fetch all records
        // for now or better, retrieve them by getting records where session_id is in sessionsData
        const sessionIds = sessionsData.map((s: any) => s.id);
        
        // Only fetch records for the filtered sessions
        let recordsData: any[] = [];
        if (sessionIds.length > 0) {
            // Chunk session IDs if there are too many for a single IN clause
            const chunkSize = 200;
            for (let i = 0; i < sessionIds.length; i += chunkSize) {
                const chunk = sessionIds.slice(i, i + chunkSize);
                const { data: chunkRecords, error: recError } = await supabase
                    .from('attendance_records')
                    .select('id, session_id, worker_id, timestamp, checkout_timestamp, manual_status, is_takeout, scan_timestamp, is_arrived')
                    .in('session_id', chunk);
                
                if (recError) throw recError;
                if (chunkRecords) recordsData = [...recordsData, ...chunkRecords];
            }
        }
        
        const typedWorkers: Worker[] = workersData.map((w: any) => ({
            id: w.id,
            opsId: w.ops_id,
            fullName: w.full_name,
            nik: w.nik,
            phone: w.phone,
            contractType: w.contract_type,
            department: w.department,
            workerType: w.worker_type,
            createdAt: w.created_at || new Date().toISOString(),
            status: w.status,
        }));
        
        const updatedWorkers = await checkAndDeactivateWorkers(typedWorkers, recordsData);
        setWorkers(updatedWorkers);

        const workerMap = new Map<string, Worker>();
        typedWorkers.forEach(worker => {
            if (worker.id) {
                workerMap.set(worker.id, worker);
            }
        });

        const recordsBySessionId = new Map<string, any[]>();
        recordsData.forEach(record => {
            if (!recordsBySessionId.has(record.session_id)) {
                recordsBySessionId.set(record.session_id, []);
            }
            recordsBySessionId.get(record.session_id)!.push(record);
        });

        const history: AttendanceSession[] = sessionsData.map((session: any) => {
            const recordsForSession = recordsBySessionId.get(session.id) || [];
            return {
                id: session.id,
                date: session.date,
                department: session.department,
                shiftTime: session.shift_time,
                shiftId: session.shift_id,
                planMpp: session.plan_mpp,
                workerType: session.worker_type,
                status: session.status,
                session_type: session.session_type,
                auto_close: session.auto_close,
                records: recordsForSession.map((rec: any) => {
                    const worker = workerMap.get(rec.worker_id);
                    return {
                        id: rec.id,
                        workerId: rec.worker_id,
                        opsId: worker?.opsId || 'N/A',
                        fullName: worker?.fullName || 'Unknown',
                        timestamp: rec.timestamp,
                        scan_timestamp: rec.scan_timestamp,
                        checkout_timestamp: rec.checkout_timestamp,
                        manual_status: rec.manual_status,
                        is_takeout: rec.is_takeout,
                        is_arrived: rec.is_arrived ?? true,
                    }
                }),
            };
        });
        setAttendanceHistory(history);

    } catch (err: any) {
      console.error("Fetch Data Error:", err);
      let errMsg = err?.message || "An unexpected error occurred.";
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  }, [session]); 

  useEffect(() => {
    if (!isPublicMode && session && authAction !== 'RECOVERY') {
        fetchData();
    } else {
        setLoading(false); 
    }
  }, [isPublicMode, session, fetchData, authAction]); 
  
  // Real-time data synchronization
  useEffect(() => {
    if (!session || isPublicMode) return;
    
    // --- Granular updates for frequently changing attendance data ---
    const handleAttendanceChanges = (payload: any) => {
      const workerMap = new Map<string, Worker>();
      // Use the ref which is always up-to-date with the 'workers' state
      workersRef.current.forEach(worker => {
          if (worker.id) {
              workerMap.set(worker.id, worker);
          }
      });

      const enrichRecord = (record: any): AttendanceRecord => {
          const worker = workerMap.get(record.worker_id);
          return {
              id: record.id,
              workerId: record.worker_id,
              opsId: worker?.opsId || 'N/A',
              fullName: worker?.fullName || 'Unknown',
              timestamp: record.timestamp,
              scan_timestamp: record.scan_timestamp,
              checkout_timestamp: record.checkout_timestamp,
              manual_status: record.manual_status,
              is_takeout: record.is_takeout,
              is_arrived: record.is_arrived ?? true,
          };
      };
      
      setAttendanceHistory(currentHistory => {
        let newHistory = [...currentHistory];
        
        // Handle Session Changes
        if (payload.table === 'attendance_sessions') {
            const sessionIndex = newHistory.findIndex(s => s.id === (payload.new?.id || payload.old?.id));

            if (payload.eventType === 'INSERT') {
                if (sessionIndex > -1) return newHistory; // Already exists
                const newSessionData = payload.new;
                const newSession: AttendanceSession = {
                    id: newSessionData.id, date: newSessionData.date, department: newSessionData.department,
                    shiftTime: newSessionData.shift_time, shiftId: newSessionData.shift_id,
                    planMpp: newSessionData.plan_mpp, workerType: newSessionData.worker_type, status: newSessionData.status,
                    session_type: newSessionData.session_type, auto_close: newSessionData.auto_close,
                    records: [],
                };
                return [newSession, ...newHistory];
            } else if (payload.eventType === 'UPDATE') {
                if (sessionIndex > -1) {
                    const updatedSessionData = payload.new;
                    newHistory[sessionIndex] = {
                        ...newHistory[sessionIndex], // keep records
                        date: updatedSessionData.date, department: updatedSessionData.department,
                        shiftTime: updatedSessionData.shift_time, shiftId: updatedSessionData.shift_id,
                        planMpp: updatedSessionData.plan_mpp, workerType: updatedSessionData.worker_type, status: updatedSessionData.status,
                        session_type: updatedSessionData.session_type, auto_close: updatedSessionData.auto_close,
                    };
                    return [...newHistory];
                }
            } else if (payload.eventType === 'DELETE') {
                return newHistory.filter(s => s.id !== payload.old.id);
            }
        }

        // Handle Record Changes
        if (payload.table === 'attendance_records') {
            const sessionId = payload.new?.session_id || payload.old?.session_id;
            if (!sessionId) return newHistory;

            const sessionIndex = newHistory.findIndex(s => s.id === sessionId);
            if (sessionIndex === -1) return newHistory;

            const targetSession = { ...newHistory[sessionIndex] };
            let updatedRecords = [...targetSession.records];

            if (payload.eventType === 'INSERT') {
                const newRecord = enrichRecord(payload.new);
                if (!updatedRecords.some(r => r.id === newRecord.id)) {
                  updatedRecords.push(newRecord);
                }
            } else if (payload.eventType === 'UPDATE') {
                const updatedRecord = enrichRecord(payload.new);
                const recordIndex = updatedRecords.findIndex(r => r.id === updatedRecord.id);
                if (recordIndex > -1) {
                    updatedRecords[recordIndex] = updatedRecord;
                } else {
                    updatedRecords.push(updatedRecord);
                }
            } else if (payload.eventType === 'DELETE') {
                updatedRecords = updatedRecords.filter(r => r.id !== payload.old.id);
            }
            
            targetSession.records = updatedRecords;
            newHistory[sessionIndex] = targetSession;
            return [...newHistory];
        }

        return currentHistory;
      });
    };
    
    // Channel for frequent data
    const attendanceChannel = supabase
      .channel('attendance-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, handleAttendanceChanges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, handleAttendanceChanges)
      .subscribe();
      
    // Channel for foundational data that triggers a full refetch
    const foundationalDataChannel = supabase
      .channel('foundational-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'master_data' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(foundationalDataChannel);
    };
  }, [session, isPublicMode, fetchData]);


  // Fungsi untuk membersihkan state auto-open setelah digunakan
  const clearAutoOpenSessionId = () => {
    setAutoOpenSessionId(null);
  };

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const confirmLogout = async () => {
    setIsLogoutModalOpen(false);
    await supabase.auth.signOut();
  };

  if (isPublicMode) {
      return <PublicAttendance />;
  }

  // Handle password recovery state BEFORE checking for session
  if (authAction === 'RECOVERY') {
    return (
      <ToastProvider>
        <UpdatePasswordPage />
      </ToastProvider>
    );
  }

  if (authLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-white">
          <div className="animate-pulse">
             <img src="https://i.imgur.com/79JL73s.png" alt="ABSENIN Logo" className="h-24 w-24 object-contain" />
          </div>
        </div>
      );
  }

  if (!session && showWelcome) {
    return <WelcomePage onEnter={() => setShowWelcome(false)} />;
  }

  if (!session) {
    return <LoginPage />;
  }

  const renderPage = () => {
    // Show cached content immediately if it exists, even if loading is true
    const isInitialLoad = loading && workers.length === 0;

    if (isInitialLoad) {
      return (
        <div className="flex justify-center items-center h-full">
          <div className="flex flex-col items-center">
             <div className="animate-bounce mb-4">
                 <img src="https://i.imgur.com/79JL73s.png" alt="ABSENIN Logo" className="h-12 w-12 object-contain opacity-50" />
             </div>
             <div className="text-gray-400 text-xs font-bold uppercase tracking-widest">Memuat Data...</div>
          </div>
        </div>
      );
    }
    
    switch (currentPage) {
      case 'Dashboard':
        return <Dashboard 
                  workers={workers} 
                  attendanceHistory={attendanceHistory} 
                  refreshData={fetchData} 
                  setAttendanceHistory={setAttendanceHistory}
                  autoOpenSessionId={autoOpenSessionId}
                  clearAutoOpenSessionId={clearAutoOpenSessionId}
               />;
      case 'Absensi':
        return <Attendance 
                  workers={workers} 
                  refreshData={fetchData}
                  activeSession={activeSession}
                  setActiveSession={setActiveSession}
                  activeRecords={activeRecords}
                  setActiveRecords={setActiveRecords}
               />;
      case 'Open List':
          return <OpenList 
                    workers={workers} 
                    setCurrentPage={setCurrentPage}
                    setAutoOpenSessionId={setAutoOpenSessionId}
                 />;
      case 'Data Base':
        return <Database workers={workers} refreshData={fetchData} />;
      case 'MPP':
        return <MPP />;
      case 'Pengaturan':
          return <Settings />;
      default:
        return <Dashboard 
                  workers={workers} 
                  attendanceHistory={attendanceHistory} 
                  refreshData={fetchData} 
                  setAttendanceHistory={setAttendanceHistory} 
                  autoOpenSessionId={autoOpenSessionId}
                  clearAutoOpenSessionId={clearAutoOpenSessionId}
                />;
    }
  };

  return (
    <ToastProvider>
        <div className="flex min-h-screen bg-[#f8f9fc] text-gray-800 font-sans">
        <Sidebar 
            currentPage={currentPage} 
            setCurrentPage={setCurrentPage} 
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
        />
        <main className="flex-1 flex flex-col min-h-screen overflow-hidden transition-all duration-300 pb-16 lg:pb-0">
            <div className="lg:hidden p-3 flex justify-between items-center bg-white border-b shrink-0">
            <div className="flex items-center gap-3">
                <img src="https://i.imgur.com/79JL73s.png" alt="ABSENIN Logo" className="h-8 w-8 object-contain" />
                <h1 className="text-lg font-black text-blue-600 leading-none tracking-tighter">ABSENIN</h1>
            </div>
            <button onClick={() => setIsLogoutModalOpen(true)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                <LogOut size={20} />
            </button>
            </div>
            <div className="flex-1 p-4 sm:p-6 lg:p-10 overflow-y-auto no-scrollbar">
                {renderPage()}
            </div>
        </main>
        <BottomNav currentPage={currentPage} setCurrentPage={setCurrentPage} />
        <Modal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} title="Konfirmasi Logout" size="sm" scrollable={false}>
          <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="text-lg leading-6 font-bold text-gray-900 mt-5">Keluar dari Sesi</h3>
              <p className="text-sm text-gray-500 mt-2">
                Apakah Anda yakin ingin keluar dari sistem?
              </p>
          </div>
          <div className="mt-6 flex justify-center gap-3">
              <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:text-sm"
                  onClick={() => setIsLogoutModalOpen(false)}
              >
                  Batal
              </button>
              <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:text-sm"
                  onClick={confirmLogout}
              >
                  Ya, Keluar
              </button>
          </div>
        </Modal>
        </div>
    </ToastProvider>
  );
};

export default App;