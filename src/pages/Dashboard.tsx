import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { modules, mockUserPermissions } from '@/data/modules';
import { useRecentModules } from '@/hooks/useRecentModules';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { SearchBar } from '@/components/dashboard/SearchBar';
import { RecentModules } from '@/components/dashboard/RecentModules';
import { ModuleCard } from '@/components/dashboard/ModuleCard';

export default function Dashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const { recentIds, addRecent } = useRecentModules();

  // Filter modules based on user permissions
  const accessibleModules = useMemo(() => {
    return modules.filter((module) =>
      module.requiredPermissions.every((perm) =>
        mockUserPermissions.modules.includes(perm)
      )
    );
  }, []);

  // Filter by search query
  const filteredModules = useMemo(() => {
    if (!searchQuery.trim()) return accessibleModules;
    const query = searchQuery.toLowerCase();
    return accessibleModules.filter(
      (module) =>
        module.title.toLowerCase().includes(query) ||
        module.description.toLowerCase().includes(query)
    );
  }, [accessibleModules, searchQuery]);

  // Get recent modules
  const recentModules = useMemo(() => {
    return recentIds
      .map((id) => accessibleModules.find((m) => m.id === id))
      .filter((m) => m && m.status === 'active') as typeof modules;
  }, [recentIds, accessibleModules]);

  const handleEnterModule = (moduleId: string) => {
    addRecent(moduleId);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/[0.02] via-transparent to-primary/[0.02] pointer-events-none" />
      
      <div className="relative z-10 container max-w-6xl mx-auto px-4 py-12">
        <DashboardHeader />

        <div className="mb-8">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        </div>

        {!searchQuery && (
          <RecentModules modules={recentModules} onEnter={handleEnterModule} />
        )}

        {/* Modules Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {searchQuery ? 'Resultados' : 'Todos los módulos'}
            </h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {filteredModules.length}
            </span>
          </div>

          {filteredModules.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No se encontraron módulos con "{searchQuery}"
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredModules.map((module, index) => (
                <ModuleCard
                  key={module.id}
                  module={module}
                  onEnter={handleEnterModule}
                  index={index}
                />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
