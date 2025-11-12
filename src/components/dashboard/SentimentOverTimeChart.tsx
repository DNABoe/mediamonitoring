import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { TrendingUp } from "lucide-react";
interface SentimentDataPoint {
  date: string;
  [key: string]: number | string; // Dynamic keys for each fighter
}
interface SentimentOverTimeChartProps {
  activeCompetitors: string[];
  data: SentimentDataPoint[];
}
const COLORS = {
  'Gripen': '#3b82f6',
  // blue
  'F-35': '#ef4444',
  // red
  'F-16': '#10b981',
  // green
  'Eurofighter': '#f59e0b',
  // amber
  'Rafale': '#8b5cf6',
  // purple
  'F-18': '#ec4899' // pink
};
export const SentimentOverTimeChart = ({
  activeCompetitors,
  data
}: SentimentOverTimeChartProps) => {
  const fighters = ['Gripen', ...activeCompetitors];
  const formatYAxis = (value: number) => {
    return `${(value * 100).toFixed(0)}%`;
  };
  const formatTooltip = (value: any) => {
    if (typeof value === 'number') {
      return `${(value * 100).toFixed(1)}%`;
    }
    return value;
  };
  return;
};