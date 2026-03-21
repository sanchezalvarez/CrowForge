import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { FileText, Table, MessageSquare, Plus, Clock } from "lucide-react";
import axios from "axios";

const API_BASE = "http://localhost:8000";

interface RecentItem {
  id: string;
  title: string;
}

interface DashboardData {
  recent_documents: RecentItem[];
  recent_sheets: RecentItem[];
}

interface DashboardPageProps {
  onNavigate: (page: any, id?: string) => void;
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData>({
    recent_documents: [],
    recent_sheets: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await axios.get(`${API_BASE}/dashboard`);
        setData(res.data);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  const quickActions = [
    {
      title: "New Chat",
      icon: <MessageSquare className="w-5 h-5" />,
      onClick: async () => {
        try {
          const res = await axios.post(`${API_BASE}/chat/session`);
          onNavigate("chat", res.data.id);
        } catch (err) {
          console.error(err);
        }
      },
      color: "bg-blue-500/10 text-blue-500",
    },
    {
      title: "New Document",
      icon: <FileText className="w-5 h-5" />,
      onClick: async () => {
        try {
          const res = await axios.post(`${API_BASE}/documents`, { title: "Untitled Document" });
          onNavigate("documents", res.data.id);
        } catch (err) {
          console.error(err);
        }
      },
      color: "bg-purple-500/10 text-purple-500",
    },
    {
      title: "New Sheet",
      icon: <Table className="w-5 h-5" />,
      onClick: async () => {
        try {
          const res = await axios.post(`${API_BASE}/sheets`, { title: "Untitled Sheet", columns: [{ name: "Column 1", type: "text" }] });
          onNavigate("sheets", res.data.id);
        } catch (err) {
          console.error(err);
        }
      },
      color: "bg-green-500/10 text-green-500",
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to CrowForge</h1>
        <p className="text-muted-foreground">
          Your local-first AI workspace. What would you like to build today?
        </p>
      </header>

      {/* Quick Actions */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <Button
            key={action.title}
            variant="outline"
            className="h-24 flex flex-col items-center justify-center gap-2 hover:border-primary transition-all group"
            onClick={action.onClick}
          >
            <div className={`p-2 rounded-full ${action.color} group-hover:scale-110 transition-transform`}>
              {action.icon}
            </div>
            <span className="font-medium">{action.title}</span>
          </Button>
        ))}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Recent Documents */}
        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Recent Documents
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("documents")}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
            ) : data.recent_documents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No documents yet.</p>
            ) : (
              <div className="space-y-1">
                {data.recent_documents.map((doc) => (
                  <Button
                    key={doc.id}
                    variant="ghost"
                    className="w-full justify-start font-normal h-10 px-2"
                    onClick={() => onNavigate("documents", doc.id)}
                  >
                    <FileText className="mr-2 h-4 w-4 text-purple-500" />
                    <span className="truncate">{doc.title}</span>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Sheets */}
        <Card className="shadow-sm border-muted">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Recent Sheets
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("sheets")}>
              View All
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
            ) : data.recent_sheets.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No sheets yet.</p>
            ) : (
              <div className="space-y-1">
                {data.recent_sheets.map((sheet) => (
                  <Button
                    key={sheet.id}
                    variant="ghost"
                    className="w-full justify-start font-normal h-10 px-2"
                    onClick={() => onNavigate("sheets", sheet.id)}
                  >
                    <Table className="mr-2 h-4 w-4 text-green-500" />
                    <span className="truncate">{sheet.title}</span>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Getting Started Tip */}
      <div className="bg-primary/5 border border-primary/10 rounded-lg p-6 flex gap-4 items-start">
        <div className="bg-primary/10 p-2 rounded-full text-primary">
          <Plus className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-primary">Pro Tip</h3>
          <p className="text-sm text-muted-foreground mt-1">
            You can use the <strong>AI Agent</strong> in Chat mode to automatically fill out your spreadsheets or write complex documents by simply describing what you want. Try attaching a document as context!
          </p>
        </div>
      </div>
    </div>
  );
}
