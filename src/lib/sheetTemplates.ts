import { Table2, LayoutTemplate, FileSpreadsheet, ListTodo, DollarSign, BarChart2 } from "lucide-react";

export interface SheetTemplate {
  id: string;
  name: string;
  description: string;
  icon: typeof Table2;
  title: string;
  columns: { name: string; type: string }[];
  rows: string[][];
  formats?: Record<string, { b?: boolean; i?: boolean; tc?: string; bg?: string }>;
}

// Helper: build header-row format object for N columns with a given bg color
function _hdrFmt(numCols: number, bg: string, tc = "#ffffff"): Record<string, { b: boolean; bg: string; tc: string }> {
  const f: Record<string, { b: boolean; bg: string; tc: string }> = {};
  for (let c = 0; c < numCols; c++) f[`0,${c}`] = { b: true, bg, tc };
  return f;
}

export const SHEET_TEMPLATES: SheetTemplate[] = [
  {
    id: "blank",
    name: "Blank",
    description: "Empty sheet, start from scratch",
    icon: Table2,
    title: "Untitled Sheet",
    columns: [],
    rows: [],
  },
  {
    id: "grid",
    name: "Grid",
    description: "Columns A–K with 50 empty rows, ready for data",
    icon: LayoutTemplate,
    title: "Sheet 1",
    columns: [
      { name: "A", type: "text" },
      { name: "B", type: "text" },
      { name: "C", type: "text" },
      { name: "D", type: "text" },
      { name: "E", type: "text" },
      { name: "F", type: "text" },
      { name: "G", type: "text" },
      { name: "H", type: "text" },
      { name: "I", type: "text" },
      { name: "J", type: "text" },
      { name: "K", type: "text" },
    ],
    rows: Array.from({ length: 50 }, () => ["", "", "", "", "", "", "", "", "", "", ""]),
    formats: _hdrFmt(11, "#64748b"),
  },
  {
    id: "crm",
    name: "Simple CRM",
    description: "Track contacts, deals and pipeline",
    icon: FileSpreadsheet,
    title: "CRM",
    columns: [
      { name: "Name", type: "text" },
      { name: "Company", type: "text" },
      { name: "Email", type: "text" },
      { name: "Phone", type: "text" },
      { name: "Stage", type: "text" },
      { name: "Value ($)", type: "number" },
      { name: "Last Contact", type: "date" },
      { name: "Notes", type: "text" },
    ],
    rows: [
      ["Jane Cooper", "Acme Corp", "jane@acme.com", "+1 555-0101", "Qualified", "12000", "2026-02-10", "Interested in enterprise plan"],
      ["John Smith", "TechFlow", "john@techflow.io", "+1 555-0102", "Proposal", "8500", "2026-02-15", "Waiting for sign-off"],
      ["Emily Davis", "Bright Ideas", "emily@bright.co", "+1 555-0103", "Lead", "5000", "2026-02-18", "Follow up after demo"],
      ["Carlos Ruiz", "NovaSoft", "carlos@novasoft.com", "+1 555-0104", "Customer", "22000", "2026-01-30", "Renewed annually"],
      ["Mia Chen", "Spark Labs", "mia@sparklabs.dev", "+1 555-0105", "Proposal", "9750", "2026-02-20", "Send contract draft"],
      ["Tom Walsh", "GlobalTrade", "tom@globaltrade.net", "+1 555-0106", "Qualified", "15000", "2026-02-12", "Budget approved Q2"],
      ["Sara Kim", "BlueWave", "sara@bluewave.io", "+1 555-0107", "Lead", "3200", "2026-02-22", "Intro call scheduled"],
    ],
    formats: _hdrFmt(8, "#0ea5e9"),
  },
  {
    id: "tasks",
    name: "Task List",
    description: "Manage tasks, priorities and deadlines",
    icon: ListTodo,
    title: "Tasks",
    columns: [
      { name: "Task", type: "text" },
      { name: "Project", type: "text" },
      { name: "Assignee", type: "text" },
      { name: "Priority", type: "text" },
      { name: "Status", type: "text" },
      { name: "Due Date", type: "date" },
      { name: "Done", type: "boolean" },
    ],
    rows: [
      ["Design landing page mockups", "Website Redesign", "Alice", "High", "In Progress", "2026-03-05", "false"],
      ["Write onboarding copy", "Website Redesign", "Bob", "Medium", "Todo", "2026-03-10", "false"],
      ["Set up CI/CD pipeline", "DevOps", "Alice", "High", "Done", "2026-02-28", "true"],
      ["Code review — auth module", "Backend", "Carlos", "Medium", "In Progress", "2026-03-03", "false"],
      ["Update API documentation", "Backend", "Bob", "Low", "Todo", "2026-03-15", "false"],
      ["User testing session", "Website Redesign", "Alice", "High", "Todo", "2026-03-08", "false"],
      ["Deploy staging environment", "DevOps", "Carlos", "High", "Done", "2026-02-25", "true"],
      ["Quarterly budget review", "Finance", "Bob", "Medium", "Todo", "2026-03-20", "false"],
    ],
    formats: _hdrFmt(7, "#8b5cf6"),
  },
  {
    id: "budget",
    name: "Budget",
    description: "Monthly income and expense tracker",
    icon: DollarSign,
    title: "Monthly Budget",
    columns: [
      { name: "Category", type: "text" },
      { name: "Type", type: "text" },
      { name: "Planned ($)", type: "number" },
      { name: "Actual ($)", type: "number" },
      { name: "Difference ($)", type: "number" },
      { name: "Notes", type: "text" },
    ],
    rows: [
      ["Salary", "Income", "5500", "5500", "0", ""],
      ["Freelance", "Income", "800", "1050", "250", "Extra design project"],
      ["Side business", "Income", "300", "420", "120", "Etsy store"],
      ["Rent", "Expense", "1400", "1400", "0", ""],
      ["Groceries", "Expense", "450", "390", "-60", "Meal prepped more"],
      ["Utilities", "Expense", "160", "175", "15", "Heating up in winter"],
      ["Internet & Phone", "Expense", "80", "80", "0", ""],
      ["Transport", "Expense", "120", "95", "-25", "WFH more this month"],
      ["Health & Gym", "Expense", "60", "60", "0", ""],
      ["Entertainment", "Expense", "150", "210", "60", "Concert + dinner"],
      ["Clothing", "Expense", "100", "0", "-100", "Skipped this month"],
      ["Savings", "Expense", "600", "600", "0", "Emergency fund"],
      ["Investments", "Expense", "400", "400", "0", "ETF auto-invest"],
    ],
    formats: {
      ...(() => {
        const f: Record<string, { b: boolean; bg: string; tc: string }> = {};
        for (let c = 0; c < 6; c++) f[`0,${c}`] = { b: true, bg: "#10b981", tc: "#ffffff" };
        return f;
      })(),
      "1,1": { b: false, bg: "#d1fae5", tc: "#065f46" },
      "2,1": { b: false, bg: "#d1fae5", tc: "#065f46" },
      "3,1": { b: false, bg: "#d1fae5", tc: "#065f46" },
    },
  },
  {
    id: "weekly-planner",
    name: "Weekly Planner",
    description: "Plan your week hour by hour",
    icon: BarChart2,
    title: "Weekly Planner",
    columns: [
      { name: "Time", type: "text" },
      { name: "Monday", type: "text" },
      { name: "Tuesday", type: "text" },
      { name: "Wednesday", type: "text" },
      { name: "Thursday", type: "text" },
      { name: "Friday", type: "text" },
      { name: "Weekend", type: "text" },
    ],
    rows: [
      ["08:00", "Morning standup", "Morning standup", "Morning standup", "Morning standup", "Morning standup", ""],
      ["09:00", "", "", "", "", "", ""],
      ["10:00", "", "Team sync", "", "1:1 with manager", "", ""],
      ["11:00", "", "", "", "", "", ""],
      ["12:00", "Lunch", "Lunch", "Lunch", "Lunch", "Lunch", ""],
      ["13:00", "", "", "", "", "", ""],
      ["14:00", "Deep work", "Deep work", "Deep work", "Deep work", "Deep work", ""],
      ["15:00", "", "", "", "", "", ""],
      ["16:00", "", "Sprint planning", "", "", "Retrospective", ""],
      ["17:00", "EOD wrap-up", "EOD wrap-up", "EOD wrap-up", "EOD wrap-up", "EOD wrap-up", ""],
      ["18:00", "", "", "", "", "", "Personal time"],
      ["19:00", "", "", "", "", "", ""],
    ],
    formats: {
      ...(() => {
        const f: Record<string, { b: boolean; bg: string; tc: string }> = {};
        for (let c = 0; c < 7; c++) f[`0,${c}`] = { b: true, bg: "#f59e0b", tc: "#ffffff" };
        // highlight lunch row (row 4)
        for (let c = 1; c < 7; c++) f[`4,${c}`] = { b: false, bg: "#fef3c7", tc: "#78350f" };
        return f;
      })(),
    },
  },
  {
    id: "inventory",
    name: "Inventory",
    description: "Track stock levels and reorder points",
    icon: LayoutTemplate,
    title: "Inventory",
    columns: [
      { name: "Item", type: "text" },
      { name: "SKU", type: "text" },
      { name: "Category", type: "text" },
      { name: "In Stock", type: "number" },
      { name: "Reorder At", type: "number" },
      { name: "Unit Price ($)", type: "number" },
      { name: "Supplier", type: "text" },
      { name: "Last Restocked", type: "date" },
    ],
    rows: [
      ["Wireless Mouse", "WM-001", "Electronics", "45", "10", "29.99", "TechSupply Co.", "2026-01-15"],
      ["USB-C Hub", "UCH-003", "Electronics", "12", "5", "49.99", "TechSupply Co.", "2026-02-01"],
      ["Notebook A5", "NB-A5", "Stationery", "200", "50", "4.50", "OfficeWorld", "2026-01-20"],
      ["Ballpoint Pens (box)", "PEN-BP-12", "Stationery", "80", "20", "6.99", "OfficeWorld", "2026-01-20"],
      ["Standing Desk Mat", "SDM-L", "Furniture", "8", "3", "89.00", "ErgoCo.", "2025-12-10"],
      ["Monitor Stand", "MS-ADJ", "Furniture", "6", "2", "59.00", "ErgoCo.", "2026-01-05"],
      ["Coffee Beans 1kg", "COF-1K", "Pantry", "15", "5", "18.00", "LocalRoast", "2026-02-10"],
      ["Printer Paper A4", "PP-A4-500", "Stationery", "30", "10", "9.50", "OfficeWorld", "2026-01-25"],
    ],
    formats: _hdrFmt(8, "#ef4444"),
  },
];
