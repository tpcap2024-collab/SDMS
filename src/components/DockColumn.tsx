import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  CheckCircle2,
  Phone,
  PlayCircle,
  X,
} from 'lucide-react';
import {
  DockData,
  DockOperationStatus,
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

interface StatusConfig {
  container: string;
  header: string;
  badge: string;
  queueContainer: string;
  queueHeader: string;
  queueItem: string;
  queueText: string;
}

interface OperationBadgeConfig {
  container: string;
  indicator: string;
  text: string;
  showCheck: boolean;
  showAlert: boolean;
}

function getStatusConfig(
  status: DockStatus
): StatusConfig {
  if (
    status ===
    'unloading'
  ) {
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
      queueText:
        'text-yellow-600',
    };
  }

  if (
    status ===
    'delayed'
  ) {
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
      queueText:
        'text-slate-500',
    };
  }

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
    queueText:
      'text-emerald-500',
  };
}

function getOperationBadgeConfig(
  status: DockOperationStatus
): OperationBadgeConfig {
  if (
    status ===
    'saving'
  ) {
    return {
      container:
        'bg-blue-50 border-blue-200 text-blue-700',
      indicator:
        'bg-blue-500 animate-[pulse_1.5s_ease-in-out_infinite]',
      text:
        'กำลังบันทึก',
      showCheck:
        false,
      showAlert:
        false,
    };
  }

  if (
    status ===
    'confirming'
  ) {
    return {
      container:
        'bg-indigo-50 border-indigo-200 text-indigo-700',
      indicator:
        'bg-indigo-500 animate-[pulse_2s_ease-in-out_infinite]',
      text:
        'รอยืนยัน',
      showCheck:
        false,
      showAlert:
        false,
    };
  }

  if (
    status ===
    'success'
  ) {
    return {
      container:
        'bg-emerald-50 border-emerald-200 text-emerald-700',
      indicator:
        '',
      text:
        'บันทึกแล้ว',
      showCheck:
        true,
      showAlert:
        false,
    };
  }

  if (
    status ===
    'error'
  ) {
    return {
      container:
        'bg-rose-50 border-rose-200 text-rose-700',
      indicator:
        '',
      text:
        'บันทึกไม่สำเร็จ',
      showCheck:
        false,
      showAlert:
        true,
    };
  }

  return {
    container:
      '',
    indicator:
      '',
    text:
      '',
    showCheck:
      false,
    showAlert:
      false,
  };
}

function getDisplayText(
  value: string
): string {
  const cleaned =
    String(
      value || ''
    ).trim();

  return (
    cleaned ||
    'ไม่มีข้อมูล'
  );
}

