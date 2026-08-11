import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Header from './components/Header';
import DockColumn from './components/DockColumn';
import Login from './components/Login';
import { mockDocks } from './data';
import {
  DockData,
  KPIData,
  WaitingTruck,
} from './types';

type SmartDockStatus =
  | 'WAITING'
  | 'IN_PROGRESS'
  | 'COMPLETED';

type SmartDockPlan = {
  sheetRow: number;
  codeRun: string;
  date: string;
  route: string;
  company: string;
  truckName: string;
  truckType: string;
  driverName: string;
  telDriver: string;
  project: string;
  dock: string;
  dockName: string;
  planEta: string;
  planEtd: string;
  remark: string;
  timeIn: string;
  timeOut: string;
  durationMinutes:
    | number
    | string;
  status: SmartDockStatus;
};

type SmartDockResponse = {
  success: boolean;
  result?: {
    rows?: SmartDockPlan[];
  };
  error?: string;
};

const API_BASE_URL = String(
  import.meta.env
    .VITE_API_URL || ''
).replace(/\/+$/, '');

const DOCK_CODES = [
  'L1-1',
  'L1-2',
  'L1-3',
  'L2-4',
  'L2-5',
  'L2-6',
];

const DOCK_INDEX_BY_CODE:
  Record<string, number> =
    Object.fromEntries(
      DOCK_CODES.map(
        (code, index) => [
          code,
          index,
        ]
      )
    );

function getBangkokDate(): string {
  return new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone:
        'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).format(new Date());
}

function getApiUrl(
  path: string
): string {
  if (!API_BASE_URL) {
    return path;
  }

  return API_BASE_URL + path;
}

function parseApiTime(
  value: string
): number {
  if (!value) {
    return Date.now();
  }

  const parsed =
    new Date(
      value.replace(' ', 'T')
    ).getTime();

  if (Number.isNaN(parsed)) {
    return Date.now();
  }

  return parsed;
}

function formatClock(
  value: string
): string {
  if (!value) {
    return '';
  }

  if (
    /^\d{2}:\d{2}$/.test(
      value
    )
  ) {
    return value;
  }

  const parsed =
    new Date(
      value.replace(' ', 'T')
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return value;
  }

  return parsed
    .toLocaleTimeString(
      'th-TH',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }
    );
}

function elapsedFrom(
  startTime: number
) {
  const totalSeconds =
    Math.floor(
      Math.max(
        0,
        Date.now() -
          startTime
      ) / 1000
    );

  const elapsedMinutes =
    Math.floor(
      totalSeconds / 60
    );

  const hours =
    Math.floor(
      elapsedMinutes / 60
    );

  const minutes =
    elapsedMinutes % 60;

  const seconds =
    totalSeconds % 60;

  return {
    elapsedMinutes,
    elapsedTime: [
      hours,
      minutes,
      seconds,
    ]
      .map((value) =>
        String(value)
          .padStart(2, '0')
      )
      .join(':'),
    progress: Math.min(
      100,
      Math.floor(
        elapsedMinutes / 0.4
      )
    ),
  };
}

function createEmptyDocks():
  DockData[] {
  return mockDocks.map(
    (dock) => ({
      ...dock,
      status: 'empty',
      currentTruck: null,
      waitingQueue: [],
    })
  );
}

function planToWaitingTruck(
  plan: SmartDockPlan
): WaitingTruck {
  return {
    id: plan.codeRun,
    route:
      plan.route || '-',
    licensePlate:
      plan.truckName || '-',
    eta:
      plan.planEta || '',
    driverName:
      plan.driverName || '',
    telDriver:
      plan.telDriver || '',
    company:
      plan.company || '',
    project:
      plan.project || '',
    dockCode:
      plan.dock,
    isMoved: false,
  };
}

