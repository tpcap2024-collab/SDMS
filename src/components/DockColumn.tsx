import React, {
  useEffect,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AnimatePresence,
  motion,
} from 'motion/react';
import {
  AlertCircle,
  CheckCircle2,
  Phone,
  PlayCircle,
  X,
} from 'lucide-react';
import {
  DockData,
  DockStatus,
  WaitingTruck,
} from '../types';

interface DockColumnProps {
  dock: DockData;
  time?: Date;
  onFinish?: () => void;
  onEnterDock?: (
    truckId: string
  ) => void;
  onDragStart?: (
    event: React.DragEvent,
    truckId: string
  ) => void;
  onDrop?: (
    event: React.DragEvent
  ) => void;
  onDragOver?: (
    event: React.DragEvent
  ) => void;
}

type WaitingTruckDetails =
  WaitingTruck & {
    driver?: string;
    driverName?: string;
    telDriver?: string;
    phone?: string;
    company?: string;
    project?: string;
    dockCode?: string;
  };

function getDriverName(
  truck: WaitingTruckDetails
): string {
  const value =
    truck.driverName ||
    truck.driver ||
    '';

  const cleanedValue =
    String(value).trim();

  if (!cleanedValue) {
    return 'ไม่มีข้อมูล';
  }

  return cleanedValue;
}

function getDriverPhone(
  truck: WaitingTruckDetails
): string {
  const value =
    truck.telDriver ||
    truck.phone ||
    '';

  const cleanedValue =
    String(value).trim();

  if (!cleanedValue) {
    return 'ไม่มีข้อมูล';
  }

  return cleanedValue;
}

function getPhoneLink(
  truck: WaitingTruckDetails
): string {
  const value =
    truck.telDriver ||
    truck.phone ||
    '';

  const cleanedPhone =
    String(value).replace(
      /[^0-9+]/g,
      ''
    );

  if (!cleanedPhone) {
    return '';
  }

  return 'tel:' + cleanedPhone;
}

