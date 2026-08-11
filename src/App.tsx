import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Header from './components/Header';
import DockColumn from './components/DockColumn';
import Login from './components/Login';
import { mockDocks, mockKPIs } from './data';
import { DockData } from './types';

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
  durationMinutes: number | string;
  status: SmartDockStatus;
};

type SmartDockResult = {
  success: boolean;
  date: string;
  rowCount: number;
  excludedRowCount: number;
  rows: SmartDockPlan[];
  timestamp: string;
};

type SmartDockResponse = {
  success: boolean;
  status?: string;
  action?: string;
  result?: SmartDockResult;
  error?: string;
};

const API_BASE_URL = String(
  import.meta.env.VITE_API_URL || ''
).replace(/\/+$/, '');

const DOCK_INDEX_BY_CODE: Record<string, number> = {
  'L1-1': 0,
  'L1-2': 1,
  'L1-3': 2,
  'L2-4': 3,
  'L2-5': 4,
  'L2-6': 5,
};

const DOCK_CODE_BY_INDEX = [
  'L1-1',
  'L1-2',
  'L1-3',
  'L2-4',
  'L2-5',
  'L2-6',
];

function getBangkokDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getApiUrl(path: string): string {
  if (!API_BASE_URL) {
    return path;
  }

  return API_BASE_URL + path;
}

function parseApiTime(value: string): number {
  if (!value) {
    return Date.now();
  }

  const normalizedValue = value.replace(
    ' ',
    'T'
  );

  const parsedTime = new Date(
    normalizedValue
  ).getTime();

  if (Number.isNaN(parsedTime)) {
    return Date.now();
  }

  return parsedTime;
}

