import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden" style={{ background: '#06142a' }}>
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden relative flex flex-col bg-white">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