function convertPlansToDocks(
  plans: SmartDockPlan[]
): DockData[] {
  const nextDocks =
    createEmptyDocks();

  plans.forEach((plan) => {
    const dockIndex =
      DOCK_INDEX_BY_CODE[
        plan.dock
      ];

    if (
      dockIndex ===
        undefined ||
      plan.status ===
        'COMPLETED'
    ) {
      return;
    }

    const selectedDock =
      nextDocks[dockIndex];

    if (
      plan.status ===
        'IN_PROGRESS' &&
      !selectedDock
        .currentTruck
    ) {
      const startTime =
        parseApiTime(
          plan.timeIn
        );

      const elapsed =
        elapsedFrom(
          startTime
        );

      selectedDock.status =
        elapsed
          .elapsedMinutes >= 40
          ? 'delayed'
          : 'unloading';

      selectedDock
        .currentTruck = {
        id: plan.codeRun,
        route:
          plan.route || '-',
        licensePlate:
          plan.truckName ||
          '-',
        driver:
          plan.driverName ||
          'ไม่มีข้อมูล',
        telDriver:
          plan.telDriver || '',
        transportCo:
          plan.company ||
          'ไม่มีข้อมูล',
        entryTime:
          formatClock(
            plan.timeIn
          ),
        elapsedTime:
          elapsed.elapsedTime,
        progress:
          elapsed.progress,
        startTime,
      };

      return;
    }

    selectedDock
      .waitingQueue.push(
        planToWaitingTruck(
          plan
        )
      );
  });

  nextDocks.forEach(
    (dock) => {
      dock.waitingQueue.sort(
        (
          firstTruck,
          secondTruck
        ) =>
          firstTruck.eta
            .localeCompare(
              secondTruck.eta
            )
      );
    }
  );

  return nextDocks;
}

function cloneDocks(
  docks: DockData[]
): DockData[] {
  return docks.map(
    (dock) => ({
      ...dock,
      currentTruck:
        dock.currentTruck
          ? {
              ...dock
                .currentTruck,
            }
          : null,
      waitingQueue:
        dock.waitingQueue
          .map((truck) => ({
            ...truck,
          })),
    })
  );
}