function formatTimeOnly(value: string): string {
  if (!value) {
    return '';
  }

  if (/^\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  const parsedDate = new Date(
    value.replace(' ', 'T')
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleTimeString(
    'th-TH',
    {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }
  );
}

function createEmptyDocks(): DockData[] {
  return mockDocks.map((dock) => ({
    ...dock,
    status: 'empty',
    currentTruck: null,
    waitingQueue: [],
  }));
}

function calculateElapsedTime(
  startTime: number
): {
  elapsedTime: string;
  elapsedMinutes: number;
  progress: number;
} {
  const elapsedMilliseconds = Math.max(
    0,
    Date.now() - startTime
  );

  const elapsedSeconds = Math.floor(
    elapsedMilliseconds / 1000
  );

  const elapsedMinutes = Math.floor(
    elapsedSeconds / 60
  );

  const elapsedHours = Math.floor(
    elapsedMinutes / 60
  );

  const displayMinutes =
    elapsedMinutes % 60;

  const displaySeconds =
    elapsedSeconds % 60;

  const elapsedTime = [
    elapsedHours,
    displayMinutes,
    displaySeconds,
  ]
    .map((value) =>
      String(value).padStart(2, '0')
    )
    .join(':');

  const progress = Math.min(
    100,
    Math.floor(
      elapsedMinutes / 40 * 100
    )
  );

  return {
    elapsedTime,
    elapsedMinutes,
    progress,
  };
}

function convertPlansToDocks(
  plans: SmartDockPlan[]
): DockData[] {
  const nextDocks = createEmptyDocks();

  plans.forEach((plan) => {
    const dockIndex =
      DOCK_INDEX_BY_CODE[plan.dock];

    if (
      dockIndex === undefined ||
      !nextDocks[dockIndex]
    ) {
      return;
    }

    if (plan.status === 'COMPLETED') {
      return;
    }

    const selectedDock =
      nextDocks[dockIndex];

    if (
      plan.status === 'IN_PROGRESS' &&
      !selectedDock.currentTruck
    ) {
      const startTime =
        parseApiTime(plan.timeIn);

      const elapsed =
        calculateElapsedTime(startTime);

      selectedDock.status =
        elapsed.elapsedMinutes >= 40
          ? 'delayed'
          : 'unloading';

      selectedDock.currentTruck = {
        id: plan.codeRun,
        route: plan.route,
        licensePlate:
          plan.truckName || '-',
        driver:
          plan.driverName || '-',
        transportCo:
          plan.company || '-',
        entryTime:
          formatTimeOnly(plan.timeIn),
        elapsedTime:
          elapsed.elapsedTime,
        progress:
          elapsed.progress,
        startTime,
      };

      return;
    }

    selectedDock.waitingQueue.push({
      id: plan.codeRun,
      route: plan.route,
      licensePlate:
        plan.truckName || '-',
      eta: plan.planEta || '',
      isMoved: false,
      driver:
        plan.driverName || '',
      telDriver:
        plan.telDriver || '',
      company:
        plan.company || '',
      project:
        plan.project || '',
      dockCode:
        plan.dock,
    } as never);
  });

  nextDocks.forEach((dock) => {
    dock.waitingQueue.sort(
      (firstTruck, secondTruck) =>
        firstTruck.eta.localeCompare(
          secondTruck.eta
        )
    );
  });

  return nextDocks;
}

export default function App() {
  const [
    isAuthenticated,
    setIsAuthenticated,
  ] = useState(false);

  const [time, setTime] = useState(
    new Date()
  );

  const [docks, setDocks] = useState<
    DockData[]
  >(createEmptyDocks);

  const [plans, setPlans] = useState<
    SmartDockPlan[]
  >([]);

  const [isLoading, setIsLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

  const [lastSync, setLastSync] =
    useState<Date | null>(null);

  const [
    processingCodeRun,
    setProcessingCodeRun,
  ] = useState('');

  const selectedDate = useMemo(
    () => getBangkokDate(),
    []
  );

  const fetchDockData =
    useCallback(async () => {
      if (!isAuthenticated) {
        return;
      }

      setIsLoading(true);
      setErrorMessage('');

      try {
        const url = getApiUrl(
          '/api/docks?date=' +
            encodeURIComponent(
              selectedDate
            )
        );

        const response = await fetch(
          url,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
          }
        );

        const data =
          await response.json() as SmartDockResponse;

        if (!response.ok) {
          throw new Error(
            data.error ||
              'ไม่สามารถดึงข้อมูลแผนงานได้'
          );
        }

        if (!data.success) {
          throw new Error(
            data.error ||
              'API ส่งผลลัพธ์ไม่สำเร็จ'
          );
        }

        const rows =
          data.result?.rows || [];

        const allowedRows =
          rows.filter(
            (row) =>
              DOCK_INDEX_BY_CODE[
                row.dock
              ] !== undefined
          );

        setPlans(allowedRows);

        setDocks(
          convertPlansToDocks(
            allowedRows
          )
        );

        setLastSync(new Date());
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'เกิดข้อผิดพลาดในการดึงข้อมูล';

        console.error(
          'Fetch Smart Dock data error:',
          error
        );

        setErrorMessage(message);
      } finally {
        setIsLoading(false);
      }
    }, [
      isAuthenticated,
      selectedDate,
    ]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    fetchDockData();

    const refreshTimer = setInterval(
      fetchDockData,
      30000
    );

    return () => {
      clearInterval(refreshTimer);
    };
  }, [
    fetchDockData,
    isAuthenticated,
  ]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const clockTimer = setInterval(() => {
      setTime(new Date());

      setDocks((previousDocks) =>
        previousDocks.map((dock) => {
          if (
            !dock.currentTruck ||
            !dock.currentTruck.startTime
          ) {
            return dock;
          }

          const elapsed =
            calculateElapsedTime(
              dock.currentTruck.startTime
            );

          return {
            ...dock,
            status:
              elapsed.elapsedMinutes >= 40
                ? 'delayed'
                : dock.status,
            currentTruck: {
              ...dock.currentTruck,
              elapsedTime:
                elapsed.elapsedTime,
              progress:
                elapsed.progress,
            },
          };
        })
      );
    }, 1000);

    return () => {
      clearInterval(clockTimer);
    };
  }, [isAuthenticated]);

  const handleFinishOperation =
    async (dockId: string) => {
      const selectedDock =
        docks.find(
          (dock) => dock.id === dockId
        );

      const currentTruck =
        selectedDock?.currentTruck;

      if (!currentTruck) {
        return;
      }

      if (processingCodeRun) {
        return;
      }

      setProcessingCodeRun(
        currentTruck.id
      );

      setErrorMessage('');

      try {
        const response = await fetch(
          getApiUrl(
            '/api/smart-dock/complete'
          ),
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              codeRun:
                currentTruck.id,
            }),
          }
        );

        const data =
          await response.json() as SmartDockResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              'ไม่สามารถจบงานได้'
          );
        }

        await fetchDockData();
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'เกิดข้อผิดพลาดในการจบงาน';

        console.error(
          'Complete Smart Dock error:',
          error
        );

        setErrorMessage(message);
      } finally {
        setProcessingCodeRun('');
      }
    };

  const handleEnterDock =
    async (
      dockId: string,
      truckId: string
    ) => {
      const dockIndex =
        docks.findIndex(
          (dock) => dock.id === dockId
        );

      if (dockIndex < 0) {
        return;
      }

      const selectedDock =
        docks[dockIndex];

      if (selectedDock.currentTruck) {
        setErrorMessage(
          'Dock นี้กำลังปฏิบัติงานอยู่'
        );

        return;
      }

      const selectedTruck =
        selectedDock.waitingQueue.find(
          (truck) =>
            truck.id === truckId
        );

      if (!selectedTruck) {
        setErrorMessage(
          'ไม่พบข้อมูลรถในคิว'
        );

        return;
      }

      if (processingCodeRun) {
        return;
      }

      const dockCode =
        DOCK_CODE_BY_INDEX[dockIndex];

      setProcessingCodeRun(truckId);
      setErrorMessage('');

      try {
        const response = await fetch(
          getApiUrl(
            '/api/smart-dock/start'
          ),
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              codeRun: truckId,
              dock: dockCode,
            }),
          }
        );

        const data =
          await response.json() as SmartDockResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              'ไม่สามารถเริ่มงานได้'
          );
        }

        await fetchDockData();
      } catch (error: unknown) {
        const message =
          error instanceof Error
            ? error.message
            : 'เกิดข้อผิดพลาดในการเริ่มงาน';

        console.error(
          'Start Smart Dock error:',
          error
        );

        setErrorMessage(message);
      } finally {
        setProcessingCodeRun('');
      }
    };

  const handleDragStart = (
    event: React.DragEvent,
    truckId: string,
    sourceDockId: string
  ) => {
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        truckId,
        sourceDockId,
      })
    );
  };

  const handleDrop = (
    event: React.DragEvent,
    targetDockId: string
  ) => {
    event.preventDefault();

    try {
      const transferredData =
        event.dataTransfer.getData(
          'application/json'
        );

      if (!transferredData) {
        return;
      }

      const parsedData = JSON.parse(
        transferredData
      ) as {
        truckId: string;
        sourceDockId: string;
      };

      const {
        truckId,
        sourceDockId,
      } = parsedData;

      if (
        sourceDockId === targetDockId
      ) {
        return;
      }

      setDocks((previousDocks) => {
        const nextDocks =
          previousDocks.map(
            (dock) => ({
              ...dock,
              waitingQueue: [
                ...dock.waitingQueue,
              ],
            })
          );

        const sourceDockIndex =
          nextDocks.findIndex(
            (dock) =>
              dock.id ===
              sourceDockId
          );

        const targetDockIndex =
          nextDocks.findIndex(
            (dock) =>
              dock.id ===
              targetDockId
          );

        if (
          sourceDockIndex < 0 ||
          targetDockIndex < 0
        ) {
          return previousDocks;
        }

        const sourceDock =
          nextDocks[
            sourceDockIndex
          ];

        const targetDock =
          nextDocks[
            targetDockIndex
          ];

        const truckIndex =
          sourceDock.waitingQueue.findIndex(
            (truck) =>
              truck.id === truckId
          );

        if (truckIndex < 0) {
          return previousDocks;
        }

        const movedTrucks =
          sourceDock.waitingQueue.splice(
            truckIndex,
            1
          );

        const movedTruck =
          movedTrucks[0];

        targetDock.waitingQueue.push({
          ...movedTruck,
          isMoved: true,
        });

        targetDock.waitingQueue.sort(
          (
            firstTruck,
            secondTruck
          ) =>
            firstTruck.eta.localeCompare(
              secondTruck.eta
            )
        );

        return nextDocks;
      });
    } catch (error: unknown) {
      console.error(
        'Move queue error:',
        error
      );

      setErrorMessage(
        'ไม่สามารถย้ายคิวรถได้'
      );
    }
  };

  const handleDragOver = (
    event: React.DragEvent
  ) => {
    event.preventDefault();
  };

  const totalTrucks =
    plans.filter(
      (plan) =>
        plan.status !== 'COMPLETED'
    ).length;

  const waitingTrucks =
    plans.filter(
      (plan) =>
        plan.status === 'WAITING'
    ).length;

  const inboundTrucks =
    plans.filter(
      (plan) =>
        plan.status !== 'COMPLETED' &&
        plan.project
          .toLowerCase()
          .includes('inb')
    ).length;

  const activeDocks =
    docks.filter(
      (dock) =>
        dock.currentTruck !== null
    ).length;

  const idleDocks =
    docks.length - activeDocks;

  const delayedDocks =
    docks.filter(
      (dock) =>
        dock.status === 'delayed'
    ).length;

  const utilization =
    docks.length > 0
      ? Math.round(
          activeDocks /
            docks.length *
            100
        )
      : 0;

  const liveKPIs = {
    ...mockKPIs,
    totalTrucks,
    waiting: waitingTrucks,
    inbound: inboundTrucks,
    idle: idleDocks,
    idleDocks,
    delayed: delayedDocks,
    utilization,
    dockUtilization: utilization,
  };

  if (!isAuthenticated) {
    return (
      <Login
        onLogin={() =>
          setIsAuthenticated(true)
        }
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden border-8 border-slate-200">
      <Header
        time={time}
        kpiData={liveKPIs}
      />

      {errorMessage && (
        <div className="bg-red-600 text-white text-sm font-bold px-4 py-2 text-center">
          {errorMessage}
        </div>
      )}

      {isLoading && !lastSync && (
        <div className="bg-blue-600 text-white text-sm font-bold px-4 py-2 text-center">
          กำลังโหลดข้อมูลแผนงาน
        </div>
      )}

      <main className="flex-1 grid grid-cols-6 divide-x divide-slate-300 bg-slate-200 overflow-hidden">
        {docks.map((dock) => (
          <DockColumn
            key={dock.id}
            dock={dock}
            time={time}
            onFinish={() =>
              handleFinishOperation(
                dock.id
              )
            }
            onEnterDock={(truckId) =>
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
            onDrop={(event) =>
              handleDrop(
                event,
                dock.id
              )
            }
            onDragOver={
              handleDragOver
            }
          />
        ))}
      </main>

      <footer className="h-8 bg-slate-800 text-slate-400 flex items-center justify-between px-6 text-[10px] font-bold uppercase tracking-widest shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className={
                'w-2 h-2 rounded-full ' +
                (errorMessage
                  ? 'bg-red-500'
                  : 'bg-emerald-500')
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
              ? lastSync.toLocaleTimeString(
                  'th-TH',
                  {
                    hour: '2-digit',
                    minute:
                      '2-digit',
                    second:
                      '2-digit',
                    hour12: false,
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
