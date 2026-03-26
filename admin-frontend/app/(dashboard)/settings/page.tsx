'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiSettingsForm } from "@/components/settings/AiSettingsForm";
import { StudioSettingsForm } from "@/components/settings/StudioSettingsForm";

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full w-full bg-slate-50 p-6 overflow-auto">
      <div className="mb-8 max-w-5xl w-full">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">System Settings</h1>
        <p className="text-sm font-medium text-slate-500 mt-1">Konfigurasi sistem admin, AI assistant, dan profil bisnis.</p>
      </div>

      <div className="max-w-5xl w-full pb-10">
        <Tabs defaultValue="ai" className="w-full flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 shrink-0">
            <TabsList className="flex flex-row md:flex-col h-auto bg-transparent p-0 space-y-2 w-full" aria-orientation="vertical">
              <TabsTrigger 
                value="ai" 
                className="w-full justify-start p-3 text-left data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700 rounded-lg border border-transparent data-[state=active]:border-slate-200 font-semibold"
              >
                🤖 AI Assistant
              </TabsTrigger>
              <TabsTrigger 
                value="studio" 
                className="w-full justify-start p-3 text-left data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700 rounded-lg border border-transparent data-[state=active]:border-slate-200 font-semibold"
              >
                🏭 Profil Studio
              </TabsTrigger>
              <TabsTrigger 
                value="team" 
                className="w-full justify-start p-3 text-left data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700 rounded-lg border border-transparent data-[state=active]:border-slate-200 font-semibold"
              >
                👥 Manajemen Tim
              </TabsTrigger>
            </TabsList>
          </div>
          
          <div className="flex-1 max-w-3xl">
            <TabsContent value="ai" className="m-0 border-0 p-0 focus-visible:outline-none">
              <AiSettingsForm />
            </TabsContent>
            
            <TabsContent value="studio" className="m-0 border-0 p-0 focus-visible:outline-none">
              <StudioSettingsForm />
            </TabsContent>
            
            <TabsContent value="team" className="m-0 border-0 p-0 focus-visible:outline-none">
              <div className="bg-white border rounded-xl p-12 text-center shadow-sm">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">🚧</div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Team Management</h3>
                <p className="text-slate-500 font-medium">Pengelolaan admin dan role akan tersedia di iterasi berikutnya.</p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
