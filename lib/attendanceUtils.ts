import { supabase } from './supabaseClient';
import { Worker } from '../types';

export const checkAndDeactivateWorkers = async (
  workers: Worker[],
  records: any[] // Using any[] here to avoid type mapping complex recordsData
): Promise<Worker[]> => {
  const inactiveWorkers: Worker[] = [];
  const now = new Date();
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  
  // Filter for Daily Worker Vendor in SOC Operator division
  const targetWorkers = workers.filter(
    (w) => w.contractType === 'Daily Worker Vendor' && 
           w.department === 'SOC Operator' &&
           w.status === 'Active'
  );

  for (const worker of targetWorkers) {
    if (!worker.id) continue;

    // Check attendance in the last month (approx 30 days)
    // recordsData uses 'worker_id' but mapped workers use 'id'. 
    // Wait, let's use the raw worker.id for comparison with records.worker_id.
    const workerRecords = records.filter(
      (r) => r.worker_id === worker.id && new Date(r.timestamp) >= oneMonthAgo
    );

    if (workerRecords.length === 0) {
      // Update in Supabase
      const { error } = await supabase
        .from('workers')
        .update({ status: 'Non Active' })
        .eq('id', worker.id);

      if (!error) {
        inactiveWorkers.push({ ...worker, status: 'Non Active' });
      }
    }
  }

  // Return updated worker list
  if (inactiveWorkers.length > 0) {
    return workers.map(w => {
        const updated = inactiveWorkers.find(iw => iw.id === w.id);
        return updated ? updated : w;
    });
  }
  
  return workers;
};
