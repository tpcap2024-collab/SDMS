export type DockStatus = 'unloading' | 'waiting' | 'empty' | 'preparing' | 'delayed';

export interface Truck {
  id?: string;
  route: string;
  licensePlate: string;
  driver: string;
  transportCo: string;
  entryTime: string;
  elapsedTime: string;
  progress: number;
  startTime?: number;
}

export interface WaitingTruck {
  id: string;
  route: string;
  licensePlate: string;
  eta: string;
  isMoved?: boolean;
}

export interface DockData {
  id: string;
  name: string;
  status: DockStatus;
  currentTruck: Truck | null;
  waitingQueue: WaitingTruck[];
}

export interface KPIData {
  totalTrucks: number;
  waitingTrucks: number;
  activeDocks: number;
  emptyDocks: number;
  delayedDocks: number;
  utilization: number;
}