function createPhoneLink(
  value: string
): string {
  const cleaned =
    String(
      value || ''
    ).replace(
      /[^0-9+]/g,
      ''
    );

  return cleaned
    ? 'tel:' + cleaned
    : '';
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
    WaitingTruck | null
  >(null);

  const [
    showOccupiedAlert,
    setShowOccupiedAlert,
  ] = useState(false);

  const config =
    getStatusConfig(
      dock.status
    );

  const operationStatus =
    dock.operationState
      ?.status ||
    'idle';

  const operationBadge =
    getOperationBadgeConfig(
      operationStatus
    );

  const showOperationBadge =
    operationStatus !==
    'idle';

  const isOperationBusy =
    operationStatus ===
      'saving' ||
    operationStatus ===
      'confirming';

  const displayQueue =
    dock.waitingQueue
      .slice(0, 5);

  const remainingQueue =
    Math.max(
      0,
      dock.waitingQueue
        .length - 5
    );

  const dockNumber =
    dock.name.replace(
      /\D/g,
      ''
    );

  const isOverdue = (
    eta: string
  ): boolean => {
    if (
      !time ||
      !eta
    ) {
      return false;
    }

    const parts =
      eta
        .split(':')
        .map(Number);

    if (
      parts.length < 2 ||
      parts.some(
        Number.isNaN
      )
    ) {
      return false;
    }

    const etaDate =
      new Date(time);

    etaDate.setHours(
      parts[0],
      parts[1],
      0,
      0
    );

    return (
      time.getTime() >
      etaDate.getTime()
    );
  };

  const getQueueStyle = (
    truck: WaitingTruck
  ): string => {
    if (
      truck.isMoved
    ) {
      return (
        'bg-[#ffff00] ' +
        'border-amber-400'
      );
    }

    if (
      isOverdue(
        truck.eta
      )
    ) {
      return (
        'bg-red-500/20 ' +
        'border-red-500 ' +
        'animate-[pulse_1s_ease-in-out_infinite]'
      );
    }

    return (
      'bg-white ' +
      config.queueItem
    );
  };

  const closeTruckDetails =
    () => {
      setSelectedTruck(
        null
      );

      setShowOccupiedAlert(
        false
      );
    };

  const enterSelectedTruck =
    () => {
      if (
        !selectedTruck ||
        isOperationBusy
      ) {
        return;
      }

      if (
        dock.currentTruck
      ) {
        setShowOccupiedAlert(
          true
        );

        return;
      }

      if (onEnterDock) {
        onEnterDock(
          selectedTruck.id
        );
      }

      closeTruckDetails();
    };

  const selectedPhoneLink =
    selectedTruck
      ? createPhoneLink(
          selectedTruck
            .telDriver
        )
      : '';

  const renderOperationBadge =
    () => {
      if (
        !showOperationBadge
      ) {
        return null;
      }

      return (
        <div className="absolute top-2 right-2 z-10">
          <div
            className={
              'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold shadow-sm ' +
              operationBadge
                .container
            }
          >
            {operationBadge
              .showCheck ? (
              <CheckCircle2
                size={12}
              />
            ) : operationBadge
                .showAlert ? (
              <AlertCircle
                size={12}
              />
            ) : (
              <span
                className={
                  'h-2 w-2 rounded-full shrink-0 ' +
                  operationBadge
                    .indicator
                }
              />
            )}

            <span>
              {dock
                .operationState
                ?.message ||
                operationBadge
                  .text}
            </span>
          </div>
        </div>
      );
    };

  return (
    <div
      className={
        'flex flex-col h-full overflow-hidden ' +
        config.container
      }
      onDrop={onDrop}
      onDragOver={
        onDragOver
      }
    >
      <div
        className={
          'relative p-3 flex flex-col items-center justify-center text-center ' +
          config.header
        }
      >
        <span className="font-black tracking-tighter uppercase flex items-baseline gap-1.5">
          <span className="text-2xl">
            DOCK
          </span>

          <span className="text-5xl leading-none">
            {dockNumber}
          </span>
        </span>

        <span className="text-base font-bold mt-1">
          {config.badge}
        </span>
      </div>

      <div className="flex-1 p-2 flex flex-col overflow-hidden">
        <div
          className={
            'rounded-lg p-2 border h-full flex flex-col ' +
            config
              .queueContainer
          }
        >
          <h3
            className={
              'text-[10px] font-bold uppercase mb-2 ' +
              config
                .queueHeader
            }
          >
            Waiting (
            {
              dock
                .waitingQueue
                .length
            }
            )
          </h3>

          {dock.waitingQueue
            .length > 0 ? (
            <div className="space-y-1.5 flex-1 overflow-y-auto">
              {displayQueue.map(
                (truck) => (
                  <div
                    draggable={
                      !isOperationBusy
                    }
                    onDragStart={(
                      event
                    ) => {
                      if (
                        !isOperationBusy &&
                        onDragStart
                      ) {
                        onDragStart(
                          event,
                          truck.id
                        );
                      }
                    }}
                    key={
                      truck.id
                    }
                    onClick={() => {
                      if (
                        isOperationBusy
                      ) {
                        return;
                      }

                      setSelectedTruck(
                        truck
                      );

                      setShowOccupiedAlert(
                        false
                      );
                    }}
                    className={
                      'p-2 border rounded shadow-sm flex justify-between items-center transition-colors gap-1.5 ' +
                      (
                        isOperationBusy
                          ? 'cursor-not-allowed opacity-60 '
                          : 'cursor-pointer hover:opacity-80 '
                      ) +
                      getQueueStyle(
                        truck
                      )
                    }
                  >
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <div
                        className={
                          'flex gap-1.5 text-[11px] font-bold truncate ' +
                          config
                            .queueText
                        }
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
                      className={
                        'shrink-0 p-1.5 rounded-full border flex items-center justify-center ' +
                        (
                          calledTrucks[
                            truck.id
                          ]
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-slate-50 text-slate-400 border-slate-200'
                        )
                      }
                    >
                      <Phone
                        size={14}
                      />
                    </div>
                  </div>
                )
              )}

              {remainingQueue >
                0 && (
                <p className="text-center text-[10px] font-bold text-slate-400 py-1">
                  +
                  {
                    remainingQueue
                  }{' '}
                  more vehicles...
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
        {dock.currentTruck ? (
          <div
            className={
              'flex-1 rounded-lg p-3 flex flex-col relative ' +
              (
                dock.status ===
                'delayed'
                  ? 'bg-rose-50 border-2 border-rose-200'
                  : 'bg-white border border-slate-200'
              )
            }
          >
            {renderOperationBadge()}

            <div className="mb-1 flex justify-between items-start gap-2">
              <p
                className={
                  'text-xs font-bold truncate ' +
                  (
                    dock.status ===
                    'delayed'
                      ? 'text-rose-600'
                      : 'text-amber-600'
                  )
                }
              >
                Route:{' '}
                {
                  dock
                    .currentTruck
                    .route
                }
              </p>

              {dock.status ===
                'delayed' &&
                !showOperationBadge && (
                <span className="bg-rose-100 text-rose-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-rose-200 shrink-0">
                  EXCEEDED
                </span>
              )}
            </div>

            <h2
              className={
                'text-2xl font-black leading-none text-slate-800 ' +
                (
                  showOperationBadge
                    ? 'pr-24'
                    : ''
                )
              }
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

              <div className="flex justify-between border-t border-slate-100 pt-1">
                <span className="text-slate-400">
                  Arrival
                </span>

                <span className="font-bold text-slate-700">
                  {
                    dock
                      .currentTruck
                      .entryTime
                  }
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">
                  Duration
                </span>

                <span className="font-black text-amber-600">
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
                  className={
                    (
                      dock.status ===
                      'delayed'
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                    ) +
                    ' h-full transition-all duration-500'
                  }
                  style={{
                    width:
                      dock
                        .currentTruck
                        .progress +
                      '%',
                  }}
                />
              </div>

              <p className="text-right text-[10px] font-bold mt-1 text-amber-600 uppercase">
                {
                  dock
                    .currentTruck
                    .progress
                }
                % Progress
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 border border-slate-200 rounded-lg p-3 flex flex-col bg-white opacity-60 relative">
            {renderOperationBadge()}

            <p className="text-lg font-black text-slate-300 flex items-center justify-center h-full">
              IDLE
            </p>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-slate-200 shrink-0 bg-white">
        <button
          type="button"
          onClick={
            onFinish
          }
          disabled={
            !dock.currentTruck ||
            isOperationBusy
          }
          className={
            'w-full py-2 rounded-lg font-bold text-[12px] uppercase shadow-sm flex items-center justify-center gap-1.5 transition-colors ' +
            (
              dock.currentTruck &&
              !isOperationBusy
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            )
          }
        >
          <CheckCircle2
            size={18}
          />

          {isOperationBusy
            ? 'กำลังดำเนินการ'
            : 'ลงงานเรียบร้อย'}
        </button>
      </div>

      {selectedTruck &&
        createPortal(
          <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200">
              <div className="bg-blue-600 p-3 flex justify-between items-center text-white">
                <h3 className="font-bold text-lg">
                  รายละเอียดรถ
                </h3>

                <button
                  type="button"
                  onClick={
                    closeTruckDetails
                  }
                  className="hover:bg-blue-700 p-1 rounded transition-colors"
                >
                  <X
                    size={20}
                  />
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
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2 gap-3">
                    <span className="text-slate-500 font-medium">
                      เส้นทาง
                    </span>

                    <span className="font-bold text-slate-800 text-right">
                      {
                        selectedTruck
                          .route
                      }
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-b border-slate-200 pb-2 gap-3">
                    <span className="text-slate-500 font-medium">
                      เวลาลงงาน
                    </span>

                    <span className="font-bold text-slate-800 text-right">
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
                      {getDisplayText(
                        selectedTruck
                          .driverName
                      )}
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
                        {getDisplayText(
                          selectedTruck
                            .telDriver
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {showOccupiedAlert && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-lg flex items-center gap-2 text-sm font-bold">
                    <AlertCircle
                      size={18}
                      className="shrink-0"
                    />

                    ช่องลงงานไม่ว่าง
                    กรุณากดลงงานเรียบร้อยก่อน
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mt-6">
                  {calledTrucks[
                    selectedTruck.id
                  ] ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setCalledTrucks(
                            (
                              previous
                            ) => ({
                              ...previous,
                              [
                                selectedTruck
                                  .id
                              ]:
                                false,
                            })
                          )
                        }
                        disabled={
                          isOperationBusy
                        }
                        className={
                          'w-full border-2 font-bold py-3 rounded-lg transition-colors shadow-sm ' +
                          (
                            isOperationBusy
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-rose-500 border-rose-500 text-white hover:bg-rose-600'
                          )
                        }
                      >
                        ยกเลิกยืนยันโทร
                      </button>

                      <button
                        type="button"
                        onClick={
                          enterSelectedTruck
                        }
                        disabled={
                          isOperationBusy
                        }
                        className={
                          'w-full border-2 font-bold py-3 rounded-lg transition-colors shadow-sm flex items-center justify-center gap-1.5 ' +
                          (
                            isOperationBusy
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                          )
                        }
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
                        type="button"
                        onClick={() =>
                          setCalledTrucks(
                            (
                              previous
                            ) => ({
                              ...previous,
                              [
                                selectedTruck
                                  .id
                              ]:
                                true,
                            })
                          )
                        }
                        disabled={
                          isOperationBusy
                        }
                        className={
                          'w-full border-2 font-bold py-3 rounded-lg transition-colors shadow-sm ' +
                          (
                            isOperationBusy
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                          )
                        }
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
