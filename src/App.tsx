import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import Header from './components/Header';
import DockColumn from './components/DockColumn';
import Login from './components/Login';
import { mockDocks } from './data';
import {
  DockData,
  DockOperationState,
  KPIData,
  PendingDockOperation,
  Truck,
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
  durationMinutes: number | string;
  status: SmartDockStatus;
};

type SmartDockResponse = {
  success: boolean;
  result?: {
    rows?: SmartDockPlan[];
  };
  error?: string;
};

type RuntimePendingOperation = PendingDockOperation & {
  phase: 'saving' | 'confirming' | 'error';
  optimisticTruck: Truck | null;
  lastCheckedAt: number;
  errorMessage: string;
};

type StoredSession = {
  expiresAt: number;
};

const API_BASE_URL = String(
  import.meta.env.VITE_API_URL || ''
).replace(/\/+$/, '');

const DOCK_CODES = [
  'L1-1',
  'L1-2',
  'L1-3',
  'L2-4',
  'L2-5',
  'L2-6',
];

const DOCK_INDEX_BY_CODE: Record<string, number> =
  Object.fromEntries(
    DOCK_CODES.map((code, index) => [code, index])
  );

const SESSION_STORAGE_KEY = 'sdms-session';
const SESSION_DURATION_MS = 43200000;
const CONFIRMATION_RETRY_MS = 3000;
const CONFIRMATION_TIMEOUT_MS = 60000;
const SUCCESS_BADGE_MS = 2500;

function getBangkokDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getApiUrl(path: string): string {
  return API_BASE_URL ? API_BASE_URL + path : path;
}

function readStoredSession(): boolean {
  try {
    const storedValue = localStorage.getItem(
      SESSION_STORAGE_KEY
    );

    if (!storedValue) {
      return false;
    }

    const session = JSON.parse(storedValue) as StoredSession;

    if (
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now()
    ) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return false;
    }

    return true;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return false;
  }
}

function saveSession(): void {
  const session: StoredSession = {
    expiresAt: Date.now() + SESSION_DURATION_MS,
  };

  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify(session)
  );
}

function parseApiTime(value: string): number {
  if (!value) {
    return Date.now();
  }

  const parsedTime = new Date(
    value.replace(' ', 'T')
  ).getTime();

  return Number.isNaN(parsedTime)
    ? Date.now()
    : parsedTime;
}

