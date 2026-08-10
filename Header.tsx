import React from 'react';
import { Bell, Truck } from 'lucide-react';
import { KPIData } from '../types';

interface HeaderProps {
  time: Date;
  kpiData: KPIData;
}

export default function Header({ time, kpiData }: HeaderProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  return (
    <header className="h-16 bg-white border-b border-slate-300 flex items-center justify-between px-6 shrink-0 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="bg-emerald-600 p-2 rounded-lg">
          <Truck size={24} className="text-white" />
        </div>
        <div>
          <h1 className="font-black text-slate-800 text-lg uppercase leading-tight">Smart Dock</h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Management System</p>
        </div>
      </div>

      {/* MINI KPI SUMMARY */}
      <div className="flex items-center gap-6 border-x border-slate-200 px-8 h-full">
        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Total Trucks</p>
          <p className="text-lg font-bold text-slate-700">{kpiData.totalTrucks.toString().padStart(2, '0')}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Waiting</p>
          <p className="text-lg font-bold text-amber-600">{kpiData.waitingTrucks.toString().padStart(2, '0')}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Inbound</p>
          <p className="text-lg font-bold text-emerald-600">{kpiData.activeDocks.toString().padStart(2, '0')}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Idle</p>
          <p className="text-lg font-bold text-slate-400">{kpiData.emptyDocks.toString().padStart(2, '0')}</p>
        </div>
        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Delayed</p>
          <p className="text-lg font-bold text-rose-600">{kpiData.delayedDocks.toString().padStart(2, '0')}</p>
        </div>
        <div className="text-center bg-slate-50 px-3 py-1 rounded-md border border-slate-100">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Util</p>
          <p className="text-lg font-bold text-emerald-700">{kpiData.utilization}%</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-xs font-bold text-slate-800">{formatDate(time)}</p>
          <p className="text-lg font-mono font-bold text-emerald-600">{formatTime(time)}</p>
        </div>
        <div className="flex gap-2 items-center">
          <button className="p-2 hover:bg-slate-100 rounded-full text-slate-400 relative">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full"></span>
          </button>
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center border-2 border-emerald-500">
            <span className="text-emerald-700 font-bold text-sm uppercase">OP</span>
          </div>
        </div>
      </div>
    </header>
  );
}
