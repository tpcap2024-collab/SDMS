import { DockData, KPIData } from './types';

export const mockDocks: DockData[] = [
  {
    id: 'dock-1',
    name: 'Dock 1',
    status: 'unloading',
    currentTruck: {
      id: 'mock-1',
      route: 'TD01-A',
      licensePlate: '71-1234',
      driver: 'สมชาย ใจดี',
      transportCo: 'TPCAP',
      entryTime: '10:00',
      elapsedTime: '00:15:00',
      progress: 45,
      startTime: Date.now() - 15 * 60000,
    },
    waitingQueue: [
      { id: 'q1-1', route: 'TD01-B', licensePlate: '72-4463', eta: '10:30' },
      { id: 'q1-2', route: 'TD01-C', licensePlate: '71-9988', eta: '10:45' },
    ],
  },
  {
    id: 'dock-2',
    name: 'Dock 2',
    status: 'delayed',
    currentTruck: {
      id: 'mock-2',
      route: 'TD02-A',
      licensePlate: '81-5566',
      driver: 'วิชาญ มั่นคง',
      transportCo: 'BKK Trans',
      entryTime: '09:15',
      elapsedTime: '01:05:00',
      progress: 80,
      startTime: Date.now() - 65 * 60000,
    },
    waitingQueue: [
      { id: 'q2-1', route: 'TD02-B', licensePlate: '61-3321', eta: '10:40' },
      { id: 'q2-2', route: 'TD02-C', licensePlate: '62-1122', eta: '11:00' },
      { id: 'q2-3', route: 'TD02-D', licensePlate: '63-4455', eta: '11:30' },
      { id: 'q2-4', route: 'TD02-E', licensePlate: '64-7788', eta: '12:00' },
    ],
  },
  {
    id: 'dock-3',
    name: 'Dock 3',
    status: 'empty',
    currentTruck: null,
    waitingQueue: [],
  },
  {
    id: 'dock-4',
    name: 'Dock 4',
    status: 'preparing',
    currentTruck: null,
    waitingQueue: [
      { id: 'q4-1', route: 'TD04-A', licensePlate: '75-6677', eta: '10:20' },
      { id: 'q4-2', route: 'TD04-B', licensePlate: '76-8899', eta: '10:50' },
    ],
  },
  {
    id: 'dock-5',
    name: 'Dock 5',
    status: 'waiting',
    currentTruck: null,
    waitingQueue: [
      { id: 'q5-1', route: 'TD05-A', licensePlate: '82-1010', eta: '10:25' },
    ],
  },
  {
    id: 'dock-6',
    name: 'Dock 6',
    status: 'unloading',
    currentTruck: {
      id: 'mock-6',
      route: 'TD06-B',
      licensePlate: '71-1284',
      driver: 'สมศักดิ์ รวดเร็ว',
      transportCo: 'TPCAP',
      entryTime: '09:50',
      elapsedTime: '00:20:00',
      progress: 60,
      startTime: Date.now() - 20 * 60000,
    },
    waitingQueue: [
      { id: 'q6-1', route: 'TD06-C', licensePlate: '77-1111', eta: '10:45' },
      { id: 'q6-2', route: 'TD06-D', licensePlate: '78-2222', eta: '11:15' },
      { id: 'q6-3', route: 'TD06-E', licensePlate: '79-3333', eta: '11:45' },
    ],
  },
];

export const mockKPIs: KPIData = {
  totalTrucks: 24,
  waitingTrucks: 12,
  activeDocks: 3,
  emptyDocks: 1,
  delayedDocks: 1,
  utilization: 83,
};