function formatTime(value: string): string {
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

  return parsedDate.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function calculateElapsed(startTime: number) {
  const elapsedSeconds = Math.floor(
    Math.max(0, Date.now() - startTime) / 1000
  );
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const elapsedHours = Math.floor(elapsedMinutes / 60);

  return {
    elapsedMinutes,
    elapsedTime: [
      elapsedHours,
      elapsedMinutes % 60,
      elapsedSeconds % 60,
    ]
      .map((value) => String(value).padStart(2, '0'))
      .join(':'),
    progress: Math.min(
      100,
      Math.floor(elapsedMinutes / 0.4)
    ),
  };
}

function createEmptyDocks(): DockData[] {
  return mockDocks.map((dock) => ({
    ...dock,
    status: 'empty',
    currentTruck: null,
    waitingQueue: [],
    operationState: undefined,
  }));
}

function createWaitingTruck(
  plan: SmartDockPlan
): WaitingTruck {
  return {
    id: plan.codeRun,
    route: plan.route || '-',
    licensePlate: plan.truckName || '-',
    eta: plan.planEta || '',
    driverName: plan.driverName || '',
    telDriver: plan.telDriver || '',
    company: plan.company || '',
    project: plan.project || '',
    dockCode: plan.dock,
    isMoved: false,
  };
}

function convertPlansToDocks(
  planRows: SmartDockPlan[]
): DockData[] {
  const nextDocks = createEmptyDocks();

  planRows.forEach((plan) => {
    const dockIndex = DOCK_INDEX_BY_CODE[plan.dock];

    if (
      dockIndex === undefined ||
      plan.status === 'COMPLETED'
    ) {
      return;
    }

    const dock = nextDocks[dockIndex];

    if (
      plan.status === 'IN_PROGRESS' &&
      !dock.currentTruck
    ) {
      const startTime = parseApiTime(plan.timeIn);
      const elapsed = calculateElapsed(startTime);

      dock.status =
        elapsed.elapsedMinutes >= 40
          ? 'delayed'
          : 'unloading';
      dock.currentTruck = {
        id: plan.codeRun,
        route: plan.route || '-',
        licensePlate: plan.truckName || '-',
        driver: plan.driverName || 'ไม่มีข้อมูล',
        telDriver: plan.telDriver || '',
        transportCo: plan.company || 'ไม่มีข้อมูล',
        entryTime: formatTime(plan.timeIn),
        elapsedTime: elapsed.elapsedTime,
        progress: elapsed.progress,
        startTime,
      };
      return;
    }

    dock.waitingQueue.push(createWaitingTruck(plan));
  });

  nextDocks.forEach((dock) => {
    dock.waitingQueue.sort((first, second) =>
      first.eta.localeCompare(second.eta)
    );
  });

  return nextDocks;
}

function cloneDocks(docks: DockData[]): DockData[] {
  return docks.map((dock) => ({
    ...dock,
    currentTruck: dock.currentTruck
      ? { ...dock.currentTruck }
      : null,
    waitingQueue: dock.waitingQueue.map((truck) => ({
      ...truck,
    })),
    operationState: dock.operationState
      ? { ...dock.operationState }
      : undefined,
  }));
}

function createOperationState(
  operation: RuntimePendingOperation
): DockOperationState {
  if (operation.phase === 'saving') {
    return {
      codeRun: operation.codeRun,
      operation: operation.operation,
      status: 'saving',
      message: 'กำลังบันทึก',
      startedAt: operation.createdAt,
    };
  }

  if (operation.phase === 'confirming') {
    return {
      codeRun: operation.codeRun,
      operation: operation.operation,
      status: 'confirming',
      message: 'รอยืนยัน',
      startedAt: operation.createdAt,
    };
  }

  return {
    codeRun: operation.codeRun,
    operation: operation.operation,
    status: 'error',
    message: operation.errorMessage || 'ยังยืนยันข้อมูลไม่ได้',
    startedAt: operation.createdAt,
  };
}

function isOperationConfirmed(
  operation: RuntimePendingOperation,
  rows: SmartDockPlan[]
): boolean {
  const serverPlan = rows.find(
    (row) => row.codeRun === operation.codeRun
  );

  if (!serverPlan) {
    return false;
  }

  if (operation.operation === 'START') {
    return (
      serverPlan.status === 'IN_PROGRESS' &&
      serverPlan.dock === operation.dockCode &&
      Boolean(serverPlan.timeIn)
    );
  }

  if (operation.operation === 'COMPLETE') {
    return (
      serverPlan.status === 'COMPLETED' &&
      Boolean(serverPlan.timeOut)
    );
  }

  return serverPlan.dock === operation.targetDockCode;
}

function mergePendingOperations(
  serverDocks: DockData[],
  pendingOperations: Map<string, RuntimePendingOperation>
): DockData[] {
  const mergedDocks = cloneDocks(serverDocks);

  pendingOperations.forEach((operation) => {
    mergedDocks.forEach((dock) => {
      dock.waitingQueue = dock.waitingQueue.filter(
        (truck) => truck.id !== operation.codeRun
      );

      if (
        dock.currentTruck?.id === operation.codeRun &&
        dock.id !== operation.dockId
      ) {
        dock.currentTruck = null;
        dock.status = 'empty';
      }
    });

    const targetDock = mergedDocks.find(
      (dock) => dock.id === operation.dockId
    );

    if (!targetDock) {
      return;
    }

    targetDock.operationState = createOperationState(operation);

    if (operation.operation === 'START') {
      if (operation.optimisticTruck) {
        const elapsed = calculateElapsed(
          operation.optimisticTruck.startTime
        );

        targetDock.currentTruck = {
          ...operation.optimisticTruck,
          elapsedTime: elapsed.elapsedTime,
          progress: elapsed.progress,
        };
        targetDock.status =
          elapsed.elapsedMinutes >= 40
            ? 'delayed'
            : 'unloading';
      }
      return;
    }

    if (operation.operation === 'COMPLETE') {
      targetDock.currentTruck = null;
      targetDock.status = 'empty';
      return;
    }

    if (operation.truck) {
      targetDock.waitingQueue.push({
        ...operation.truck,
        dockCode:
          operation.targetDockCode || operation.dockCode,
        isMoved: true,
      });
      targetDock.waitingQueue.sort((first, second) =>
        first.eta.localeCompare(second.eta)
      );
    }
  });

  return mergedDocks;
}

function updatePlanStatus(
  planRows: SmartDockPlan[],
  codeRun: string,
  status: SmartDockStatus,
  timestamp: string
): SmartDockPlan[] {
  return planRows.map((plan) => {
    if (plan.codeRun !== codeRun) {
      return plan;
    }

    if (status === 'IN_PROGRESS') {
      return {
        ...plan,
        status,
        timeIn: timestamp,
      };
    }

    return {
      ...plan,
      status,
      timeOut: timestamp,
    };
  });
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] =
    useState(readStoredSession);
  const [time, setTime] = useState(new Date());
  const [docks, setDocks] = useState<DockData[]>(
    createEmptyDocks
  );
  const [plans, setPlans] = useState<SmartDockPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    getBangkokDate
  );
  const [showReturnFullscreen, setShowReturnFullscreen] =
    useState(false);

  const docksRef = useRef<DockData[]>(createEmptyDocks());
  const plansRef = useRef<SmartDockPlan[]>([]);
  const pendingOperationsRef = useRef(
    new Map<string, RuntimePendingOperation>()
  );
  const requestSequenceRef = useRef(0);
  const isFetchingRef = useRef(false);
  const phoneWasFullscreenRef = useRef(false);
  const waitingForPhoneReturnRef = useRef(false);
  const confirmationTimerRef = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);
  const successTimersRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>()
  );

  const commitDocks = useCallback(
    (
      updater:
        | DockData[]
        | ((current: DockData[]) => DockData[])
    ) => {
      const nextDocks =
        typeof updater === 'function'
          ? updater(docksRef.current)
          : updater;

      docksRef.current = nextDocks;
      setDocks(nextDocks);
    },
    []
  );

  const commitPlans = useCallback(
    (
      updater:
        | SmartDockPlan[]
        | ((current: SmartDockPlan[]) => SmartDockPlan[])
    ) => {
      const nextPlans =
        typeof updater === 'function'
          ? updater(plansRef.current)
          : updater;

      plansRef.current = nextPlans;
      setPlans(nextPlans);
    },
    []
  );

  const clearSuccessTimer = useCallback((dockId: string) => {
    const timer = successTimersRef.current.get(dockId);

    if (timer) {
      clearTimeout(timer);
      successTimersRef.current.delete(dockId);
    }
  }, []);

  const showSuccessState = useCallback(
    (operation: RuntimePendingOperation) => {
      clearSuccessTimer(operation.dockId);

      commitDocks((currentDocks) =>
        currentDocks.map((dock) =>
          dock.id === operation.dockId
            ? {
                ...dock,
                operationState: {
                  codeRun: operation.codeRun,
                  operation: operation.operation,
                  status: 'success',
                  message: 'บันทึกแล้ว',
                  startedAt: Date.now(),
                },
              }
            : dock
        )
      );

      const timer = setTimeout(() => {
        commitDocks((currentDocks) =>
          currentDocks.map((dock) => {
            if (
              dock.id !== operation.dockId ||
              dock.operationState?.codeRun !== operation.codeRun ||
              dock.operationState.status !== 'success'
            ) {
              return dock;
            }

            return {
              ...dock,
              operationState: undefined,
            };
          })
        );
        successTimersRef.current.delete(operation.dockId);
      }, SUCCESS_BADGE_MS);

      successTimersRef.current.set(operation.dockId, timer);
    },
    [clearSuccessTimer, commitDocks]
  );

  const scheduleConfirmationCheck = useCallback(() => {
    if (confirmationTimerRef.current) {
      clearTimeout(confirmationTimerRef.current);
    }

    if (pendingOperationsRef.current.size === 0) {
      confirmationTimerRef.current = null;
      return;
    }

    confirmationTimerRef.current = setTimeout(() => {
      confirmationTimerRef.current = null;
      window.dispatchEvent(
        new CustomEvent('sdms-confirm-pending')
      );
    }, CONFIRMATION_RETRY_MS);
  }, []);

  const fetchDockData = useCallback(
    async (force = false) => {
      if (!isAuthenticated) {
        return;
      }

      if (isFetchingRef.current) {
        return;
      }

      if (!force && document.visibilityState === 'hidden') {
        return;
      }

      const requestSequence = requestSequenceRef.current + 1;
      requestSequenceRef.current = requestSequence;
      isFetchingRef.current = true;
      setIsLoading(true);

      try {
        const response = await fetch(
          getApiUrl(
            '/api/docks?date=' +
              encodeURIComponent(selectedDate)
          ),
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
          }
        );

        const data =
          await response.json() as SmartDockResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || 'ไม่สามารถดึงข้อมูลแผนงานได้'
          );
        }

        if (requestSequence !== requestSequenceRef.current) {
          return;
        }

        const rows = (data.result?.rows || []).filter(
          (row) =>
            DOCK_INDEX_BY_CODE[row.dock] !== undefined
        );
        const confirmedOperations: RuntimePendingOperation[] = [];
        const now = Date.now();

        pendingOperationsRef.current.forEach(
          (operation, codeRun) => {
            if (isOperationConfirmed(operation, rows)) {
              confirmedOperations.push(operation);
              pendingOperationsRef.current.delete(codeRun);
              return;
            }

            if (
              operation.phase === 'confirming' &&
              now - operation.createdAt >= CONFIRMATION_TIMEOUT_MS
            ) {
              operation.phase = 'error';
              operation.errorMessage = 'ยังยืนยันข้อมูลไม่ได้';
              operation.lastCheckedAt = now;
              pendingOperationsRef.current.set(
                codeRun,
                operation
              );
            }
          }
        );

        const serverDocks = convertPlansToDocks(rows);
        const mergedDocks = mergePendingOperations(
          serverDocks,
          pendingOperationsRef.current
        );

        commitPlans(rows);
        commitDocks(mergedDocks);
        setLastSync(new Date());
        setErrorMessage('');

        confirmedOperations.forEach((operation) => {
          showSuccessState(operation);
        });

        scheduleConfirmationCheck();
      } catch (error: unknown) {
        if (requestSequence !== requestSequenceRef.current) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'เกิดข้อผิดพลาดในการดึงข้อมูล';

        console.error('Fetch Smart Dock data error:', error);
        setErrorMessage(message);
      } finally {
        if (requestSequence === requestSequenceRef.current) {
          isFetchingRef.current = false;
          setIsLoading(false);
        }
      }
    },
    [
      commitDocks,
      commitPlans,
      isAuthenticated,
      scheduleConfirmationCheck,
      selectedDate,
      showSuccessState,
    ]
  );

  useEffect(() => {
    const handlePendingConfirmation = () => {
      void fetchDockData(true);
    };

    window.addEventListener(
      'sdms-confirm-pending',
      handlePendingConfirmation
    );

    return () => {
      window.removeEventListener(
        'sdms-confirm-pending',
        handlePendingConfirmation
      );
    };
  }, [fetchDockData]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    void fetchDockData(true);

    const refreshTimer = setInterval(() => {
      void fetchDockData();
    }, 30000);

    return () => {
      clearInterval(refreshTimer);
    };
  }, [fetchDockData, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const sessionTimer = setInterval(() => {
      if (!readStoredSession()) {
        setIsAuthenticated(false);
        commitPlans([]);
        commitDocks(createEmptyDocks());
      }
    }, 60000);

    return () => {
      clearInterval(sessionTimer);
    };
  }, [commitDocks, commitPlans, isAuthenticated]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        waitingForPhoneReturnRef.current
      ) {
        waitingForPhoneReturnRef.current = false;

        if (
          phoneWasFullscreenRef.current &&
          !document.fullscreenElement
        ) {
          setShowReturnFullscreen(true);
        }
      }
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange
    );

    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange
      );
    };
  }, []);

  useEffect(() => {
    return () => {
      if (confirmationTimerRef.current) {
        clearTimeout(confirmationTimerRef.current);
      }

      successTimersRef.current.forEach((timer) => {
        clearTimeout(timer);
      });
      successTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const clockTimer = setInterval(() => {
      setTime(new Date());

      commitDocks((currentDocks) =>
        currentDocks.map((dock) => {
          if (!dock.currentTruck) {
            return dock;
          }

          const elapsed = calculateElapsed(
            dock.currentTruck.startTime
          );

          return {
            ...dock,
            status:
              elapsed.elapsedMinutes >= 40
                ? 'delayed'
                : 'unloading',
            currentTruck: {
              ...dock.currentTruck,
              elapsedTime: elapsed.elapsedTime,
              progress: elapsed.progress,
            },
          };
        })
      );
    }, 1000);

    return () => {
      clearInterval(clockTimer);
    };
  }, [commitDocks, isAuthenticated]);

  const handleLogin = () => {
    saveSession();
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    pendingOperationsRef.current.clear();
    setShowReturnFullscreen(false);
    setIsAuthenticated(false);
    commitPlans([]);
    commitDocks(createEmptyDocks());
    setLastSync(null);
    setErrorMessage('');
  };

  const handleDateChange = (date: string) => {
    if (!date || date === selectedDate) {
      return;
    }

    if (pendingOperationsRef.current.size > 0) {
      setErrorMessage(
        'กรุณารอให้การบันทึกข้อมูลเสร็จก่อนเปลี่ยนวันที่'
      );
      return;
    }

    requestSequenceRef.current += 1;
    setSelectedDate(date);
    commitPlans([]);
    commitDocks(createEmptyDocks());
    setLastSync(null);
    setErrorMessage('');
  };

  const handlePhoneCall = (wasFullscreen: boolean) => {
    phoneWasFullscreenRef.current = wasFullscreen;
    waitingForPhoneReturnRef.current = true;
  };

  const returnToFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen({
        navigationUI: 'hide',
      });
      setShowReturnFullscreen(false);
      phoneWasFullscreenRef.current = false;
    } catch (error: unknown) {
      console.error('Return fullscreen error:', error);
      setErrorMessage('ไม่สามารถกลับเข้า Full Screen ได้');
    }
  };

  const handleEnterDock = async (
    dockId: string,
    truckId: string
  ) => {
    if (pendingOperationsRef.current.has(truckId)) {
      return;
    }

    const currentDocks = docksRef.current;
    const dockIndex = currentDocks.findIndex(
      (dock) => dock.id === dockId
    );

    if (dockIndex < 0) {
      return;
    }

    const selectedDock = currentDocks[dockIndex];

    if (
      selectedDock.currentTruck ||
      selectedDock.operationState?.status === 'saving' ||
      selectedDock.operationState?.status === 'confirming'
    ) {
      setErrorMessage('Dock นี้กำลังปฏิบัติงานอยู่');
      return;
    }

    const selectedTruck = selectedDock.waitingQueue.find(
      (truck) => truck.id === truckId
    );

    if (!selectedTruck) {
      setErrorMessage('ไม่พบข้อมูลรถในคิว');
      return;
    }

    const route = String(selectedTruck.route || '').trim();

    if (!route) {
      setErrorMessage('ไม่พบ Route ของรถรายการนี้');
      return;
    }

    const startTime = Date.now();
    const optimisticTruck: Truck = {
      id: selectedTruck.id,
      route,
      licensePlate: selectedTruck.licensePlate,
      driver: selectedTruck.driverName || 'ไม่มีข้อมูล',
      telDriver: selectedTruck.telDriver,
      transportCo: selectedTruck.company || 'ไม่มีข้อมูล',
      entryTime: new Date(startTime).toLocaleTimeString(
        'th-TH',
        {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }
      ),
      elapsedTime: '00:00:00',
      progress: 0,
      startTime,
    };
    const operation: RuntimePendingOperation = {
      codeRun: truckId,
      operation: 'START',
      dockId,
      dockCode: DOCK_CODES[dockIndex],
      route,
      createdAt: startTime,
      truck: { ...selectedTruck },
      currentTruck: null,
      phase: 'saving',
      optimisticTruck,
      lastCheckedAt: 0,
      errorMessage: '',
    };

    pendingOperationsRef.current.set(truckId, operation);
    clearSuccessTimer(dockId);
    setErrorMessage('');

    commitDocks((current) =>
      current.map((dock) => {
        if (dock.id !== dockId) {
          return {
            ...dock,
            waitingQueue: dock.waitingQueue.filter(
              (truck) => truck.id !== truckId
            ),
          };
        }

        return {
          ...dock,
          status: 'unloading',
          currentTruck: optimisticTruck,
          waitingQueue: dock.waitingQueue.filter(
            (truck) => truck.id !== truckId
          ),
          operationState: createOperationState(operation),
        };
      })
    );

    commitPlans((current) =>
      updatePlanStatus(
        current,
        truckId,
        'IN_PROGRESS',
        new Date(startTime).toISOString()
      )
    );

    try {
      const response = await fetch(
        getApiUrl('/api/smart-dock/start'),
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            codeRun: truckId,
            route,
            dock: DOCK_CODES[dockIndex],
          }),
        }
      );

      const data =
        await response.json() as SmartDockResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || 'ไม่สามารถเริ่มงานได้'
        );
      }

      const latestOperation =
        pendingOperationsRef.current.get(truckId);

      if (latestOperation) {
        latestOperation.phase = 'confirming';
        latestOperation.lastCheckedAt = Date.now();
        pendingOperationsRef.current.set(
          truckId,
          latestOperation
        );

        commitDocks((current) =>
          current.map((dock) =>
            dock.id === dockId
              ? {
                  ...dock,
                  operationState:
                    createOperationState(latestOperation),
                }
              : dock
          )
        );
      }

      setLastSync(new Date());
      scheduleConfirmationCheck();
    } catch (error: unknown) {
      pendingOperationsRef.current.delete(truckId);

      const message =
        error instanceof Error
          ? error.message
          : 'เกิดข้อผิดพลาดในการเริ่มงาน';

      commitDocks((current) =>
        current.map((dock) => {
          if (dock.id !== dockId) {
            return dock;
          }

          const waitingQueue = dock.waitingQueue.some(
            (truck) => truck.id === selectedTruck.id
          )
            ? dock.waitingQueue
            : [...dock.waitingQueue, selectedTruck].sort(
                (first, second) =>
                  first.eta.localeCompare(second.eta)
              );

          return {
            ...dock,
            status: 'empty',
            currentTruck:
              dock.currentTruck?.id === truckId
                ? null
                : dock.currentTruck,
            waitingQueue,
            operationState: {
              codeRun: truckId,
              operation: 'START',
              status: 'error',
              message: 'บันทึกไม่สำเร็จ',
              startedAt: Date.now(),
            },
          };
        })
      );

      commitPlans((current) =>
        current.map((plan) =>
          plan.codeRun === truckId
            ? {
                ...plan,
                status: 'WAITING',
                timeIn: '',
              }
            : plan
        )
      );

      setErrorMessage(message);
    }
  };

  const handleFinishOperation = async (dockId: string) => {
    const currentDock = docksRef.current.find(
      (dock) => dock.id === dockId
    );

    if (!currentDock?.currentTruck) {
      return;
    }

    if (
      currentDock.operationState?.status === 'saving' ||
      currentDock.operationState?.status === 'confirming'
    ) {
      return;
    }

    const currentTruck = { ...currentDock.currentTruck };

    if (pendingOperationsRef.current.has(currentTruck.id)) {
      return;
    }

    const dockIndex = docksRef.current.findIndex(
      (dock) => dock.id === dockId
    );
    const operation: RuntimePendingOperation = {
      codeRun: currentTruck.id,
      operation: 'COMPLETE',
      dockId,
      dockCode: DOCK_CODES[dockIndex] || '',
      route: currentTruck.route,
      createdAt: Date.now(),
      truck: null,
      currentTruck,
      phase: 'saving',
      optimisticTruck: null,
      lastCheckedAt: 0,
      errorMessage: '',
    };

    pendingOperationsRef.current.set(currentTruck.id, operation);
    clearSuccessTimer(dockId);
    setErrorMessage('');

    commitDocks((current) =>
      current.map((dock) =>
        dock.id === dockId
          ? {
              ...dock,
              status: 'empty',
              currentTruck: null,
              operationState: createOperationState(operation),
            }
          : dock
      )
    );

    commitPlans((current) =>
      updatePlanStatus(
        current,
        currentTruck.id,
        'COMPLETED',
        new Date().toISOString()
      )
    );

    try {
      const response = await fetch(
        getApiUrl('/api/smart-dock/complete'),
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            codeRun: currentTruck.id,
          }),
        }
      );

      const data =
        await response.json() as SmartDockResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || 'ไม่สามารถจบงานได้'
        );
      }

      const latestOperation =
        pendingOperationsRef.current.get(currentTruck.id);

      if (latestOperation) {
        latestOperation.phase = 'confirming';
        latestOperation.lastCheckedAt = Date.now();
        pendingOperationsRef.current.set(
          currentTruck.id,
          latestOperation
        );

        commitDocks((current) =>
          current.map((dock) =>
            dock.id === dockId
              ? {
                  ...dock,
                  operationState:
                    createOperationState(latestOperation),
                }
              : dock
          )
        );
      }

      setLastSync(new Date());
      scheduleConfirmationCheck();
    } catch (error: unknown) {
      pendingOperationsRef.current.delete(currentTruck.id);

      const message =
        error instanceof Error
          ? error.message
          : 'เกิดข้อผิดพลาดในการจบงาน';

      commitDocks((current) =>
        current.map((dock) =>
          dock.id === dockId
            ? {
                ...dock,
                status: 'unloading',
                currentTruck,
                operationState: {
                  codeRun: currentTruck.id,
                  operation: 'COMPLETE',
                  status: 'error',
                  message: 'บันทึกไม่สำเร็จ',
                  startedAt: Date.now(),
                },
              }
            : dock
        )
      );

      commitPlans((current) =>
        current.map((plan) =>
          plan.codeRun === currentTruck.id
            ? {
                ...plan,
                status: 'IN_PROGRESS',
                timeOut: '',
              }
            : plan
        )
      );

      setErrorMessage(message);
    }
  };

  const handleDragStart = (
    event: React.DragEvent,
    truckId: string,
    sourceDockId: string
  ) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      'application/json',
      JSON.stringify({
        truckId,
        sourceDockId,
      })
    );
  };

  const handleDrop = async (
    event: React.DragEvent,
    targetDockId: string
  ) => {
    event.preventDefault();

    try {
      const transferredData =
        event.dataTransfer.getData('application/json');

      if (!transferredData) {
        return;
      }

      const {
        truckId,
        sourceDockId,
      } = JSON.parse(transferredData) as {
        truckId: string;
        sourceDockId: string;
      };

      if (
        sourceDockId === targetDockId ||
        pendingOperationsRef.current.has(truckId)
      ) {
        return;
      }

      const sourceDockIndex = docksRef.current.findIndex(
        (dock) => dock.id === sourceDockId
      );
      const targetDockIndex = docksRef.current.findIndex(
        (dock) => dock.id === targetDockId
      );

      if (sourceDockIndex < 0 || targetDockIndex < 0) {
        return;
      }

      const sourceDock = docksRef.current[sourceDockIndex];
      const movedTruck = sourceDock.waitingQueue.find(
        (truck) => truck.id === truckId
      );

      if (!movedTruck) {
        return;
      }

      const sourceDockCode =
        movedTruck.dockCode || DOCK_CODES[sourceDockIndex];
      const targetDockCode = DOCK_CODES[targetDockIndex];
      const optimisticMovedTruck: WaitingTruck = {
        ...movedTruck,
        dockCode: targetDockCode,
        isMoved: true,
      };
      const operation: RuntimePendingOperation = {
        codeRun: truckId,
        operation: 'MOVE',
        dockId: targetDockId,
        dockCode: targetDockCode,
        route: movedTruck.route,
        createdAt: Date.now(),
        truck: optimisticMovedTruck,
        currentTruck: null,
        sourceDockId,
        sourceDockCode,
        targetDockId,
        targetDockCode,
        phase: 'saving',
        optimisticTruck: null,
        lastCheckedAt: 0,
        errorMessage: '',
      };

      pendingOperationsRef.current.set(truckId, operation);
      clearSuccessTimer(targetDockId);
      setErrorMessage('');

      commitDocks((current) => {
        const nextDocks = cloneDocks(current);

        nextDocks.forEach((dock) => {
          dock.waitingQueue = dock.waitingQueue.filter(
            (truck) => truck.id !== truckId
          );
        });

        nextDocks[targetDockIndex].waitingQueue.push(
          optimisticMovedTruck
        );
        nextDocks[targetDockIndex].waitingQueue.sort(
          (first, second) => first.eta.localeCompare(second.eta)
        );
        nextDocks[targetDockIndex].operationState =
          createOperationState(operation);

        return nextDocks;
      });

      commitPlans((current) =>
        current.map((plan) =>
          plan.codeRun === truckId
            ? {
                ...plan,
                dock: targetDockCode,
                dockName: `Dock ${targetDockIndex + 1}`,
              }
            : plan
        )
      );

      try {
        const response = await fetch(
          getApiUrl('/api/smart-dock/move'),
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              codeRun: truckId,
              sourceDock: sourceDockCode,
              targetDock: targetDockCode,
            }),
          }
        );

        const data =
          await response.json() as SmartDockResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || 'ไม่สามารถโยกช่องได้'
          );
        }

        const latestOperation =
          pendingOperationsRef.current.get(truckId);

        if (latestOperation) {
          latestOperation.phase = 'confirming';
          latestOperation.lastCheckedAt = Date.now();
          pendingOperationsRef.current.set(
            truckId,
            latestOperation
          );

          commitDocks((current) =>
            current.map((dock) =>
              dock.id === targetDockId
                ? {
                    ...dock,
                    operationState:
                      createOperationState(latestOperation),
                  }
                : dock
            )
          );
        }

        setLastSync(new Date());
        scheduleConfirmationCheck();
      } catch (error: unknown) {
        pendingOperationsRef.current.delete(truckId);

        const message =
          error instanceof Error
            ? error.message
            : 'เกิดข้อผิดพลาดในการโยกช่อง';

        commitDocks((current) => {
          const nextDocks = cloneDocks(current);

          nextDocks.forEach((dock) => {
            dock.waitingQueue = dock.waitingQueue.filter(
              (truck) => truck.id !== truckId
            );
          });

          nextDocks[sourceDockIndex].waitingQueue.push({
            ...movedTruck,
            dockCode: sourceDockCode,
            isMoved: false,
          });
          nextDocks[sourceDockIndex].waitingQueue.sort(
            (first, second) => first.eta.localeCompare(second.eta)
          );
          nextDocks[targetDockIndex].operationState = undefined;
          nextDocks[sourceDockIndex].operationState = {
            codeRun: truckId,
            operation: 'MOVE',
            status: 'error',
            message: 'บันทึกไม่สำเร็จ',
            startedAt: Date.now(),
          };

          return nextDocks;
        });

        commitPlans((current) =>
          current.map((plan) =>
            plan.codeRun === truckId
              ? {
                  ...plan,
                  dock: sourceDockCode,
                  dockName: `Dock ${sourceDockIndex + 1}`,
                }
              : plan
          )
        );

        setErrorMessage(message);
      }
    } catch (error) {
      console.error('Move queue error:', error);
      setErrorMessage('ไม่สามารถย้ายคิวรถได้');
    }
  };

  const activeDocks = docks.filter(
    (dock) => dock.currentTruck !== null
  ).length;

  const kpiData: KPIData = {
    totalTrucks: plans.filter(
      (plan) => plan.status !== 'COMPLETED'
    ).length,
    waitingTrucks: plans.filter(
      (plan) => plan.status === 'WAITING'
    ).length,
    activeDocks,
    emptyDocks: docks.length - activeDocks,
    delayedDocks: docks.filter(
      (dock) => dock.status === 'delayed'
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
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans overflow-hidden border-8 border-slate-200">
      <Header
        time={time}
        kpiData={kpiData}
        selectedDate={selectedDate}
        isRefreshing={isLoading}
        onDateChange={handleDateChange}
        onRefresh={() => {
          void fetchDockData(true);
        }}
        onLogout={handleLogout}
      />

      {errorMessage && (
        <div className="bg-red-600 text-white text-sm font-bold px-4 py-2 text-center">
          {errorMessage}
        </div>
      )}

      {isLoading && !lastSync && (
        <div className="bg-blue-600 text-white text-sm font-bold px-4 py-2 text-center">
          กำลังโหลดข้อมูลแผนงานวันที่ {selectedDate}
        </div>
      )}

      <main className="flex-1 grid grid-cols-6 divide-x divide-slate-300 bg-slate-200 overflow-hidden">
        {docks.map((dock) => (
          <DockColumn
            key={dock.id}
            dock={dock}
            time={time}
            onFinish={() =>
              handleFinishOperation(dock.id)
            }
            onEnterDock={(truckId) =>
              handleEnterDock(dock.id, truckId)
            }
            onDragStart={(event, truckId) =>
              handleDragStart(
                event,
                truckId,
                dock.id
              )
            }
            onDrop={(event) =>
              void handleDrop(event, dock.id)
            }
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onPhoneCall={handlePhoneCall}
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
          <span className="text-slate-600">|</span>
          <span>PLAN DATE: {selectedDate}</span>
          <span className="text-slate-600">|</span>
          <span>
            LAST SYNC:{' '}
            {lastSync
              ? lastSync.toLocaleTimeString(
                  'th-TH',
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  }
                )
              : 'WAITING'}
          </span>
        </div>

        <div className="flex items-center gap-6">
          <span>6 DOCKS ONLINE</span>
          <span>ZONE: A-WEST WAREHOUSE</span>
        </div>
      </footer>

      {showReturnFullscreen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-5">
              <span className="text-3xl font-black">⛶</span>
            </div>
            <h2 className="text-2xl font-black text-slate-800">
              กลับเข้า Full Screen
            </h2>
            <p className="text-sm text-slate-500 mt-2 mb-6">
              แตะปุ่มด้านล่างเพื่อกลับสู่หน้าจอแสดงผล
            </p>
            <button
              type="button"
              onClick={returnToFullscreen}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-lg py-4 rounded-xl shadow-lg transition-colors"
            >
              กลับเข้า Full Screen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
