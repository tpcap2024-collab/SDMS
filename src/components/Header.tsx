import React, {
  useEffect,
  useState,
} from 'react';
import {
  Bell,
  CalendarDays,
  LogOut,
  Maximize2,
  Minimize2,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Truck,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { KPIData } from '../types';

interface HeaderProps {
  time: Date;
  kpiData: KPIData;
  selectedDate: string;
  isRefreshing: boolean;
  onDateChange: (
    date: string
  ) => void;
  onRefresh: () => void;
  onLogout: () => void;
  displayScale: number;
  smartphoneMode: boolean;
  onScaleDecrease: () => void;
  onScaleIncrease: () => void;
  onScaleReset: () => void;
  onToggleSmartphoneMode: () => void;
}

export default function Header({
  time,
  kpiData,
  selectedDate,
  isRefreshing,
  onDateChange,
  onRefresh,
  onLogout,
  displayScale,
  smartphoneMode,
  onScaleDecrease,
  onScaleIncrease,
  onScaleReset,
  onToggleSmartphoneMode,
}: HeaderProps) {
  const [
    isFullscreen,
    setIsFullscreen,
  ] = useState(false);

  const [
    fullscreenError,
    setFullscreenError,
  ] = useState('');

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        Boolean(
          document.fullscreenElement
        )
      );

      setFullscreenError('');
    };

    document.addEventListener(
      'fullscreenchange',
      handleFullscreenChange
    );

    handleFullscreenChange();

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        handleFullscreenChange
      );
    };
  }, []);

  const formatDate = (
    date: Date
  ) => {
    return date.toLocaleDateString(
      'en-US',
      {
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }
    );
  };

  const formatTime = (
    date: Date
  ) => {
    return date.toLocaleTimeString(
      'en-US',
      {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }
    );
  };

  const toggleFullscreen = async () => {
    setFullscreenError('');

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await document.documentElement.requestFullscreen({
        navigationUI: 'hide',
      });
    } catch (error: unknown) {
      console.error(
        'Fullscreen error:',
        error
      );

      setFullscreenError(
        'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ Full Screen'
      );
    }
  };

  return (
    <header className="relative h-20 bg-white border-b border-slate-300 flex items-center justify-between px-4 shrink-0 shadow-sm gap-3">
      <div className="flex items-center gap-3 shrink-0">
        <div className="bg-emerald-600 p-2 rounded-lg">
          <Truck
            size={24}
            className="text-white"
          />
        </div>

        <div>
          <h1 className="font-black text-slate-800 text-lg uppercase leading-tight">
            Smart Dock
          </h1>

          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            Management System
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 border-x border-slate-200 px-4 h-full min-w-0">
        <div className="text-center">
          <p className="text-[9px] text-slate-400 font-bold uppercase">
            Total
          </p>

          <p className="text-lg font-bold text-slate-700">
            {kpiData.totalTrucks
              .toString()
              .padStart(2, '0')}
          </p>
        </div>

        <div className="text-center">
          <p className="text-[9px] text-slate-400 font-bold uppercase">
            Waiting
          </p>

          <p className="text-lg font-bold text-amber-600">
            {kpiData.waitingTrucks
              .toString()
              .padStart(2, '0')}
          </p>
        </div>

        <div className="text-center">
          <p className="text-[9px] text-slate-400 font-bold uppercase">
            Active
          </p>

          <p className="text-lg font-bold text-emerald-600">
            {kpiData.activeDocks
              .toString()
              .padStart(2, '0')}
          </p>
        </div>

        <div className="text-center">
          <p className="text-[9px] text-slate-400 font-bold uppercase">
            Idle
          </p>

          <p className="text-lg font-bold text-slate-400">
            {kpiData.emptyDocks
              .toString()
              .padStart(2, '0')}
          </p>
        </div>

        <div className="text-center">
          <p className="text-[9px] text-slate-400 font-bold uppercase">
            Delayed
          </p>

          <p className="text-lg font-bold text-rose-600">
            {kpiData.delayedDocks
              .toString()
              .padStart(2, '0')}
          </p>
        </div>

        <div className="text-center bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
          <p className="text-[9px] text-slate-400 font-bold uppercase">
            Util
          </p>

          <p className="text-lg font-bold text-emerald-700">
            {kpiData.utilization}%
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 shrink-0">
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-sm">
          <button
            type="button"
            onClick={onToggleSmartphoneMode}
            className={
              'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ' +
              (smartphoneMode
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-transparent bg-white text-slate-600 hover:bg-slate-100')
            }
            title={smartphoneMode ? 'ปิดโหมดสมาร์ตโฟน' : 'เปิดโหมดสมาร์ตโฟน'}
            aria-label={smartphoneMode ? 'ปิดโหมดสมาร์ตโฟน' : 'เปิดโหมดสมาร์ตโฟน'}
            aria-pressed={smartphoneMode}
          >
            <Smartphone size={20} strokeWidth={2.4} />
          </button>

          <button
            type="button"
            onClick={onScaleDecrease}
            disabled={displayScale <= 80}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
            title="ลดขนาดหน้าจอ"
            aria-label="ลดขนาดหน้าจอ"
          >
            <ZoomOut size={19} />
          </button>

          <button
            type="button"
            onClick={onScaleReset}
            className="flex h-9 min-w-[64px] items-center justify-center gap-1 rounded-lg bg-white px-2 text-sm font-black text-slate-700 hover:bg-slate-100"
            title="คืนขนาดหน้าจอเป็น 100%"
            aria-label="คืนขนาดหน้าจอเป็น 100%"
          >
            <RotateCcw size={15} />
            {displayScale}%
          </button>

          <button
            type="button"
            onClick={onScaleIncrease}
            disabled={displayScale >= 120}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
            title="เพิ่มขนาดหน้าจอ"
            aria-label="เพิ่มขนาดหน้าจอ"
          >
            <ZoomIn size={19} />
          </button>
        </div>

        <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
          <CalendarDays
            size={18}
            className="text-emerald-600 shrink-0"
          />

          <div className="flex flex-col">
            <span className="text-[9px] text-slate-400 font-bold uppercase leading-none mb-1">
              Plan Date
            </span>

            <input
              type="date"
              value={selectedDate}
              onChange={(event) =>
                onDateChange(
                  event.target.value
                )
              }
              disabled={isRefreshing}
              className={
                'bg-transparent text-xs font-bold text-slate-700 outline-none ' +
                (isRefreshing
                  ? 'cursor-wait opacity-60'
                  : 'cursor-pointer')
              }
              aria-label="เลือกวันที่แผนงาน"
            />
          </div>
        </label>

        <div className="text-right hidden xl:block min-w-[150px]">
          <p className="text-[11px] font-bold text-slate-800 whitespace-nowrap">
            {formatDate(time)}
          </p>

          <p className="text-base font-mono font-bold text-emerald-600">
            {formatTime(time)}
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className={
            'p-2.5 rounded-lg border transition-colors ' +
            (isRefreshing
              ? 'bg-blue-50 border-blue-200 text-blue-500 cursor-wait'
              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100')
          }
          title={
            isRefreshing
              ? 'กำลังรีเฟรชข้อมูล'
              : 'รีเฟรชข้อมูล'
          }
          aria-label={
            isRefreshing
              ? 'กำลังรีเฟรชข้อมูล'
              : 'รีเฟรชข้อมูล'
          }
        >
          <RefreshCw
            size={20}
            className={
              isRefreshing
                ? 'animate-spin'
                : ''
            }
          />
        </button>

        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-2.5 hover:bg-slate-100 rounded-lg text-slate-500 border border-slate-200 transition-colors"
          title={
            isFullscreen
              ? 'ออกจาก Full Screen'
              : 'เปิด Full Screen'
          }
          aria-label={
            isFullscreen
              ? 'ออกจาก Full Screen'
              : 'เปิด Full Screen'
          }
        >
          {isFullscreen ? (
            <Minimize2 size={20} />
          ) : (
            <Maximize2 size={20} />
          )}
        </button>

        <button
          type="button"
          className="p-2.5 hover:bg-slate-100 rounded-lg text-slate-400 relative transition-colors"
          aria-label="การแจ้งเตือน"
          title="การแจ้งเตือน"
        >
          <Bell size={20} />

          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
        </button>

        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-emerald-500">
          <span className="text-emerald-700 font-bold text-sm uppercase">
            OP
          </span>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="p-2.5 hover:bg-rose-50 rounded-lg text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition-colors"
          title="ออกจากระบบ"
          aria-label="ออกจากระบบ"
        >
          <LogOut size={20} />
        </button>
      </div>

      {fullscreenError && (
        <div className="absolute right-4 top-full mt-1 z-50 bg-rose-600 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-lg">
          {fullscreenError}
        </div>
      )}
    </header>
  );
}
