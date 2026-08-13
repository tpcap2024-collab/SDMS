export type DockStatus =
  | 'unloading'
  | 'waiting'
  | 'empty'
  | 'preparing'
  | 'delayed';

export type DockOperationType =
  | 'START'
  | 'COMPLETE';

export type DockOperationStatus =
  | 'idle'
  | 'saving'
  | 'confirming'
  | 'success'
  | 'error';

export interface Truck {
  id: string;
  route: string;
  licensePlate: string;
  driver: string;
  telDriver: string;
  transportCo: string;
  entryTime: string;
  elapsedTime: string;
  progress: number;
  startTime: number;
}

export interface WaitingTruck {
  id: string;
  route: string;
  licensePlate: string;
  eta: string;
  driverName: string;
  telDriver: string;
  company: string;
  project: string;
  dockCode: string;
  isMoved?: boolean;
}

export interface DockOperationState {
  codeRun: string;
  operation: DockOperationType;
  status: DockOperationStatus;
  message: string;
  startedAt: number;
}

export interface PendingDockOperation {
  codeRun: string;
  operation: DockOperationType;
  dockId: string;
  dockCode: string;
  route: string;
  createdAt: number;
  truck: WaitingTruck | null;
  currentTruck: Truck | null;
}

export interface DockData {
  id: string;
  name: string;
  status: DockStatus;
  currentTruck: Truck | null;
  waitingQueue: WaitingTruck[];
  operationState?: DockOperationState;
}

export interface KPIData {
  totalTrucks: number;
  waitingTrucks: number;
  activeDocks: number;
  emptyDocks: number;
  delayedDocks: number;
  utilization: number;
}
`
