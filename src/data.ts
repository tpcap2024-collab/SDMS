import {
  DockData,
  KPIData,
} from './types';

export const mockDocks: DockData[] =
  Array.from(
    {
      length: 6,
    },
    (_, index) => ({
      id:
        'dock-' +
        String(index + 1),
      name:
        'Dock ' +
        String(index + 1),
      status: 'empty',
      currentTruck: null,
      waitingQueue: [],
    })
  );

export const mockKPIs: KPIData = {
  totalTrucks: 0,
  waitingTrucks: 0,
  activeDocks: 0,
  emptyDocks: 6,
  delayedDocks: 0,
  utilization: 0,
};
