import React, { useEffect, useState } from 'react'; import { createPortal } from 'react-dom'; import { AnimatePresence, motion } from 'motion/react'; import { AlertCircle, CheckCircle2, Phone, PlayCircle, X } from 'lucide-react'; import { DockData, DockStatus, WaitingTruck } from '../types';

interface DockColumnProps { dock: DockData; time?: Date; onFinish?: () => void; onEnterDock?: (truckId: string) => void; onDragStart?: (event: React.DragEvent, truckId: string) => void; onDrop?: (event: React.DragEvent) => void; onDragOver?: (event: React.DragEvent) => void; }

function createPhoneLink(value: string): string { const cleaned = value.replace(/[^0-9+]/g, ''); if (!cleaned) { return ''; } return 'tel:' + cleaned; }

export default function DockColumn({ dock, time, onFinish, onEnterDock, onDragStart, onDrop, onDragOver, }: DockColumnProps) { const [calledTrucks, setCalledTrucks] = useState<Record<string, boolean>>({}); const [selectedTruck, setSelectedTruck] = useState<WaitingTruck | null>(null); const [mounted, setMounted] = useState(false); const [showOccupiedAlert, setShowOccupiedAlert] = useState(false);

useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

const getStatusConfig = (status: DockStatus) => { if (status === 'unloading') { return { container: 'bg-white', header: 'bg-yellow-400 text-black', badge: 'กำลังลงงาน', queueContainer: 'bg-slate-50 border-slate-200', queueHeader: 'text-slate-400', queueItem: 'border-slate-200', queueText: 'text-yellow-600', }; } if (status === 'delayed') { return { container: 'bg-rose-50/30', header: 'bg-[#ff0000] text-black', badge: 'ผิดปกติ', queueContainer: 'bg-white border-slate-200', queueHeader: 'text-slate-400', queueItem: 'border-slate-200', queueText: 'text-slate-500', }; } return { container: 'bg-white opacity-95', header: 'bg-[#00ff00] text-black', badge: 'ว่าง', queueContainer: 'bg-slate-50 border-slate-200', queueHeader: 'text-slate-400', queueItem: 'border-slate-200', queueText: 'text-emerald-500', }; };

const config = getStatusConfig(dock.status); const displayQueue = dock.waitingQueue.slice(0, 5); const remainingQueue = Math.max(0, dock.waitingQueue.length - 5);

const isOverdue = (eta: string) => { if (!time || !eta) { return false; } const parts = eta.split(':').map(Number); if (parts.length < 2 || parts.some(Number.isNaN)) { return false; } const etaDate = new Date(time); etaDate.setHours(parts[0], parts[1], 0, 0); return time.getTime() > etaDate.getTime(); };

const getQueueStyle = (truck: WaitingTruck) => { if (truck.isMoved) { return 'bg-[#ffff00] border-amber-400'; } if (isOverdue(truck.eta)) { return 'bg-red-500/20 border-red-500 animate-[pulse_1s_ease-in-out_infinite]'; } return 'bg-white ' + config.queueItem; };

const enterSelectedTruck = () => { if (!selectedTruck) { return; } if (dock.currentTruck) { setShowOccupiedAlert(true); return; } if (onEnterDock) { onEnterDock(selectedTruck.id); } setSelectedTruck(null); setShowOccupiedAlert(false); };

const selectedPhoneLink = selectedTruck ? createPhoneLink(selectedTruck.telDriver) : '';

return ( <div className={'flex flex-col h-full overflow-hidden ' + config.container} onDrop={onDrop} onDragOver={onDragOver} > <div className={'p-3 flex flex-col items-center justify-center text-center ' + config.header}> DOCK {dock.name.replace(/\D/g, '')} {config.badge}

  <div className="flex-1 p-2 flex flex-col overflow-hidden">
    <div className={'rounded-lg p-2 border h-full flex flex-col ' + config.queueContainer}>
      <h3 className={'text-[10px] font-bold uppercase mb-2 ' + config.queueHeader}>
        Waiting ({dock.waitingQueue.length})
      </h3>
      {dock.waitingQueue.length > 0 ? (
        <div className="space-y-1.5 flex-1 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {displayQueue.map((truck) => (
              <motion.div
                draggable
                onDragStart={(event) => {
                  if (onDragStart) {
                    onDragStart(event as unknown as React.DragEvent, truck.id);
                  }
                }}
                layout
                layoutId={'truck-' + truck.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={truck.id}
                onClick={() => {
                  setSelectedTruck(truck);
                  setShowOccupiedAlert(false);
                }}
                className={
                  'p-2 border rounded shadow-sm flex justify-between items-center cursor-pointer hover:opacity-80 gap-1.5 ' +
                  getQueueStyle(truck)
                }
              >
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className={'flex gap-1.5 text-[11px] font-bold truncate ' + config.queueText}>
                    <span className="truncate">{truck.route}</span>
                    <span className="shrink-0">{truck.eta}</span>
                  </div>
                  <div className="text-sm font-black text-slate-800 truncate">{truck.licensePlate}</div>
                </div>
                <div
                  className={
                    'shrink-0 p-1.5 rounded-full border flex items-center justify-center ' +
                    (calledTrucks[truck.id]
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-400 border-slate-200')
                  }
                >
                  <Phone size={14} />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {remainingQueue > 0 && (
            <p className="text-center text-[10px] font-bold text-slate-400 py-1">
              +{remainingQueue} more vehicles...
            </p>
          )}
        </div>
      ) : (
        <div className="h-full flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
          No queue
        </div>
      )}
    </div>
  </div>

  <div className="w-full h-3 bg-slate-100 border-y-2 border-slate-200 shrink-0" />

  <div className="h-[220px] p-2 shrink-0 flex flex-col">
    <AnimatePresence mode="wait">
      {dock.currentTruck ? (
        <motion.div
          layoutId={'truck-' + dock.currentTruck.id}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={
            'flex-1 rounded-lg p-3 flex flex-col ' +
            (dock.status === 'delayed'
              ? 'bg-rose-50 border-2 border-rose-200'
              : 'bg-white border border-slate-200')
          }
        >
          <div className="mb-1 flex justify-between items-start">
            <p className={'text-xs font-bold ' + (dock.status === 'delayed' ? 'text-rose-600' : 'text-amber-600')}>
              Route: {dock.currentTruck.route}
            </p>
            {dock.status === 'delayed' && (
              <span className="bg-rose-100 text-rose-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-rose-200">
                EXCEEDED
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black leading-none text-slate-800">{dock.currentTruck.licensePlate}</h2>
          <div className="mt-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Driver</span>
              <span className="font-bold text-slate-700 truncate max-w-[100px]">{dock.currentTruck.driver}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Transport</span>
              <span className="font-bold text-slate-700 truncate max-w-[100px]">{dock.currentTruck.transportCo}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-1">
              <span className="text-slate-400">Arrival</span>
              <span className="font-bold text-slate-700">{dock.currentTruck.entryTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Duration</span>
              <span className="font-black text-amber-600">{dock.currentTruck.elapsedTime}</span>
            </div>
          </div>
          <div className="mt-auto pt-2">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={(dock.status === 'delayed' ? 'bg-rose-500' : 'bg-amber-500') + ' h-full'}
                style={{ width: dock.currentTruck.progress + '%' }}
              />
            </div>
            <p className="text-right text-[10px] font-bold mt-1 text-amber-600">{dock.currentTruck.progress}% Progress</p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="idle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 border border-slate-200 rounded-lg p-3 flex flex-col bg-white opacity-60"
        >
          <p className="text-lg font-black text-slate-300 flex items-center justify-center h-full">IDLE</p>
        </motion.div>
      )}
    </AnimatePresence>
  </div>

  <div className="p-2 border-t border-slate-200 shrink-0 bg-white">
    <button
      onClick={onFinish}
      disabled={!dock.currentTruck}
      className={
        'w-full py-2 rounded-lg font-bold text-[12px] uppercase shadow-sm flex items-center justify-center gap-1.5 ' +
        (dock.currentTruck ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-slate-100 text-slate-400')
      }
    >
      <CheckCircle2 size={18} />
      ลงงานเรียบร้อย
    </button>
  </div>

  {mounted && selectedTruck && createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
        <div className="bg-blue-600 p-3 flex justify-between items-center text-white">
          <h3 className="font-bold text-lg">รายละเอียดรถ</h3>
          <button onClick={() => setSelectedTruck(null)} className="hover:bg-blue-700 p-1 rounded">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-center">
            <div className="text-4xl font-black text-slate-800">{selectedTruck.licensePlate}</div>
            <div className="text-blue-600 font-bold text-sm mt-1">ทะเบียนรถ</div>
          </div>
          <div className="space-y-3 text-sm bg-slate-50 p-4 rounded-lg border border-slate-200">
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500">เส้นทาง</span>
              <span className="font-bold">{selectedTruck.route}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-2">
              <span className="text-slate-500">เวลาลงงาน</span>
              <span className="font-bold">{selectedTruck.eta}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 pb-2 gap-3">
              <span className="text-slate-500">ชื่อคนขับ</span>
              <span className="font-bold text-right">{selectedTruck.driverName || 'ไม่มีข้อมูล'}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">เบอร์โทร</span>
              <span className="font-bold text-blue-600">{selectedTruck.telDriver || 'ไม่มีข้อมูล'}</span>
            </div>
          </div>

          <AnimatePresence>
            {showOccupiedAlert && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-lg flex items-center gap-2 text-sm font-bold">
                  <AlertCircle size={18} />
                  ช่องลงงานไม่ว่าง กรุณากดลงงานเรียบร้อยก่อน
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-2 gap-3">
            {calledTrucks[selectedTruck.id] ? (
              <>
                <button
                  onClick={() =>
                    setCalledTrucks((previous) => ({ ...previous, [selectedTruck.id]: false }))
                  }
                  className="bg-rose-500 text-white font-bold py-3 rounded-lg"
                >
                  ยกเลิกยืนยันโทร
                </button>
                <button
                  onClick={enterSelectedTruck}
                  className="bg-blue-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-1.5"
                >
                  <PlayCircle size={18} />
                  เข้าช่อง
                </button>
              </>
            ) : (
              <>
                {selectedPhoneLink ? (
                  {selectedPhoneLink}200 text-emerald-600 font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Phone size={18} />
                    โทรออก
                  </a>
                ) : (
                  <button
                    disabled
                    className="bg-slate-100 border-2 border-slate-200 text-slate-400 font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Phone size={18} />
                    ไม่มีเบอร์โทร
                  </button>
                )}
                <button
                  onClick={() =>
                    setCalledTrucks((previous) => ({ ...previous, [selectedTruck.id]: true }))
                  }
                  className="bg-blue-600 text-white font-bold py-3 rounded-lg"
                >
                  ยืนยันโทรเรียกแล้ว
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )}
</div>


); }
