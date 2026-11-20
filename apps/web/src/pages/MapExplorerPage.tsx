import React from 'react';
import { MapHeaderBar } from '../components/map/MapHeaderBar';
import { LayerControlSidebar } from '../components/map/LayerControlSidebar';
import { CbmsMapCanvas } from '../components/map/CbmsMapCanvas';

export const MapExplorerPage: React.FC = () => {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-100">
      <MapHeaderBar />
      <div className="flex flex-1 overflow-hidden">
        <LayerControlSidebar />
        <main className="flex-1">
          <CbmsMapCanvas />
        </main>
      </div>
    </div>
  );
};