export default function App() {
  const [
    isAuthenticated,
    setIsAuthenticated,
  ] = useState(false);

  const [
    time,
    setTime,
  ] = useState(
    new Date()
  );

  const [
    docks,
    setDocks,
  ] = useState<
    DockData[]
  >(createEmptyDocks);

  const [
    plans,
    setPlans,
  ] = useState<
    SmartDockPlan[]
  >([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    lastSync,
    setLastSync,
  ] = useState<
    Date | null
  >(null);

  const pendingRef =
    useRef(
      new Set<string>()
    );

  const selectedDate =
    useMemo(
      () =>
        getBangkokDate(),
      []
    );

  const fetchDockData =
    useCallback(
      async (
        force = false
      ) => {
        if (
          !isAuthenticated
        ) {
          return;
        }

        if (
          !force &&
          pendingRef
            .current
            .size > 0
        ) {
          return;
        }

        setIsLoading(true);

        try {
          const response =
            await fetch(
              getApiUrl(
                '/api/docks?date=' +
                  encodeURIComponent(
                    selectedDate
                  )
              ),
              {
                headers: {
                  Accept:
                    'application/json',
                },
              }
            );

          const data =
            await response
              .json() as
              SmartDockResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.error ||
                'ไม่สามารถดึงข้อมูลแผนงานได้'
            );
          }

          const rows =
            (
              data.result
                ?.rows || []
            ).filter(
              (row) =>
                DOCK_INDEX_BY_CODE[
                  row.dock
                ] !==
                undefined
            );

          setPlans(rows);

          setDocks(
            convertPlansToDocks(
              rows
            )
          );

          setLastSync(
            new Date()
          );

          setErrorMessage('');
        } catch (
          error: unknown
        ) {
          const message =
            error instanceof
            Error
              ? error.message
              : 'เกิดข้อผิดพลาดในการดึงข้อมูล';

          console.error(
            'Fetch Smart Dock data error:',
            error
          );

          setErrorMessage(
            message
          );
        } finally {
          setIsLoading(false);
        }
      },
      [
        isAuthenticated,
        selectedDate,
      ]
    );

  useEffect(() => {
    if (
      !isAuthenticated
    ) {
      return;
    }

    fetchDockData();

    const refreshTimer =
      setInterval(
        () =>
          fetchDockData(),
        30000
      );

    return () =>
      clearInterval(
        refreshTimer
      );
  }, [
    fetchDockData,
    isAuthenticated,
  ]);

  useEffect(() => {
    if (
      !isAuthenticated
    ) {
      return;
    }

    const clockTimer =
      setInterval(() => {
        setTime(
          new Date()
        );

        setDocks(
          (previous) =>
            previous.map(
              (dock) => {
                if (
                  !dock
                    .currentTruck
                ) {
                  return dock;
                }

                const elapsed =
                  elapsedFrom(
                    dock
                      .currentTruck
                      .startTime
                  );

                return {
                  ...dock,
                  status:
                    elapsed
                      .elapsedMinutes >=
                    40
                      ? 'delayed'
                      : 'unloading',
                  currentTruck: {
                    ...dock
                      .currentTruck,
                    elapsedTime:
                      elapsed
                        .elapsedTime,
                    progress:
                      elapsed
                        .progress,
                  },
                };
              }
            )
        );
      }, 1000);

    return () =>
      clearInterval(
        clockTimer
      );
  }, [isAuthenticated]);

  const handleEnterDock =
    async (
      dockId: string,
      truckId: string
    ) => {
      const dockIndex =
        docks.findIndex(
          (dock) =>
            dock.id === dockId
        );

      if (
        dockIndex < 0 ||
        pendingRef
          .current
          .has(truckId)
      ) {
        return;
      }

      const selectedDock =
        docks[dockIndex];

      if (
        selectedDock
          .currentTruck
      ) {
        setErrorMessage(
          'Dock นี้กำลังปฏิบัติงานอยู่'
        );

        return;
      }

      const selectedTruck =
        selectedDock
          .waitingQueue
          .find(
            (truck) =>
              truck.id ===
              truckId
          );

      if (!selectedTruck) {
        return;
      }

      const backup =
        cloneDocks(docks);

      const startTime =
        Date.now();

      pendingRef
        .current
        .add(truckId);

      setErrorMessage('');

      setDocks(
        (previous) =>
          previous.map(
            (dock) => {
              if (
                dock.id !==
                dockId
              ) {
                return dock;
              }

              return {
                ...dock,
                status:
                  'unloading',
                currentTruck: {
                  id:
                    selectedTruck.id,
                  route:
                    selectedTruck.route,
                  licensePlate:
                    selectedTruck
                      .licensePlate,
                  driver:
                    selectedTruck
                      .driverName ||
                    'ไม่มีข้อมูล',
                  telDriver:
                    selectedTruck
                      .telDriver,
                  transportCo:
                    selectedTruck
                      .company ||
                    'ไม่มีข้อมูล',
                  entryTime:
                    new Date(
                      startTime
                    )
                      .toLocaleTimeString(
                        'th-TH',
                        {
                          hour:
                            '2-digit',
                          minute:
                            '2-digit',
                          hour12:
                            false,
                        }
                      ),
                  elapsedTime:
                    '00:00:00',
                  progress: 0,
                  startTime,
                },
                waitingQueue:
                  dock
                    .waitingQueue
                    .filter(
                      (truck) =>
                        truck.id !==
                        truckId
                    ),
              };
            }
          )
      );

      setPlans(
        (previous) =>
          previous.map(
            (plan) =>
              plan.codeRun ===
              truckId
                ? {
                    ...plan,
                    status:
                      'IN_PROGRESS',
                    timeIn:
                      new Date(
                        startTime
                      )
                        .toISOString(),
                  }
                : plan
          )
      );

      try {
        const response =
          await fetch(
            getApiUrl(
              '/api/smart-dock/start'
            ),
            {
              method: 'POST',
              headers: {
                Accept:
                  'application/json',
                'Content-Type':
                  'application/json',
              },
              body:
                JSON.stringify({
                  codeRun:
                    truckId,
                  dock:
                    DOCK_CODES[
                      dockIndex
                    ],
                }),
            }
          );

        const data =
          await response
            .json() as
            SmartDockResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              'ไม่สามารถเริ่มงานได้'
          );
        }

        setLastSync(
          new Date()
        );
      } catch (
        error: unknown
      ) {
        setDocks(backup);

        setPlans(
          (previous) =>
            previous.map(
              (plan) =>
                plan.codeRun ===
                truckId
                  ? {
                      ...plan,
                      status:
                        'WAITING',
                      timeIn: '',
                    }
                  : plan
            )
        );

        const message =
          error instanceof
          Error
            ? error.message
            : 'เกิดข้อผิดพลาดในการเริ่มงาน';

        setErrorMessage(
          message
        );
      } finally {
        pendingRef
          .current
          .delete(truckId);

        void fetchDockData(
          true
        );
      }
    };

  const handleFinishOperation =
    async (
      dockId: string
    ) => {
      const dockIndex =
        docks.findIndex(
          (dock) =>
            dock.id === dockId
        );

      if (dockIndex < 0) {
        return;
      }

      const currentTruck =
        docks[dockIndex]
          .currentTruck;

      if (
        !currentTruck ||
        pendingRef
          .current
          .has(
            currentTruck.id
          )
      ) {
        return;
      }

      const backup =
        cloneDocks(docks);

      pendingRef
        .current
        .add(
          currentTruck.id
        );

      setErrorMessage('');

      setDocks(
        (previous) =>
          previous.map(
            (dock) =>
              dock.id ===
              dockId
                ? {
                    ...dock,
                    status:
                      'empty',
                    currentTruck:
                      null,
                  }
                : dock
          )
      );

      setPlans(
        (previous) =>
          previous.map(
            (plan) =>
              plan.codeRun ===
              currentTruck.id
                ? {
                    ...plan,
                    status:
                      'COMPLETED',
                  }
                : plan
          )
      );

      try {
        const response =
          await fetch(
            getApiUrl(
              '/api/smart-dock/complete'
            ),
            {
              method: 'POST',
              headers: {
                Accept:
                  'application/json',
                'Content-Type':
                  'application/json',
              },
              body:
                JSON.stringify({
                  codeRun:
                    currentTruck.id,
                }),
            }
          );

        const data =
          await response
            .json() as
            SmartDockResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              'ไม่สามารถจบงานได้'
          );
        }

        setLastSync(
          new Date()
        );
      } catch (
        error: unknown
      ) {
        setDocks(backup);

        setPlans(
          (previous) =>
            previous.map(
              (plan) =>
                plan.codeRun ===
                currentTruck.id
                  ? {
                      ...plan,
                      status:
                        'IN_PROGRESS',
                    }
                  : plan
            )
        );

        const message =
          error instanceof
          Error
            ? error.message
            : 'เกิดข้อผิดพลาดในการจบงาน';

        setErrorMessage(
          message
        );
      } finally {
        pendingRef
          .current
          .delete(
            currentTruck.id
          );

        void fetchDockData(
          true
        );
      }
    };

  const handleDragStart = (
    event:
      React.DragEvent,
    truckId: string,
    sourceDockId: string
  ) => {
    event.dataTransfer
      .setData(
        'application/json',
        JSON.stringify({
          truckId,
          sourceDockId,
        })
      );
  };

  const handleDrop = (
    event:
      React.DragEvent,
    targetDockId: string
  ) => {
    event.preventDefault();

    try {
      const value =
        event.dataTransfer
          .getData(
            'application/json'
          );

      if (!value) {
        return;
      }

      const {
        truckId,
        sourceDockId,
      } = JSON.parse(
        value
      ) as {
        truckId: string;
        sourceDockId: string;
      };

      if (
        sourceDockId ===
        targetDockId
      ) {
        return;
      }

      setDocks(
        (previous) => {
          const next =
            cloneDocks(
              previous
            );

          const sourceIndex =
            next.findIndex(
              (dock) =>
                dock.id ===
                sourceDockId
            );

          const targetIndex =
            next.findIndex(
              (dock) =>
                dock.id ===
                targetDockId
            );

          if (
            sourceIndex < 0 ||
            targetIndex < 0
          ) {
            return previous;
          }

          const truckIndex =
            next[
              sourceIndex
            ].waitingQueue
              .findIndex(
                (truck) =>
                  truck.id ===
                  truckId
              );

          if (
            truckIndex < 0
          ) {
            return previous;
          }

          const moved =
            next[
              sourceIndex
            ].waitingQueue
              .splice(
                truckIndex,
                1
              )[0];

          next[
            targetIndex
          ].waitingQueue
            .push({
              ...moved,
              isMoved: true,
            });

          next[
            targetIndex
          ].waitingQueue
            .sort(
              (
                first,
                second
              ) =>
                first.eta
                  .localeCompare(
                    second.eta
                  )
            );

          return next;
        }
      );
    } catch (error) {
      console.error(
        'Move queue error:',
        error
      );

      setErrorMessage(
        'ไม่สามารถย้ายคิวรถได้'
      );
    }
  };

  const activeDocks =
    docks.filter(
      (dock) =>
        dock.currentTruck !==
        null
    ).length;

  const kpiData:
    KPIData = {
    totalTrucks:
      plans.filter(
        (plan) =>
          plan.status !==
          'COMPLETED'
      ).length,
    waitingTrucks:
      plans.filter(
        (plan) =>
          plan.status ===
          'WAITING'
      ).length,
    activeDocks,
    emptyDocks:
      docks.length -
      activeDocks,
    delayedDocks:
      docks.filter(
        (dock) =>
          dock.status ===
          'delayed'
      ).length,
    utilization:
      docks.length > 0
        ? Math.round(
            activeDocks /
              docks.length /
              0.01
          )
        : 0,
  };

  if (!isAuthenticated) {
    return (
      <Login
        onLogin={() =>
          setIsAuthenticated(
            true
          )
        }
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden border-8 border-slate-200">
      <Header
        time={time}
        kpiData={
          kpiData
        }
      />

      {errorMessage && (
        <div className="bg-red-600 text-white text-sm font-bold px-4 py-2 text-center">
          {errorMessage}
        </div>
      )}

      {isLoading &&
        !lastSync && (
          <div className="bg-blue-600 text-white text-sm font-bold px-4 py-2 text-center">
            กำลังโหลดข้อมูลแผนงาน
          </div>
        )}

      <main className="flex-1 grid grid-cols-6 divide-x divide-slate-300 bg-slate-200 overflow-hidden">
        {docks.map(
          (dock) => (
            <DockColumn
              key={
                dock.id
              }
              dock={dock}
              time={time}
              onFinish={() =>
                handleFinishOperation(
                  dock.id
                )
              }
              onEnterDock={(
                truckId
              ) =>
                handleEnterDock(
                  dock.id,
                  truckId
                )
              }
              onDragStart={(
                event,
                truckId
              ) =>
                handleDragStart(
                  event,
                  truckId,
                  dock.id
                )
              }
              onDrop={(
                event
              ) =>
                handleDrop(
                  event,
                  dock.id
                )
              }
              onDragOver={(
                event
              ) =>
                event
                  .preventDefault()
              }
            />
          )
        )}
      </main>

      <footer className="h-8 bg-slate-800 text-slate-400 flex items-center justify-between px-6 text-[10px] font-bold uppercase tracking-widest shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className={
                'w-2 h-2 rounded-full ' +
                (
                  errorMessage
                    ? 'bg-red-500'
                    : 'bg-emerald-500'
                )
              }
            />

            {errorMessage
              ? 'SYSTEM WARNING'
              : 'SYSTEM STABLE'}
          </span>

          <span className="text-slate-600">
            |
          </span>

          <span>
            LAST SYNC:{' '}
            {lastSync
              ? lastSync
                  .toLocaleTimeString(
                    'th-TH',
                    {
                      hour:
                        '2-digit',
                      minute:
                        '2-digit',
                      second:
                        '2-digit',
                      hour12:
                        false,
                    }
                  )
              : 'WAITING'}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <span>
            6 DOCKS ONLINE
          </span>

          <span>
            ZONE: A-WEST WAREHOUSE
          </span>
        </div>
      </footer>
    </div>
  );
}
