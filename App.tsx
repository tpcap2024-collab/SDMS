import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DockColumn from './components/DockColumn';
import Login from './components/Login';
import { mockDocks, mockKPIs } from './data';
import { DockData } from './types';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [time, setTime] = useState(new Date());
  const [docks, setDocks] = useState<DockData[]>(mockDocks);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch data from Google Sheets API
    const fetchSheetData = async () => {
      try {
        const response = await fetch('/api/docks');
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        const data = await response.json();
        if (data && data.data && data.data.length > 0) {
          // Process the sheet data if needed.
          // For now, if there is a GOOGLE_SHEET_ID and it returns data, we can log it.
          // Because we don't know the exact column format of the user's sheet, we keep the mock docks
          // but we can update parts of it if we define a standard structure later.
          console.log('Google Sheets data loaded:', data.data);
          
          // Optionally you can map this data to setDocks, assuming standard columns:
          // [DockName, Status, TruckRoute, LicensePlate, ...]
          // But without a strict schema from the user, applying raw data might break the UI.
        }
      } catch (err) {
        console.error('Error fetching sheet data, falling back to mock data', err);
      }
    };

    fetchSheetData();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const timer = setInterval(() => {
      setTime(new Date());
      
      setDocks(prev => prev.map(dock => {
        if (dock.currentTruck && dock.currentTruck.startTime) {
          const elapsedMs = Date.now() - dock.currentTruck.startTime;
          const elapsedMins = Math.floor(elapsedMs / 60000);
          const elapsedSecs = Math.floor((elapsedMs % 60000) / 1000);
          const elapsedHours = Math.floor(elapsedMins / 60);
          const displayMins = elapsedMins % 60;
          
          const elapsedTime = `${elapsedHours.toString().padStart(2, '0')}:${displayMins.toString().padStart(2, '0')}:${elapsedSecs.toString().padStart(2, '0')}`;
          
          let status = dock.status;
          if (elapsedMins >= 40 && status !== 'delayed') {
            status = 'delayed';
          }

          return {
            ...dock,
            status,
            currentTruck: {
              ...dock.currentTruck,
              elapsedTime,
              progress: Math.min(100, Math.floor((elapsedMins / 40) * 100))
            }
          };
        }
        return dock;
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFinishOperation = (dockId: string) => {
    setDocks(prev => prev.map(dock => {
      if (dock.id === dockId) {
        return {
          ...dock,
          status: 'empty',
          currentTruck: null
        };
      }
      return dock;
    }));
  };

  const handleEnterDock = (dockId: string, truckId: string) => {
    setDocks(prev => prev.map(dock => {
      if (dock.id === dockId) {
        const truck = dock.waitingQueue.find(t => t.id === truckId);
        if (!truck) return dock;
        
        return {
          ...dock,
          status: 'unloading',
          currentTruck: {
            id: truck.id,
            route: truck.route,
            licensePlate: truck.licensePlate,
            driver: 'สมชาย ใจดี',
            transportCo: 'บริษัท ขนส่ง จำกัด',
            entryTime: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
            elapsedTime: '00:00:00',
            progress: 0,
            startTime: Date.now(),
          },
          waitingQueue: dock.waitingQueue.filter(t => t.id !== truckId)
        };
      }
      return dock;
    }));
  };

  const handleDragStart = (e: React.DragEvent, truckId: string, sourceDockId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ truckId, sourceDockId }));
  };

  const handleDrop = (e: React.DragEvent, targetDockId: string) => {
    e.preventDefault();
    try {
      const data = e.dataTransfer.getData('application/json');
      if (!data) return;
      const { truckId, sourceDockId } = JSON.parse(data);
      if (sourceDockId === targetDockId) return;

      setDocks(prev => {
        const newDocks = [...prev];
        const sourceDockIndex = newDocks.findIndex(d => d.id === sourceDockId);
        const targetDockIndex = newDocks.findIndex(d => d.id === targetDockId);
        
        if (sourceDockIndex > -1 && targetDockIndex > -1) {
          const sourceDock = { ...newDocks[sourceDockIndex], waitingQueue: [...newDocks[sourceDockIndex].waitingQueue] };
          const targetDock = { ...newDocks[targetDockIndex], waitingQueue: [...newDocks[targetDockIndex].waitingQueue] };
          
          const truckIndex = sourceDock.waitingQueue.findIndex(t => t.id === truckId);
          if (truckIndex > -1) {
            const [truck] = sourceDock.waitingQueue.splice(truckIndex, 1);
            targetDock.waitingQueue.push({ ...truck, isMoved: true });
            targetDock.waitingQueue.sort((a, b) => a.eta.localeCompare(b.eta));
            
            newDocks[sourceDockIndex] = sourceDock;
            newDocks[targetDockIndex] = targetDock;
          }
        }
        return newDocks;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden border-8 border-slate-200">
      <Header time={time} kpiData={mockKPIs} />
      
      {/* Main Board - 6 Columns */}
      <main className="flex-1 grid grid-cols-6 divide-x divide-slate-300 bg-slate-200 overflow-hidden">
        {docks.map((dock) => (
          <DockColumn 
            key={dock.id} 
            dock={dock} 
            time={time}
            onFinish={() => handleFinishOperation(dock.id)}
            onEnterDock={(truckId) => handleEnterDock(dock.id, truckId)}
            onDragStart={(e, truckId) => handleDragStart(e, truckId, dock.id)}
            onDrop={(e) => handleDrop(e, dock.id)}
            onDragOver={handleDragOver}
          />
        ))}
      </main>

      <footer className="h-8 bg-slate-800 text-slate-400 flex items-center justify-between px-6 text-[10px] font-bold uppercase tracking-widest shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"> <span className="w-2 h-2 rounded-full bg-emerald-500"></span> SYSTEM STABLE </span>
          <span className="text-slate-600">|</span>
          <span>LAST SYNC: {time.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
        </div>
        <div className="flex items-center gap-6">
          <span>6 DOCKS ONLINE</span>
          <span>ZONE: A-WEST WAREHOUSE</span>
        </div>
      </footer>
    </div>
  );
}