export default function DockColumn({
  dock,
  time,
  onFinish,
  onEnterDock,
  onDragStart,
  onDrop,
  onDragOver,
}: DockColumnProps) {
  const [
    calledTrucks,
    setCalledTrucks,
  ] = useState<
    Record<string, boolean>
  >({});

  const [
    selectedTruck,
    setSelectedTruck,
  ] = useState<
    WaitingTruckDetails | null
  >(null);

  const [
    mounted,
    setMounted,
  ] = useState(false);

  const [
    showOccupiedAlert,
    setShowOccupiedAlert,
  ] = useState(false);

  useEffect(() => {
    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  const openTruckDetails = (
    truck: WaitingTruck
  ) => {
    setSelectedTruck(
      truck as WaitingTruckDetails
    );

    setShowOccupiedAlert(false);
  };

  const closeTruckDetails = () => {
    setSelectedTruck(null);
    setShowOccupiedAlert(false);
  };

  const handleConfirmCall = () => {
    if (!selectedTruck) {
      return;
    }

    setCalledTrucks(
      (previousState) => ({
        ...previousState,
        [selectedTruck.id]: true,
      })
    );
  };

  const handleCancelCall = () => {
    if (!selectedTruck) {
      return;
    }

    setCalledTrucks(
      (previousState) => ({
        ...previousState,
        [selectedTruck.id]: false,
      })
    );
  };

  const handleEnterSelectedTruck =
    () => {
      if (!selectedTruck) {
        return;
      }

      if (dock.currentTruck) {
        setShowOccupiedAlert(true);
        return;
      }

      if (onEnterDock) {
        onEnterDock(
          selectedTruck.id
        );
      }

      closeTruckDetails();
    };

  const getStatusConfig = (
    status: DockStatus
  ) => {
    switch (status) {
      case 'unloading':
        return {
          container:
            'bg-white',
          header:
            'bg-yellow-400 text-black',
          badge:
            'กำลังลงงาน',
          queueContainer:
            'bg-slate-50 border-slate-200',
          queueHeader:
            'text-slate-400',
          queueItem:
            'border-slate-200',
          queueTextPrimary:
            'text-yellow-600',
        };

      case 'delayed':
        return {
          container:
            'bg-rose-50/30',
          header:
            'bg-[#ff0000] text-black',
          badge:
            'ผิดปกติ',
          queueContainer:
            'bg-white border-slate-200',
          queueHeader:
            'text-slate-400',
          queueItem:
            'border-slate-200',
          queueTextPrimary:
            'text-slate-500',
        };

      case 'empty':
      case 'waiting':
      case 'preparing':
      default:
        return {
          container:
            'bg-white opacity-95',
          header:
            'bg-[#00ff00] text-black',
          badge:
            'ว่าง',
          queueContainer:
            'bg-slate-50 border-slate-200',
          queueHeader:
            'text-slate-400',
          queueItem:
            'border-slate-200',
          queueTextPrimary:
            'text-emerald-500',
        };
    }
  };

  const config =
    getStatusConfig(
      dock.status
    );

  const displayQueue =
    dock.waitingQueue.slice(
      0,
      5
    );

  const remainingQueue =
    Math.max(
      0,
      dock.waitingQueue.length - 5
    );

  const isOverdue = (
    eta: string
  ) => {
    if (!time || !eta) {
      return false;
    }

    const timeParts =
      eta
        .split(':')
        .map(Number);

    if (
      timeParts.length < 2 ||
      Number.isNaN(
        timeParts[0]
      ) ||
      Number.isNaN(
        timeParts[1]
      )
    ) {
      return false;
    }

    const etaDate =
      new Date(time);

    etaDate.setHours(
      timeParts[0],
      timeParts[1],
      0,
      0
    );

    return (
      time.getTime() >
      etaDate.getTime()
    );
  };

  const getQueueItemStyle = (
    truck: WaitingTruck
  ) => {
    if (truck.isMoved) {
      return [
        'bg-[#ffff00]',
        'border-amber-400',
      ].join(' ');
    }

    if (isOverdue(truck.eta)) {
      return [
        'bg-red-500/20',
        'border-red-500',
        'animate-[pulse_1s_ease-in-out_infinite]',
      ].join(' ');
    }

    return [
      'bg-white',
      config.queueItem,
    ].join(' ');
  };

  const renderDockName = () => {
    const match =
      dock.name.match(
        /^(DOCK)\s+(\d+)$/i
      );

    if (match) {
      return (
        <span className="font-black tracking-tighter uppercase flex items-baseline gap-1.5">
          <span className="text-2xl">
            {match[1]}
          </span>

          <span className="text-5xl leading-none">
            {match[2]}
          </span>
        </span>
      );
    }

    return (
      <span className="font-black text-4xl tracking-tighter uppercase">
        {dock.name}
      </span>
    );
  };

  const selectedDriverName =
    selectedTruck
      ? getDriverName(
          selectedTruck
        )
      : '';

  const selectedDriverPhone =
    selectedTruck
      ? getDriverPhone(
          selectedTruck
        )
      : '';

  const selectedPhoneLink =
    selectedTruck
      ? getPhoneLink(
          selectedTruck
        )
      : '';

  return (
    <div
      className={[
        'flex flex-col',
        'h-full',
        'overflow-hidden',
        config.container,
      ].join(' ')}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <div
        className={[
          'p-3',
          'flex',
          'flex-col',
          'items-center',
          'justify-center',
          'text-center',
          config.header,
        ].join(' ')}
      >
        {renderDockName()}

        <span className="text-base font-bold mt-1">
          {config.badge}
        </span>
      </div>

      <div className="flex-1 p-2 flex flex-col overflow-hidden">
        <div
          className={[
            'rounded-lg',
            'p-2',
            'border',
            'h-full',
            'flex',
            'flex-col',
            config.queueContainer,
          ].join(' ')}
        >
          <h3
            className={[
              'text-[10px]',
              'font-bold',
              'uppercase',
              'mb-2',
              config.queueHeader,
            ].join(' ')}
          >
            {dock.status ===
            'waiting'
              ? 'Priority Queue'
              : 'Waiting (' +
                dock.waitingQueue
                  .length +
                ')'}
          </h3>

          {dock.waitingQueue
            .length > 0 ? (
            <div className="space-y-1.5 flex-1 overflow-y-auto">
              <AnimatePresence mode="popLayout">
                {displayQueue.map(
                  (truck) => (
                    <motion.div
                      draggable
                      onDragStart={(
                        event
                      ) => {
                        if (
                          onDragStart
                        ) {
                          onDragStart(
                            event as React.DragEvent,
                            truck.id
                          );
                        }
                      }}
                      layout
                      layoutId={
                        'truck-' +
                        truck.id
                      }
                      initial={{
                        opacity: 0,
                        scale: 0.9,
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.9,
                      }}
                      key={
                        truck.id
                      }
                      onClick={() =>
                        openTruckDetails(
                          truck
                        )
                      }
                      className={[
                        'p-2',
                        'border',
                        'rounded',
                        'shadow-sm',
                        'flex',
                        'justify-between',
                        'items-center',
                        'cursor-pointer',
                        'transition-colors',
                        'hover:opacity-80',
                        'gap-1.5',
                        getQueueItemStyle(
                          truck
                        ),
                      ].join(' ')}
                    >
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div
                          className={[
                            'flex',
                            'gap-1.5',
                            'text-[11px]',
                            'font-bold',
                            'truncate',
                            config.queueTextPrimary,
                          ].join(' ')}
                        >
                          <span className="truncate">
                            {
                              truck.route
                            }
                          </span>

                          <span className="shrink-0">
                            {
                              truck.eta
                            }
                          </span>
                        </div>

                        <div className="text-sm font-black text-slate-800 truncate">
                          {
                            truck
                              .licensePlate
                          }
                        </div>
                      </div>

                      <div
                        className={[
                          'shrink-0',
                          'p-1.5',
                          'rounded-full',
                          'border',
                          'transition-colors',
                          'flex',
                          'items-center',
                          'justify-center',
                          calledTrucks[
                            truck.id
                          ]
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-400 border-slate-200',
                        ].join(' ')}
                      >
                        <Phone
                          size={14}
                        />
                      </div>
                    </motion.div>
                  )
                )}
              </AnimatePresence>

              {remainingQueue >
              0 ? (
                <p className="text-center text-[10px] font-bold text-slate-400 py-1">
                  +
                  {
                    remainingQueue
                  }{' '}
                  more vehicles...
                </p>
              ) : null}
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
              layoutId={
                dock.currentTruck
                  .id
                  ? 'truck-' +
                    dock
                      .currentTruck
                      .id
                  : undefined
              }
              initial={{
                opacity: 0,
                y: -20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.9,
              }}
              key="active-truck"
              className={[
                'flex-1',
                'rounded-lg',
                'p-3',
                'flex',
                'flex-col',
                'relative',
                dock.status ===
                'delayed'
                  ? 'bg-rose-50 border-2 border-rose-200'
                  : 'bg-white border border-slate-200',
              ].join(' ')}
            >
              <div className="mb-1 flex justify-between items-start">
                <p
                  className={[
                    'text-xs',
                    'font-bold',
                    dock.status ===
                    'delayed'
                      ? 'text-rose-600'
                      : 'text-amber-600',
                  ].join(' ')}
                >
                  Route:{' '}
                  {
                    dock
                      .currentTruck
                      .route
                  }
                </p>

                {dock.status ===
                  'delayed' && (
                  <span className="bg-rose-100 text-rose-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-rose-200">
                    EXCEEDED
                  </span>
                )}
              </div>

              <h2
                className={[
                  'text-2xl',
                  'font-black',
                  'leading-none',
                  dock.status ===
                  'delayed'
                    ? 'text-rose-800'
                    : 'text-slate-800',
                ].join(' ')}
              >
                {
                  dock
                    .currentTruck
                    .licensePlate
                }
              </h2>

              <div className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Driver
                  </span>

                  <span className="font-bold text-slate-700 truncate max-w-[100px]">
                    {
                      dock
                        .currentTruck
                        .driver
                    }
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400">
                    Transport
                  </span>

                  <span className="font-bold text-slate-700 truncate max-w-[100px]">
                    {
                      dock
                        .currentTruck
                        .transportCo
                    }
                  </span>
                </div>

                <div
                  className={[
                    'flex',
                    'justify-between',
                    'border-t',
                    'pt-1',
                    dock.status ===
                    'delayed'
                      ? 'border-rose-200'
                      : 'border-slate-100',
                  ].join(' ')}
                >
                  <span className="text-slate-400">
                    Arrival
                  </span>

                  <span className="font-bold text-slate-700 uppercase">
                    {
                      dock
                        .currentTruck
                        .entryTime
                    }
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">
                    Duration
                  </span>

                  <span
                    className={[
                      'font-black',
                      'text-sm',
                      dock.status ===
                      'delayed'
                        ? 'text-rose-600'
                        : 'text-amber-600',
                    ].join(' ')}
                  >
                    {
                      dock
                        .currentTruck
                        .elapsedTime
                    }
                  </span>
                </div>
              </div>

              <div className="mt-auto pt-2">
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className={[
                      dock.status ===
                      'delayed'
                        ? 'bg-rose-500'
                        : 'bg-amber-500',
                      'h-full',
                      'transition-all',
                      'duration-500',
                    ].join(' ')}
                    style={{
                      width:
                        dock
                          .currentTruck
                          .progress +
                        '%',
                    }}
                  />
                </div>

                <p
                  className={[
                    'text-right',
                    'text-[10px]',
                    'font-bold',
                    'mt-1',
                    'uppercase',
                    dock.status ===
                    'delayed'
                      ? 'text-rose-600'
                      : 'text-amber-600',
                  ].join(' ')}
                >
                  {
                    dock
                      .currentTruck
                      .progress
                  }
                  % Progress
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
              className="flex-1 border border-slate-200 rounded-lg p-3 flex flex-col bg-white opacity-60"
            >
              <p className="text-lg font-black text-slate-300 flex items-center justify-center h-full">
                IDLE
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-2 border-t border-slate-200 shrink-0 bg-white">
        <button
          onClick={onFinish}
          disabled={
            !dock.currentTruck
          }
          className={[
            'w-full',
            'py-2',
            'rounded-lg',
            'font-bold',
            'text-[12px]',
            'uppercase',
            'shadow-sm',
            'flex',
            'items-center',
            'justify-center',
            'gap-1.5',
            'transition-colors',
            dock.currentTruck
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-slate-100 text-slate-400',
          ].join(' ')}
        >
          <CheckCircle2
            size={18}
          />

          ลงงานเรียบร้อย
        </button>
      </div>

      {mounted &&
        selectedTruck &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
              <div className="bg-blue-600 p-3 flex justify-between items-center text-white">
                <h3 className="font-bold text-lg">
                  รายละเอียดรถ
                </h3>

                <button
                  onClick={
                    closeTruckDetails
                  }
                  className="hover:bg-blue-700 p-1 rounded transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="text-center">
                  <div className="text-4xl font-black text-slate-800 tracking-tight">
                    {
                      selectedTruck
                        .licensePlate
                    }
                  </div>

                  <div className="text-blue-600 font-bold text-sm mt-1 uppercase">
                    ทะเบียนรถ
                  </div>
                </div>

                <div className="space-y-3 text-sm mt-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-medium">
                      เส้นทาง
                      (Route)
                    </span>

                    <span className="font-bold text-slate-800">
                      {
                        selectedTruck
                          .route
                      }
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-medium">
                      เวลาลงงาน
                      (ETA)
                    </span>

                    <span className="font-bold text-slate-800">
                      {
                        selectedTruck
                          .eta
                      }
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-slate-200 pb-2 gap-3">
                    <span className="text-slate-500 font-medium shrink-0">
                      ชื่อคนขับ
                    </span>

                    <span className="font-bold text-slate-800 text-right">
                      {
                        selectedDriverName
                      }
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-1 gap-3">
                    <span className="text-slate-500 font-medium shrink-0">
                      เบอร์โทร
                    </span>

                    <div className="flex items-center gap-2 font-bold text-blue-600 text-right">
                      <Phone
                        size={14}
                      />

                      <span>
                        {
                          selectedDriverPhone
                        }
                      </span>
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {showOccupiedAlert && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        height: 0,
                      }}
                      animate={{
                        opacity: 1,
                        height: 'auto',
                      }}
                      exit={{
                        opacity: 0,
                        height: 0,
                      }}
                      className="overflow-hidden"
                    >
                      <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-lg flex items-center gap-2 mt-4 text-sm font-bold">
                        <AlertCircle
                          size={18}
                          className="shrink-0"
                        />

                        ช่องลงงานไม่ว่าง
                        กรุณากดลงงานเรียบร้อยก่อน
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  {calledTrucks[
                    selectedTruck.id
                  ] ? (
                    <>
                      <button
                        onClick={
                          handleCancelCall
                        }
                        className="w-full bg-rose-500 border-2 border-rose-500 text-white font-bold py-3 rounded-lg hover:bg-rose-600 hover:border-rose-600 transition-colors shadow-sm"
                      >
                        ยกเลิกยืนยันโทร
                      </button>

                      <button
                        onClick={
                          handleEnterSelectedTruck
                        }
                        className="w-full bg-blue-600 border-2 border-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 hover:border-blue-700 transition-colors shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <PlayCircle
                          size={18}
                        />

                        เข้าช่อง
                      </button>
                    </>
                  ) : (
                    <>
                      {selectedPhoneLink ? (
                        {
                          <Phone
                            size={18}
                          />

                          โทรออก
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="w-full bg-slate-100 border-2 border-slate-200 text-slate-400 font-bold py-3 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <Phone
                            size={18}
                          />

                          ไม่มีเบอร์โทร
                        </button>
                      )}

                      <button
                        onClick={
                          handleConfirmCall
                        }
                        className="w-full bg-blue-600 border-2 border-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 hover:border-blue-700 transition-colors shadow-sm"
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
  );
}
